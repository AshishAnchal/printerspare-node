# Printer Spare — Node.js store (v2)

A complete rebuild of your PHP/MySQL store as a **Node.js + Express + SQLite** app, with a much more customisable storefront.
No separate database server needed — everything is in `data/store.db`; images live in `data/uploads/`.

## Run it
```bash
npm install
cp .env.example .env      # optional: set SESSION_SECRET, SITE_URL, ADMIN_PASSWORD…
npm start                 # http://localhost:3000
```
Admin panel: **/admin** — first-run login `admin` / `admin123` (or `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env`). Change it immediately (Admin → Admins & password).
Test everything: with the server running, `node scripts/smoke.js http://localhost:3000`.

## What was copied from the PHP project
Categories (+ their photos), the 8 products, 3 coupons (PRINTER20, FIRST10, SAVE50), brand strip, 3 hero slides, trust strip, menus, category colours, store name/phone/WhatsApp/address/GST 18%/free-shipping ₹999/₹99 shipping, all pages' logic (cart, coupons, GST, COD + Razorpay, pincode shipping zones, Delhivery tracking, enquiries, user accounts, order history, admin panel) and every image in `assets/uploads`.
Old URLs (`/product.php?slug=…`, `/products.php`, …) redirect 301 to the new ones.

**Not in the zip:** your *live* MySQL rows (real products/orders/customers) — the zip only had the starter SQL. Bring them over in Admin → Import / Export → *Import from your old PHP/MySQL store* (upload a phpMyAdmin `.sql` export; passwords keep working), then copy your old `assets/uploads/*` into `data/uploads/`.
Seven product photos had no product row; they were added as **inactive drafts** (price 0) — set price/stock and activate. One image (`product-1788292051-5382.jpg`, three people in masks) looks like an accidental upload — it's only in the Media library, delete it there.
Shipping-zone charges are starter values (Lucknow ₹49, UP ₹79, NE/J&K ₹149, A&N ₹199, rest ₹99) — edit under Shipping zones.

## New customisation (all from the admin, no code)
| Where | What you can change |
|---|---|
| **Appearance** | 7 colour presets + every colour, font (7), corner roundness, page width, header style (dark/light/centered), card style, products per row, image fit, sticky header, announcement bar, custom CSS — with a **live preview** (desktop/mobile) |
| **Homepage builder** | Reorder / hide / duplicate / add sections: hero, trust strip, brands, category grid, product rows (newest, featured, sale, most-viewed, a category, a brand; grid or scroll), per-category blocks, CTA band, promo banner, custom HTML, newsletter |
| **Hero slides, Trust strip, Brands, Menus, Pages** | Full CRUD with ordering; header/footer menus; CMS pages (`/page/<slug>`) |
| **Settings** (≈110 options) | Store info, logo upload, 15+ show/hide toggles (ratings, wishlist, WhatsApp button, category bar…), GST mode (add-on / inclusive / none), free-shipping threshold, COD on/off + min/max order + fee, guest checkout, minimum order, labels/button text, Razorpay & Delhivery keys, SMTP, SEO/analytics/custom head & body code, **maintenance mode** |
| **Products** | Variants/pack sizes, gallery images, badges, tags, per-product free shipping, feature chips, YouTube how-to, SEO fields, bulk actions (activate, move category, ±% price), duplicate, CSV import/export |
| **Also new** | Real customer reviews (moderated) instead of random star counts, order timeline + AWB + status emails, printable invoices, dashboard with sales chart & low-stock, media library, DB backup download, multiple admins, sitemap/robots, coupon expiry & max-discount |

## Deploy
* **VPS / any Node host:** `NODE_ENV=production npm start` behind nginx/Caddy with HTTPS; keep `data/` on a persistent disk; use `pm2 start server.js`.
* **Hostinger:** needs a Node.js plan (Business/Cloud) → create a Node app, upload, `npm install`, entry file `server.js`. Plain PHP shared hosting cannot run this.
* Behind HTTPS set `SITE_URL`. If you test in production mode over plain http, set `COOKIE_SECURE=0`.

## Security notes
* The PHP files contained **live Razorpay keys, a Delhivery token and DB credentials** — none were copied. Rotate them, then enter new ones in Settings (or `.env`).
* Improvements over the PHP version: Razorpay amount is computed server-side and the payment signature is verified against it (the PHP trusted the browser's amount); CSRF tokens on every form; prices never trusted from the client; login rate-limiting; stock re-checked at order time.
* The admin `admin123` in the old schema.sql did not actually match its hash, so a fresh `admin/admin123` is created instead.
* GST: the PHP *added* 18% on top while labelling prices "inclusive". Default here keeps the add-on behaviour; switch in Settings → Pricing, GST & Checkout.
