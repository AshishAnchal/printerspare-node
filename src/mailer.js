'use strict';
const nodemailer = require('nodemailer');
const settings = require('./settings');
const { esc, money, fmtDate } = require('./lib');

function transport() {
  const host = settings.get('smtp_host'); if (!host) return null;
  return nodemailer.createTransport({ host, port: settings.get('smtp_port') || 465, secure: !!settings.get('smtp_secure'), auth: settings.get('smtp_user') ? { user: settings.get('smtp_user'), pass: settings.get('smtp_pass') } : undefined, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
}
async function send(to, subject, html) {
  const t = transport(); if (!t || !to) return false;
  try {
    const fromName = settings.get('mail_from_name') || settings.get('store_name');
    await t.sendMail({ from: `"${fromName}" <${settings.get('smtp_user') || settings.get('email')}>`, to, subject, html });
    return true;
  } catch (e) { console.warn('[mail] failed:', e.message); return false; }
}
const wrap = (title, inner) => `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
<div style="background:${esc(settings.get('color_primary'))};color:#fff;padding:18px 22px;font-size:18px;font-weight:700">${esc(settings.get('store_name'))}</div>
<div style="padding:22px"><h2 style="margin:0 0 14px;font-size:18px">${title}</h2>${inner}</div>
<div style="background:#f9fafb;padding:12px 22px;font-size:12px;color:#6b7280">${esc(settings.get('address'))} · ${esc(settings.get('phone'))} · ${esc(settings.get('email'))}</div></div>`;
const itemsTable = (items) => `<table style="width:100%;border-collapse:collapse;font-size:14px">${items.map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(i.product_name)} × ${i.quantity}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${money(i.total)}</td></tr>`).join('')}</table>`;

function orderHtml(o, items) {
  return wrap(`Order confirmed — #${esc(o.order_number)}`, `<p>Hi ${esc(o.name)}, thanks for your order! Placed on ${esc(fmtDate(o.created_at))}.</p>${itemsTable(items)}
<p style="text-align:right;font-size:14px">Subtotal ${money(o.subtotal)}${o.discount ? ` · Discount −${money(o.discount)}` : ''}${o.gst ? ` · GST ${money(o.gst)}` : ''} · Shipping ${o.shipping ? money(o.shipping) : 'FREE'}${o.cod_fee ? ` · COD fee ${money(o.cod_fee)}` : ''}<br><b style="font-size:16px">Total ${money(o.total)}</b> (${o.payment_method === 'cod' ? 'Cash on Delivery' : o.payment_status === 'paid' ? 'Paid online' : 'Online — pending'})</p>
<p style="font-size:14px"><b>Ship to:</b><br>${esc(o.name)}, ${esc(o.address)}, ${esc(o.city)}, ${esc(o.state)} ${esc(o.pincode)}<br>📞 ${esc(o.phone)}</p>`);
}
const sendOrderConfirmation = (o, items) => settings.get('email_customer_on_order') ? send(o.email, `✅ Order confirmed #${o.order_number} | ${settings.get('store_name')}`, orderHtml(o, items)) : false;
const sendAdminAlert = (o, items) => { const to = settings.get('admin_notify_email') || settings.get('email'); return send(to, `🛒 New order #${o.order_number} — ${money(o.total)}`, orderHtml(o, items)); };
const sendStatusUpdate = (o) => settings.get('email_customer_on_status') ? send(o.email, `Order #${o.order_number} is now ${o.order_status}`, wrap(`Your order is ${esc(o.order_status)}`, `<p>Hi ${esc(o.name)}, the status of order <b>#${esc(o.order_number)}</b> is now <b>${esc(o.order_status)}</b>.</p>${o.awb ? `<p>Tracking number (AWB): <b>${esc(o.awb)}</b> via ${esc(o.courier || '')}</p>` : ''}`)) : false;
module.exports = { send, sendOrderConfirmation, sendAdminAlert, sendStatusUpdate, orderHtml };
