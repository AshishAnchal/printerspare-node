'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../db');
const settings = require('../../settings');
const { requireAdmin, rateLimit } = require('../../middleware');

const r = express.Router();
r.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

r.get('/login', (req, res) => req.session.adminId ? res.redirect('/admin') : res.render('admin/login', { error: '' }));
r.post('/login', rateLimit(8, 600000), (req, res) => {
  const id = String(req.body.username || '').trim().toLowerCase();
  const a = db.get('SELECT * FROM admins WHERE lower(username)=? OR lower(email)=?', id, id);
  if (!a || !bcrypt.compareSync(String(req.body.password || ''), a.password)) return res.status(401).render('admin/login', { error: 'Invalid username or password.' });
  const csrf = req.session.csrf, back = req.session.adminReturn;
  req.session.regenerate(() => { req.session.adminId = a.id; req.session.adminName = a.username; req.session.csrf = csrf; res.redirect(back && /^\/admin/.test(back) ? back : '/admin'); });
});
r.get('/logout', (req, res) => { delete req.session.adminId; res.redirect('/admin/login'); });

r.use(requireAdmin);
r.use((req, res, next) => {
  const a = db.get('SELECT * FROM admins WHERE id=?', req.session.adminId);
  if (!a) { delete req.session.adminId; return res.redirect('/admin/login'); }
  res.locals.adm = {
    name: a.username,
    pending: db.get("SELECT COUNT(*) n FROM orders WHERE order_status='pending'").n || 0,
    enq: db.get("SELECT COUNT(*) n FROM enquiries WHERE status='new'").n || 0,
    rev: db.get('SELECT COUNT(*) n FROM reviews WHERE is_approved=0').n || 0,
    defaultPw: bcrypt.compareSync('admin123', a.password),
  };
  res.locals.active = req.path === '/' ? '/admin' : '/admin' + req.path;
  res.locals.title = 'Admin';
  next();
});

r.get('/', (req, res) => {
  const q = (sql, ...p) => db.get(sql, ...p);
  const live = "order_status!='cancelled'";
  const stats = {
    today: q(`SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders WHERE date(created_at,'+5 hours','+30 minutes')=date('now','+5 hours','+30 minutes') AND ${live}`),
    month: q(`SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders WHERE strftime('%Y-%m',created_at,'+5 hours','+30 minutes')=strftime('%Y-%m','now','+5 hours','+30 minutes') AND ${live}`),
    all: q(`SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders WHERE ${live}`),
    products: q('SELECT COUNT(*) n, SUM(is_active) a FROM products'),
    customers: q('SELECT COUNT(*) n FROM users').n,
    aov: q(`SELECT COALESCE(AVG(total),0) a FROM orders WHERE ${live}`).a,
  };
  const days = db.all(`SELECT date(created_at,'+5 hours','+30 minutes') d, COUNT(*) n, SUM(total) s FROM orders WHERE ${live} AND created_at >= datetime('now','-14 days') GROUP BY d`);
  const series = []; for (let i = 13; i >= 0; i--) { const dt = new Date(Date.now() + 19800000 - i * 86400000).toISOString().slice(0, 10); const f = days.find((x) => x.d === dt); series.push({ d: dt, n: f ? f.n : 0, s: f ? f.s : 0 }); }
  const recent = db.all('SELECT * FROM orders ORDER BY id DESC LIMIT 8');
  const low = db.all('SELECT id,name,stock,image FROM products WHERE is_active=1 AND stock<=? ORDER BY stock LIMIT 8', settings.get('low_stock_threshold'));
  const top = db.all("SELECT oi.product_name name, SUM(oi.quantity) qty, SUM(oi.total) rev FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_status!='cancelled' GROUP BY oi.product_name ORDER BY qty DESC LIMIT 5");
  const byStatus = db.all('SELECT order_status s, COUNT(*) n FROM orders GROUP BY s');
  res.render('admin/dashboard', { title: 'Dashboard', stats, series, recent, low, top, byStatus });
});

for (const m of ['orders', 'products', 'crud', 'settings', 'homepage', 'misc']) require('./' + m)(r);
module.exports = r;
