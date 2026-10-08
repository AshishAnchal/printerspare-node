(function () {
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  // confirm destructive actions
  document.addEventListener('submit', function (e) { var m = e.target.getAttribute('data-confirm'); if (m && !confirm(m)) e.preventDefault(); });
  // colour picker <-> text
  $$('.colorfield').forEach(function (w) { var c = w.querySelector('input[type=color]'), t = w.querySelector('input[type=text]'); c.addEventListener('input', function () { t.value = c.value; t.dispatchEvent(new Event('input', { bubbles: true })); }); t.addEventListener('input', function () { if (/^#[0-9a-f]{6}$/i.test(t.value)) c.value = t.value; }); });
  // tabs
  $$('[data-tabs]').forEach(function (bar) {
    var btns = $$('[data-tab]', bar), key = 'adm_tab_' + location.pathname;
    function show(id) { btns.forEach(function (b) { b.classList.toggle('on', b.dataset.tab === id); }); $$('.pane').forEach(function (p) { p.classList.toggle('on', p.id === id); }); try { sessionStorage.setItem(key, id); } catch (e) {} }
    btns.forEach(function (b) { b.addEventListener('click', function (ev) { ev.preventDefault(); show(b.dataset.tab); }); });
    var saved = null; try { saved = sessionStorage.getItem(key); } catch (e) {}
    show(saved && document.getElementById(saved) ? saved : btns[0].dataset.tab);
  });
  // image preview
  $$('input[type=file][data-preview]').forEach(function (i) { i.addEventListener('change', function () { var f = i.files[0]; if (!f) return; var img = document.getElementById(i.dataset.preview); if (img) { img.src = URL.createObjectURL(f); img.style.display = ''; } }); });
  // select-all checkbox
  $$('[data-checkall]').forEach(function (a) { a.addEventListener('change', function () { $$('input[name="ids"]').forEach(function (c) { c.checked = a.checked; }); }); });
})();
