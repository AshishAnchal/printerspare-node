'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const settings = require('../settings');
const { requireUser, rateLimit } = require('../middleware');
const L = require('../lib');
const r = express.Router();

const safeNext = (u) => (u && /^\/(?!\/)/.test(u) ? u : '/account');
r.get('/login', (req, res) => req.session.userId ? res.redirect('/account') : res.render('pages/login', { pageTitle: 'Login', mode: 'login', form: {} }));
r.post('/login', rateLimit(10, 600000), (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const u = db.get('SELECT * FROM users WHERE lower(email)=?', email);
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password)) { req.flash('error', 'Invalid email or password.'); return res.render('pages/login', { pageTitle: 'Login', mode: 'login', form: { email } }); }
  const cart = req.session.cart, rt = req.session.returnTo, csrf = req.session.csrf;
  req.session.regenerate(() => { req.session.userId = u.id; req.session.cart = cart || {}; req.session.csrf = csrf; req.flash('success', `Welcome back, ${u.name.split(' ')[0]}!`); res.redirect(safeNext(rt)); });
});
r.get('/register', (req, res) => req.session.userId ? res.redirect('/account') : res.render('pages/login', { pageTitle: 'Create account', mode: 'register', form: {} }));
r.post('/register', rateLimit(10, 600000), (req, res) => {
  const f = { name: String(req.body.name || '').trim(), email: String(req.body.email || '').trim().toLowerCase(), phone: String(req.body.phone || '').trim() };
  const pw = String(req.body.password || '');
  const err = !f.name ? 'Please enter your name.' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) ? 'Please enter a valid email.' : pw.length < 6 ? 'Password must be at least 6 characters.' : pw !== String(req.body.password2 || '') ? 'Passwords do not match.' : db.get('SELECT id FROM users WHERE lower(email)=?', f.email) ? 'That email is already registered — please log in.' : '';
  if (err) { req.flash('error', err); return res.render('pages/login', { pageTitle: 'Create account', mode: 'register', form: f }); }
  const id = db.run('INSERT INTO users(name,email,password,phone) VALUES(?,?,?,?)', f.name, f.email, bcrypt.hashSync(pw, 10), f.phone).lastInsertRowid;
  const cart = req.session.cart, rt = req.session.returnTo, csrf = req.session.csrf;
  req.session.regenerate(() => { req.session.userId = id; req.session.cart = cart || {}; req.session.csrf = csrf; req.flash('success', 'Account created — welcome! 🎉'); res.redirect(safeNext(rt)); });
});
r.get('/logout', (req, res) => { delete req.session.userId; req.flash('success', 'You have been logged out.'); res.redirect('/'); });

r.get('/account', requireUser, (req, res) => {
  const stats = db.get("SELECT COUNT(*) n, COALESCE(SUM(total),0) spent, SUM(CASE WHEN order_status IN ('pending','confirmed','processing','shipped') THEN 1 ELSE 0 END) open FROM orders WHERE user_id=? AND order_status!='cancelled'", req.session.userId);
  const recent = db.all('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 5', req.session.userId);
  res.render('account/dashboard', { stats, recent, tab: 'dash', pageTitle: 'My Account' });
});
r.get('/account/orders', requireUser, (req, res) => res.render('account/orders', { orders: db.all('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC', req.session.userId), tab: 'orders', pageTitle: 'My Orders' }));
r.get('/account/orders/:number', requireUser, (req, res, next) => {
  const o = db.get('SELECT * FROM orders WHERE order_number=? AND user_id=?', req.params.number, req.session.userId); if (!o) return next();
  res.render('account/order', { o, items: db.all('SELECT * FROM order_items WHERE order_id=?', o.id), events: db.all('SELECT * FROM order_events WHERE order_id=? ORDER BY id', o.id), tab: 'orders', FLOW: ['pending', 'confirmed', 'processing', 'shipped', 'delivered'], pageTitle: 'Order ' + o.order_number });
});
r.get('/account/profile', requireUser, (req, res) => res.render('account/profile', { u: db.get('SELECT * FROM users WHERE id=?', req.session.userId), tab: 'profile', pageTitle: 'Profile' }));
r.post('/account/profile', requireUser, (req, res) => {
  const b = req.body; const u = db.get('SELECT * FROM users WHERE id=?', req.session.userId);
  db.run('UPDATE users SET name=?,phone=?,address=?,city=?,state=?,pincode=? WHERE id=?', String(b.name || u.name).trim(), String(b.phone || '').trim(), String(b.address || '').trim(), String(b.city || '').trim(), String(b.state || '').trim(), String(b.pincode || '').trim(), u.id);
  if (b.new_password) {
    if (!bcrypt.compareSync(String(b.current_password || ''), u.password)) { req.flash('error', 'Current password is incorrect.'); return res.redirect('/account/profile'); }
    if (String(b.new_password).length < 6) { req.flash('error', 'New password must be at least 6 characters.'); return res.redirect('/account/profile'); }
    db.run('UPDATE users SET password=? WHERE id=?', bcrypt.hashSync(String(b.new_password), 10), u.id);
  }
  req.flash('success', 'Profile updated ✅'); res.redirect('/account/profile');
});
module.exports = r;
