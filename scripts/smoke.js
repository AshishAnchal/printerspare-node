'use strict';
// End-to-end smoke test: node scripts/smoke.js [baseUrl]   (server must be running)
const base = process.argv[2] || 'http://localhost:3000';
let fails = 0;
function client() {
  const jar = {};
  const call = async (method, url, body, extra = {}) => {
    const headers = { Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...extra };
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(body).toString(); }
    const r = await fetch(base + url, { method, headers, body, redirect: 'manual' });
    (r.headers.getSetCookie ? r.headers.getSetCookie() : []).forEach((c) => { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); });
    const text = await r.text(); return { status: r.status, loc: r.headers.get('location'), text };
  };
  return { get: (u) => call('GET', u), post: (u, b, h) => call('POST', u, b, h) };
}
const ok = (name, cond, info = '') => { if (!cond) fails++; console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '  ' + info)); };
const csrfOf = (html) => (html.match(/name="_csrf" value="([a-f0-9]+)"/) || html.match(/data-csrf="([a-f0-9]+)"/) || [])[1];

(async () => {
  console.log('Storefront');
  const c = client(); let r = await c.get('/'); const csrf = csrfOf(r.text);
  ok('home renders sections', r.status === 200 && /hero-slide/.test(r.text) && /pcard/.test(r.text) && /trust-item/.test(r.text));
  ok('csrf token present', !!csrf);
  r = await c.post('/cart/add', { _csrf: csrf, product_id: 1, qty: 2 }); ok('add to cart', r.status === 302);
  r = await c.post('/cart/coupon', { _csrf: csrf, code: 'printer20' }); r = await c.get('/cart');
  ok('cart shows item + coupon', /PRINTER20/.test(r.text) && /Order Summary/.test(r.text));
  r = await c.post('/cart/add', { _csrf: 'bad', product_id: 1 }); ok('bad csrf rejected', r.status === 302 && !/cart$/.test(r.loc || ''), r.loc);
  r = await c.get('/checkout'); ok('checkout renders', r.status === 200 && /Place Order/.test(r.text));
  let q = await (await fetch(base + '/api/pincode?pin=226010')).json(); ok('pincode api (Lucknow zone)', q.ok && q.zone === 'Lucknow Local' && q.charge === 49, JSON.stringify(q));
  const form = { _csrf: csrf, name: 'Test Buyer', email: 'buyer@example.com', phone: '9876543210', address: '12 Test Street', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226010', payment_method: 'cod' };
  r = await c.post('/checkout', { ...form, name: '' }); ok('validation errors shown', r.status === 400 && /full name/i.test(r.text));
  r = await c.post('/checkout', form); ok('COD order placed → success page', r.status === 302 && /order-success/.test(r.loc || ''), r.status + ' ' + r.loc);
  const num = (r.loc || '').split('/').pop();
  r = await c.get('/order-success/' + num); ok('success page', r.status === 200 && r.text.includes(num));
  r = await c.post('/track', { _csrf: csrf, order: num, contact: 'buyer@example.com' }); ok('track by order+email', /Order #/.test(r.text) && r.text.includes(num));
  r = await c.post('/track', { _csrf: csrf, order: num, contact: 'wrong@example.com' }); ok('track rejects wrong contact', /could not find/i.test(r.text));
  r = await c.get('/invoice/' + num); ok('invoice', r.status === 200 && /INVOICE/.test(r.text));
  r = await c.post('/register', { _csrf: csrf, name: 'Reg User', email: `u${Date.now()}@example.com`, password: 'secret12', password2: 'secret12' }); ok('register', r.status === 302);
  r = await c.get('/account'); ok('account dashboard', r.status === 200 && /Hello, Reg/.test(r.text));
  r = await c.post('/enquiry', { _csrf: csrf, name: 'E', email: 'e@example.com', message: 'need part' }); ok('enquiry', r.status === 302);
  r = await c.get('/wishlist/items?ids=1,2'); ok('wishlist items', /pcard/.test(r.text));
  r = await c.get('/product.php?slug=hp-803-black-ink'); ok('legacy PHP url redirects', r.status === 301 && r.loc === '/product/hp-803-black-ink');

  console.log('Admin');
  const a = client(); r = await a.get('/admin'); ok('admin protected', r.status === 302 && /login/.test(r.loc));
  r = await a.get('/admin/login'); const ac = csrfOf(r.text);
  r = await a.post('/admin/login', { _csrf: ac, username: 'admin', password: 'wrong' }); ok('bad login rejected', r.status === 401);
  r = await a.post('/admin/login', { _csrf: ac, username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' }); ok('login', r.status === 302, r.status);
  const pages = ['/admin', '/admin/orders', '/admin/orders/1', '/admin/customers', '/admin/coupons', '/admin/coupons?edit=1', '/admin/enquiries', '/admin/reviews', '/admin/products', '/admin/products/new', '/admin/products/1/edit', '/admin/categories', '/admin/categories?edit=1', '/admin/brands', '/admin/import', '/admin/appearance', '/admin/homepage', '/admin/homepage?edit=5', '/admin/homepage?type=banner', '/admin/hero_slides', '/admin/hero_slides?edit=1', '/admin/trust_items', '/admin/menu_items', '/admin/pages', '/admin/pages?edit=1', '/admin/settings', '/admin/shipping_zones', '/admin/media', '/admin/subscribers', '/admin/account', '/admin/backup', '/admin/orders/1/invoice', '/admin/orders/export.csv', '/admin/import/products.csv'];
  for (const p of pages) { r = await a.get(p); ok('GET ' + p, r.status === 200, r.status + ' ' + (r.text.match(/<pre>([\s\S]{0,300})/) || [])[1]); }
  const ac2 = csrfOf((await a.get('/admin/settings')).text);
  r = await a.post('/admin/orders/1', { _csrf: ac2, order_status: 'confirmed', payment_status: 'pending', awb: 'TEST123', courier: 'Delhivery', admin_notes: 'n' }); ok('update order', r.status === 302);
  r = await a.post('/admin/appearance', { _csrf: ac2, theme_preset: 'emerald', color_primary: '#064e3b', color_button: '#059669', font: 'poppins', radius: 16, card_style: 'border', grid_cols: '3', header_style: 'light' });
  const css = await (await fetch(base + '/theme.css')).text(); ok('theme change applied to /theme.css', r.status === 302 && /--primary:#064e3b/.test(css) && /Poppins/.test(css) && /--radius:16px/.test(css) && /--cols:3/.test(css));
  r = await a.get('/'); ok('home uses new card/header style', /card-border/.test(r.text) && /hdr-light/.test(r.text));
  r = await a.post('/admin/appearance', { _csrf: ac2, reset: 1 });
  r = await a.post('/admin/settings', { _csrf: ac2, _fields: 'store_name,cod_fee,show_wishlist,cod_enabled', store_name: 'Printer Spare', cod_fee: '40', cod_enabled: 'on' }); r = await a.get('/'); ok('settings: wishlist toggle off hides heart', !/data-wish/.test(r.text));
  const c2 = client(); r = await c2.get('/'); const cs = csrfOf(r.text); await c2.post('/cart/add', { _csrf: cs, product_id: 1 }); r = await (await fetch(base + '/checkout/quote?method=cod&pincode=226010', { headers: { Cookie: '' } })).json();
  r = await a.post('/admin/settings', { _csrf: ac2, _fields: 'cod_fee,show_wishlist,cod_enabled', cod_fee: '0', show_wishlist: 'on', cod_enabled: 'on' });
  r = await a.post('/admin/homepage/5/move', { _csrf: ac2, dir: 'up' }); ok('reorder homepage section', r.status === 302);
  r = await a.post('/admin/coupons', { _csrf: ac2, id: '', code: 'test5', type: 'fixed', value: '5', min_order: '0', max_uses: '3', is_active: 'on' }); r = await a.get('/admin/coupons'); ok('create coupon (crud)', /TEST5/.test(r.text));
  r = await a.post('/admin/homepage', { _csrf: ac2, type: 'banner', title: 'Promo', heading: 'Sale!', text: 'x', btn1_label: 'Go', btn1_url: '/products', bg: '#111', color: '#fff' }); ok('add homepage section', r.status === 302);
  console.log(fails ? `\n${fails} FAILED` : '\nAll checks passed ✅'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
