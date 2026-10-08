'use strict';
const { db } = require('./db');
const settings = require('./settings');
const { stateCode } = require('./lib');

const NE = ['AS', 'AR', 'MN', 'ML', 'MZ', 'NL', 'SK', 'TR'];
const groupsFor = (code) => [code, NE.includes(code) ? 'NE' : null, ['JK', 'LA'].includes(code) ? 'JK' : null, code === 'AN' ? 'AN' : null].filter(Boolean);

/** Best matching zone: pincode prefix (longest) → city → state → default → flat setting */
function quote({ pincode = '', state = '', city = '' } = {}) {
  const flat = { charge: settings.get('shipping_charge'), zone: 'Standard', min_days: 3, max_days: 5, label: settings.get('delivery_days_default') };
  if (!settings.get('use_shipping_zones')) return flat;
  const zones = db.all('SELECT * FROM shipping_zones WHERE is_active=1 ORDER BY sort_order, id');
  let z = null;
  const pin = String(pincode).replace(/\D/g, '');
  if (pin) {
    const m = zones.filter((x) => x.zone_type === 'pincode' && x.value.split(',').some((v) => v.trim() && pin.startsWith(v.trim())));
    m.sort((a, b) => Math.max(...b.value.split(',').map((v) => v.trim().length)) - Math.max(...a.value.split(',').map((v) => v.trim().length)));
    z = m[0] || null;
  }
  if (!z && city) z = zones.find((x) => x.zone_type === 'city' && x.value.toLowerCase().split(',').map((s) => s.trim()).includes(String(city).toLowerCase().trim())) || null;
  if (!z && state) {
    const codes = groupsFor(stateCode(state) || String(state).toUpperCase());
    z = zones.find((x) => x.zone_type === 'state' && x.value.split(',').some((v) => codes.includes(v.trim().toUpperCase()))) || null;
  }
  if (!z) z = zones.find((x) => x.zone_type === 'default') || null;
  if (!z) return flat;
  return { charge: z.charge, zone: z.zone_name, min_days: z.min_days, max_days: z.max_days, label: `${z.min_days}–${z.max_days} business days` };
}
module.exports = { quote };
