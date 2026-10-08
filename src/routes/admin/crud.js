'use strict';
const { db } = require('../../db');
const upload = require('../../upload');
const L = require('../../lib');
const { uniqueSlug } = require('./products');

const T = (name, label, type = 'text', extra = {}) => ({ name, label, type, ...extra });
const RES = {
  categories: { table: 'categories', title: 'Categories', sort: 'sort_order, name', slug: 'name', dir: 'cats', cols: ['image', 'name', 'slug', 'is_active'], sortable: true, toggle: true,
    fields: [T('name', 'Name *', 'text', { required: true }), T('slug', 'URL slug', 'text', { help: 'Auto-generated if blank.' }), T('description', 'Description', 'textarea'), T('image', 'Category image', 'image'), T('sort_order', 'Sort order', 'number', { def: 0 }), T('is_active', 'Visible', 'bool', { def: 1 })] },
  brands: { table: 'brands', title: 'Brands', sort: 'sort_order, name', dir: 'misc', cols: ['name', 'text_color', 'show_on_home', 'is_active'], sortable: true, toggle: true, help: 'Brands appear in the homepage brand strip (if that section is on) and in the enquiry form.',
    fields: [T('name', 'Brand name *', 'text', { required: true }), T('text_color', 'Text colour', 'color', { def: '#1a1f5e' }), T('font_style', 'Text style', 'select', { options: { bold: 'Bold', caps: 'UPPERCASE', lower: 'lowercase', italic: 'Italic' }, def: 'bold' }), T('logo', 'Logo image (optional, replaces text)', 'image'), T('show_on_home', 'Show on homepage strip', 'bool', { def: 1 }), T('sort_order', 'Sort order', 'number', { def: 0 }), T('is_active', 'Active', 'bool', { def: 1 })] },
  coupons: { table: 'coupons', title: 'Coupons', sort: 'id DESC', upper: ['code'], cols: ['code', 'type', 'value', 'min_order', 'used', 'expires_at', 'is_active'], toggle: true,
    fields: [T('code', 'Coupon code *', 'text', { required: true }), T('type', 'Type', 'select', { options: { percent: 'Percentage (%)', fixed: 'Fixed amount' }, def: 'percent' }), T('value', 'Value *', 'number', { required: true, step: 0.01 }), T('min_order', 'Minimum order', 'number', { def: 0 }), T('max_discount', 'Max discount (for %)', 'number', { help: 'Optional cap.', step: 0.01 }), T('max_uses', 'Total uses allowed', 'number', { def: 100 }), T('starts_at', 'Starts on', 'date'), T('expires_at', 'Expires on', 'date'), T('is_active', 'Active', 'bool', { def: 1 })] },
  shipping_zones: { table: 'shipping_zones', title: 'Shipping zones', sort: 'sort_order, id', cols: ['zone_name', 'zone_type', 'value', 'charge', 'days', 'is_active'], sortable: true, toggle: true, help: 'The most specific match wins: pincode prefix → city → state → default. Pincode value: comma-separated prefixes (226, 2260). State value: codes like UP, DL, MH — or the groups NE, JK, AN.',
    fields: [T('zone_name', 'Zone name *', 'text', { required: true }), T('zone_type', 'Match by', 'select', { options: { pincode: 'Pincode prefix', state: 'State code', city: 'City name', default: 'Default (everything else)' }, def: 'pincode' }), T('value', 'Value *', 'text', { required: true, help: 'e.g. 226  ·  UP  ·  Lucknow  ·  ALL' }), T('charge', 'Shipping charge', 'number', { def: 99, step: 0.01 }), T('min_days', 'Min days', 'number', { def: 3 }), T('max_days', 'Max days', 'number', { def: 5 }), T('sort_order', 'Sort order', 'number', { def: 0 }), T('is_active', 'Active', 'bool', { def: 1 })] },
  hero_slides: { table: 'hero_slides', title: 'Hero slides', sort: 'sort_order, id', dir: 'misc', cols: ['heading', 'btn1_label', 'is_active'], sortable: true, toggle: true, help: 'Wrap words in *stars* in the heading to colour them (e.g. “Free *Shipping*”). Colours/gradients: use any CSS colour or gradient like linear-gradient(135deg,#fff,#eef2ff). Button link “whatsapp” opens your WhatsApp chat.',
    fields: [T('tag', 'Small tag above heading', 'text'), T('heading', 'Heading * (new line = line break)', 'textarea', { required: true }), T('subtext', 'Sub text', 'textarea'), T('btn1_label', 'Button 1 label', 'text'), T('btn1_url', 'Button 1 link', 'text', { def: '/products' }), T('btn1_style', 'Button 1 style', 'select', { options: { red: 'Red (main)', navy: 'Primary', yellow: 'Accent', green: 'Green', whatsapp: 'WhatsApp', outline: 'Outline' }, def: 'red' }), T('btn2_label', 'Button 2 label', 'text'), T('btn2_url', 'Button 2 link', 'text'), T('btn2_style', 'Button 2 style', 'select', { options: { red: 'Red (main)', navy: 'Primary', yellow: 'Accent', green: 'Green', whatsapp: 'WhatsApp', outline: 'Outline' }, def: 'navy' }), T('bg', 'Background (colour or gradient)', 'text', { def: 'linear-gradient(135deg,#ffffff,#eef2ff)' }), T('text_color', 'Text colour', 'color', { def: '#111827' }), T('tag_color', 'Accent colour (tag & highlight)', 'color', { def: '#cc0000' }), T('emoji', 'Big emoji (if no image)', 'text'), T('image', 'Slide image (optional)', 'image'), T('sort_order', 'Order', 'number', { def: 0 }), T('is_active', 'Active', 'bool', { def: 1 })] },
  trust_items: { table: 'trust_items', title: 'Trust strip', sort: 'sort_order, id', cols: ['icon', 'title', 'subtitle', 'is_active'], sortable: true, toggle: true,
    fields: [T('icon', 'Icon / emoji', 'text', { def: '✅' }), T('title', 'Title *', 'text', { required: true }), T('subtitle', 'Subtitle', 'text'), T('sort_order', 'Order', 'number', { def: 0 }), T('is_active', 'Active', 'bool', { def: 1 })] },
  menu_items: { table: 'menu_items', title: 'Menus', sort: "location, sort_order, id", cols: ['location', 'label', 'url', 'is_active'], sortable: true, toggle: true, help: 'Location “Header menu bar” is the coloured bar under the header; “Footer links” appears in the footer. Use the type “All categories” once to auto-insert your category list.',
    fields: [T('location', 'Location', 'select', { options: { nav: 'Header menu bar', footer: 'Footer links' }, def: 'nav' }), T('kind', 'Type', 'select', { options: { link: 'Single link', categories: 'All categories (auto)' }, def: 'link' }), T('label', 'Label *', 'text', { required: true }), T('url', 'Link', 'text', { help: '/products?brand=HP  ·  /page/about  ·  https://…' }), T('bg_color', 'Background colour', 'color', { empty: true }), T('text_color', 'Text colour', 'color', { empty: true }), T('new_tab', 'Open in new tab', 'bool', { def: 0 }), T('sort_order', 'Order', 'number', { def: 0 }), T('is_active', 'Active', 'bool', { def: 1 })] },
  pages: { table: 'pages', title: 'Pages', sort: 'sort_order, id', slug: 'title', cols: ['title', 'slug', 'show_in_footer', 'is_active'], sortable: true, toggle: true, help: 'Pages are available at /page/<slug> and can be linked from menus or the footer.',
    fields: [T('title', 'Title *', 'text', { required: true }), T('slug', 'URL slug', 'text'), T('content', 'Content (HTML)', 'html'), T('meta_description', 'Meta description', 'text'), T('show_in_footer', 'Show in footer links', 'bool', { def: 1 }), T('sort_order', 'Order', 'number', { def: 0 }), T('is_active', 'Published', 'bool', { def: 1 })] },
  enquiries: { table: 'enquiries', title: 'Enquiries', sort: 'id DESC', cols: ['created_at', 'name', 'contact', 'printer', 'message', 'status'], noCreate: true,
    fields: [T('status', 'Status', 'select', { options: { new: 'New', replied: 'Replied', closed: 'Closed' } })] },
};

const val = (f, v) => {
  if (f.type === 'bool') return L.bool(v);
  if (f.type === 'number') return String(v ?? '').trim() === '' ? (f.def ?? null) : L.num(v);
  if (f.type === 'color') return L.isColor(String(v || '').trim()) ? String(v).trim() : '';
  if (f.type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null;
  return String(v ?? '').trim();
};

module.exports = (r) => {
  for (const [key, cfg] of Object.entries(RES)) {
    const base = '/' + key;
    const uploader = cfg.dir ? upload[cfg.dir].any() : (req, res, next) => next();
    const view = (req, res, edit) => {
      let rows = db.all(`SELECT * FROM ${cfg.table} ORDER BY ${cfg.sort}`);
      if (key === 'coupons') rows.forEach((x) => { x.used = `${x.used_count}/${x.max_uses}`; });
      if (key === 'shipping_zones') rows.forEach((x) => { x.days = `${x.min_days}–${x.max_days}d`; });
      if (key === 'enquiries') rows.forEach((x) => { x.contact = `${x.email}${x.phone ? ' · ' + x.phone : ''}`; x.printer = `${x.printer_brand || ''} ${x.printer_model || ''}`.trim(); });
      res.render('admin/crud', { title: cfg.title, cfg, key, rows, edit, active: '/admin' + base });
    };
    r.get(base, (req, res) => view(req, res, req.query.edit ? db.get(`SELECT * FROM ${cfg.table} WHERE id=?`, req.query.edit) : null));
    r.post(base, uploader, (req, res) => {
      const id = L.int(req.body.id), b = req.body, files = {};
      (req.files || []).forEach((f) => { files[f.fieldname] = f.filename; });
      const old = id ? db.get(`SELECT * FROM ${cfg.table} WHERE id=?`, id) : null;
      if (cfg.noCreate && !old) return res.redirect('/admin' + base);
      const data = {};
      for (const f of cfg.fields) {
        if (f.type === 'image') { if (files[f.name]) { data[f.name] = files[f.name]; if (old && old[f.name]) upload.removeFile(cfg.dir === 'cats' ? 'cats' : cfg.dir === 'misc' ? 'misc' : '', old[f.name]); } else if (b['remove_' + f.name] && old) { data[f.name] = null; upload.removeFile(cfg.dir === 'cats' ? 'cats' : 'misc', old[f.name]); } continue; }
        if (!(f.name in b) && f.type !== 'bool') continue;
        let v = val(f, b[f.name]); if (cfg.upper && cfg.upper.includes(f.name)) v = String(v).toUpperCase();
        if (f.required && (v === '' || v === null)) { req.flash('error', `${f.label.replace(' *', '')} is required.`); return res.redirect('/admin' + base + (id ? '?edit=' + id : '')); }
        data[f.name] = v;
      }
      if (cfg.slug) { const s = data.slug || (old && old.slug) || ''; data.slug = uniqueSlug(s || data[cfg.slug] || 'item', cfg.table, id); }
      try {
        if (old) { const cols = Object.keys(data); if (cols.length) db.run(`UPDATE ${cfg.table} SET ${cols.map((c) => c + '=?').join(',')} WHERE id=?`, ...cols.map((c) => data[c]), id); req.flash('success', 'Saved ✅'); }
        else { const cols = Object.keys(data); db.run(`INSERT INTO ${cfg.table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`, ...cols.map((c) => data[c])); req.flash('success', 'Added ✅'); }
      } catch (e) { req.flash('error', /UNIQUE/.test(e.message) ? 'That value already exists — it must be unique.' : e.message); return res.redirect('/admin' + base + (id ? '?edit=' + id : '')); }
      res.redirect('/admin' + base);
    });
    r.post(`${base}/:id/toggle`, (req, res) => { db.run(`UPDATE ${cfg.table} SET is_active=1-COALESCE(is_active,0) WHERE id=?`, req.params.id); res.redirect('/admin' + base); });
    r.post(`${base}/:id/move`, (req, res) => {
      const rows = db.all(`SELECT id FROM ${cfg.table} ORDER BY ${cfg.sort}`).map((x) => x.id), i = rows.indexOf(Number(req.params.id)), j = req.body.dir === 'up' ? i - 1 : i + 1;
      if (i > -1 && j > -1 && j < rows.length) { [rows[i], rows[j]] = [rows[j], rows[i]]; db.transaction(() => rows.forEach((id, n) => db.run(`UPDATE ${cfg.table} SET sort_order=? WHERE id=?`, n, id)))(); }
      res.redirect('/admin' + base);
    });
    r.post(`${base}/:id/delete`, (req, res) => {
      const old = db.get(`SELECT * FROM ${cfg.table} WHERE id=?`, req.params.id);
      if (old) { for (const f of cfg.fields) if (f.type === 'image' && old[f.name]) upload.removeFile(cfg.dir === 'cats' ? 'cats' : 'misc', old[f.name]); db.run(`DELETE FROM ${cfg.table} WHERE id=?`, req.params.id); req.flash('success', 'Deleted.'); }
      res.redirect('/admin' + base);
    });
  }
};
module.exports.RES = RES;
