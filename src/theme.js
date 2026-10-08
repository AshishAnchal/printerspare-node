'use strict';
const settings = require('./settings');
const { isColor } = require('./lib');

function lum(hex) {
  let h = String(hex).replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const on = (hex) => (lum(hex) > 0.45 ? '#111827' : '#ffffff');
const col = (k) => { const v = settings.get(k); return isColor(v) ? v : '#000000'; };

function css() {
  const s = settings.all();
  const f = settings.FONTS[s.font] || settings.FONTS.inter;
  const stack = f[1] === null ? 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif' : `'${f[0]}',system-ui,sans-serif`;
  const imp = f[1] ? `@import url('https://fonts.googleapis.com/css2?family=${f[1]}&display=swap');\n` : '';
  const hdrLight = s.header_style === 'light';
  const hdrBg = hdrLight ? col('color_card') : col('color_primary');
  const out = `${imp}:root{
--primary:${col('color_primary')};--primary-dark:${col('color_primary_dark')};--accent:${col('color_accent')};
--btn:${col('color_button')};--price:${col('color_price')};--success:${col('color_success')};
--bg:${col('color_bg')};--surface:${col('color_surface')};--card:${col('color_card')};
--text:${col('color_text')};--muted:${col('color_muted')};--border:${col('color_border')};
--on-primary:${on(col('color_primary'))};--on-btn:${on(col('color_button'))};--on-accent:${on(col('color_accent'))};
--hdr-bg:${hdrBg};--hdr-text:${hdrLight ? col('color_text') : on(col('color_primary'))};
--ann-bg:${col('ann_bg')};--ann-color:${col('ann_color')};
--radius:${Math.max(0, Math.min(28, s.radius))}px;--container:${Math.max(960, Math.min(1600, s.container_width))}px;
--font:${stack};--cols:${s.grid_cols};--img-fit:${s.image_fit};
}
${s.sticky_header ? '' : '.site-header{position:static!important}'}
${s.custom_css || ''}`;
  return css.cache = { v: settings.version(), body: out }, out;
}
module.exports = { css, on };
