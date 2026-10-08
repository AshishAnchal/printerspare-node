'use strict';
const { db } = require('../../db');
const upload = require('../../upload');
const L = require('../../lib');
const settings = require('../../settings');

const uniqueSlug = (base, table, ignoreId) => {
  let s = L.slugify(base) || 'item', n = 1, cand = s;
  while (db.get(`SELECT id FROM ${table} WHERE slug=? AND id!=?`, cand, ignoreId || 0)) cand = `${s}-${++n}`;
  return cand;
};

module.exports = (r) => {
  r.get('/products', (req, res) => {
    const q = req.query, w = [], p = [];
    if (q.q) { w.push('(p.name LIKE ? OR p.sku LIKE ? OR p.brand LIKE ?)'); p.push(...Array(3).fill(`%${q.q}%`)); }
    if (q.category) { w.push('p.category_id=?'); p.push(q.category); }
    if (q.status === 'active') w.push('p.is_active=1'); if (q.status === 'inactive') w.push('p.is_active=0'); if (q.status === 'low') { w.push('p.stock<=?'); p.push(settings.get('low_stock_threshold')); }
    const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
    const total = db.get(`SELECT COUNT(*) n FROM products p ${where}`, ...p).n;
    const pager = L.paginate(total, 30, L.int(q.page, 1));
    const rows = db.all(`SELECT p.*, c.name cat_name, (SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id) nv FROM products p JOIN categories c ON c.id=p.category_id ${where} ORDER BY p.id DESC LIMIT 30 OFFSET ?`, ...p, pager.offset);
    res.render('admin/products', { title: 'Products', rows, pager, total, cats: db.all('SELECT id,name FROM categories ORDER BY name') });
  });

  r.post('/products/bulk', (req, res) => {
    let ids = req.body.ids || []; if (!Array.isArray(ids)) ids = [ids]; ids = ids.map(Number).filter(Boolean);
    const act = req.body.action;
    if (!ids.length) { req.flash('error', 'Select at least one product.'); return res.redirect('/admin/products'); }
    const ph = ids.map(() => '?').join(',');
    if (act === 'activate') db.run(`UPDATE products SET is_active=1 WHERE id IN (${ph})`, ...ids);
    else if (act === 'deactivate') db.run(`UPDATE products SET is_active=0 WHERE id IN (${ph})`, ...ids);
    else if (act === 'feature') db.run(`UPDATE products SET is_featured=1 WHERE id IN (${ph})`, ...ids);
    else if (act === 'unfeature') db.run(`UPDATE products SET is_featured=0 WHERE id IN (${ph})`, ...ids);
    else if (act === 'delete') db.run(`DELETE FROM products WHERE id IN (${ph})`, ...ids);
    else if (act === 'category' && req.body.category_id) db.run(`UPDATE products SET category_id=? WHERE id IN (${ph})`, Number(req.body.category_id), ...ids);
    else if (act === 'price_pct' && L.num(req.body.pct)) { const f = 1 + L.num(req.body.pct) / 100; db.run(`UPDATE products SET price=ROUND(price*?,2), sale_price=CASE WHEN sale_price IS NULL THEN NULL ELSE ROUND(sale_price*?,2) END WHERE id IN (${ph})`, f, f, ...ids); }
    req.flash('success', `Done — ${ids.length} product(s) updated.`); res.redirect(req.get('referer') || '/admin/products');
  });

  const form = (res, p, extra = {}) => res.render('admin/product-form', { title: p && p.id ? 'Edit product' : 'Add product', p: p || {}, cats: db.all('SELECT id,name FROM categories ORDER BY name'), brands: db.all('SELECT name FROM brands ORDER BY name'), variants: p && p.id ? db.all('SELECT * FROM product_variants WHERE product_id=? ORDER BY sort_order,id', p.id) : [], gallery: p && p.id ? db.all('SELECT * FROM product_images WHERE product_id=? ORDER BY sort_order,id', p.id) : [], active: '/admin/products', ...extra });
  r.get('/products/new', (req, res) => form(res, { is_active: 1, feature_free_shipping: 1, feature_returns: 1, feature_genuine: 1, feature_tested: 1, stock: 10 }));
  r.get('/products/:id/edit', (req, res, next) => { const p = db.get('SELECT * FROM products WHERE id=?', req.params.id); if (!p) return next(); form(res, p); });

  const up = upload.product.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]);
  r.post('/products/save', up, (req, res) => {
    const b = req.body, id = L.int(b.id), files = req.files || {};
    const name = String(b.name || '').trim(), price = L.num(b.price);
    if (!name || !L.int(b.category_id) || price <= 0) { req.flash('error', 'Name, category and a price above zero are required.'); return res.redirect(id ? `/admin/products/${id}/edit` : '/admin/products/new'); }
    const sale = String(b.sale_price || '').trim() === '' ? null : L.num(b.sale_price);
    const f = [L.int(b.category_id), name, String(b.description || ''), price, sale, Math.max(0, L.int(b.stock)), String(b.sku || '').trim(), String(b.brand || '').trim(), String(b.compatible_models || '').trim(), String(b.youtube_url || '').trim(), String(b.tags || '').trim(), String(b.badge || '').trim(), String(b.meta_title || '').trim(), String(b.meta_description || '').trim(), L.bool(b.free_shipping), L.bool(b.feature_free_shipping), L.bool(b.feature_returns), L.bool(b.feature_genuine), L.bool(b.feature_tested), L.bool(b.is_featured), L.bool(b.is_active)];
    let pid = id;
    db.transaction(() => {
      if (id) {
        db.run(`UPDATE products SET category_id=?,name=?,description=?,price=?,sale_price=?,stock=?,sku=?,brand=?,compatible_models=?,youtube_url=?,tags=?,badge=?,meta_title=?,meta_description=?,free_shipping=?,feature_free_shipping=?,feature_returns=?,feature_genuine=?,feature_tested=?,is_featured=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, ...f, id);
        const slug = String(b.slug || '').trim(); if (slug) db.run('UPDATE products SET slug=? WHERE id=?', uniqueSlug(slug, 'products', id), id);
      } else {
        pid = db.run(`INSERT INTO products(category_id,name,description,price,sale_price,stock,sku,brand,compatible_models,youtube_url,tags,badge,meta_title,meta_description,free_shipping,feature_free_shipping,feature_returns,feature_genuine,feature_tested,is_featured,is_active,slug) VALUES(${f.map(() => '?').join(',')},?)`, ...f, uniqueSlug(b.slug || name, 'products')).lastInsertRowid;
      }
      if (files.image && files.image[0]) { const old = db.get('SELECT image FROM products WHERE id=?', pid).image; db.run('UPDATE products SET image=? WHERE id=?', files.image[0].filename, pid); if (old && old !== files.image[0].filename && !db.get('SELECT 1 x FROM products WHERE image=? AND id!=?', old, pid) && !db.get('SELECT 1 x FROM product_images WHERE image=?', old)) upload.removeFile('', old); }
      if (L.bool(b.remove_image) && !(files.image && files.image[0])) db.run('UPDATE products SET image=NULL WHERE id=?', pid);
      (files.gallery || []).forEach((g, i) => db.run('INSERT INTO product_images(product_id,image,sort_order) VALUES(?,?,?)', pid, g.filename, 100 + i));
      let rm = b.remove_gallery || []; if (!Array.isArray(rm)) rm = [rm];
      rm.map(Number).filter(Boolean).forEach((gid) => { const g = db.get('SELECT * FROM product_images WHERE id=? AND product_id=?', gid, pid); if (g) { db.run('DELETE FROM product_images WHERE id=?', gid); upload.removeFile('', g.image); } });
      // variants: replace set, keeping ids that still exist
      const vin = b.variants ? (Array.isArray(b.variants) ? b.variants : Object.values(b.variants)) : [];
      const keep = [];
      vin.forEach((v, i) => {
        const label = String(v.label || '').trim(), vp = L.num(v.price); if (!label || vp <= 0) return;
        const vs = String(v.sale_price || '').trim() === '' ? null : L.num(v.sale_price);
        if (L.int(v.id) && db.get('SELECT id FROM product_variants WHERE id=? AND product_id=?', L.int(v.id), pid)) { db.run('UPDATE product_variants SET label=?,qty=?,price=?,sale_price=?,stock=?,sort_order=?,is_active=? WHERE id=?', label, Math.max(1, L.int(v.qty, 1)), vp, vs, Math.max(0, L.int(v.stock)), i, v.is_active ? 1 : 0, L.int(v.id)); keep.push(L.int(v.id)); }
        else keep.push(db.run('INSERT INTO product_variants(product_id,label,qty,price,sale_price,stock,sort_order,is_active) VALUES(?,?,?,?,?,?,?,?)', pid, label, Math.max(1, L.int(v.qty, 1)), vp, vs, Math.max(0, L.int(v.stock)), i, v.is_active ? 1 : 0).lastInsertRowid);
      });
      db.run(`DELETE FROM product_variants WHERE product_id=? ${keep.length ? 'AND id NOT IN (' + keep.join(',') + ')' : ''}`, pid);
    })();
    req.flash('success', id ? 'Product saved ✅' : 'Product created ✅');
    res.redirect(b.save_new ? '/admin/products/new' : `/admin/products/${pid}/edit`);
  });
  r.post('/products/:id/delete', (req, res) => { db.run('DELETE FROM products WHERE id=?', req.params.id); req.flash('success', 'Product deleted.'); res.redirect('/admin/products'); });
  r.post('/products/:id/duplicate', (req, res) => {
    const p = db.get('SELECT * FROM products WHERE id=?', req.params.id); if (!p) return res.redirect('/admin/products');
    const nid = db.run(`INSERT INTO products(category_id,name,slug,description,price,sale_price,stock,sku,image,brand,compatible_models,youtube_url,tags,badge,free_shipping,is_active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`, p.category_id, p.name + ' (copy)', uniqueSlug(p.slug + '-copy', 'products'), p.description, p.price, p.sale_price, p.stock, p.sku, p.image, p.brand, p.compatible_models, p.youtube_url, p.tags, p.badge, p.free_shipping).lastInsertRowid;
    db.all('SELECT * FROM product_variants WHERE product_id=?', p.id).forEach((v) => db.run('INSERT INTO product_variants(product_id,label,qty,price,sale_price,stock,sort_order,is_active) VALUES(?,?,?,?,?,?,?,?)', nid, v.label, v.qty, v.price, v.sale_price, v.stock, v.sort_order, v.is_active));
    req.flash('success', 'Duplicated as an inactive draft.'); res.redirect(`/admin/products/${nid}/edit`);
  });
  r.post('/products/:id/quick', (req, res) => { // inline price/stock edit from the list
    const b = req.body; db.run('UPDATE products SET price=COALESCE(?,price), sale_price=?, stock=COALESCE(?,stock) WHERE id=?', b.price ? L.num(b.price) : null, String(b.sale_price || '') === '' ? null : L.num(b.sale_price), b.stock !== undefined ? Math.max(0, L.int(b.stock)) : null, req.params.id);
    req.flash('success', 'Updated.'); res.redirect(req.get('referer') || '/admin/products');
  });
};
module.exports.uniqueSlug = uniqueSlug;
