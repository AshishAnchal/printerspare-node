(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var csrf = document.body.getAttribute('data-csrf');
  var money = function (n, cur) { return (cur || '₹') + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  /* mobile drawer */
  var drawer = $('#mobDrawer'), overlay = $('#mobOverlay');
  function openD() { drawer.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeD() { drawer.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; }
  if ($('#hamBtn')) $('#hamBtn').addEventListener('click', openD);
  if ($('#mobClose')) $('#mobClose').addEventListener('click', closeD);
  if (overlay) overlay.addEventListener('click', closeD);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeD(); });

  /* auto-dismiss alerts */
  $$('#alerts .alert').forEach(function (a) { setTimeout(function () { a.style.transition = 'opacity .4s'; a.style.opacity = 0; setTimeout(function () { a.remove(); }, 450); }, 5000); });

  /* hero slider */
  var hs = $('#heroSlider');
  if (hs) {
    var track = $('#heroTrack'), dots = $$('.hero-dot', hs), n = +hs.dataset.count, cur = 0, timer, ms = +hs.dataset.auto || 4500;
    var go = function (i) { cur = (i + n) % n; track.style.transform = 'translateX(-' + cur * 100 + '%)'; dots.forEach(function (d, k) { d.classList.toggle('active', k === cur); }); };
    var auto = function () { clearInterval(timer); if (n > 1) timer = setInterval(function () { go(cur + 1); }, ms); };
    if ($('#heroPrev')) { $('#heroPrev').onclick = function () { go(cur - 1); auto(); }; $('#heroNext').onclick = function () { go(cur + 1); auto(); }; }
    dots.forEach(function (d) { d.onclick = function () { go(+d.dataset.i); auto(); }; });
    var sx = 0; hs.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    hs.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) { go(cur + (dx < 0 ? 1 : -1)); auto(); } });
    auto();
  }

  /* qty steppers */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]'); if (!b) return;
    var inp = b.parentElement.querySelector('input'); var v = (parseInt(inp.value, 10) || 1) + parseInt(b.dataset.q, 10);
    v = Math.max(parseInt(inp.min, 10) || 1, Math.min(v, parseInt(inp.max, 10) || 999)); inp.value = v;
    if (inp.hasAttribute('data-autosubmit')) inp.form.submit();
  });
  $$('[data-autosubmit]').forEach(function (i) { i.addEventListener('change', function () { i.form.submit(); }); });

  /* tabs */
  $$('.tab-btn').forEach(function (b) { b.addEventListener('click', function () { $$('.tab-btn').forEach(function (x) { x.classList.remove('active'); }); $$('.tab-pane').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); var t = document.getElementById(b.dataset.tab); if (t) t.classList.add('active'); }); });
  if (location.hash === '#reviews' && $('#revTab')) $('#revTab').click();

  /* gallery */
  $$('.thumb').forEach(function (t) { t.addEventListener('click', function () { $('#mainImg').src = t.dataset.src; $$('.thumb').forEach(function (x) { x.classList.remove('active'); }); t.classList.add('active'); }); });
  if ($('#copyLink')) $('#copyLink').onclick = function () { var u = this.dataset.url || location.href; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { $('#copyLink').textContent = '✓'; }, function () { prompt('Copy link', u); }); };

  /* product variants */
  var vr = $('#variantRow');
  if (vr && window.PRODUCT) {
    var P = window.PRODUCT;
    var apply = function (btn) {
      $$('.variant', vr).forEach(function (x) { x.classList.remove('active'); }); btn.classList.add('active');
      var price = parseFloat(btn.dataset.price), old = parseFloat(btn.dataset.old || 0), stock = parseInt(btn.dataset.stock, 10);
      $('#selLabel').textContent = btn.dataset.label; $('#variantId').value = btn.dataset.id; $('#curPrice').textContent = money(price, P.cur);
      var op = $('#oldPrice'), sp = $('#savePill'); if (old > price) { op.style.display = ''; op.textContent = money(old, P.cur); sp.style.display = ''; sp.textContent = 'Save ' + money(old - price, P.cur); } else { op.style.display = 'none'; sp.style.display = 'none'; }
      $('#stockLine').innerHTML = stock > 0 ? '<span style="color:var(--success)">✅ In Stock</span>' + (stock < P.lowStock ? ' <span class="save-pill" style="background:#fffbeb;color:#92400e">Only ' + stock + ' left!</span>' : '') : '<span style="color:#ef4444">❌ Out of Stock</span>';
      ['addBtn', 'buyBtn'].forEach(function (id) { $('#' + id).disabled = stock <= 0; }); $('#addBtn').textContent = stock > 0 ? P.addLabel : '❌ Out of Stock';
      var q = $('#qtyInput'); q.max = Math.max(stock, 1); if (+q.value > stock && stock > 0) q.value = stock;
    };
    $$('.variant', vr).forEach(function (b) { b.addEventListener('click', function () { apply(b); }); });
  }

  /* pincode checker (product page) */
  if ($('#pinBtn')) {
    var pin = $('#pinInput'), out = $('#pinResult');
    var check = function () {
      var v = pin.value.replace(/\D/g, ''); if (v.length !== 6) { out.innerHTML = '<span style="color:#ef4444">Enter a 6-digit pincode</span>'; return; }
      out.textContent = '⏳ Checking…';
      fetch('/api/pincode?pin=' + v).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok) { out.innerHTML = '<span style="color:#ef4444;font-weight:700">❌ ' + (d.message || 'Not deliverable') + '</span> — <a href="/enquiry" style="text-decoration:underline">contact us</a>'; return; }
        out.innerHTML = '<span style="color:var(--success);font-weight:700">✅ Delivery available' + (d.city ? ' in ' + d.city : '') + '</span><br><span class="muted">📦 ' + d.days + ' · Shipping ' + (d.charge ? money(d.charge, (window.PRODUCT || {}).cur) : 'FREE') + '</span>';
      }).catch(function () { out.innerHTML = '<span style="color:#ef4444">Check failed — try again</span>'; });
    };
    $('#pinBtn').onclick = check; pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  }

  /* add-to-cart (ajax from cards, keeps page position) */
  document.addEventListener('submit', function (e) {
    var f = e.target; if (f.getAttribute('action') !== '/cart/add' || f.id === 'addForm') return;
    e.preventDefault(); var btn = f.querySelector('button'); var orig = btn.textContent;
    fetch('/cart/add', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }, body: new URLSearchParams(new FormData(f)) })
      .then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok) { btn.textContent = '⚠️ ' + (d.message || 'Error'); } else { btn.textContent = btn.dataset.added || '✅ Added!'; var b = $('#cartBadge'); if (b) { b.textContent = d.count; b.style.display = 'flex'; } }
        setTimeout(function () { btn.textContent = orig; }, 1600);
      }).catch(function () { f.submit(); });
  });

  /* wishlist (stored in the browser) */
  var WL = 'ps_wishlist';
  var getW = function () { try { return JSON.parse(localStorage.getItem(WL) || '[]'); } catch (e) { return []; } };
  var setW = function (a) { try { localStorage.setItem(WL, JSON.stringify(a)); } catch (e) { /* private mode */ } };
  var paintW = function () { var w = getW(); $$('[data-wish]').forEach(function (b) { b.classList.toggle('on', w.indexOf(+b.dataset.wish) > -1); }); };
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-wish]'); if (!b) return; var id = +b.dataset.wish, w = getW(), i = w.indexOf(id); if (i > -1) w.splice(i, 1); else w.push(id); setW(w); paintW(); });
  paintW();
  if ($('#wishGrid')) { var ids = getW(); if (!ids.length) $('#wishGrid').innerHTML = '<div class="empty"><div class="big">❤️</div><h2>Your wishlist is empty</h2><p class="muted" style="margin:.4rem 0 1rem">Tap the heart on any product to save it.</p><a class="btn btn-navy" href="/products">Browse products</a></div>'; else fetch('/wishlist/items?ids=' + ids.join(',')).then(function (r) { return r.text(); }).then(function (h) { $('#wishGrid').innerHTML = h; paintW(); }); }

  /* back to top */
  var tt = $('#toTop'); if (tt) { window.addEventListener('scroll', function () { tt.classList.toggle('show', window.scrollY > 500); }, { passive: true }); tt.onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }; }

  /* checkout */
  var cf = $('#checkoutForm');
  if (cf) {
    var C = window.CHECKOUT || {}, q = function (n) { return cf.elements[n]; };
    var method = function () { var r = cf.querySelector('input[name=payment_method]:checked'); return r ? r.value : 'cod'; };
    var refresh = function () {
      var u = '/checkout/quote?pincode=' + encodeURIComponent(q('pincode').value) + '&state=' + encodeURIComponent(q('state').value) + '&city=' + encodeURIComponent(q('city').value) + '&method=' + method();
      fetch(u).then(function (r) { return r.json(); }).then(function (d) {
        $('#qShip').innerHTML = d.shipping ? money(d.shipping, C.cur) : '<b style="color:var(--success)">FREE</b>'; $('#qZone').textContent = d.zone ? '(' + d.zone + ')' : '';
        $('#qTotal').textContent = money(d.total, C.cur); $('#qCodRow').style.display = d.codFee ? '' : 'none'; $('#qCod').textContent = money(d.codFee, C.cur);
        $('#qDays').textContent = d.days ? '📦 Estimated delivery: ' + d.days : '';
      });
    };
    $$('.pay-opt', cf).forEach(function (o) { o.addEventListener('click', function () { if (o.classList.contains('disabled')) return; $$('.pay-opt', cf).forEach(function (x) { x.classList.remove('sel'); }); o.classList.add('sel'); o.querySelector('input').checked = true; refresh(); $('#placeBtn').textContent = method() === 'online' ? 'Pay Securely →' : 'Place Order →'; }); });
    q('state').addEventListener('change', refresh); q('city').addEventListener('change', refresh);
    var pinMsg = $('#pinMsg'), lastPin = '';
    q('pincode').addEventListener('input', function () {
      var v = this.value.replace(/\D/g, ''); this.value = v; if (v.length !== 6 || v === lastPin) return; lastPin = v; pinMsg.textContent = '⏳ Checking pincode…';
      fetch('/api/lookup-pin?pin=' + v).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok) { pinMsg.innerHTML = '<span style="color:#ef4444">Delivery not available at this pincode</span>'; return; } pinMsg.textContent = '✅ Deliverable';
        if (d.city && !q('city').value) q('city').value = d.city; if (d.state) q('state').value = d.state; refresh();
      }).catch(function () { pinMsg.textContent = ''; refresh(); });
    });
    refresh();
    var btn = $('#placeBtn'), busy = false;
    cf.addEventListener('submit', function (e) {
      if (busy) { e.preventDefault(); return; }
      if (method() !== 'online' || q('razorpay_signature').value) { busy = true; btn.disabled = true; btn.textContent = 'Placing order…'; return; }
      e.preventDefault();
      for (var i = 0; i < cf.elements.length; i++) { var el = cf.elements[i]; if (el.required && !el.value.trim()) { el.focus(); el.style.borderColor = '#ef4444'; return; } }
      btn.disabled = true; btn.textContent = 'Starting payment…';
      var body = new URLSearchParams(new FormData(cf));
      fetch('/checkout/razorpay-order', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf, Accept: 'application/json' }, body: body }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok) throw new Error(d.message);
        if (!window.Razorpay) throw new Error('Payment window failed to load. Check your connection and try again.');
        var rz = new Razorpay({ key: d.key, amount: d.amount, currency: 'INR', name: d.name, order_id: d.order_id, prefill: d.prefill, theme: { color: d.color || '#1a1f5e' },
          handler: function (res) { q('razorpay_payment_id').value = res.razorpay_payment_id; q('razorpay_order_id').value = res.razorpay_order_id; q('razorpay_signature').value = res.razorpay_signature; btn.textContent = 'Confirming payment…'; busy = true; cf.submit(); },
          modal: { ondismiss: function () { btn.disabled = false; btn.textContent = 'Pay Securely →'; } } });
        rz.on('payment.failed', function (r) { alert('Payment failed: ' + ((r.error && r.error.description) || 'please try again')); btn.disabled = false; btn.textContent = 'Pay Securely →'; });
        rz.open();
      }).catch(function (err) { alert(err.message || 'Could not start payment'); btn.disabled = false; btn.textContent = 'Pay Securely →'; });
    });
  }
})();
