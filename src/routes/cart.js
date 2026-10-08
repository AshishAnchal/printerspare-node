'use strict';
const express = require('express');
const { db } = require('../db');
const settings = require('../settings');
const cart = require('../cart');
const L = require('../lib');

const r = express.Router();
const wantsJson = (req) => req.xhr || /json/.test(req.get('accept') || '') && !/html/.test(req.get('accept') || '');

r.get('/cart', (req, res) => {
  const t = cart.totals(req, { method: 'online' });
  res.render('pages/cart', { t, pageTitle: 'Shopping Cart' });
});
r.get('/cart/count', (req, res) => res.json({ count: cart.count(req) }));

r.post('/cart/add', (req, res) => {
  const pid = L.int(req.body.product_id), vid = L.int(req.body.variant_id), qty = Math.max(1, L.int(req.body.qty, 1));
  const p = db.get('SELECT id,stock,name FROM products WHERE id=? AND is_active=1', pid);
  const back = req.get('referer') && !wantsJson(req) ? req.get('referer') : '/cart';
  const fail = (m) => { if (wantsJson(req)) return res.status(400).json({ ok: false, message: m }); req.flash('error', m); res.redirect(back); };
  if (!p) return fail('Product not found.');
  let stock = p.stock;
  if (vid) { const v = db.get('SELECT stock FROM product_variants WHERE id=? AND product_id=? AND is_active=1', vid, pid); if (!v) return fail('That option is no longer available.'); stock = v.stock; }
  else if (db.get('SELECT COUNT(*) n FROM product_variants WHERE product_id=? AND is_active=1', pid).n > 0) return fail('Please choose an option first.');
  if (stock <= 0) return fail('Sorry, this item is out of stock.');
  const have = (cart.cartOf(req)[cart.keyOf(pid, vid)] || { qty: 0 }).qty;
  if (have + qty > stock) { if (have >= stock) return fail(`You already have the maximum available (${stock}) in your cart.`); cart.setQty(req, cart.keyOf(pid, vid), 0); cart.add(req, pid, vid, stock); }
  else cart.add(req, pid, vid, qty);
  if (req.body.buy_now) return res.redirect('/checkout');
  if (wantsJson(req)) return res.json({ ok: true, count: cart.count(req) });
  req.flash('success', `Added to cart 🛒`); res.redirect(back);
});
r.post('/cart/update', (req, res) => { cart.setQty(req, String(req.body.key), L.int(req.body.qty, 1)); res.redirect('/cart'); });
r.post('/cart/remove', (req, res) => { cart.setQty(req, String(req.body.key), 0); req.flash('success', 'Item removed.'); res.redirect('/cart'); });
r.post('/cart/coupon', (req, res) => {
  const t = cart.totals(req); const v = cart.validateCoupon(req.body.code, t.subtotal);
  if (v.ok) { req.session.coupon = v.coupon.code; req.flash('success', `Coupon applied — you save ${L.money(v.discount)} 🎉`); } else req.flash('error', v.error);
  res.redirect(req.get('referer') && req.get('referer').includes('/checkout') ? '/checkout' : '/cart');
});
r.post('/cart/coupon/remove', (req, res) => { delete req.session.coupon; res.redirect(req.get('referer') && req.get('referer').includes('/checkout') ? '/checkout' : '/cart'); });
module.exports = r;
