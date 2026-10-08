'use strict';
require('./src/env');
const path = require('path');
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const helmet = require('helmet');
const { db, UPLOAD_DIR } = require('./src/db');
const SqliteStore = require('./src/sessionStore');
const mw = require('./src/middleware');
const settings = require('./src/settings');

require('./src/seed').run();

const app = express();
const PROD = process.env.NODE_ENV === 'production';
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: PROD ? '7d' : 0 }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

const secret = process.env.SESSION_SECRET || (() => {
  let s = db.get("SELECT value FROM settings WHERE key='_session_secret'");
  if (!s) { s = { value: require('crypto').randomBytes(32).toString('hex') }; db.run("INSERT INTO settings(key,value) VALUES('_session_secret',?)", s.value); }
  return s.value;
})();
app.use(session({ name: 'ps.sid', secret, resave: false, saveUninitialized: false, store: new SqliteStore(), cookie: { httpOnly: true, sameSite: 'lax', secure: PROD && process.env.COOKIE_SECURE !== '0', maxAge: 14 * 86400000 } }));

app.use(mw.locals);
app.use(mw.csrfCheck);
app.use(mw.maintenance);
app.use('/admin', require('./src/routes/admin'));
app.use(mw.storefront);
app.use(require('./src/routes/shop'));
app.use(require('./src/routes/cart'));
app.use(require('./src/routes/checkout'));
app.use(require('./src/routes/account'));

app.use((req, res) => res.status(404).render('pages/404', { pageTitle: 'Not found' }));
app.use((err, req, res, next) => { // eslint-disable-line
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  if (/^\/admin/.test(req.path)) { req.flash('error', 'Error: ' + err.message); return res.redirect(req.get('referer') || '/admin'); }
  res.status(500).send(`<h1 style="font-family:sans-serif">Something went wrong</h1><p style="font-family:sans-serif">Please go back and try again.${PROD ? '' : '<pre>' + String(err.stack).replace(/</g, '&lt;') + '</pre>'}</p>`);
});

const port = Number(process.env.PORT) || 3000;
if (require.main === module) app.listen(port, () => console.log(`\n  🖨️  ${settings.get('store_name')} running → http://localhost:${port}\n  Admin panel        → http://localhost:${port}/admin  (admin / admin123 — change it!)\n`));
module.exports = app;
