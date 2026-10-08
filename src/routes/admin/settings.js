'use strict';
const settings = require('../../settings');
const upload = require('../../upload');
const mailer = require('../../mailer');
const L = require('../../lib');

const APPEARANCE_KEYS = ['theme_preset', 'color_primary', 'color_primary_dark', 'color_accent', 'color_button', 'color_price', 'color_success', 'color_bg', 'color_surface', 'color_card', 'color_text', 'color_muted', 'color_border', 'font', 'radius', 'container_width', 'header_style', 'sticky_header', 'card_style', 'grid_cols', 'image_fit', 'logo_shape', 'ann_enabled', 'ann_text', 'ann_link', 'ann_bg', 'ann_color', 'ann_dismissible', 'custom_css'];

function save(req, keys) {
  const files = {}; (req.files || []).forEach((f) => { files[f.fieldname] = f.filename; });
  const out = {};
  for (const k of keys) {
    const f = settings.BY_KEY[k]; if (!f) continue;
    const b = req.body[k];
    if (f.type === 'bool') out[k] = L.bool(b) ? 1 : 0;
    else if (f.type === 'image') { if (files[k]) out[k] = files[k]; else if (req.body['remove_' + k]) out[k] = ''; }
    else if (f.type === 'password') { if (b && String(b).trim()) out[k] = String(b).trim(); else if (req.body['clear_' + k]) out[k] = ''; }
    else if (f.type === 'number') { if (String(b ?? '') !== '') out[k] = L.num(b, f.def); }
    else if (f.type === 'color') { if (L.isColor(b)) out[k] = b; }
    else if (f.type === 'select') { if (b !== undefined && (f.key === 'theme_preset' || f.options[b] !== undefined)) out[k] = b; }
    else if (b !== undefined) out[k] = String(b);
  }
  if ('whatsapp' in out) out.whatsapp = out.whatsapp.replace(/\D/g, '');
  settings.setMany(out);
}

module.exports = (r) => {
  r.get('/settings', (req, res) => {
    const vals = settings.all();
    const secrets = {}; settings.SCHEMA.forEach((f) => { if (f.type === 'password') secrets[f.key] = !!vals[f.key]; });
    res.render('admin/settings', { title: 'Settings', GROUPS: settings.GROUPS.filter((g) => g.id !== 'theme'), SCHEMA: settings.SCHEMA, vals, secrets, active: '/admin/settings' });
  });
  r.post('/settings', upload.misc.any(), (req, res) => {
    const keys = String(req.body._fields || '').split(',').filter(Boolean);
    save(req, keys); req.flash('success', 'Settings saved ✅'); res.redirect('/admin/settings');
  });
  r.post('/settings/test-email', async (req, res) => {
    const to = String(req.body.to || settings.get('admin_notify_email') || settings.get('email'));
    const ok = await mailer.send(to, 'Test email from ' + settings.get('store_name'), '<p>Your SMTP settings work. 🎉</p>');
    req.flash(ok ? 'success' : 'error', ok ? 'Test email sent to ' + to : 'Could not send. Check host, port, SSL, username and password.'); res.redirect('/admin/settings');
  });

  r.get('/appearance', (req, res) => res.render('admin/appearance', { title: 'Appearance', fields: APPEARANCE_KEYS.map((k) => settings.BY_KEY[k]), vals: settings.all(), PRESETS: settings.PRESETS, active: '/admin/appearance' }));
  r.post('/appearance', (req, res) => {
    if (req.body.reset) { const p = settings.PRESETS.original; const o = { theme_preset: 'original', font: 'inter', radius: 10, container_width: 1280, header_style: 'classic', card_style: 'shadow', grid_cols: '4', image_fit: 'contain', logo_shape: 'circle', sticky_header: 1 }; for (const [k, v] of Object.entries(p)) if (k !== 'label') o[k] = v; settings.setMany(o); req.flash('success', 'Theme reset to the original look.'); return res.redirect('/admin/appearance'); }
    save(req, APPEARANCE_KEYS); req.flash('success', 'Appearance saved — your store is updated ✅'); res.redirect('/admin/appearance');
  });
};
