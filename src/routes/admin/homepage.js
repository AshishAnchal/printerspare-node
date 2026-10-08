'use strict';
const { db } = require('../../db');

const BG = { white: 'White', light: 'Light grey', dark: 'Primary colour (dark)' };
const TYPES = {
  hero: { label: '🖼️ Hero slider', note: 'Edit the slides under Hero slides.', fields: [['autoplay_ms', 'Slide change every (ms)', 'number', 4500]] },
  trust: { label: '✅ Trust strip', note: 'Edit the items under Trust strip.', fields: [] },
  brands: { label: '🏷️ Brand logos', note: 'Edit brands under Brands.', fields: [['heading', 'Heading', 'text', '— Parts Available —']] },
  categories: { label: '🗂️ Category grid', fields: [['heading', 'Heading', 'text', 'Top Categories'], ['bg', 'Background', 'select', 'light', BG]] },
  products: { label: '📦 Product row', fields: [['heading', 'Heading', 'text', 'New Arrival'], ['source', 'Show', 'source', 'newest'], ['limit', 'How many', 'number', 8], ['layout', 'Layout', 'select', 'grid', { grid: 'Grid', scroll: 'Horizontal scroll' }], ['bg', 'Background', 'select', 'white', BG], ['link_label', 'Link label', 'text', 'View all'], ['link_url', 'Link URL', 'text', '/products']] },
  category_blocks: { label: '🧱 One block per category', fields: [['limit', 'Products per block', 'number', 8], ['max_categories', 'Max categories shown', 'number', 10]] },
  cta: { label: '📣 Call-to-action band', fields: [['heading', 'Heading', 'text', ''], ['text', 'Text', 'text', ''], ['btn1_label', 'Button 1 label', 'text', ''], ['btn1_url', 'Button 1 link (or “whatsapp”)', 'text', '/enquiry'], ['btn2_label', 'Button 2 label', 'text', ''], ['btn2_url', 'Button 2 link (or “whatsapp”)', 'text', 'whatsapp']] },
  banner: { label: '🎉 Promo banner', fields: [['heading', 'Heading', 'text', ''], ['text', 'Text', 'text', ''], ['btn1_label', 'Button label', 'text', 'Shop now'], ['btn1_url', 'Button link', 'text', '/products'], ['bg', 'Background (colour/gradient)', 'text', 'linear-gradient(135deg,#1a1f5e,#2d3494)'], ['color', 'Text colour', 'color', '#ffffff']] },
  html: { label: '🧑‍💻 Custom HTML', fields: [['html', 'HTML', 'html', '']] },
  newsletter: { label: '📬 Newsletter signup', fields: [['heading', 'Heading', 'text', 'Get deals in your inbox'], ['text', 'Text', 'text', 'New parts, price drops and exclusive coupons.']] },
};

module.exports = (r) => {
  r.get('/homepage', (req, res) => {
    const rows = db.all('SELECT * FROM home_sections ORDER BY sort_order,id');
    const edit = req.query.edit ? db.get('SELECT * FROM home_sections WHERE id=?', req.query.edit) : null;
    res.render('admin/homepage', { title: 'Homepage builder', rows, edit, editCfg: edit ? JSON.parse(edit.config || '{}') : {}, TYPES, cats: db.all('SELECT name,slug FROM categories ORDER BY name'), brands: db.all('SELECT name FROM brands ORDER BY name'), newType: TYPES[req.query.type] ? req.query.type : '', active: '/admin/homepage' });
  });
  r.post('/homepage', (req, res) => {
    const b = req.body, id = Number(b.id) || 0, t = TYPES[b.type]; if (!t) return res.redirect('/admin/homepage');
    const cfg = {}; for (const [k, , type, def] of t.fields) { const v = b[k]; cfg[k] = type === 'number' ? (Number(v) || def) : (v === undefined ? def : String(v)); }
    const title = String(b.title || '').trim() || t.label.replace(/^\S+\s/, '');
    if (id) { db.run('UPDATE home_sections SET title=?, config=? WHERE id=?', title, JSON.stringify(cfg), id); req.flash('success', 'Section saved ✅'); }
    else { const n = db.get('SELECT COALESCE(MAX(sort_order),0)+1 n FROM home_sections').n; db.run('INSERT INTO home_sections(type,title,config,sort_order,is_active) VALUES(?,?,?,?,1)', b.type, title, JSON.stringify(cfg), n); req.flash('success', 'Section added to the bottom of your homepage ✅'); }
    res.redirect('/admin/homepage');
  });
  r.post('/homepage/:id/toggle', (req, res) => { db.run('UPDATE home_sections SET is_active=1-is_active WHERE id=?', req.params.id); res.redirect('/admin/homepage'); });
  r.post('/homepage/:id/delete', (req, res) => { db.run('DELETE FROM home_sections WHERE id=?', req.params.id); req.flash('success', 'Section removed.'); res.redirect('/admin/homepage'); });
  r.post('/homepage/:id/duplicate', (req, res) => { const s = db.get('SELECT * FROM home_sections WHERE id=?', req.params.id); if (s) db.run('INSERT INTO home_sections(type,title,config,sort_order,is_active) VALUES(?,?,?,?,0)', s.type, s.title + ' (copy)', s.config, s.sort_order + 1); res.redirect('/admin/homepage'); });
  r.post('/homepage/:id/move', (req, res) => {
    const ids = db.all('SELECT id FROM home_sections ORDER BY sort_order,id').map((x) => x.id), i = ids.indexOf(Number(req.params.id)), j = req.body.dir === 'up' ? i - 1 : i + 1;
    if (i > -1 && j > -1 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; db.transaction(() => ids.forEach((id, n) => db.run('UPDATE home_sections SET sort_order=? WHERE id=?', n, id)))(); }
    res.redirect('/admin/homepage');
  });
};
