'use strict';
const { db } = require('./db');
const settings = require('./settings');

const VAR_PRICE = 'CASE WHEN v.sale_price IS NOT NULL AND v.sale_price < v.price THEN v.sale_price ELSE v.price END';
const BASE = `SELECT p.*, c.name AS cat_name, c.slug AS cat_slug,
 (SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) AS has_variants,
 (SELECT MIN(${VAR_PRICE}) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) AS min_price,
 (SELECT COALESCE(SUM(v.stock),0) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) AS var_stock,
 (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.product_id=p.id AND r.is_approved=1) AS rating_avg,
 (SELECT COUNT(*) FROM reviews r WHERE r.product_id=p.id AND r.is_approved=1) AS review_count
 FROM products p JOIN categories c ON c.id=p.category_id`;

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_low: 'COALESCE(min_price, CASE WHEN p.sale_price IS NOT NULL AND p.sale_price<p.price THEN p.sale_price ELSE p.price END) ASC',
  price_high: 'COALESCE(min_price, CASE WHEN p.sale_price IS NOT NULL AND p.sale_price<p.price THEN p.sale_price ELSE p.price END) DESC',
  sale: '(p.sale_price IS NOT NULL AND p.sale_price<p.price) DESC, ((p.price-COALESCE(p.sale_price,p.price))/NULLIF(p.price,0)) DESC, p.created_at DESC',
  featured: 'p.is_featured DESC, p.created_at DESC',
  popular: 'p.views DESC, p.created_at DESC',
  name: 'p.name COLLATE NOCASE ASC',
};

function list({ where = [], params = [], sort = 'newest', limit = 16, offset = 0 } = {}) {
  const w = ['p.is_active=1', 'c.is_active=1', ...where];
  if (!settings.get('show_out_of_stock')) w.push('(p.stock>0 OR (SELECT COALESCE(SUM(stock),0) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1)>0)');
  const sql = `${BASE} WHERE ${w.join(' AND ')} ORDER BY ${SORTS[sort] || SORTS.newest} LIMIT ? OFFSET ?`;
  return db.all(sql, ...params, limit, offset);
}
function count({ where = [], params = [] } = {}) {
  const w = ['p.is_active=1', 'c.is_active=1', ...where];
  if (!settings.get('show_out_of_stock')) w.push('(p.stock>0 OR (SELECT COALESCE(SUM(stock),0) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1)>0)');
  return db.get(`SELECT COUNT(*) n FROM products p JOIN categories c ON c.id=p.category_id WHERE ${w.join(' AND ')}`, ...params).n;
}
const bySlug = (slug) => db.get(`${BASE} WHERE p.slug=? AND p.is_active=1`, slug);
const byIds = (ids) => ids.length ? db.all(`${BASE} WHERE p.is_active=1 AND p.id IN (${ids.map(() => '?').join(',')})`, ...ids) : [];

/** Product sources used by homepage "product" sections */
function forSource(source, limit = 8) {
  const m = String(source || 'newest');
  if (m.startsWith('category:')) return list({ where: ['c.slug=?'], params: [m.slice(9)], sort: 'featured', limit });
  if (m.startsWith('brand:')) return list({ where: ['p.brand=?'], params: [m.slice(6)], sort: 'newest', limit });
  if (m === 'featured') return list({ where: ['p.is_featured=1'], sort: 'newest', limit });
  if (m === 'sale') return list({ where: ['p.sale_price IS NOT NULL AND p.sale_price<p.price'], sort: 'sale', limit });
  if (m === 'popular') return list({ sort: 'popular', limit });
  return list({ sort: 'newest', limit });
}
module.exports = { list, count, bySlug, byIds, forSource, SORTS };
