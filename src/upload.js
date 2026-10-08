'use strict';
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR } = require('./db');

const OK = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif']);
const make = (sub = '', prefix = 'product') => multer({
  limits: { fileSize: 5 * 1024 * 1024, files: 12 },
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const d = path.join(UPLOAD_DIR, sub); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
    filename: (req, file, cb) => cb(null, `${prefix}-${Math.floor(Date.now() / 1000)}-${Math.floor(1000 + Math.random() * 9000)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  fileFilter: (req, file, cb) => cb(null, OK.has(path.extname(file.originalname).toLowerCase()) && /^image\//.test(file.mimetype)),
});
const removeFile = (sub, name) => { if (!name || /[\\/]/.test(name)) return; try { fs.unlinkSync(path.join(UPLOAD_DIR, sub, name)); } catch (e) { /* ignore */ } };
module.exports = { product: make('', 'product'), cats: make('cats', 'cat'), misc: make('misc', 'img'), removeFile, OK };
