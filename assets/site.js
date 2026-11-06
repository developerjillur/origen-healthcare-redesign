/* ORIGEN Healthcare site script: views (artifact preview only), menus, live open status, tabs, request flow. */
(function () {
  'use strict';
  var doc = document, body = doc.body;
  var MODE = body.getAttribute('data-mode') || 'export';
  var CFG = window.ORIGEN || {};
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };
  var items = [], menuBtn = null, drawer = null;

  function currentView() { return MODE === 'artifact' ? ($('.view:not([hidden])') || doc) : ($('.view') || doc); }

  /* ---------- header ---------- */
  var head = $('[data-head]');
  var onScroll = function () { if (head) head.classList.toggle('is-scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  menuBtn = $('[data-menu-btn]');
  drawer = $('#drawer');
  function setDrawer(open) {
    if (!menuBtn || !drawer) return;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    drawer.hidden = !open;
    body.classList.toggle('menu-open', open);
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setDrawer(menuBtn.getAttribute('aria-expanded') !== 'true'); });
  if (drawer) drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setDrawer(false); });

  items = $$('.nav-item[data-menu]');
  function setPanel(item, open) {
    item.classList.toggle('open', open);
    var b = $('.nav-btn', item);
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeAll() { items.forEach(function (i) { setPanel(i, false); }); setDrawer(false); }
  items.forEach(function (item) {
    var b = $('.nav-btn', item), timer;
    b.addEventListener('click', function () {
      var open = !item.classList.contains('open');
      items.forEach(function (i) { if (i !== item) setPanel(i, false); });
      setPanel(item, open);
    });
    if (window.matchMedia('(hover: hover)').matches) {
      item.addEventListener('mouseenter', function () { clearTimeout(timer); items.forEach(function (i) { if (i !== item) setPanel(i, false); }); setPanel(item, true); });
      item.addEventListener('mouseleave', function () { timer = setTimeout(function () { setPanel(item, false); }, 160); });
    }
    item.addEventListener('click', function (e) { if (e.target.closest('.nav-panel a')) setPanel(item, false); });
  });
  doc.addEventListener('click', function (e) { if (!e.target.closest('.nav-item')) items.forEach(function (i) { setPanel(i, false); }); });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = items.filter(function (i) { return i.classList.contains('open'); })[0];
    if (open) { setPanel(open, false); $('.nav-btn', open).focus(); }
    if (menuBtn && menuBtn.getAttribute('aria-expanded') === 'true') { setDrawer(false); menuBtn.focus(); }
  });

  /* ---------- live open status (America/Chicago) ---------- */
  function chicagoNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      var get = function (t) { return (parts.filter(function (p) { return p.type === t; })[0] || {}).value; };
      var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      return { day: wd, mins: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10) };
    } catch (e) { var d = new Date(); return { day: d.getDay(), mins: d.getHours() * 60 + d.getMinutes() }; }
  }
  function statusText() {
    var n = chicagoNow(), weekday = n.day >= 1 && n.day <= 5;
    if (weekday && n.mins >= 540 && n.mins < 1020) return { open: true, text: 'Open now until 5 PM' };
    if (weekday && n.mins < 540) return { open: false, text: 'Opens today at 9 AM' };
    if (n.day >= 1 && n.day <= 4) return { open: false, text: 'Closed now, opens tomorrow at 9 AM' };
    if (n.day === 6) return { open: false, text: 'Saturday: by appointment' };
    return { open: false, text: 'Closed now, opens Monday at 9 AM' };
  }
  function paintStatus() {
    var s = statusText(), idx = (chicagoNow().day + 6) % 7;
    $$('[data-status]').forEach(function (el) {
      el.classList.toggle('is-open', s.open);
      var t = $('.status-text', el);
      if (t) t.textContent = s.text;
    });
    $$('.hours li[data-day]').forEach(function (li) { li.classList.toggle('is-today', parseInt(li.getAttribute('data-day'), 10) === idx); });
  }
  paintStatus();
  setInterval(paintStatus, 60000);

  /* ---------- views (artifact: every page is a view on a plain #slug) ---------- */
  function show(slug) {
    var target = slug && doc.getElementById('view-' + slug) ? slug : (slug ? 'not-found' : 'home');
    $$('.view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== target; });
    var titles = CFG.titles || {};
    if (titles[target]) doc.title = titles[target];
    body.classList.toggle('on-request', target === 'request-appointment');
    body.classList.toggle('on-thanks', target === 'thank-you');
    closeAll();
    window.scrollTo(0, 0);
    var main = $('#main');
    if (main && slug) main.focus({ preventScroll: true });
    setupView();
  }
  if (MODE === 'artifact') {
    window.addEventListener('hashchange', function () { show((location.hash || '').replace(/^#/, '')); });
    show((location.hash || '').replace(/^#/, ''));
  } else {
    body.classList.toggle('on-request', !!$('.view.is-request'));
    body.classList.toggle('on-thanks', !!$('.view.is-thanks'));
    setupView();
  }

  /* jump links scroll inside the current view and never change the route */
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('[data-jump]');
    if (!a) return;
    var id = a.getAttribute('data-jump');
    var el = currentView().querySelector('[id="' + id + '"]') || doc.getElementById(id);
    if (!el) return;
    e.preventDefault();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* remember which service a request button came from */
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-service]');
    if (a) { store.set('origen-service', a.getAttribute('data-service')); return; }
    var r = e.target.closest('a');
    if (r && /request-appointment\/?$/.test(r.getAttribute('href') || '')) store.set('origen-service', '');
  });

  function setupView() {
    var v = currentView();
    if (!v || v.__ready) return;
    v.__ready = true;
    setupTabs(v);
    setupToc(v);
    var qc = $('[data-qcheck]', v);
    if (qc) {
      var boxes = $$('input[name=qc]', qc), out = $('[data-qc-result]', qc);
      qc.addEventListener('change', function () {
        var n = boxes.filter(function (b) { return b.checked; }).length;
        var adult = boxes[0].checked, ride = boxes[boxes.length - 1].checked;
        var msg = n === boxes.length ? 'All five fit you: Spravato\u00ae may be worth asking about. Request an evaluation and your provider will confirm whether it is right and safe for you.'
          : n >= 3 ? n + ' of 5 fit you. An evaluation can tell you whether Spravato\u00ae or another treatment fits best.'
          : n ? n + ' of 5 fit you. Other treatments may come first; an evaluation helps you choose.' : 'Tick the statements that fit you.';
        if (n && !adult) msg = 'Spravato\u00ae is for adults (18 and older). For a child or teen, our child and teen psychiatry care is the right place to start.';
        else if (n >= 3 && !ride) msg += ' You will also need someone to drive you home after each visit.';
        out.textContent = msg;
        var kid = $('[data-qc-kid]', qc);
        if (kid) kid.hidden = !(n && !adult);
      });
    }
    var form = $('[data-request]', v);
    if (form) setupRequest(form);
  }

  function setupTabs(v) {
    $$('[role=tablist]', v).forEach(function (list) {
      var tabs = $$('[role=tab]', list);
      function select(tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var p = v.querySelector('[id="' + t.getAttribute('aria-controls') + '"]');
          if (p) p.hidden = !on;
        });
        if (focus) tab.focus();
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(t); });
        t.addEventListener('keydown', function (e) {
          var k = e.key, j = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : null;
          if (j === null) return;
          e.preventDefault();
          select(tabs[(j + tabs.length) % tabs.length], true);
        });
      });
    });
  }

  function setupToc(v) {
    var links = $$('.toc a[data-jump]', v);
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { var el = v.querySelector('[id="' + a.getAttribute('data-jump') + '"]'); if (el) map[el.id] = { a: a, el: el }; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (l) { l.classList.remove('is-active'); });
          map[en.target.id].a.classList.add('is-active');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(map).forEach(function (id) { io.observe(map[id].el); });
  }

  /* ---------- request flow ---------- */
  var LINE_OF = {
    'Mental health & psychiatry': ['Adult psychiatry', 'Child & teen psychiatry', 'ADHD', 'Autism (ASD) testing', 'Depression', 'Anxiety', 'Mood disorders', 'PTSD', 'Personality disorders', 'Postpartum counseling', 'PMDD', 'PMS', 'Insomnia', 'Mental health'],
    'Spravato® treatment': ['Spravato® treatment', 'Spravato®'],
    'Medical spa': ['Morpheus8', 'PRP microneedling', 'HydraFacial', 'Laser hair removal', 'Laser tattoo removal', 'PRP for hair', 'Diamond microdermabrasion', 'LED teeth whitening', 'Medical spa'],
    'Primary care': ['Primary care'],
    'Weight loss & HRT': ['Weight loss & HRT']
  };
  function setupRequest(form) {
    var steps = $$('[data-step]', form), dots = $$('[data-step-dot]', form);
    var label = $('[data-step-label]', form), err = $('[data-error]', form);
    var back = $('[data-back]', form), next = $('[data-next]', form), submit = $('[data-submit]', form);
    var at = 0;
    function go(i, focus) {
      at = i;
      steps.forEach(function (s, k) { s.hidden = k !== i; });
      dots.forEach(function (d, k) { d.classList.toggle('is-done', k < i); d.classList.toggle('is-now', k === i); });
      label.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
      back.hidden = i === 0;
      next.hidden = i === steps.length - 1;
      submit.hidden = i !== steps.length - 1;
      err.hidden = true;
      if (focus) {
        var first = steps[i].querySelector('legend, label');
        if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
        var top = form.getBoundingClientRect().top + window.scrollY - 110;
        if (window.scrollY > top) window.scrollTo(0, top);
      }
    }
    function fieldErr(el, msg) {
      var host = el.type === 'radio' ? el.closest('fieldset') : (el.type === 'checkbox' ? el.closest('label').parentNode : (el.closest('.field') || el.parentNode));
      var p = host.querySelector(':scope > .f-err[data-for="' + (el.id || el.name) + '"]');
      if (!msg) { if (p) p.hidden = true; if (el.type !== 'radio') el.setAttribute('aria-invalid', 'false'); return; }
      if (!p) {
        p = doc.createElement('p'); p.className = 'f-err'; p.id = (el.id || el.name) + '-err'; p.setAttribute('data-for', el.id || el.name);
        if (el.type === 'checkbox') el.closest('label').insertAdjacentElement('afterend', p); else host.appendChild(p);
      }
      p.textContent = msg; p.hidden = false;
      if (el.type !== 'radio') { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', p.id); }
    }
    var MSG = { name: 'Please enter your full name.', phone: 'Please enter a phone number with 10 digits.', email: 'Please enter an email address, like name@example.com.',
      insurance: 'Please choose your plan, or choose Not sure.', patient_name: 'Please enter the patient\u2019s name.', patient_age: 'Please enter the patient\u2019s age.' };
    function check(i) {
      var step = steps[i], bad = 0, first = null, seen = {};
      $$('input[type=radio][required]', step).forEach(function (r) {
        if (seen[r.name]) return;
        seen[r.name] = true;
        var ok = $$('input[name="' + r.name + '"]', step).some(function (x) { return x.checked; });
        fieldErr(r, ok ? '' : 'Please choose one option.');
        if (!ok) { bad++; first = first || r; }
      });
      $$('input[required]:not([type=radio]):not([type=checkbox]), select[required]', step).forEach(function (f) {
        if (f.closest('[hidden]')) return;
        var v = f.value.trim();
        var ok = v && (f.type !== 'email' || /.+@.+\..+/.test(v)) && (f.type !== 'tel' || v.replace(/\D/g, '').length >= 10);
        fieldErr(f, ok ? '' : (MSG[f.name] || 'Please fill in this field.'));
        if (!ok) { bad++; first = first || f; }
      });
      var consent = $('input[name=consent]', step);
      if (consent) {
        fieldErr(consent, consent.checked ? '' : 'Please tick the box so our team can contact you.');
        if (!consent.checked) { bad++; first = first || consent; }
      }
      if (bad) {
        err.textContent = bad === 1 ? 'One answer needs your attention.' : bad + ' answers need your attention.';
        err.hidden = false;
        if (first) first.focus();
        return false;
      }
      err.hidden = true;
      return true;
    }
    function syncWho() {
      var who = form.querySelector('input[name=who]:checked'), box = $('[data-patient]', form);
      if (!box) return;
      var other = !!who && who.value !== 'Me';
      box.hidden = !other;
      $$('input', box).forEach(function (f) { f.required = other; if (!other) fieldErr(f, ''); });
    }
    function syncEmail() {
      var best = $('[name=best]', form), em = $('[name=email]', form), tag = $('[data-em-tag]', form);
      if (!best || !em) return;
      var need = best.value === 'Email';
      em.required = need;
      if (tag) tag.textContent = need ? '(needed for email replies)' : '(optional)';
      if (!need) fieldErr(em, '');
    }
    next.addEventListener('click', function () { if (check(at)) go(at + 1, true); });
    back.addEventListener('click', function () { go(at - 1, true); });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'line') $$('.concerns', form).forEach(function (c) {
        c.hidden = c.getAttribute('data-for') !== e.target.value;
        if (c.hidden) $$('input', c).forEach(function (x) { x.checked = false; });
      });
      if (e.target.name === 'who') syncWho();
      if (e.target.name === 'best') syncEmail();
      var filled = (e.target.type === 'radio' || e.target.type === 'checkbox') ? e.target.checked : !!e.target.value;
      if (filled && e.target.name !== 'concern' && e.target.name !== 'days') fieldErr(e.target, '');
    });
    function prefill() {
      var svc = store.get('origen-service');
      if (!svc) return;
      Object.keys(LINE_OF).forEach(function (line) {
        if (LINE_OF[line].indexOf(svc) < 0) return;
        var r = form.querySelector('input[name=line][value="' + line + '"]');
        if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
        var c = form.querySelector('input[name=concern][value="' + svc + '"]');
        if (c) c.checked = true;
      });
    }
    prefill();
    syncWho();
    syncEmail();
    window.addEventListener('hashchange', function () { if (location.hash === '#request-appointment') prefill(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!check(at)) return;
      if (MODE === 'artifact') { form.reset(); syncWho(); syncEmail(); go(0, false); store.set('origen-service', ''); location.hash = 'thank-you'; return; }
      var endpoint = form.getAttribute('data-endpoint') || window.ORIGEN_FORM_ENDPOINT;
      if (!endpoint) {
        err.textContent = 'Online requests are not connected yet. Please call (531) 571-3018, Monday to Friday, 9 AM to 5 PM.';
        err.hidden = false;
        return;
      }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = data[k] ? [].concat(data[k], v) : v; });
      submit.disabled = true;
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); location.href = '/origen-healthcare-redesign/thank-you/'; })
        .catch(function () { submit.disabled = false; err.textContent = 'Sorry, your request did not go through. Please call (531) 571-3018.'; err.hidden = false; });
    });
    go(0, false);
  }
})();
