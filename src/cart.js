'use strict';
const { db } = require('./db');
const settings = require('./settings');
const { effectivePrice } = require('./lib');
const shipping = require('./shipping');

const cartOf = (req) => (req.session.cart = req.session.cart || {});
const keyOf = (pid, vid) => `${pid}_${vid || 0}`;

function add(req, pid, vid, qty) {
  const c = cartOf(req); const k = keyOf(pid, vid);
  c[k] = { product_id: pid, variant_id: vid || 0, qty: Math.min(999, (c[k] ? c[k].qty : 0) + qty) };
}
function setQty(req, key, qty) { const c = cartOf(req); if (!c[key]) return; if (qty <= 0) delete c[key]; else c[key].qty = Math.min(qty, 999); }
function clear(req) { req.session.cart = {}; delete req.session.coupon; }
function count(req) { return Object.values(cartOf(req)).reduce((n, e) => n + e.qty, 0); }

/** Fresh DB-backed line items (prices are never trusted from the client). */
function items(req) {
  const out = [];
  for (const [key, e] of Object.entries(cartOf(req))) {
    const p = db.get('SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=? AND p.is_active=1', e.product_id);
    if (!p) { delete cartOf(req)[key]; continue; }
    let unit = effectivePrice(p), label = '', stock = p.stock, variant = null;
    if (e.variant_id) {
      variant = db.get('SELECT * FROM product_variants WHERE id=? AND product_id=? AND is_active=1', e.variant_id, p.id);
      if (variant) { unit = effectivePrice(variant); label = variant.label; stock = variant.stock; } else { delete cartOf(req)[key]; continue; }
    }
    const qty = Math.max(1, Math.min(e.qty, stock > 0 ? stock : e.qty));
    out.push({ key, product: p, variant, label, unit, qty, stock, line: Math.round(unit * qty * 100) / 100, inStock: stock > 0 });
  }
  return out;
}

function validateCoupon(code, subtotal) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'Enter a coupon code.' };
  const c = db.get('SELECT * FROM coupons WHERE code=? AND is_active=1', code);
  if (!c) return { ok: false, error: 'Invalid coupon code.' };
  const now = new Date().toISOString().slice(0, 10);
  if (c.used_count >= c.max_uses) return { ok: false, error: 'This coupon has been fully used.' };
  if (c.starts_at && now < c.starts_at) return { ok: false, error: 'This coupon is not active yet.' };
  if (c.expires_at && now > c.expires_at) return { ok: false, error: 'This coupon has expired.' };
  if (subtotal < c.min_order) return { ok: false, error: `Minimum order ${settings.get('currency')}${c.min_order} required for this coupon.` };
  let d = c.type === 'percent' ? subtotal * c.value / 100 : c.value;
  if (c.max_discount && d > c.max_discount) d = c.max_discount;
  return { ok: true, coupon: c, discount: Math.round(Math.min(d, subtotal) * 100) / 100 };
}

const r2 = (n) => Math.round(n * 100) / 100;
/** Full price breakdown. ctx: { pincode, state, city, method } */
function totals(req, ctx = {}) {
  const list = items(req);
  const subtotal = r2(list.reduce((s, i) => s + i.line, 0));
  let discount = 0, couponCode = null;
  if (req.session.coupon) {
    const v = validateCoupon(req.session.coupon, subtotal);
    if (v.ok) { discount = v.discount; couponCode = v.coupon.code; } else delete req.session.coupon;
  }
  const taxable = Math.max(0, subtotal - discount);
  const mode = settings.get('gst_mode'), pct = settings.get('gst_percent');
  let gst = 0, afterGst = taxable;
  if (mode === 'exclusive') { gst = r2(taxable * pct / 100); afterGst = r2(taxable + gst); }
  else if (mode === 'inclusive') { gst = r2(taxable - taxable / (1 + pct / 100)); }
  const hasFree = list.some((i) => i.product.free_shipping);
  const threshold = settings.get('free_shipping_above');
  const freeShip = list.length > 0 && (hasFree || (threshold > 0 && afterGst >= threshold));
  const q = shipping.quote(ctx);
  const shippingCharge = list.length === 0 || freeShip ? 0 : q.charge;
  const codFee = ctx.method === 'cod' ? settings.get('cod_fee') : 0;
  const total = r2(afterGst + shippingCharge + codFee);
  return { items: list, subtotal, discount, couponCode, gst, gstPct: pct, gstMode: mode, shipping: shippingCharge, freeShip, hasFree, codFee, total, zone: q, toFree: threshold > 0 && !freeShip ? Math.max(0, r2(threshold - afterGst)) : 0 };
}

module.exports = { cartOf, add, setQty, clear, count, items, totals, validateCoupon, keyOf };
