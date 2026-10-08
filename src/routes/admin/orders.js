'use strict';
const { db } = require('../../db');
const settings = require('../../settings');
const orders = require('../../orders');
const L = require('../../lib');

const csv = (rows, cols) => '﻿' + [cols.map((c) => c[0]).join(','), ...rows.map((r) => cols.map((c) => `"${String(c[1](r) ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');

module.exports = (r) => {
  function filter(q) {
    const w = [], p = [];
    if (q.status) { w.push('order_status=?'); p.push(q.status); }
    if (q.payment) { w.push('payment_status=?'); p.push(q.payment); }
    if (q.method) { w.push('payment_method=?'); p.push(q.method); }
    if (q.from) { w.push("date(created_at,'+5 hours','+30 minutes')>=?"); p.push(q.from); }
    if (q.to) { w.push("date(created_at,'+5 hours','+30 minutes')<=?"); p.push(q.to); }
    if (q.q) { w.push('(order_number LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ? OR awb LIKE ?)'); p.push(...Array(5).fill(`%${q.q}%`)); }
    return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', p };
  }
  r.get('/orders', (req, res) => {
    const { where, p } = filter(req.query);
    const total = db.get(`SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders ${where}`, ...p);
    const pager = L.paginate(total.n, 25, L.int(req.query.page, 1));
    const rows = db.all(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT 25 OFFSET ?`, ...p, pager.offset);
    res.render('admin/orders', { title: 'Orders', rows, pager, total, STATUSES: orders.STATUSES });
  });
  r.get('/orders/export.csv', (req, res) => {
    const { where, p } = filter(req.query);
    const rows = db.all(`SELECT * FROM orders ${where} ORDER BY id DESC`, ...p);
    res.type('text/csv').attachment('orders.csv').send(csv(rows, [['Order', (o) => o.order_number], ['Date', (o) => o.created_at], ['Name', (o) => o.name], ['Email', (o) => o.email], ['Phone', (o) => o.phone], ['Address', (o) => o.address], ['City', (o) => o.city], ['State', (o) => o.state], ['Pincode', (o) => o.pincode], ['Method', (o) => o.payment_method], ['Payment', (o) => o.payment_status], ['Status', (o) => o.order_status], ['Subtotal', (o) => o.subtotal], ['Discount', (o) => o.discount], ['GST', (o) => o.gst], ['Shipping', (o) => o.shipping], ['COD fee', (o) => o.cod_fee], ['Total', (o) => o.total], ['Coupon', (o) => o.coupon_code], ['AWB', (o) => o.awb]]));
  });
  r.get('/orders/:id', (req, res, next) => {
    const o = db.get('SELECT * FROM orders WHERE id=?', req.params.id); if (!o) return next();
    res.render('admin/order', { title: 'Order ' + o.order_number, o, items: db.all('SELECT * FROM order_items WHERE order_id=?', o.id), events: db.all('SELECT * FROM order_events WHERE order_id=? ORDER BY id DESC', o.id), STATUSES: orders.STATUSES, active: '/admin/orders' });
  });
  r.post('/orders/:id', (req, res) => {
    const b = req.body;
    orders.setStatus(Number(req.params.id), orders.STATUSES.includes(b.order_status) ? b.order_status : null, { payment_status: ['pending', 'paid', 'failed'].includes(b.payment_status) ? b.payment_status : null, awb: String(b.awb || '').trim(), courier: String(b.courier || '').trim(), admin_notes: String(b.admin_notes || '') });
    req.flash('success', 'Order updated ✅'); res.redirect('/admin/orders/' + req.params.id);
  });
  r.post('/orders/:id/delete', (req, res) => { db.run('DELETE FROM orders WHERE id=?', req.params.id); req.flash('success', 'Order deleted.'); res.redirect('/admin/orders'); });
  r.get('/orders/:id/invoice', (req, res, next) => { const o = db.get('SELECT * FROM orders WHERE id=?', req.params.id); if (!o) return next(); res.render('pages/invoice', { o, items: db.all('SELECT * FROM order_items WHERE order_id=?', o.id) }); });

  r.get('/customers', (req, res) => {
    const q = String(req.query.q || '');
    const rows = db.all(`SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) orders, (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id=u.id AND o.order_status!='cancelled') spent FROM users u WHERE (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?) ORDER BY u.id DESC LIMIT 500`, ...Array(3).fill(`%${q}%`));
    res.render('admin/customers', { title: 'Customers', rows, q });
  });
  r.get('/customers/export.csv', (req, res) => res.type('text/csv').attachment('customers.csv').send(csv(db.all('SELECT * FROM users ORDER BY id'), [['Name', (u) => u.name], ['Email', (u) => u.email], ['Phone', (u) => u.phone], ['City', (u) => u.city], ['State', (u) => u.state], ['Joined', (u) => u.created_at]])));
};
