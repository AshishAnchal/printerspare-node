'use strict';
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { db, DATA_DIR, UPLOAD_DIR } = require('../../db');
const upload = require('../../upload');
const L = require('../../lib');
const { uniqueSlug } = require('./products');
const { parseMysqlDump } = require('../../mysqlImport');

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function parseCsv(text) {
  const rows = []; let row = [], cur = '', inQ = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true; else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}
const mem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

module.exports = (r) => {
  /* ---- reviews ---- */
  r.get('/reviews', (req, res) => res.render('admin/reviews', { title: 'Reviews', rows: db.all('SELECT r.*, p.name pname FROM reviews r JOIN products p ON p.id=r.product_id ORDER BY r.is_approved, r.id DESC LIMIT 300'), active: '/admin/reviews' }));
  r.post('/reviews/:id/approve', (req, res) => { db.run('UPDATE reviews SET is_approved=1-is_approved WHERE id=?', req.params.id); res.redirect('/admin/reviews'); });
  r.post('/reviews/:id/delete', (req, res) => { db.run('DELETE FROM reviews WHERE id=?', req.params.id); res.redirect('/admin/reviews'); });

  /* ---- subscribers ---- */
  r.get('/subscribers', (req, res) => res.render('admin/subscribers', { title: 'Subscribers', rows: db.all('SELECT * FROM subscribers ORDER BY id DESC'), active: '/admin/subscribers' }));
  r.get('/subscribers/export.csv', (req, res) => res.type('text/csv').attachment('subscribers.csv').send('Email,Joined\r\n' + db.all('SELECT * FROM subscribers').map((s) => `${q(s.email)},${q(s.created_at)}`).join('\r\n')));
  r.post('/subscribers/:id/delete', (req, res) => { db.run('DELETE FROM subscribers WHERE id=?', req.params.id); res.redirect('/admin/subscribers'); });

  /* ---- media library ---- */
  const listMedia = () => {
    const out = [];
    const walk = (dir, rel) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { if (f.isDirectory()) walk(path.join(dir, f.name), rel + f.name + '/'); else if (upload.OK.has(path.extname(f.name).toLowerCase())) { const st = fs.statSync(path.join(dir, f.name)); out.push({ file: rel + f.name, size: st.size, mtime: st.mtimeMs }); } } };
    walk(UPLOAD_DIR, ''); out.sort((a, b) => b.mtime - a.mtime);
    const used = new Set([...db.all('SELECT image FROM products WHERE image IS NOT NULL').map((x) => x.image), ...db.all('SELECT image FROM product_images').map((x) => x.image), ...db.all('SELECT image FROM categories WHERE image IS NOT NULL').map((x) => 'cats/' + x.image), ...db.all('SELECT image FROM hero_slides WHERE image IS NOT NULL').map((x) => 'misc/' + x.image), ...db.all('SELECT logo FROM brands WHERE logo IS NOT NULL').map((x) => 'misc/' + x.logo), ...db.all("SELECT value FROM settings WHERE key IN ('logo_image','og_image') AND value!=''").map((x) => 'misc/' + x.value)]);
    out.forEach((m) => { m.used = used.has(m.file); });
    return out;
  };
  r.get('/media', (req, res) => res.render('admin/media', { title: 'Media library', files: listMedia(), active: '/admin/media' }));
  r.post('/media/upload', upload.misc.array('files', 20), (req, res) => { req.flash('success', `${(req.files || []).length} file(s) uploaded.`); res.redirect('/admin/media'); });
  r.post('/media/delete', (req, res) => {
    const f = String(req.body.file || ''); if (/\.\./.test(f) || !upload.OK.has(path.extname(f).toLowerCase())) return res.redirect('/admin/media');
    try { fs.unlinkSync(path.join(UPLOAD_DIR, f)); req.flash('success', 'File deleted.'); } catch (e) { req.flash('error', 'Could not delete.'); }
    res.redirect('/admin/media');
  });

  /* ---- product import / export ---- */
  r.get('/import', (req, res) => res.render('admin/import', { title: 'Import / Export', active: '/admin/import' }));
  r.get('/import/products.csv', (req, res) => {
    const rows = db.all('SELECT p.*, c.name cat FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.id');
    const cols = ['name', 'category', 'brand', 'sku', 'price', 'sale_price', 'stock', 'compatible_models', 'description', 'tags', 'youtube_url', 'is_featured', 'is_active', 'image', 'slug'];
    res.type('text/csv').attachment('products.csv').send('﻿' + cols.join(',') + '\r\n' + rows.map((p) => [p.name, p.cat, p.brand, p.sku, p.price, p.sale_price, p.stock, p.compatible_models, p.description, p.tags, p.youtube_url, p.is_featured, p.is_active, p.image, p.slug].map(q).join(',')).join('\r\n'));
  });
  r.get('/import/template.csv', (req, res) => res.type('text/csv').attachment('products-template.csv').send('name,category,brand,sku,price,sale_price,stock,compatible_models,description,tags,youtube_url,is_featured,is_active,image,slug\r\n"HP 12A Toner Cartridge","HP Printers","HP","Q2612A",1499,999,25,"HP 1010, 1012, 1015","Compatible toner","toner",,1,1,,\r\n'));
  r.post('/import/products', mem.single('csv'), (req, res) => {
    if (!req.file) { req.flash('error', 'Choose a CSV file first.'); return res.redirect('/admin/import'); }
    const rows = parseCsv(req.file.buffer.toString('utf8')); const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    const col = (row, n) => { const i = head.indexOf(n); return i < 0 ? '' : String(row[i] ?? '').trim(); };
    let added = 0, updated = 0, skipped = 0;
    db.transaction(() => rows.forEach((row) => {
      const name = col(row, 'name'), price = L.num(col(row, 'price')); if (!name || price <= 0) { skipped++; return; }
      let cat = db.get('SELECT id FROM categories WHERE lower(name)=lower(?)', col(row, 'category') || 'General');
      if (!cat) cat = { id: db.run('INSERT INTO categories(name,slug) VALUES(?,?)', col(row, 'category') || 'General', uniqueSlug(col(row, 'category') || 'general', 'categories')).lastInsertRowid };
      const sale = col(row, 'sale_price') === '' ? null : L.num(col(row, 'sale_price'));
      const vals = [cat.id, name, col(row, 'description'), price, sale, L.int(col(row, 'stock')), col(row, 'sku'), col(row, 'brand'), col(row, 'compatible_models'), col(row, 'tags'), col(row, 'youtube_url'), L.bool(col(row, 'is_featured')), col(row, 'is_active') === '' ? 1 : L.bool(col(row, 'is_active'))];
      const existing = (col(row, 'slug') && db.get('SELECT id FROM products WHERE slug=?', col(row, 'slug'))) || (col(row, 'sku') && db.get('SELECT id FROM products WHERE sku=?', col(row, 'sku')));
      if (existing) { db.run('UPDATE products SET category_id=?,name=?,description=?,price=?,sale_price=?,stock=?,sku=?,brand=?,compatible_models=?,tags=?,youtube_url=?,is_featured=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', ...vals, existing.id); if (col(row, 'image')) db.run('UPDATE products SET image=? WHERE id=?', col(row, 'image'), existing.id); updated++; }
      else { db.run('INSERT INTO products(category_id,name,description,price,sale_price,stock,sku,brand,compatible_models,tags,youtube_url,is_featured,is_active,slug,image) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...vals, uniqueSlug(col(row, 'slug') || name, 'products'), col(row, 'image') || null); added++; }
    }))();
    req.flash('success', `Import finished — ${added} added, ${updated} updated, ${skipped} skipped.`); res.redirect('/admin/import');
  });
  // import the ORIGINAL phpMyAdmin .sql export of the live PHP shop
  r.post('/import/mysql', mem.single('sql'), (req, res) => {
    if (!req.file) { req.flash('error', 'Choose your phpMyAdmin .sql export first.'); return res.redirect('/admin/import'); }
    try { const s = parseMysqlDump(req.file.buffer.toString('utf8'), { replace: !!req.body.replace }); req.flash('success', 'Imported from MySQL dump: ' + Object.entries(s).map(([t, n]) => `${n} ${t}`).join(', ') + '. Copy your old assets/uploads files into Media → Upload (or the data/uploads folder).'); }
    catch (e) { req.flash('error', 'Import failed: ' + e.message); }
    res.redirect('/admin/import');
  });
  r.post('/import/uploads', upload.product.array('files', 100), (req, res) => { req.flash('success', `${(req.files || []).length} image(s) added. (Names are kept only if you upload via the data/uploads folder — otherwise use Media library.)`); res.redirect('/admin/import'); });

  /* ---- backup ---- */
  r.get('/backup', (req, res) => res.render('admin/backup', { title: 'Backup', size: fs.statSync(path.join(DATA_DIR, 'store.db')).size, active: '/admin/backup' }));
  r.get('/backup/db', async (req, res) => {
    const tmp = path.join(DATA_DIR, `backup-${Date.now()}.db`);
    try { await db.backup(tmp); res.download(tmp, `store-backup-${new Date().toISOString().slice(0, 10)}.db`, () => fs.unlink(tmp, () => {})); } catch (e) { req.flash('error', e.message); res.redirect('/admin/backup'); }
  });

  /* ---- admin accounts ---- */
  r.get('/account', (req, res) => res.render('admin/account', { title: 'Admins & password', admins: db.all('SELECT id,username,email,created_at FROM admins ORDER BY id'), me: req.session.adminId, active: '/admin/account' }));
  r.post('/account/password', (req, res) => {
    const a = db.get('SELECT * FROM admins WHERE id=?', req.session.adminId), b = req.body;
    if (!bcrypt.compareSync(String(b.current || ''), a.password)) req.flash('error', 'Current password is incorrect.');
    else if (String(b.next || '').length < 8) req.flash('error', 'Use at least 8 characters for the new password.');
    else if (b.next !== b.next2) req.flash('error', 'New passwords do not match.');
    else { db.run('UPDATE admins SET password=?, username=COALESCE(NULLIF(?,\'\'),username), email=COALESCE(NULLIF(?,\'\'),email) WHERE id=?', bcrypt.hashSync(b.next, 11), String(b.username || '').trim(), String(b.email || '').trim(), a.id); req.flash('success', 'Password updated ✅'); }
    res.redirect('/admin/account');
  });
  r.post('/account/add', (req, res) => {
    const b = req.body;
    if (!b.username || !/^[^@\s]+@[^@\s]+$/.test(b.email || '') || String(b.password || '').length < 8) req.flash('error', 'Username, valid email and a password of 8+ characters are required.');
    else try { db.run('INSERT INTO admins(username,email,password) VALUES(?,?,?)', b.username.trim(), b.email.trim(), bcrypt.hashSync(b.password, 11)); req.flash('success', 'Admin added ✅'); } catch (e) { req.flash('error', 'That username or email already exists.'); }
    res.redirect('/admin/account');
  });
  r.post('/account/:id/delete', (req, res) => {
    if (Number(req.params.id) === req.session.adminId) req.flash('error', "You can't delete your own account."); else if (db.get('SELECT COUNT(*) n FROM admins').n <= 1) req.flash('error', 'At least one admin is required.'); else { db.run('DELETE FROM admins WHERE id=?', req.params.id); req.flash('success', 'Admin removed.'); }
    res.redirect('/admin/account');
  });
};
