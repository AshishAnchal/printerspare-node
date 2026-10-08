'use strict';
const crypto = require('crypto');
const { db } = require('./db');
const settings = require('./settings');
const L = require('./lib');
const cart = require('./cart');

/** Builds the navigation, theme and helpers every storefront template needs. */
function locals(req, res, next) {
  const s = settings.sanitized();
  res.locals.S = s;
  res.locals.L = L;
  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.cartCount = cart.count(req);
  res.locals.user = req.session.userId ? db.get('SELECT id,name,email FROM users WHERE id=?', req.session.userId) : null;
  res.locals.isAdmin = !!req.session.adminId;
  res.locals.flash = req.session.flash || {}; delete req.session.flash;
  res.locals.pageTitle = null; res.locals.metaDesc = null; res.locals.ogImage = null; res.locals.canonical = null;
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(16).toString('hex');
  res.locals.csrf = req.session.csrf;
  res.locals.themeVersion = settings.version();
  res.locals.flashMsg = (type, msg) => { (req.session.flash = req.session.flash || {})[type] = [...((req.session.flash || {})[type] || []), msg]; };
  req.flash = (type, msg) => { const f = (req.session.flash = req.session.flash || {}); (f[type] = f[type] || []).push(msg); };
  next();
}

/** Storefront-only: categories, menus, brands. */
function storefront(req, res, next) {
  res.locals.navCats = db.all('SELECT id,name,slug,image FROM categories WHERE is_active=1 ORDER BY sort_order, name');
  const raw = db.all("SELECT * FROM menu_items WHERE location='nav' AND is_active=1 ORDER BY sort_order, id");
  const palette = ['#1565c0', '#2e7d32', '#6a1b9a', '#e65100', '#00695c', '#4527a0', '#c62828', '#0277bd', '#558b2f', '#6d4c41'];
  const nav = [];
  for (const m of raw) {
    if (m.kind === 'categories') res.locals.navCats.forEach((c, i) => nav.push({ label: '🖨️ ' + c.name, url: '/products?category=' + c.slug, bg_color: palette[i % palette.length], text_color: '#fff', slug: c.slug }));
    else nav.push(m);
  }
  res.locals.navItems = nav;
  res.locals.footerLinks = db.all("SELECT * FROM menu_items WHERE location='footer' AND is_active=1 ORDER BY sort_order, id");
  res.locals.footerPages = db.all('SELECT slug,title FROM pages WHERE is_active=1 AND show_in_footer=1 ORDER BY sort_order, id');
  next();
}

function maintenance(req, res, next) {
  if (!settings.get('maintenance_mode')) return next();
  if (req.session.adminId || req.path.startsWith('/admin') || req.path.startsWith('/uploads') || req.path.startsWith('/css') || req.path.startsWith('/js') || req.path === '/theme.css') return next();
  res.status(503).render('pages/maintenance');
}

function csrfCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const t = req.get('x-csrf-token') || (req.body && req.body._csrf) || req.query._csrf;
  if (t && req.session.csrf && t.length === req.session.csrf.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(req.session.csrf))) return next();
  if (req.accepts(['html', 'json']) === 'json' || req.xhr) return res.status(403).json({ ok: false, message: 'Session expired — refresh the page.' });
  req.flash('error', 'Your session expired. Please try again.');
  res.redirect(req.get('referer') || '/');
}

const requireUser = (req, res, next) => { if (req.session.userId) return next(); req.session.returnTo = req.originalUrl; req.flash('error', 'Please log in to continue.'); res.redirect('/login'); };
const requireAdmin = (req, res, next) => { if (req.session.adminId) return next(); req.session.adminReturn = req.originalUrl; res.redirect('/admin/login'); };

// tiny in-memory rate limiter (login brute-force protection)
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const k = req.ip + '|' + req.path; const now = Date.now();
    const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).send('Too many attempts. Please wait a few minutes and try again.');
    arr.push(now); hits.set(k, arr); next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 900000)) hits.delete(k); }, 600000).unref();

module.exports = { locals, storefront, maintenance, csrfCheck, requireUser, requireAdmin, rateLimit };
