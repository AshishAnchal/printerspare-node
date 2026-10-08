'use strict';
const settings = require('./settings');
const token = () => { const t = String(settings.get('delhivery_token') || '').trim(); return t ? (/^token /i.test(t) ? t : 'Token ' + t) : ''; };
const enabled = () => !!token();

async function getJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try { const r = await fetch(url, { headers: { Authorization: token(), Accept: 'application/json' }, signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
/** → { serviceable, city, state, district, source } */
async function pincode(pin) {
  if (!/^\d{6}$/.test(pin)) return { serviceable: false, message: 'Enter a valid 6-digit pincode', source: 'validation' };
  if (!enabled() || settings.get('pincode_check_mode') === 'off') return { serviceable: true, city: '', state: '', source: 'default' };
  try {
    const d = await getJSON('https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=' + pin);
    const p = d && d.delivery_codes && d.delivery_codes[0] && d.delivery_codes[0].postal_code;
    if (!p) return { serviceable: false, message: 'Delivery not available at this pincode', source: 'delhivery' };
    return { serviceable: true, city: p.city || '', state: p.state_code || '', district: p.district || '', cod: p.cod === 'Y', source: 'delhivery' };
  } catch (e) { return { serviceable: true, city: '', state: '', source: 'fallback' }; } // never block customers because an API is down
}
async function track(awb) {
  if (!enabled()) throw new Error('Tracking is not configured yet (add the Delhivery token in Settings → Shipping).');
  const d = await getJSON('https://track.delhivery.com/api/v1/packages/json/?waybill=' + encodeURIComponent(awb));
  const s = d && d.ShipmentData && d.ShipmentData[0] && d.ShipmentData[0].Shipment;
  if (!s) throw new Error('No shipment found for ' + awb);
  return s;
}
module.exports = { pincode, track, enabled };
