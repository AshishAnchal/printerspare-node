'use strict';
const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const settings = require('../settings');
const cart = require('../cart');
const orders = require('../orders');
const L = require('../lib');

const r = express.Router();
const keys = () => ({ id: settings.get('razorpay_key_id'), secret: settings.get('razorpay_key_secret') });
const onlineAvailable = () => settings.get('online_enabled') && keys().id && keys().secret;

function readForm(b) {
  const f = {};
  for (const k of ['name', 'email', 'phone', 'address', 'city', 'state', 'pincode', 'notes']) f[k] = String(b[k] || '').trim();
  f.method = b.payment_method === 'online' ? 'online' : 'cod';
  f.phone = f.phone.replace(/[^\d+]/g, '');
  f.pincode = f.pincode.replace(/\D/g, '');
  return f;
}
function validate(f, t) {
  const e = [];
  if (f.name.length < 2) e.push('Please enter your full name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) e.push('Please enter a valid email.');
  if (f.phone.replace(/\D/g, '').length < 10) e.push('Please enter a valid 10-digit phone number.');
  if (f.address.length < 5) e.push('Please enter your full address.');
  if (!f.city) e.push('City is required.');
  if (!f.state) e.push('Please select your state.');
  if (!/^\d{6}$/.test(f.pincode)) e.push('Please enter a valid 6-digit pincode.');
  if (f.method === 'cod') {
    const S = settings.all();
    if (!S.cod_enabled) e.push('Cash on Delivery is not available right now.');
    if (S.cod_min_order > 0 && t.total < S.cod_min_order) e.push(`Cash on Delivery needs an order of at least ${L.money0(S.cod_min_order)}.`);
    if (S.cod_max_order > 0 && t.total > S.cod_max_order) e.push(`Cash on Delivery is only available up to ${L.money0(S.cod_max_order)}. Please pay online.`);
  } else if (!onlineAvailable()) e.push('Online payment is not available right now.');
  if (!settings.get('guest_checkout')) { /* handled before */ }
  return e;
}

function guard(req, res, next) {
  if (!settings.get('guest_checkout') && !req.session.userId) { req.session.returnTo = '/checkout'; req.flash('error', 'Please log in or register to checkout.'); return res.redirect('/login'); }
  if (!cart.count(req)) { req.flash('error', 'Your cart is empty.'); return res.redirect('/cart'); }
  next();
}

r.get('/checkout', guard, (req, res) => {
  const u = req.session.userId ? db.get('SELECT * FROM users WHERE id=?', req.session.userId) : null;
  const form = { name: u?.name || '', email: u?.email || '', phone: u?.phone || '', address: u?.address || '', city: u?.city || '', state: u?.state || '', pincode: u?.pincode || '', notes: '', method: settings.get('cod_enabled') ? 'cod' : 'online' };
  const t = cart.totals(req, { pincode: form.pincode, state: form.state, method: form.method });
  res.render('pages/checkout', { t, form, errors: [], online: !!onlineAvailable(), pageTitle: 'Checkout' });
});

// live price breakdown for the checkout summary
r.get('/checkout/quote', (req, res) => {
  const t = cart.totals(req, { pincode: String(req.query.pincode || ''), state: String(req.query.state || ''), city: String(req.query.city || ''), method: req.query.method === 'online' ? 'online' : 'cod' });
  res.json({ subtotal: t.subtotal, discount: t.discount, gst: t.gst, gstMode: t.gstMode, shipping: t.shipping, freeShip: t.freeShip, codFee: t.codFee, total: t.total, zone: t.zone.zone, days: t.zone.label });
});

// 1) create Razorpay order for the *server-computed* total
r.post('/checkout/razorpay-order', guard, async (req, res) => {
  try {
    if (!onlineAvailable()) return res.status(400).json({ ok: false, message: 'Online payment is not configured.' });
    const f = readForm(req.body); f.method = 'online';
    const t = cart.totals(req, { pincode: f.pincode, state: f.state, city: f.city, method: 'online' });
    const errs = validate(f, t); if (errs.length) return res.status(400).json({ ok: false, message: errs[0] });
    const k = keys();
    const resp = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${k.id}:${k.secret}`).toString('base64') }, body: JSON.stringify({ amount: Math.round(t.total * 100), currency: 'INR', receipt: 'rcpt_' + Date.now() }) });
    const d = await resp.json();
    if (!resp.ok || !d.id) return res.status(502).json({ ok: false, message: (d.error && d.error.description) || 'Could not start payment. Please try again.' });
    req.session.rzp = { order_id: d.id, total: t.total };
    res.json({ ok: true, key: k.id, order_id: d.id, amount: d.amount, name: settings.get('store_name'), color: settings.get('razorpay_theme'), prefill: { name: f.name, email: f.email, contact: f.phone } });
  } catch (e) { console.error('[razorpay]', e.message); res.status(500).json({ ok: false, message: 'Payment service unreachable. Please try again.' }); }
});

// 2) place order (COD directly, online after signature verification)
r.post('/checkout', guard, (req, res) => {
  const f = readForm(req.body);
  const t = cart.totals(req, { pincode: f.pincode, state: f.state, city: f.city, method: f.method });
  const errors = validate(f, t);
  let paid = false, rzpPayment = null, rzpOrder = null;
  if (!errors.length && f.method === 'online') {
    const pid = String(req.body.razorpay_payment_id || ''), oid = String(req.body.razorpay_order_id || ''), sig = String(req.body.razorpay_signature || '');
    const expect = crypto.createHmac('sha256', keys().secret).update(oid + '|' + pid).digest('hex');
    const ok = pid && oid && sig.length === expect.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
    if (!ok) errors.push('We could not verify your payment. If money was deducted, contact us with your payment ID.');
    else if (!req.session.rzp || req.session.rzp.order_id !== oid || Math.abs(req.session.rzp.total - t.total) > 0.01) errors.push('Your cart changed after payment started. Please try again — if money was deducted, contact us with your payment ID ' + pid + '.');
    else { paid = true; rzpPayment = pid; rzpOrder = oid; }
  }
  if (!errors.length) {
    try {
      const order = orders.place(req, { ...f, paid, rzpPayment, rzpOrder });
      delete req.session.rzp;
      if (req.session.userId) { const u = db.get('SELECT address FROM users WHERE id=?', req.session.userId); if (u && !u.address) db.run('UPDATE users SET phone=?,address=?,city=?,state=?,pincode=? WHERE id=?', f.phone, f.address, f.city, f.state, f.pincode, req.session.userId); }
      return res.redirect('/order-success/' + order.order_number);
    } catch (e) { errors.push(e.message); }
  }
  res.status(400).render('pages/checkout', { t, form: f, errors, online: !!onlineAvailable(), pageTitle: 'Checkout' });
});

function canView(req, o) { return o && (req.session.lastOrder === o.order_number || (req.session.userId && o.user_id === req.session.userId) || req.session.adminId); }
r.get('/order-success/:number', (req, res, next) => {
  const o = db.get('SELECT * FROM orders WHERE order_number=?', req.params.number);
  if (!canView(req, o)) return next();
  const items = db.all('SELECT * FROM order_items WHERE order_id=?', o.id);
  const phone = o.phone.replace(/\D/g, '').slice(-10);
  const wa = `https://wa.me/91${phone}?text=${encodeURIComponent(`Hello ${o.name}! Order #${o.order_number} confirmed!\n💰 Total: ${L.money(o.total)}\n🙏 Thank you!`)}`;
  const storeWa = `https://wa.me/${String(settings.get('whatsapp')).replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I just placed order #' + o.order_number)}`;
  res.render('pages/order-success', { o, items, wa, storeWa, FLOW: ['pending', 'confirmed', 'processing', 'shipped', 'delivered'], pageTitle: 'Order Confirmed' });
});
r.get('/invoice/:number', (req, res, next) => {
  const o = db.get('SELECT * FROM orders WHERE order_number=?', req.params.number);
  if (!canView(req, o)) return next();
  res.render('pages/invoice', { o, items: db.all('SELECT * FROM order_items WHERE order_id=?', o.id), layout: false });
});
module.exports = r;
