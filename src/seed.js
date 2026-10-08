'use strict';
/* First-run seed: every row & image that shipped inside the original PHP project
 * (database/schema.sql defaults + assets/uploads), plus starter content for the new
 * customisable homepage, menus and pages. Safe to call repeatedly (only seeds an empty DB). */
const fs = require('fs');
const path = require('path');
const { db, UPLOAD_DIR, ROOT } = require('./db');
const settings = require('./settings');

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, f.name), d = path.join(dst, f.name);
    if (f.isDirectory()) copyDir(s, d); else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
}

function run({ force = false } = {}) {
  if (!force && db.get('SELECT COUNT(*) n FROM categories').n > 0) return false;
  copyDir(path.join(ROOT, 'seed', 'uploads'), UPLOAD_DIR);

  db.transaction(() => {
    // ---- categories (original schema.sql) + category photos found in assets/uploads/cats
    const cats = [
      ['HP Printers', 'hp-printers', 'Spare parts for HP printers', 1, 'cat-1778301785-483.jpg'],
      ['Canon Printers', 'canon-printers', 'Spare parts for Canon printers', 2, 'cat-1778302770-124.jpg'],
      ['Epson Printers', 'epson-printers', 'Spare parts for Epson printers', 3, 'cat-1778302511-845.jpg'],
      ['Brother Printers', 'brother-printers', 'Spare parts for Brother printers', 4, 'cat-1778302643-524.jpg'],
      ['Samsung Printers', 'samsung-printers', 'Spare parts for Samsung printers', 5, 'cat-1778302892-573.jpg'],
      ['Lexmark Printers', 'lexmark-printers', 'Spare parts for Lexmark printers', 6, null],
    ];
    for (const c of cats) db.run('INSERT INTO categories(name,slug,description,sort_order,image) VALUES(?,?,?,?,?)', c[0], c[1], c[2], c[3], c[4]);

    // ---- admin: same username/email as the PHP project. NOTE: the hash shipped in schema.sql
    //      does not actually verify as "admin123" (as its comment claimed), so we create a fresh admin / admin123
    //      login instead. CHANGE IT after first login (the dashboard nags until you do).
    db.run('INSERT INTO admins(username,email,password) VALUES(?,?,?)', 'admin', process.env.ADMIN_EMAIL || 'admin@printparts.com', require('bcryptjs').hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10));

    // ---- coupons (original)
    for (const c of [['PRINTER20', 'percent', 20, 1000, 100], ['FIRST10', 'percent', 10, 200, 500], ['SAVE50', 'fixed', 50, 500, 200]])
      db.run('INSERT INTO coupons(code,type,value,min_order,max_uses) VALUES(?,?,?,?,?)', ...c);

    // ---- products (original 8) — images matched to the photos that were in assets/uploads
    const P = [
      [1, 'HP LaserJet Fuser Unit RM1-6405', 'hp-laserjet-fuser-rm1-6405', 'Original quality fuser unit for HP LaserJet series. Ensures crisp, smudge-free prints.', 1299, 799, 25, 'HP', 'HP LaserJet P1606dn, M403, M405, M426, M427, M129, M130', 1, 'product-1778303468-8609.jpg'],
      [1, 'HP 803 Black Ink Cartridge', 'hp-803-black-ink', 'Original compatible HP 803 black ink cartridge. High page yield.', 299, 199, 50, 'HP', 'HP DeskJet 1111, 2131, 2132, 2621, 2622', 1, null],
      [2, 'Canon PG-745 Black Ink', 'canon-pg745-black', 'Canon PG-745 original black ink for Pixma printers.', 349, 249, 40, 'Canon', 'Canon Pixma MG2470, MG2570, MG2970, MX497', 1, null],
      [3, 'Epson L3150 Printhead Original', 'epson-l3150-printhead', 'Replacement printhead for Epson L series ink tank printers.', 1899, 1299, 10, 'Epson', 'Epson L3150, L3110, L3100, L1110', 1, null],
      [4, 'Brother Drum Unit DR-2375', 'brother-drum-dr2375', 'Compatible drum unit for Brother laser printers. High page yield.', 1099, 749, 15, 'Brother', 'Brother HL-L2321D, L2361DN, DCP-L2541DW', 1, null],
      [1, 'HP LaserJet Pressure Roller', 'hp-pressure-roller-m126', 'New import micro foam pressure roller for HP LaserJet Pro.', 225, 175, 30, 'HP', 'HP LaserJet Pro M126nw, M126a, M128fn, M128fw', 0, 'product-1778304191-3248.jpg'],
      [3, 'Epson L210 Head Cable with Sensor', 'epson-l210-head-cable', 'Head cable with sensor cable for Epson L series printers.', 35, null, 45, 'Epson', 'Epson L210, L220, L360, L380, M200', 0, 'product-1778305248-8369.jpg'],
      [2, 'Canon MF3010 CCD Cable FK3-1160', 'canon-mf3010-ccd-cable', 'CCD cable for Canon image class printers. New import black.', 24, null, 60, 'Canon', 'Canon MF3010, MF4750, MF4820d, MF4412, MF4450', 0, 'product-1778305324-5190.jpg'],
    ];
    for (const p of P) db.run('INSERT INTO products(category_id,name,slug,description,price,sale_price,stock,brand,compatible_models,is_featured,image) VALUES(?,?,?,?,?,?,?,?,?,?,?)', p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10]);

    // ---- product photos from the old uploads folder that had no product row in the zip
    //      (live product rows are in the old MySQL DB). Added as inactive DRAFTS so no fake prices go live.
    const D = [
      [1, 'HP LaserJet Fuser Film Sleeve', 'hp-laserjet-fuser-film-sleeve', 'Fuser film sleeve for HP LaserJet printers.', 'HP', 'product-1778303468-8609.jpg', 0],
      [1, 'HP Sensor Board with Flat Cable', 'hp-sensor-board-flat-cable', 'Sensor board with flat cable assembly.', 'HP', 'product-1778303815-1691.jpg', 1],
      [1, 'Teflon Grease for Fuser Gears (White)', 'teflon-grease-white', 'White Teflon grease for fuser gears and rollers.', 'HP', 'product-1778304042-1775.jpg', 1],
      [1, 'HP Formatter / Main Logic Board', 'hp-formatter-main-board', 'Formatter (main) board for HP LaserJet.', 'HP', 'product-1778304611-4186.jpg', 1],
      [3, 'Epson Printer Flat Cable', 'epson-printer-flat-cable', 'Flat flexible cable for Epson printers.', 'Epson', 'product-1778304537-8916.jpg', 1],
      [3, 'Epson Printer Cap / Wiper Parts', 'epson-cap-wiper-parts', 'Plastic cap & wiper parts for Epson inkjet printers.', 'Epson', 'product-1780334786-4410.jpeg', 1],
      [3, 'Epson Ink Pump / Capping Station Assembly', 'epson-ink-pump-capping-station', 'Ink pump with capping station for Epson L-series.', 'Epson', 'product-1780335539-7611.jpg', 1],
      [1, 'HP LaserJet 1020 Main Motor RK2-0799', 'hp-1020-main-motor-rk2-0799', 'Main motor for HP LaserJet 1020.', 'HP', 'product-1780336111-2959.png', 1],
    ];
    const cat0 = db.get('SELECT id FROM categories LIMIT 1').id;
    let n = 0;
    for (const d of D) {
      if (n++ === 0) continue; // fuser sleeve photo is already used by product #1
      db.run("INSERT INTO products(category_id,name,slug,description,price,stock,brand,image,is_active) VALUES(?,?,?,?,0,0,?,?,0)", d[0] || cat0, d[1], d[2], d[3] + ' (draft — set price & stock, then activate)', d[4], d[5]);
    }

    // ---- brands (original homepage strip)
    [['HP', '#0096D6', 'bold'], ['Samsung', '#1428A0', 'caps'], ['Epson', '#009BDE', 'caps'], ['Brother', '#004A97', 'lower'], ['Canon', '#CC0000', 'italic'], ['Lexmark', '#006400', 'caps']]
      .forEach((b, i) => db.run('INSERT INTO brands(name,text_color,font_style,sort_order) VALUES(?,?,?,?)', b[0], b[1], b[2], i));

    // ---- shipping zones (starter rates — the originals lived only in the live DB; edit in Admin → Shipping)
    [['Lucknow Local', 'pincode', '226', 49, 1, 2, 1], ['Uttar Pradesh', 'state', 'UP', 79, 2, 4, 2], ['North-East States', 'state', 'NE', 149, 5, 8, 3], ['Jammu, Kashmir & Ladakh', 'state', 'JK', 149, 5, 8, 4], ['Andaman & Nicobar', 'state', 'AN', 199, 7, 12, 5], ['Rest of India', 'default', 'ALL', 99, 3, 5, 99]]
      .forEach((z) => db.run('INSERT INTO shipping_zones(zone_name,zone_type,value,charge,min_days,max_days,sort_order) VALUES(?,?,?,?,?,?,?)', ...z));

    // ---- hero slides (original 3 slides, now editable)
    const S = [
      ["🚀 India's #1 Printer Parts Store", 'Cash on Delivery\n*+ Free Shipping*\nAvailable!', 'Free shipping on orders above ₹999. Genuine & compatible parts for every printer.', '🛒 Buy Now', '/products', 'red', 'New Arrivals →', '/products?sort=newest', 'navy', 'linear-gradient(135deg,#fff,#eef2ff)', '#111827', '#cc0000', '🛵'],
      ['🖨️ Laser Printer Specialists', 'Laser Printer\n*Spare Parts*\nfrom ₹24 Only!', 'Fuser units, drum units, rollers, boards for HP, Canon, Brother.', 'Shop HP Parts', '/products?brand=HP', 'navy', 'Shop Canon', '/products?brand=Canon', 'red', 'linear-gradient(135deg,#f0f4ff,#fff)', '#111827', '#1a1f5e', '🖨️'],
      ['💧 Inkjet Printer Parts', 'Epson & Canon\n*Inkjet Parts*\nSave up to 86%!', 'Pump assemblies, printheads, cables — original & compatible quality.', 'Shop Epson', '/products?brand=Epson', 'green', '🔍 Find My Part', '/enquiry', 'navy', 'linear-gradient(135deg,#f0fdf4,#fff)', '#111827', '#00a650', '💧'],
    ];
    S.forEach((s, i) => db.run('INSERT INTO hero_slides(tag,heading,subtext,btn1_label,btn1_url,btn1_style,btn2_label,btn2_url,btn2_style,bg,text_color,tag_color,emoji,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...s, i));

    // ---- trust strip (original)
    [['🚚', 'Free Shipping', 'Orders above ₹999'], ['💰', 'Low Price Guarantee', "We won't be beat on price"], ['💬', 'Top-notch Support', 'Expert team available'], ['🏢', 'Business Services', 'Support your business'], ['🔄', 'Easy Returns', '30-day return policy']]
      .forEach((t, i) => db.run('INSERT INTO trust_items(icon,title,subtitle,sort_order) VALUES(?,?,?,?)', ...t, i));

    // ---- homepage sections (order matches the original page; extras start switched off)
    const H = [
      ['hero', 'Hero slider', {}, 1],
      ['trust', 'Trust strip', {}, 1],
      ['brands', 'Brand logos', { heading: '— Parts Available —' }, 1],
      ['categories', 'Top categories', { heading: 'Top Categories', bg: 'light' }, 1],
      ['products', 'New arrivals', { heading: 'New Arrival', source: 'newest', limit: 8, link_label: 'View all', link_url: '/products?sort=newest', bg: 'white', layout: 'grid' }, 1],
      ['category_blocks', 'Product block per category', { limit: 8, max_categories: 10 }, 1],
      ['cta', 'Find-my-part call to action', { heading: "Can't Find Your Printer Part? 🔍", text: 'Tell us your printer brand & model — our experts will find it!', btn1_label: 'Send Enquiry →', btn1_url: '/enquiry', btn2_label: '💬 WhatsApp Now', btn2_url: 'whatsapp' }, 1],
      ['products', 'Featured products (off)', { heading: '⭐ Featured Picks', source: 'featured', limit: 8, link_label: 'View all', link_url: '/products?sort=featured', bg: 'light', layout: 'scroll' }, 0],
      ['products', 'Best deals (off)', { heading: '🔥 Hot Deals', source: 'sale', limit: 8, link_label: 'All deals', link_url: '/products?sort=sale', bg: 'white', layout: 'grid' }, 0],
      ['banner', 'Promo banner (off)', { heading: 'Mega Sale — up to 80% OFF', text: 'Use code PRINTER20 for an extra 20% on orders above ₹1000.', btn1_label: 'Shop the sale', btn1_url: '/products?sort=sale', bg: 'linear-gradient(135deg,#1a1f5e,#2d3494)', color: '#ffffff' }, 0],
      ['html', 'Custom HTML block (off)', { html: '<div class="container" style="padding:2rem 0;text-align:center"><h2>Your own content here</h2><p>Edit this block in Admin → Homepage.</p></div>' }, 0],
      ['newsletter', 'Newsletter signup (off)', { heading: 'Get deals in your inbox', text: 'New parts, price drops and exclusive coupons.' }, 0],
    ];
    H.forEach((h, i) => db.run('INSERT INTO home_sections(type,title,config,sort_order,is_active) VALUES(?,?,?,?,?)', h[0], h[1], JSON.stringify(h[2]), i, h[3]));

    // ---- menus
    [['nav', 'link', '🛒 All Products', '/products', '#e53935'], ['nav', 'categories', 'Categories (auto from your category list)', '', ''], ['nav', 'link', '🔍 Find My Part', '/enquiry', '#f59e0b'], ['nav', 'link', '📍 Track Order', '/track', '#1e40af'], ['nav', 'link', '🏷️ On Sale', '/products?sort=sale', '#cc0000']]
      .forEach((m, i) => db.run('INSERT INTO menu_items(location,kind,label,url,bg_color,sort_order) VALUES(?,?,?,?,?,?)', m[0], m[1], m[2], m[3], m[4], i));
    [['Home', '/'], ['All Products', '/products'], ['Find My Part', '/enquiry'], ['Track Order', '/track'], ['My Orders', '/account/orders'], ['Cart', '/cart']]
      .forEach((m, i) => db.run("INSERT INTO menu_items(location,kind,label,url,sort_order) VALUES('footer','link',?,?,?)", m[0], m[1], i));

    // ---- CMS pages (starter text — review before relying on it)
    const pg = [
      ['about', 'About Us', '<h2>About Printer Spare</h2><p>We supply genuine and compatible spare parts for HP, Canon, Epson, Brother, Samsung and Lexmark printers from Gomti Nagar, Lucknow, with delivery across India.</p><p>Not sure which part you need? Use <a href="/enquiry">Find My Part</a> and our team will help.</p>'],
      ['shipping-policy', 'Shipping Policy', '<h2>Shipping Policy</h2><p>Orders are dispatched within 24 hours on working days via Delhivery. Delivery typically takes 3–5 business days depending on your pincode. Free shipping is available above the order value shown in the header.</p>'],
      ['return-policy', 'Return Policy', '<h2>Returns &amp; Refunds</h2><p>If a part arrives damaged or incorrect, contact us within the return window with photos and your order number. We will arrange a replacement or refund.</p>'],
      ['privacy-policy', 'Privacy Policy', '<h2>Privacy Policy</h2><p>We collect only the details needed to process and deliver your order. We do not sell your data. Payments are handled by Razorpay; we never store card details.</p>'],
      ['terms', 'Terms & Conditions', '<h2>Terms &amp; Conditions</h2><p>By placing an order you agree to provide accurate details and to pay the displayed price. Please check printer compatibility before ordering.</p>'],
    ];
    pg.forEach((p, i) => db.run('INSERT INTO pages(slug,title,content,sort_order) VALUES(?,?,?,?)', p[0], p[1], p[2], i));
  })();

  // original hard-coded defaults that now live in Settings are already the schema defaults
  settings.set('theme_preset', 'original');
  return true;
}
module.exports = { run };
if (require.main === module) {
  const reset = process.argv.includes('--reset');
  if (reset) { for (const t of ['reviews', 'order_events', 'order_items', 'orders', 'product_variants', 'product_images', 'products', 'brands', 'coupons', 'shipping_zones', 'hero_slides', 'trust_items', 'home_sections', 'menu_items', 'pages', 'categories', 'admins', 'users', 'enquiries', 'subscribers', 'sessions']) db.run(`DELETE FROM ${t}`); }
  console.log(run({ force: reset }) ? 'Seeded.' : 'Database already has data (use --reset to wipe & reseed).');
}
