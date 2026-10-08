'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const settings = require('../settings');
const P = require('../products');
const L = require('../lib');
const delhivery = require('../delhivery');
const mailer = require('../mailer');
const theme = require('../theme');
const { rateLimit } = require('../middleware');

const r = express.Router();

/* ---------------- dynamic theme ---------------- */
r.get('/theme.css', (req, res) => { res.type('css').set('Cache-Control', 'public, max-age=300').send(theme.css()); });

/* ---------------- home ---------------- */
function sectionData(sec) {
  const cfg = JSON.parse(sec.config || '{}');
  const out = { id: sec.id, type: sec.type, title: sec.title, cfg };
  switch (sec.type) {
    case 'hero': out.slides = db.all('SELECT * FROM hero_slides WHERE is_active=1 ORDER BY sort_order,id'); break;
    case 'trust': out.items = db.all('SELECT * FROM trust_items WHERE is_active=1 ORDER BY sort_order,id'); break;
    case 'brands': out.brands = db.all('SELECT * FROM brands WHERE is_active=1 AND show_on_home=1 ORDER BY sort_order,id'); break;
    case 'categories': out.cats = db.all('SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order,name'); break;
    case 'products': out.products = P.forSource(cfg.source, L.int(cfg.limit, 8)); break;
    case 'category_blocks': {
      const cats = db.all('SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order,name');
      out.blocks = [];
      for (const c of cats) { if (out.blocks.length >= L.int(cfg.max_categories, 10)) break; const products = P.list({ where: ['p.category_id=?'], params: [c.id], sort: 'featured', limit: L.int(cfg.limit, 8) }); if (products.length) out.blocks.push({ cat: c, products }); }
      break;
    }
    default: break;
  }
  return out;
}
r.get('/', (req, res) => {
  const sections = db.all('SELECT * FROM home_sections WHERE is_active=1 ORDER BY sort_order,id').map(sectionData);
  res.render('pages/home', { sections, canonical: (settings.get('site_url') || '') + '/' });
});

/* ---------------- listing ---------------- */
r.get('/products', (req, res) => {
  const q = req.query;
  const where = [], params = [];
  const search = String(q.search || '').trim(), brand = String(q.brand || '').trim(), category = String(q.category || '').trim();
  const min = L.num(q.min, 0), max = L.num(q.max, 0);
  if (search) {
    const words = search.split(/\s+/).filter(Boolean).slice(0, 6);
    for (const w of words) { where.push('(p.name LIKE ? OR p.description LIKE ? OR p.compatible_models LIKE ? OR p.brand LIKE ? OR p.sku LIKE ? OR p.tags LIKE ?)'); params.push(...Array(6).fill(`%${w}%`)); }
  }
  if (brand) { where.push('(p.brand=? COLLATE NOCASE OR p.name LIKE ? OR c.name LIKE ?)'); params.push(brand, `%${brand}%`, `%${brand}%`); }
  if (category) { where.push('c.slug=?'); params.push(category); }
  const eff = 'COALESCE((SELECT MIN(CASE WHEN v.sale_price IS NOT NULL AND v.sale_price<v.price THEN v.sale_price ELSE v.price END) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1), CASE WHEN p.sale_price IS NOT NULL AND p.sale_price<p.price THEN p.sale_price ELSE p.price END)';
  if (min > 0) { where.push(`${eff} >= ?`); params.push(min); }
  if (max > 0) { where.push(`${eff} <= ?`); params.push(max); }
  if (q.stock === '1') where.push('(p.stock>0 OR (SELECT COALESCE(SUM(stock),0) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1)>0)');
  const sort = P.SORTS[q.sort] ? q.sort : 'newest';
  const perPage = Math.max(4, settings.get('products_per_page'));
  const total = P.count({ where, params });
  const pager = L.paginate(total, perPage, L.int(q.page, 1));
  const products = P.list({ where, params, sort, limit: perPage, offset: pager.offset });
  const brands = db.all("SELECT brand, COUNT(*) n FROM products WHERE is_active=1 AND brand IS NOT NULL AND brand!='' GROUP BY brand ORDER BY brand COLLATE NOCASE");
  const cats = db.all('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.is_active=1) n FROM categories c WHERE c.is_active=1 ORDER BY sort_order,name');
  const catRow = category ? cats.find((c) => c.slug === category) : null;
  const heading = search ? `Results for “${search}”` : brand ? `${brand} Parts` : catRow ? catRow.name : q.sort === 'sale' ? 'On Sale' : 'All Products';
  res.render('pages/products', { products, pager, total, brands, cats, search, brand, category, sort, heading, catRow, min: q.min || '', max: q.max || '', pageTitle: heading, metaDesc: catRow && catRow.description });
});

/* ---------------- product ---------------- */
r.get('/product/:slug', (req, res, next) => {
  const p = P.bySlug(req.params.slug); if (!p) return next();
  db.run('UPDATE products SET views=views+1 WHERE id=?', p.id);
  const variants = db.all('SELECT * FROM product_variants WHERE product_id=? AND is_active=1 ORDER BY sort_order, qty, id', p.id);
  const gallery = [p.image, ...db.all('SELECT image FROM product_images WHERE product_id=? ORDER BY sort_order,id', p.id).map((x) => x.image)].filter(Boolean);
  const related = settings.get('show_related') ? P.list({ where: ['p.category_id=?', 'p.id!=?'], params: [p.category_id, p.id], limit: 4, sort: 'featured' }) : [];
  const reviews = db.all('SELECT * FROM reviews WHERE product_id=? AND is_approved=1 ORDER BY created_at DESC LIMIT 30', p.id);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((x) => x.rating === n).length }));
  res.render('pages/product', { p, variants, gallery, related, reviews, dist, vid: L.youtubeId(p.youtube_url), pageTitle: p.meta_title || p.name, metaDesc: p.meta_description || (p.description || '').slice(0, 155), ogImage: p.image ? '/uploads/' + p.image : null, canonical: (settings.get('site_url') || '') + '/product/' + p.slug });
});
r.post('/product/:slug/review', rateLimit(5, 600000), (req, res) => {
  const p = db.get('SELECT id,slug FROM products WHERE slug=?', req.params.slug); if (!p || !settings.get('enable_reviews')) return res.redirect('/products');
  const rating = Math.min(5, Math.max(1, L.int(req.body.rating, 5))), name = String(req.body.name || '').trim().slice(0, 80), comment = String(req.body.comment || '').trim().slice(0, 1000);
  if (!name || !comment) { req.flash('error', 'Please add your name and a few words.'); return res.redirect('/product/' + p.slug + '#reviews'); }
  db.run('INSERT INTO reviews(product_id,name,rating,comment) VALUES(?,?,?,?)', p.id, name, rating, comment);
  req.flash('success', 'Thanks! Your review will appear once approved.'); res.redirect('/product/' + p.slug + '#reviews');
});

/* ---------------- APIs ---------------- */
r.get('/api/pincode', async (req, res) => {
  const pin = String(req.query.pin || '').replace(/\D/g, '');
  const d = await delhivery.pincode(pin);
  if (!d.serviceable) return res.json({ ok: false, message: d.message || 'Delivery not available' });
  const shipping = require('../shipping');
  const q = shipping.quote({ pincode: pin, state: d.state, city: d.city });
  const total = L.num(req.query.total, 0), thr = settings.get('free_shipping_above');
  res.json({ ok: true, city: d.city, state: d.state, zone: q.zone, charge: thr > 0 && total >= thr ? 0 : q.charge, days: q.label, source: d.source });
});
r.get('/api/lookup-pin', async (req, res) => { const d = await delhivery.pincode(String(req.query.pin || '').replace(/\D/g, '')); res.json({ ok: d.serviceable, city: d.city || '', state: L.STATES[d.state] || '' }); });
r.get('/wishlist', (req, res) => res.render('pages/wishlist', { pageTitle: 'Wishlist' }));
r.get('/wishlist/items', (req, res) => {
  const ids = String(req.query.ids || '').split(',').map((x) => parseInt(x, 10)).filter(Boolean).slice(0, 60);
  res.render('partials/product-grid', { products: P.byIds(ids) });
});
r.post('/subscribe', rateLimit(8, 600000), (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { try { db.run('INSERT INTO subscribers(email) VALUES(?)', email); } catch (e) { /* duplicate */ } req.flash('success', 'You are subscribed! 🎉'); } else req.flash('error', 'Please enter a valid email.');
  res.redirect(req.get('referer') || '/');
});

/* ---------------- enquiry ---------------- */
r.get('/enquiry', (req, res) => res.render('pages/enquiry', { pageTitle: 'Find My Part', brands: db.all('SELECT name FROM brands WHERE is_active=1 ORDER BY sort_order'), form: {} }));
r.post('/enquiry', rateLimit(6, 600000), (req, res) => {
  const b = req.body; const f = { name: String(b.name || '').trim(), email: String(b.email || '').trim(), phone: String(b.phone || '').trim(), printer_brand: String(b.printer_brand || '').trim(), printer_model: String(b.printer_model || '').trim(), message: String(b.message || '').trim() };
  if (!f.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) || !f.message) { req.flash('error', 'Name, a valid email and your requirement are needed.'); return res.render('pages/enquiry', { pageTitle: 'Find My Part', brands: db.all('SELECT name FROM brands WHERE is_active=1 ORDER BY sort_order'), form: f }); }
  db.run('INSERT INTO enquiries(name,email,phone,printer_brand,printer_model,message) VALUES(?,?,?,?,?,?)', f.name, f.email, f.phone, f.printer_brand, f.printer_model, f.message.slice(0, 3000));
  mailer.send(settings.get('admin_notify_email') || settings.get('email'), `New enquiry from ${f.name}`, `<p><b>${L.esc(f.name)}</b> · ${L.esc(f.phone)} · ${L.esc(f.email)}</p><p>${L.esc(f.printer_brand)} ${L.esc(f.printer_model)}</p><p>${L.esc(f.message)}</p>`).catch(() => {});
  req.flash('success', "Thanks! We've received your enquiry and will reply shortly. 🙌"); res.redirect('/enquiry');
});

/* ---------------- tracking ---------------- */
const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
r.all('/track', async (req, res) => {
  const q = { awb: String(req.body.awb || req.query.awb || '').trim(), order: String(req.body.order || req.query.order || '').trim().toUpperCase(), contact: String(req.body.contact || req.query.contact || '').trim().toLowerCase() };
  const view = { pageTitle: 'Track Your Order', q, order: null, events: [], items: [], shipment: null, error: '', FLOW };
  if (q.order) {
    const o = db.get('SELECT * FROM orders WHERE order_number=?', q.order);
    const digits = q.contact.replace(/\D/g, '');
    if (o && ((q.contact && o.email.toLowerCase() === q.contact) || (digits.length >= 8 && o.phone.replace(/\D/g, '').endsWith(digits.slice(-10))))) {
      view.order = o; view.events = db.all('SELECT * FROM order_events WHERE order_id=? ORDER BY id', o.id); view.items = db.all('SELECT * FROM order_items WHERE order_id=?', o.id);
      if (o.awb && delhivery.enabled()) { try { view.shipment = await delhivery.track(o.awb); } catch (e) { /* show order timeline only */ } }
    } else view.error = 'We could not find that order. Check the order number and the email/phone used at checkout.';
  } else if (q.awb) {
    try { view.shipment = await delhivery.track(q.awb); } catch (e) { view.error = e.message; }
  }
  res.render('pages/track', view);
});

/* ---------------- CMS pages, SEO ---------------- */
r.get('/page/:slug', (req, res, next) => { const pg = db.get('SELECT * FROM pages WHERE slug=? AND is_active=1', req.params.slug); if (!pg) return next(); res.render('pages/cms', { pg, pageTitle: pg.title, metaDesc: pg.meta_description }); });
r.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\nSitemap: ${(settings.get('site_url') || `${req.protocol}://${req.get('host')}`)}/sitemap.xml\n`));
r.get('/sitemap.xml', (req, res) => {
  const base = settings.get('site_url') || `${req.protocol}://${req.get('host')}`;
  const urls = ['/', '/products', '/enquiry', '/track'];
  db.all('SELECT slug FROM categories WHERE is_active=1').forEach((c) => urls.push('/products?category=' + c.slug));
  db.all('SELECT slug FROM products WHERE is_active=1').forEach((p) => urls.push('/product/' + p.slug));
  db.all('SELECT slug FROM pages WHERE is_active=1').forEach((p) => urls.push('/page/' + p.slug));
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${L.esc(base + u)}</loc></url>`).join('')}</urlset>`);
});

/* ---------------- legacy PHP URLs → new routes (keeps old links & Google results working) ---------------- */
r.get('/index.php', (req, res) => res.redirect(301, '/'));
r.get('/products.php', (req, res) => res.redirect(301, '/products' + (req._parsedUrl.search || '')));
r.get('/product.php', (req, res) => res.redirect(301, req.query.slug ? '/product/' + encodeURIComponent(req.query.slug) : '/products'));
r.get('/cart.php', (req, res) => res.redirect(301, '/cart'));
r.get('/checkout.php', (req, res) => res.redirect(301, '/checkout'));
r.get('/track.php', (req, res) => res.redirect(301, '/track' + (req._parsedUrl.search || '')));
r.get('/enquiry.php', (req, res) => res.redirect(301, '/enquiry'));
r.get('/auth/login.php', (req, res) => res.redirect(301, '/login'));
r.get('/auth/register.php', (req, res) => res.redirect(301, '/register'));
r.get('/user/dashboard.php', (req, res) => res.redirect(301, '/account'));
r.get('/user/orders.php', (req, res) => res.redirect(301, '/account/orders'));
r.get('/admin/login.php', (req, res) => res.redirect(301, '/admin/login'));
r.get('/sitemap.php', (req, res) => res.redirect(301, '/sitemap.xml'));

module.exports = r;
