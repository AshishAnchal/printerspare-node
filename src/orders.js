'use strict';
const { db } = require('./db');
const settings = require('./settings');
const cart = require('./cart');
const { orderNumber } = require('./lib');
const mailer = require('./mailer');

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

/** Atomically creates an order from the session cart. Throws Error with a user-facing message. */
function place(req, d) {
  const t = cart.totals(req, { pincode: d.pincode, state: d.state, city: d.city, method: d.method });
  if (!t.items.length) throw new Error('Your cart is empty.');
  for (const i of t.items) if (!i.inStock || i.qty > i.stock) throw new Error(`"${i.product.name}${i.label ? ' (' + i.label + ')' : ''}" does not have enough stock.`);
  if (settings.get('min_order_value') > 0 && t.subtotal < settings.get('min_order_value')) throw new Error(`Minimum order value is ${settings.get('currency')}${settings.get('min_order_value')}.`);

  const number = orderNumber();
  const id = db.transaction(() => {
    const r = db.run(`INSERT INTO orders(user_id,order_number,name,email,phone,address,city,state,pincode,payment_method,payment_status,subtotal,shipping,discount,gst,cod_fee,total,coupon_code,notes,razorpay_payment_id,razorpay_order_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, req.session.userId || null, number, d.name, d.email, d.phone, d.address, d.city, d.state, d.pincode, d.method, d.paid ? 'paid' : 'pending', t.subtotal, t.shipping, t.discount, t.gst, t.codFee, t.total, t.couponCode, d.notes || '', d.rzpPayment || null, d.rzpOrder || null);
    const oid = r.lastInsertRowid;
    for (const i of t.items) {
      db.run('INSERT INTO order_items(order_id,product_id,variant_id,product_name,product_image,price,quantity,total) VALUES(?,?,?,?,?,?,?,?)', oid, i.product.id, i.variant ? i.variant.id : null, i.product.name + (i.label ? ` (${i.label})` : ''), i.product.image || '', i.unit, i.qty, i.line);
      if (i.variant) db.run('UPDATE product_variants SET stock=MAX(0,stock-?) WHERE id=?', i.qty, i.variant.id);
      else db.run('UPDATE products SET stock=MAX(0,stock-?) WHERE id=?', i.qty, i.product.id);
    }
    if (t.couponCode) db.run('UPDATE coupons SET used_count=used_count+1 WHERE code=?', t.couponCode);
    db.run('INSERT INTO order_events(order_id,label) VALUES(?,?)', oid, d.paid ? 'Order placed — payment received online' : d.method === 'cod' ? 'Order placed — Cash on Delivery' : 'Order placed — awaiting payment');
    return oid;
  })();

  const order = db.get('SELECT * FROM orders WHERE id=?', id);
  const items = db.all('SELECT * FROM order_items WHERE order_id=?', id);
  mailer.sendOrderConfirmation(order, items).catch(() => {});
  mailer.sendAdminAlert(order, items).catch(() => {});
  cart.clear(req);
  req.session.lastOrder = number;
  return order;
}

function setStatus(id, status, extra = {}) {
  const o = db.get('SELECT * FROM orders WHERE id=?', id); if (!o) return null;
  const changed = status && status !== o.order_status;
  db.run('UPDATE orders SET order_status=COALESCE(?,order_status), payment_status=COALESCE(?,payment_status), awb=COALESCE(?,awb), courier=COALESCE(?,courier), admin_notes=COALESCE(?,admin_notes), updated_at=CURRENT_TIMESTAMP WHERE id=?', status || null, extra.payment_status || null, extra.awb ?? null, extra.courier ?? null, extra.admin_notes ?? null, id);
  if (changed) {
    db.run('INSERT INTO order_events(order_id,label) VALUES(?,?)', id, 'Status changed to ' + status);
    if (status === 'cancelled' && o.order_status !== 'cancelled') { // put stock back
      for (const it of db.all('SELECT * FROM order_items WHERE order_id=?', id)) { if (it.variant_id) db.run('UPDATE product_variants SET stock=stock+? WHERE id=?', it.quantity, it.variant_id); else db.run('UPDATE products SET stock=stock+? WHERE id=?', it.quantity, it.product_id); }
    }
  }
  if (extra.payment_status && extra.payment_status !== o.payment_status) db.run('INSERT INTO order_events(order_id,label) VALUES(?,?)', id, 'Payment marked ' + extra.payment_status);
  if (extra.awb && extra.awb !== o.awb) db.run('INSERT INTO order_events(order_id,label) VALUES(?,?)', id, `Tracking number added: ${extra.awb}`);
  const fresh = db.get('SELECT * FROM orders WHERE id=?', id);
  if (changed) mailer.sendStatusUpdate(fresh).catch(() => {});
  return fresh;
}
module.exports = { place, setStatus, STATUSES };
