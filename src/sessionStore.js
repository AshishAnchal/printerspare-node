'use strict';
const session = require('express-session');
const { db } = require('./db');

class SqliteStore extends session.Store {
  constructor() { super(); setInterval(() => { try { db.run('DELETE FROM sessions WHERE expires < ?', Date.now()); } catch (e) { /* ignore */ } }, 15 * 60 * 1000).unref(); }
  get(sid, cb) { try { const r = db.get('SELECT data, expires FROM sessions WHERE sid=?', sid); if (!r || r.expires < Date.now()) return cb(null, null); cb(null, JSON.parse(r.data)); } catch (e) { cb(e); } }
  set(sid, sess, cb) { try { const exp = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000; db.run('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET data=excluded.data, expires=excluded.expires', sid, JSON.stringify(sess), exp); cb && cb(null); } catch (e) { cb && cb(e); } }
  destroy(sid, cb) { try { db.run('DELETE FROM sessions WHERE sid=?', sid); cb && cb(null); } catch (e) { cb && cb(e); } }
  touch(sid, sess, cb) { this.set(sid, sess, cb); }
}
module.exports = SqliteStore;
