'use strict';
/* Imports rows from a phpMyAdmin / mysqldump export (INSERT INTO ... VALUES ...) of the ORIGINAL PHP store
 * into this app's SQLite database. Only tables/columns that exist here are imported. */
const { db } = require('./db');

const ORDER = ['categories', 'users', 'admins', 'coupons', 'shipping_zones', 'products', 'product_variants', 'orders', 'order_items', 'enquiries'];
const ESC = { n: '\n', r: '\r', t: '\t', 0: '\0', b: '\b', Z: '\x1a' };

function* statements(sql) { // split on ; outside quotes
  let cur = '', q = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (q) { cur += c; if (c === '\\' && q !== '`') { cur += sql[++i] ?? ''; } else if (c === q) { if (sql[i + 1] === q) cur += sql[++i]; else q = null; } continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
    if (c === '-' && sql[i + 1] === '-' && /\s/.test(sql[i + 2] || ' ')) { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (c === '#') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (c === '/' && sql[i + 1] === '*') { const e = sql.indexOf('*/', i + 2); i = e < 0 ? sql.length : e + 1; continue; }
    if (c === ';') { if (cur.trim()) yield cur.trim(); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) yield cur.trim();
}
function parseValues(s) { // "(..),(..)" → arrays
  const rows = []; let i = 0;
  while (i < s.length) {
    while (i < s.length && s[i] !== '(') i++; if (i >= s.length) break; i++;
    const row = [];
    for (;;) {
      while (/\s/.test(s[i])) i++;
      let v;
      if (s[i] === "'") { let o = ''; i++; for (;;) { const c = s[i++]; if (c === '\\') { const n = s[i++]; o += ESC[n] ?? n; } else if (c === "'") { if (s[i] === "'") { o += "'"; i++; } else break; } else o += c; } v = o; }
      else { let j = i; while (j < s.length && s[j] !== ',' && s[j] !== ')') j++; const t = s.slice(i, j).trim(); i = j; v = /^null$/i.test(t) ? null : /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t; }
      row.push(v);
      while (/\s/.test(s[i])) i++;
      if (s[i] === ',') { i++; continue; } if (s[i] === ')') { i++; break; } throw new Error('Unexpected character in VALUES near: ' + s.slice(i, i + 30));
    }
    rows.push(row);
  }
  return rows;
}

function parseMysqlDump(sql, { replace = false } = {}) {
  const stats = {}; const found = {};
  for (const st of statements(sql)) {
    const m = st.match(/^INSERT\s+(?:IGNORE\s+)?INTO\s+`?(\w+)`?\s*(?:\(([^)]*)\))?\s*VALUES\s*([\s\S]*?)(?:\s+ON\s+DUPLICATE[\s\S]*)?$/i);
    if (!m || !ORDER.includes(m[1])) continue;
    (found[m[1]] = found[m[1]] || []).push({ cols: m[2] ? m[2].split(',').map((c) => c.replace(/[`\s]/g, '')) : null, rows: parseValues(m[3]) });
  }
  if (!Object.keys(found).length) throw new Error('No INSERT statements for known tables were found. Export with "Add INSERT statements / complete inserts" in phpMyAdmin.');
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const t of ORDER) {
        if (!found[t]) continue;
        const info = db.all(`PRAGMA table_info(${t})`).map((c) => c.name);
        if (replace) db.run(`DELETE FROM ${t}`);
        for (const g of found[t]) {
          const cols = g.cols || info;
          const keep = cols.map((c, i) => [c, i]).filter(([c]) => info.includes(c));
          const stmt = db.prepare(`INSERT OR REPLACE INTO ${t}(${keep.map(([c]) => c).join(',')}) VALUES(${keep.map(() => '?').join(',')})`);
          for (const row of g.rows) { stmt.run(...keep.map(([, i]) => row[i] ?? null)); stats[t] = (stats[t] || 0) + 1; }
        }
      }
    })();
  } finally { db.pragma('foreign_keys = ON'); }
  return stats;
}
module.exports = { parseMysqlDump, statements, parseValues };
