'use strict';
const { db } = require('./db');

/* ------------------------------------------------------------------
 * Every customisable option in the store is declared here once.
 * The admin "Settings" screen is generated from this schema, so adding
 * a new option = adding one line below.
 * type: text | textarea | html | number | select | bool | color | password | image
 * env : optional environment-variable fallback (used when value is empty)
 * ------------------------------------------------------------------ */
const FONTS = {
  inter: ['Inter', 'Inter:wght@400;500;600;700;800;900'],
  poppins: ['Poppins', 'Poppins:wght@400;500;600;700;800'],
  roboto: ['Roboto', 'Roboto:wght@400;500;700;900'],
  dmsans: ['DM Sans', 'DM+Sans:wght@400;500;700'],
  nunito: ['Nunito', 'Nunito:wght@400;600;700;800;900'],
  lora: ['Lora', 'Lora:wght@400;600;700'],
  system: ['system-ui', null],
};

const GROUPS = [
  { id: 'store', label: 'Store & Contact', icon: '🏪' },
  { id: 'theme', label: 'Colours & Fonts', icon: '🎨' },
  { id: 'layout', label: 'Layout & Display', icon: '🧩' },
  { id: 'announce', label: 'Announcement Bar', icon: '📣' },
  { id: 'commerce', label: 'Pricing, GST & Checkout', icon: '🧾' },
  { id: 'payments', label: 'Payments (Razorpay)', icon: '💳' },
  { id: 'shipping', label: 'Shipping & Tracking', icon: '🚚' },
  { id: 'email', label: 'Email (SMTP)', icon: '✉️' },
  { id: 'labels', label: 'Text & Labels', icon: '🔤' },
  { id: 'seo', label: 'SEO & Scripts', icon: '🔎' },
  { id: 'maintenance', label: 'Maintenance Mode', icon: '🛠️' },
];

const F = (group, key, label, type, def, extra = {}) => ({ group, key, label, type, def, ...extra });
const SCHEMA = [
  // ---- store
  F('store', 'store_name', 'Store name', 'text', 'Printer Spare'),
  F('store', 'tagline', 'Tagline (under logo)', 'text', 'Genuine · Compatible · Fast'),
  F('store', 'logo_emoji', 'Logo emoji (used if no logo image)', 'text', '🖨️'),
  F('store', 'logo_image', 'Logo image', 'image', '', { help: 'Square PNG/JPG works best. Overrides the emoji.' }),
  F('store', 'logo_shape', 'Logo shape', 'select', 'circle', { options: { circle: 'Circle', rounded: 'Rounded square', none: 'No frame' } }),
  F('store', 'email', 'Support email', 'text', 'support@printerspare.com'),
  F('store', 'phone', 'Phone', 'text', '+91 81276 93845'),
  F('store', 'whatsapp', 'WhatsApp number (with country code, digits only)', 'text', '918127693845'),
  F('store', 'address', 'Address', 'text', 'Gomti Nagar, Lucknow, Uttar Pradesh'),
  F('store', 'business_hours', 'Business hours', 'text', 'Mon–Sat: 9am–6pm'),
  F('store', 'footer_about', 'Footer “about” text', 'textarea', "India's trusted source for genuine & compatible printer spare parts. HP, Canon, Epson, Brother & more."),
  F('store', 'footer_note', 'Footer small print', 'text', 'All prices in INR.'),
  F('store', 'delivery_note', 'Footer delivery note', 'text', '📦 Pan India Delivery via Delhivery'),
  F('store', 'social_facebook', 'Facebook URL', 'text', ''),
  F('store', 'social_instagram', 'Instagram URL', 'text', ''),
  F('store', 'social_youtube', 'YouTube URL', 'text', ''),
  F('store', 'social_twitter', 'X / Twitter URL', 'text', ''),
  F('store', 'site_url', 'Public website URL (for sitemap/emails)', 'text', '', { env: 'SITE_URL', help: 'e.g. https://printerspare.com' }),

  // ---- theme
  F('theme', 'theme_preset', 'Preset', 'select', 'original', { options: {}, help: 'Pick a preset, then fine-tune the colours below. Use the Appearance page for a live preview.' }),
  F('theme', 'color_primary', 'Primary (header, headings, buttons)', 'color', '#1a1f5e'),
  F('theme', 'color_primary_dark', 'Primary — dark shade', 'color', '#0f1340'),
  F('theme', 'color_accent', 'Accent (highlights, borders)', 'color', '#fbbf24'),
  F('theme', 'color_button', 'Main button / sale colour', 'color', '#cc0000'),
  F('theme', 'color_price', 'Price colour', 'color', '#cc0000'),
  F('theme', 'color_success', 'Success / WhatsApp-green', 'color', '#00a650'),
  F('theme', 'color_bg', 'Page background', 'color', '#ffffff'),
  F('theme', 'color_surface', 'Alternate section background', 'color', '#f5f5f0'),
  F('theme', 'color_card', 'Card background', 'color', '#ffffff'),
  F('theme', 'color_text', 'Body text', 'color', '#111827'),
  F('theme', 'color_muted', 'Muted text', 'color', '#6b7280'),
  F('theme', 'color_border', 'Borders', 'color', '#e5e7eb'),
  F('theme', 'font', 'Font family', 'select', 'inter', { options: { inter: 'Inter', poppins: 'Poppins', roboto: 'Roboto', dmsans: 'DM Sans', nunito: 'Nunito', lora: 'Lora (serif)', system: 'System default (fastest)' } }),
  F('theme', 'radius', 'Corner roundness (px)', 'number', 10, { min: 0, max: 28 }),

  // ---- layout
  F('layout', 'container_width', 'Page width (px)', 'number', 1280, { min: 960, max: 1600 }),
  F('layout', 'header_style', 'Header style', 'select', 'classic', { options: { classic: 'Classic (dark bar)', light: 'Light (white bar)', centered: 'Centered logo' } }),
  F('layout', 'sticky_header', 'Sticky header', 'bool', 1),
  F('layout', 'show_cat_nav', 'Show category menu bar under header', 'bool', 1),
  F('layout', 'show_search_category', 'Category dropdown inside search box', 'bool', 1),
  F('layout', 'grid_cols', 'Products per row (desktop)', 'select', '4', { options: { 3: '3', 4: '4', 5: '5', 6: '6' } }),
  F('layout', 'card_style', 'Product card style', 'select', 'shadow', { options: { shadow: 'Soft shadow', border: 'Outlined', flat: 'Flat (minimal)' } }),
  F('layout', 'image_fit', 'Product image fit', 'select', 'contain', { options: { contain: 'Show whole image', cover: 'Fill (crop)' } }),
  F('layout', 'products_per_page', 'Products per page (shop)', 'number', 16, { min: 4, max: 60 }),
  F('layout', 'show_out_of_stock', 'List out-of-stock products', 'bool', 1),
  F('layout', 'show_ratings', 'Show star ratings (real customer reviews)', 'bool', 1),
  F('layout', 'enable_reviews', 'Let customers write reviews', 'bool', 1),
  F('layout', 'show_wishlist', 'Wishlist heart on cards', 'bool', 1),
  F('layout', 'show_sale_badge', '“Save %” badge on cards', 'bool', 1),
  F('layout', 'show_brand_on_card', 'Show brand name on cards', 'bool', 1),
  F('layout', 'show_pincode_checker', 'Pincode delivery checker on product page', 'bool', 1),
  F('layout', 'show_share', 'Share buttons on product page', 'bool', 1),
  F('layout', 'show_related', 'Related products', 'bool', 1),
  F('layout', 'show_whatsapp_float', 'Floating WhatsApp button', 'bool', 1),
  F('layout', 'show_newsletter', 'Newsletter box in footer', 'bool', 1),
  F('layout', 'show_scroll_top', '“Back to top” button', 'bool', 1),
  F('layout', 'whatsapp_position', 'WhatsApp button side', 'select', 'right', { options: { right: 'Right', left: 'Left' } }),

  // ---- announcement
  F('announce', 'ann_enabled', 'Show announcement bar', 'bool', 1),
  F('announce', 'ann_text', 'Message', 'text', '🚀 <b>FREE Shipping</b> above {free_shipping} &nbsp;⚡ Code: <b>PRINTER20</b> = 20% OFF &nbsp;📞 <b>{phone}</b>', { help: 'HTML allowed. Placeholders: {free_shipping} {phone} {store_name}' }),
  F('announce', 'ann_link', 'Link (optional)', 'text', ''),
  F('announce', 'ann_bg', 'Background', 'color', '#1a1f5e'),
  F('announce', 'ann_color', 'Text colour', 'color', '#fbbf24'),
  F('announce', 'ann_dismissible', 'Visitors can close it', 'bool', 0),

  // ---- commerce
  F('commerce', 'currency', 'Currency symbol', 'text', '₹'),
  F('commerce', 'gst_mode', 'GST handling', 'select', 'exclusive', { options: { exclusive: 'Add GST on top of product prices (original behaviour)', inclusive: 'Prices already include GST (show breakdown only)', none: 'No GST' } }),
  F('commerce', 'gst_percent', 'GST %', 'number', 18, { min: 0, max: 40, step: 0.5 }),
  F('commerce', 'free_shipping_above', 'Free shipping above (order total)', 'number', 999, { help: '0 disables free shipping by threshold.' }),
  F('commerce', 'shipping_charge', 'Default shipping charge', 'number', 99),
  F('commerce', 'use_shipping_zones', 'Use shipping zones (pincode / state rates)', 'bool', 1),
  F('commerce', 'cod_enabled', 'Cash on Delivery', 'bool', 1),
  F('commerce', 'cod_min_order', 'COD minimum order value', 'number', 0, { help: '0 = no minimum.' }),
  F('commerce', 'cod_max_order', 'COD maximum order value', 'number', 0, { help: '0 = no maximum.' }),
  F('commerce', 'cod_fee', 'COD handling fee', 'number', 0),
  F('commerce', 'online_enabled', 'Online payment (Razorpay)', 'bool', 1),
  F('commerce', 'min_order_value', 'Minimum order value', 'number', 0),
  F('commerce', 'guest_checkout', 'Allow guest checkout', 'bool', 1),
  F('commerce', 'low_stock_threshold', 'Low-stock warning at', 'number', 10),
  F('commerce', 'return_days', 'Return window (days)', 'number', 30),
  F('commerce', 'delivery_days_default', 'Default delivery estimate', 'text', '3–5 business days'),

  // ---- payments
  F('payments', 'razorpay_key_id', 'Razorpay Key ID', 'text', '', { env: 'RAZORPAY_KEY_ID' }),
  F('payments', 'razorpay_key_secret', 'Razorpay Key Secret', 'password', '', { env: 'RAZORPAY_KEY_SECRET', help: 'Stored on the server only. Leave blank to keep the current value.' }),
  F('payments', 'razorpay_theme', 'Checkout window colour', 'color', '#1a1f5e'),

  // ---- shipping
  F('shipping', 'delhivery_token', 'Delhivery API token', 'password', '', { env: 'DELHIVERY_TOKEN', help: 'Used for pincode serviceability and order tracking. Paste the full “Token xxxx” value.' }),
  F('shipping', 'pincode_check_mode', 'Pincode checker', 'select', 'auto', { options: { auto: 'Use Delhivery if token set, else always serviceable', off: 'Never block any pincode' } }),
  F('shipping', 'default_courier', 'Default courier name', 'text', 'Delhivery'),

  // ---- email
  F('email', 'smtp_host', 'SMTP host', 'text', '', { env: 'SMTP_HOST' }),
  F('email', 'smtp_port', 'SMTP port', 'number', 465, { env: 'SMTP_PORT' }),
  F('email', 'smtp_secure', 'Use SSL/TLS (port 465)', 'bool', 1),
  F('email', 'smtp_user', 'SMTP username', 'text', '', { env: 'SMTP_USER' }),
  F('email', 'smtp_pass', 'SMTP password', 'password', '', { env: 'SMTP_PASS' }),
  F('email', 'mail_from_name', 'From name', 'text', ''),
  F('email', 'admin_notify_email', 'Send new-order alerts to', 'text', ''),
  F('email', 'email_customer_on_order', 'Email customer an order confirmation', 'bool', 1),
  F('email', 'email_customer_on_status', 'Email customer when status changes', 'bool', 1),

  // ---- labels
  F('labels', 'label_add_to_cart', '“Add to cart” button', 'text', '🛒 Add to Cart'),
  F('labels', 'label_buy_now', '“Buy now” button', 'text', '⚡ Buy it now'),
  F('labels', 'label_find_part', '“Find my part” menu label', 'text', '🔍 Find My Part'),
  F('labels', 'label_track', '“Track order” menu label', 'text', '📍 Track Order'),
  F('labels', 'label_sale', '“On sale” menu label', 'text', '🏷️ On Sale'),
  F('labels', 'label_new_arrivals', 'Homepage “new arrivals” default title', 'text', 'New Arrival'),
  F('labels', 'label_search_placeholder', 'Search placeholder', 'text', 'Search printer parts, model number...'),
  F('labels', 'order_success_message', 'Order success message', 'textarea', 'Thank you! We will pack and dispatch your parts within 24 hours.'),
  F('labels', 'checkout_note', 'Note shown on checkout', 'textarea', ''),
  F('labels', 'product_shipping_text', 'Product page “Shipping” tab text', 'textarea', 'Delivered via Delhivery. Securely packaged to avoid transit damage.'),

  // ---- seo
  F('seo', 'meta_title_suffix', 'Page title suffix', 'text', ''),
  F('seo', 'meta_description', 'Default meta description', 'textarea', 'Buy genuine & compatible printer spare parts online — HP, Canon, Epson, Brother, Samsung & Lexmark. Pan-India delivery.'),
  F('seo', 'og_image', 'Default share image', 'image', ''),
  F('seo', 'ga_id', 'Google Analytics ID (G-XXXX)', 'text', ''),
  F('seo', 'custom_head_html', 'Custom code in <head>', 'html', '', { help: 'Meta tags, pixels, verification tags…' }),
  F('seo', 'custom_body_html', 'Custom code before </body>', 'html', ''),
  F('seo', 'custom_css', 'Custom CSS', 'html', '', { help: 'Applied on every storefront page, after the theme.' }),

  // ---- maintenance
  F('maintenance', 'maintenance_mode', 'Put the store in maintenance mode', 'bool', 0, { help: 'Visitors see a maintenance page; admins can still browse.' }),
  F('maintenance', 'maintenance_title', 'Title', 'text', "We'll be right back"),
  F('maintenance', 'maintenance_message', 'Message', 'textarea', "We're upgrading the store. Please check back shortly — or reach us on WhatsApp for urgent orders."),
];

/* Colour presets — applied from the Appearance page */
const PRESETS = {
  original: { label: 'Printer Spare (original)', color_primary: '#1a1f5e', color_primary_dark: '#0f1340', color_accent: '#fbbf24', color_button: '#cc0000', color_price: '#cc0000', color_success: '#00a650', color_bg: '#ffffff', color_surface: '#f5f5f0', color_card: '#ffffff', color_text: '#111827', color_muted: '#6b7280', color_border: '#e5e7eb', ann_bg: '#1a1f5e', ann_color: '#fbbf24' },
  emerald: { label: 'Emerald', color_primary: '#064e3b', color_primary_dark: '#022c22', color_accent: '#facc15', color_button: '#059669', color_price: '#047857', color_success: '#16a34a', color_bg: '#ffffff', color_surface: '#f0fdf4', color_card: '#ffffff', color_text: '#0f172a', color_muted: '#64748b', color_border: '#d1fae5', ann_bg: '#064e3b', ann_color: '#facc15' },
  sunset: { label: 'Sunset', color_primary: '#7c2d12', color_primary_dark: '#431407', color_accent: '#fdba74', color_button: '#ea580c', color_price: '#c2410c', color_success: '#16a34a', color_bg: '#fffaf5', color_surface: '#fff1e6', color_card: '#ffffff', color_text: '#1c1917', color_muted: '#78716c', color_border: '#fed7aa', ann_bg: '#7c2d12', ann_color: '#fed7aa' },
  royal: { label: 'Royal Purple', color_primary: '#4c1d95', color_primary_dark: '#2e1065', color_accent: '#f0abfc', color_button: '#7c3aed', color_price: '#6d28d9', color_success: '#16a34a', color_bg: '#ffffff', color_surface: '#f5f3ff', color_card: '#ffffff', color_text: '#1e1b4b', color_muted: '#6b7280', color_border: '#ddd6fe', ann_bg: '#4c1d95', ann_color: '#f0abfc' },
  ocean: { label: 'Ocean', color_primary: '#0c4a6e', color_primary_dark: '#082f49', color_accent: '#22d3ee', color_button: '#0284c7', color_price: '#0369a1', color_success: '#16a34a', color_bg: '#ffffff', color_surface: '#f0f9ff', color_card: '#ffffff', color_text: '#0f172a', color_muted: '#64748b', color_border: '#bae6fd', ann_bg: '#0c4a6e', ann_color: '#22d3ee' },
  midnight: { label: 'Midnight (dark)', color_primary: '#0b1220', color_primary_dark: '#050913', color_accent: '#fbbf24', color_button: '#ef4444', color_price: '#fca5a5', color_success: '#22c55e', color_bg: '#0f172a', color_surface: '#111c33', color_card: '#17233f', color_text: '#e5e7eb', color_muted: '#94a3b8', color_border: '#26344f', ann_bg: '#050913', ann_color: '#fbbf24' },
  mono: { label: 'Monochrome', color_primary: '#18181b', color_primary_dark: '#09090b', color_accent: '#e4e4e7', color_button: '#18181b', color_price: '#18181b', color_success: '#16a34a', color_bg: '#ffffff', color_surface: '#f4f4f5', color_card: '#ffffff', color_text: '#18181b', color_muted: '#71717a', color_border: '#e4e4e7', ann_bg: '#18181b', ann_color: '#e4e4e7' },
};
SCHEMA.find((f) => f.key === 'theme_preset').options = Object.fromEntries([...Object.entries(PRESETS).map(([k, v]) => [k, v.label]), ['custom', 'Custom']]);

const BY_KEY = Object.fromEntries(SCHEMA.map((f) => [f.key, f]));
let cache = null;
let version = Date.now();

function load() {
  const rows = db.all('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const out = {};
  for (const f of SCHEMA) {
    let v = stored[f.key];
    if ((v === undefined || v === '') && f.env && process.env[f.env]) v = process.env[f.env];
    if (v === undefined) v = f.def;
    if (f.type === 'bool') v = v === true || v === 1 || v === '1' || v === 'on';
    else if (f.type === 'number') { v = Number(v); if (Number.isNaN(v)) v = Number(f.def) || 0; }
    out[f.key] = v;
  }
  cache = out;
  return out;
}
const all = () => cache || load();
const get = (k) => all()[k];
function set(key, value) {
  if (!BY_KEY[key]) return;
  db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, String(value ?? ''));
  cache = null; version = Date.now();
}
function setMany(obj) {
  db.transaction(() => { for (const [k, v] of Object.entries(obj)) set(k, v); })();
  cache = null; version = Date.now();
}
const sanitized = () => { // safe to expose to templates (no secrets)
  const s = { ...all() };
  for (const f of SCHEMA) if (f.type === 'password') delete s[f.key];
  return s;
};

module.exports = { SCHEMA, GROUPS, PRESETS, FONTS, all, get, set, setMany, sanitized, BY_KEY, version: () => version };
