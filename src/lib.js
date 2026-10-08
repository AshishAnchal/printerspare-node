'use strict';
const settings = require('./settings');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
const money = (n) => {
  const c = settings.get('currency') || '₹';
  const v = Number(n || 0);
  return c + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const money0 = (n) => (settings.get('currency') || '₹') + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const effectivePrice = (p) => (p.sale_price && p.sale_price < p.price ? p.sale_price : p.price);
const discountPct = (old, now) => (old && now && now < old ? Math.round((1 - now / old) * 100) : 0);
const orderNumber = () => {
  const d = new Date();
  const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return `ORD-${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
};
const paginate = (total, perPage, page) => {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pages);
  return { total, perPage, current, pages, offset: (current - 1) * perPage };
};
const youtubeId = (url) => { const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m ? m[1] : ''; };
const fmtDate = (d) => { if (!d) return ''; const dt = new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z')); return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }); };
const fmtDay = (d) => { if (!d) return ''; const dt = new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z')); return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }); };
// highlight markup:  "Free *Shipping*"  -> Free <span class="hl">Shipping</span>   (safe: escapes first)
const highlight = (s) => esc(s).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>').replace(/\n/g, '<br>');
const bool = (v) => (v === 'on' || v === '1' || v === 1 || v === true || v === 'true' ? 1 : 0);
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const isColor = (v) => /^#[0-9a-fA-F]{3,8}$/.test(String(v || ''));
// only allow CSS backgrounds that cannot break out of a style attribute
const safeBg = (v) => (/^[#a-zA-Z0-9\s,.()%\-/]+$/.test(String(v || '')) ? String(v) : '');

const STATES = { AN: 'Andaman & Nicobar', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar', CH: 'Chandigarh', CG: 'Chhattisgarh', DN: 'Dadra & Nagar Haveli and Daman & Diu', DL: 'Delhi', GA: 'Goa', GJ: 'Gujarat', HR: 'Haryana', HP: 'Himachal Pradesh', JK: 'Jammu & Kashmir', JH: 'Jharkhand', KA: 'Karnataka', KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep', MP: 'Madhya Pradesh', MH: 'Maharashtra', MN: 'Manipur', ML: 'Meghalaya', MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha', PY: 'Puducherry', PB: 'Punjab', RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu', TS: 'Telangana', TR: 'Tripura', UP: 'Uttar Pradesh', UK: 'Uttarakhand', WB: 'West Bengal' };
const stateCode = (name) => { const n = String(name || '').trim().toLowerCase(); for (const [c, s] of Object.entries(STATES)) if (s.toLowerCase() === n || c.toLowerCase() === n) return c; return ''; };

module.exports = { esc, slugify, money, money0, effectivePrice, discountPct, orderNumber, paginate, youtubeId, fmtDate, fmtDay, highlight, bool, num, int, isColor, safeBg, STATES, stateCode };
