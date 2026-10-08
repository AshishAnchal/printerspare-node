'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(path.join(UPLOAD_DIR, 'cats'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'misc'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'store.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  phone TEXT, address TEXT, city TEXT, state TEXT, pincode TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  text_color TEXT DEFAULT '#1a1f5e',
  font_style TEXT DEFAULT 'bold',
  logo TEXT,
  show_on_home INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  sale_price REAL,
  stock INTEGER NOT NULL DEFAULT 0,
  sku TEXT,
  image TEXT,
  brand TEXT,
  compatible_models TEXT,
  youtube_url TEXT,
  tags TEXT,
  badge TEXT,
  meta_title TEXT,
  meta_description TEXT,
  free_shipping INTEGER DEFAULT 0,
  feature_free_shipping INTEGER DEFAULT 1,
  feature_returns INTEGER DEFAULT 1,
  feature_genuine INTEGER DEFAULT 1,
  feature_tested INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  views INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL,
  sale_price REAL,
  stock INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
  address TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL, pincode TEXT NOT NULL,
  payment_method TEXT DEFAULT 'cod',
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'pending',
  subtotal REAL NOT NULL DEFAULT 0,
  shipping REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  gst REAL NOT NULL DEFAULT 0,
  cod_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  coupon_code TEXT,
  notes TEXT,
  admin_notes TEXT,
  awb TEXT, courier TEXT,
  razorpay_payment_id TEXT, razorpay_order_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  variant_id INTEGER,
  product_name TEXT NOT NULL,
  product_image TEXT,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
  printer_brand TEXT, printer_model TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT DEFAULT 'percent',
  value REAL NOT NULL,
  min_order REAL DEFAULT 0,
  max_discount REAL,
  max_uses INTEGER DEFAULT 100,
  used_count INTEGER DEFAULT 0,
  starts_at TEXT, expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shipping_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_name TEXT NOT NULL,
  zone_type TEXT NOT NULL DEFAULT 'pincode',
  value TEXT NOT NULL,
  charge REAL DEFAULT 99,
  min_days INTEGER DEFAULT 3,
  max_days INTEGER DEFAULT 5,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS hero_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT, heading TEXT NOT NULL, subtext TEXT,
  btn1_label TEXT, btn1_url TEXT, btn1_style TEXT DEFAULT 'red',
  btn2_label TEXT, btn2_url TEXT, btn2_style TEXT DEFAULT 'navy',
  bg TEXT, text_color TEXT, tag_color TEXT,
  emoji TEXT, image TEXT,
  sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS trust_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  icon TEXT, title TEXT NOT NULL, subtitle TEXT,
  sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS home_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT,
  config TEXT DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location TEXT NOT NULL DEFAULT 'nav',
  kind TEXT NOT NULL DEFAULT 'link',
  label TEXT NOT NULL,
  url TEXT,
  icon TEXT,
  bg_color TEXT, text_color TEXT,
  new_tab INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  meta_description TEXT,
  show_in_footer INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  is_approved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL
);
`);

// tiny helpers ------------------------------------------------------------
db.all = (sql, ...p) => db.prepare(sql).all(...p);
db.get = (sql, ...p) => db.prepare(sql).get(...p);
db.run = (sql, ...p) => db.prepare(sql).run(...p);

module.exports = { db, DATA_DIR, UPLOAD_DIR, ROOT };
