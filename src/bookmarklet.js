/* "JUZ40 · SapaLine" bookmarklet. Runs on a SapaLine "Live Sabaq" page (e.g. /live-sabaq/smart/physics),
   reads every lesson of the week shown (table layout on a wide screen, cards on a narrow one), opens each
   lesson's survey from the "Ұнау %" cell, reads Ұнады / Орташа / Ұнамады and closes it again.
   It never types anything into SapaLine. The result is JSON for the admin panel's import window.
   Built into a javascript: URL by the build scripts (comments and indentation are stripped, so every
   statement must end with a semicolon). */
(async function () {
  var D = document, W = window;
  if (W.__juz40busy) { return; }
  var BOX = 'juz40-sapa-box';
  var old = D.getElementById(BOX); if (old) { old.remove(); }
  var box = D.createElement('div'); box.id = BOX;
  box.setAttribute('style', 'position:fixed;z-index:2147483647;top:16px;right:16px;width:380px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;background:#2a0f33;color:#f8ecfc;font:14px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.45);padding:16px;text-align:left;pointer-events:auto!important;isolation:isolate');
  D.body.appendChild(box);
  var stop = false, json = '';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var btn = function (x, label, main) { return '<button type="button" data-x="' + x + '" style="pointer-events:auto!important;cursor:pointer;border:0;border-radius:999px;padding:9px 15px;margin:12px 8px 0 0;font-family:inherit;font-size:13px;font-weight:700;' + (main ? 'background:#e2b8ef;color:#2a0f33' : 'background:rgba(248,236,252,.12);color:#f8ecfc') + '">' + label + '</button>'; };
  var show = function (html, buttons) { box.innerHTML = '<div style="font-weight:800;letter-spacing:.03em;margin-bottom:8px">JUZ40 · SapaLine</div><div>' + html + '</div><div>' + (buttons || '') + '</div>'; };
  var notice = function (text) { var el = box.querySelector('[data-copy-status]'); if (el) { el.textContent = text; } };
  var selectJSON = function () {
    var ta = box.querySelector('#juz40-json');
    if (!ta) { return false; }
    try { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); return true; } catch (e) { return false; }
  };
  var done = function (b) { if (b) { b.textContent = 'Көшірілді ✓'; } notice('Деректер көшірілді. Импорт терезесіне қойыңыз.'); };
  // Keep the panel interactive when the host page has a modal/focus layer, and keep its
  // delegated React handlers from treating our controls as page controls.
  ['pointerdown', 'mousedown', 'keydown'].forEach(function (type) { box.addEventListener(type, function (ev) { ev.stopPropagation(); }, true); });
  box.addEventListener('click', function (ev) {
    ev.stopPropagation();
    var b = ev.target.closest ? ev.target.closest('[data-x]') : null; if (!b) { return; }
    ev.preventDefault();
    var x = b.getAttribute('data-x');
    if (x === 'close') { stop = true; box.remove(); return; }
    if (x === 'stop') { stop = true; return; }
    if (x === 'select') { selectJSON(); notice('Мәтін белгіленді. ⌘C / Ctrl+C басып, импорт терезесіне қойыңыз.'); return; }
    if (x === 'download') {
      var url = null, link = null;
      try {
        url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
        link = D.createElement('a'); link.href = url; link.download = 'sapaline-' + subject + '-' + line + '-m' + pm[1] + '-w' + pm[2] + '.json';
        D.body.appendChild(link); link.click();
        notice('JSON жүктелді. Сайттағы импорт терезесінде «JSON файлды ашу» таңдаңыз.');
      } catch (e) { notice('Файл жүктелмеді. «Мәтінді белгілеу» басып, ⌘C / Ctrl+C арқылы көшіріңіз.'); }
      finally { if (link) { link.remove(); } if (url) { setTimeout(function () { URL.revokeObjectURL(url); }, 60000); } }
      return;
    }
    if (x === 'copy') {
      // Legacy copy runs synchronously inside the click so it does not lose user activation.
      var copied = false;
      try { copied = selectJSON() && typeof D.execCommand === 'function' && D.execCommand('copy'); } catch (e) {}
      if (copied) { done(b); return; }
      var failed = function () {
        b.textContent = 'Қайта көшіру'; selectJSON();
        notice('Браузер автоматты көшіруге рұқсат бермеді. Белгіленген мәтінді ⌘C / Ctrl+C арқылы көшіріңіз немесе «JSON жүктеу» басыңыз.');
      };
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          notice('Көшіріліп жатыр…'); Promise.resolve(navigator.clipboard.writeText(json)).then(function () { done(b); }, failed);
        } else { failed(); }
      } catch (e) { failed(); }
    }
  }, true);

  if (!/(^|\.)sapaline\.app$/.test(location.hostname) || !/^\/live-sabaq\//.test(location.pathname)) {
    show('Бұл батырма SapaLine-дағы <b>Live Sabaq</b> бетінде жұмыс істейді. Физика бетін ашып, аптаны таңдап, қайта басыңыз.', btn('close', 'Жабу'));
    return;
  }
  var seg = location.pathname.split('/').filter(Boolean);
  var line = seg[1] || 'smart', subjRaw = (seg[2] || '').toLowerCase();
  var subject = /phy|fiz|физ/.test(subjRaw) ? 'physics' : /geo/.test(subjRaw) ? 'geometry' : /math/.test(subjRaw) ? 'math' : subjRaw;
  if (subject !== 'physics' && subject !== 'math' && subject !== 'geometry' && /Физика/.test(D.body.innerText || '')) { subject = 'physics'; }
  if (subject !== 'physics') {
    show('Бұл бет физика емес' + (subjRaw ? ' (<b>' + esc(subjRaw) + '</b>)' : '') + '. SapaLine-да <b>Live Sabaq → Физика</b> бетін ашып, аптаны таңдап, қайта басыңыз.', btn('close', 'Жабу'));
    return;
  }
  var periodPattern = /(\d+)\s*[-–—]\s*АЙ\s*(\d+)\s*[-–—]\s*АПТА/i;
  var pm = periodPattern.exec(D.body.innerText || '');
  if (!pm) {
    show('Апта табылмады. Бет толық жүктелгенін күтіп, қайта басыңыз.', btn('close', 'Жабу'));
    return;
  }
  var period = pm[1] + '-АЙ ' + pm[2] + '-АПТА';

  var sleep = function (ms) {
    return new Promise(function (res) {
      var end = Date.now() + ms;
      if (!D.hidden) { setTimeout(res, ms); return; }
      var ch = new MessageChannel();
      ch.port1.onmessage = function () { if (Date.now() >= end) { ch.port1.close(); res(); } else { ch.port2.postMessage(0); } };
      ch.port2.postMessage(0);
    });
  };
  var waitFor = async function (fn, t) { var t0 = Date.now(); while (Date.now() - t0 < t) { var v = fn(); if (v) { return v; } await sleep(100); } return null; };
  var vis = function (e) { return !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length)); };
  var txt = function (e) { return e ? (e.innerText || '').trim() : ''; };

  var items = [];
  var label = function (s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/\s*%$/, ''); };
  var table = Array.prototype.find.call(D.querySelectorAll('table'), function (t) { return vis(t) && Array.prototype.some.call(t.querySelectorAll('thead th'), function (th) { return label(txt(th)) === 'ұнау'; }); });
  if (table) {
    var ths = Array.prototype.map.call(table.querySelectorAll('thead th'), txt);
    var col = function (n) { return ths.map(label).indexOf(label(n)); };
    var C = { date: col('Күні'), time: col('Уақыты'), teacher: col('Мұғалім'), potok: col('Поток'), agym: col('Ағым'), like: col('Ұнау %'), att: col('Қатысым %'), present: col('Қатысты'), total: col('Жалпы') };
    if (C.teacher < 0 || C.agym < 0 || C.like < 0) { show('Кесте бағандары өзгерген: Мұғалім, Ағым немесе Ұнау % табылмады. Импорт тоқтатылды.', btn('close', 'Жабу')); return; }
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (tr) {
      if (!vis(tr) || tr.children.length < ths.length - 1) { return; }
      var cell = function (i) { return i >= 0 ? tr.children[i] : null; };
      var val = function (i) {
        var c = cell(i); if (!c) { return null; }
        var inp = c.querySelector('input,textarea,select'); if (inp) { return (inp.value || '').trim(); }
        var b = c.querySelector('button[data-cell]'); return txt(b || c);
      };
      var likeCell = cell(C.like);
      items.push({ num: txt(cell(0)).replace(/[^\d]/g, ''), date: val(C.date), time: val(C.time), teacher: val(C.teacher), potok: val(C.potok), agym: val(C.agym), like: val(C.like), att: val(C.att), present: val(C.present), total: val(C.total), likeBtn: likeCell ? likeCell.querySelector('button[data-cell],button') : null });
    });
  } else {
    var fieldEl = function (card, name) {
      var lab = Array.prototype.find.call(card.querySelectorAll('*'), function (e) { return e.children.length === 0 && label(e.textContent) === label(name); });
      if (!lab) { return null; }
      var c = lab.parentElement;
      for (var i = 0; i < 4 && c; i++) {
        var inp = c.querySelector('input, textarea, select'), b = c.querySelector('button[data-cell]');
        if (inp || b) { return { inp: inp, btn: b }; }
        var t = (c.innerText || '').replace(lab.textContent || name, '').trim(); if (t) { return { txt: t }; }
        c = c.parentElement;
      }
      return null;
    };
    var cval = function (card, n) { var f = fieldEl(card, n); if (!f) { return null; } if (f.inp) { return f.inp.value; } if (f.btn) { return txt(f.btn); } return f.txt || null; };
    Array.prototype.forEach.call(D.querySelectorAll('.row-cards > div.rounded-xl'), function (card) {
      if (!vis(card)) { return; }
      var lf = fieldEl(card, 'Ұнау %');
      items.push({ num: ((card.innerText || '').match(/№\s*(\d+)/) || [])[1], date: cval(card, 'Күні'), time: cval(card, 'Уақыты'), teacher: cval(card, 'Мұғалім'), potok: cval(card, 'Поток'), agym: cval(card, 'Ағым'), like: cval(card, 'Ұнау %'), att: cval(card, 'Қатысым %'), present: cval(card, 'Қатысты'), total: cval(card, 'Жалпы'), likeBtn: lf && lf.btn });
    });
  }
  items = items.filter(function (r) { return r.teacher || r.agym; });
  if (!items.length) {
    show('Бұл аптада сабақ табылмады. Бет толық жүктелгенін күтіп, қайта басыңыз.', btn('close', 'Жабу'));
    return;
  }

  var surveyDlg = function () { return Array.prototype.find.call(D.querySelectorAll('[role=dialog]'), function (d) { return vis(d) && d.querySelector('input[aria-label="Ұнады"]'); }); };
  if (Array.prototype.some.call(D.querySelectorAll('[role=dialog]'), vis)) { show('Алдымен ашық терезені жабыңыз да, бетбелгіні қайта басыңыз.', btn('close', 'Жабу')); return; }
  var readSurvey = async function (b) {
    b.scrollIntoView({ block: 'center' }); await sleep(120);
    b.click();
    var dlg = await waitFor(surveyDlg, 6000);
    if (!dlg) { return { err: 'no dialog' }; }
    if (D.activeElement && D.activeElement.blur) { D.activeElement.blur(); }
    var get = function (l) { var i = dlg.querySelector('input[aria-label="' + l + '"]'); return i ? i.value : null; };
    var r = { liked: get('Ұнады'), avg: get('Орташа'), disliked: get('Ұнамады'), total: get('Жалпы'), present: get('Қатысты'), polled: get('Опрос өтті') };
    var close = Array.prototype.find.call(dlg.querySelectorAll('button'), function (x) { return txt(x) === 'Close' || txt(x) === 'Жабу' || x.getAttribute('aria-label') === 'Close' || x.getAttribute('aria-label') === 'Жабу'; });
    if (close) { close.click(); } else { D.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
    var closed = await waitFor(function () { return !surveyDlg(); }, 4000);
    if (!closed) { r.err = 'dialog did not close'; stop = true; }
    await sleep(150);
    return r;
  };

  W.__juz40busy = true;
  try {
    for (var i = 0; i < items.length; i++) {
      if (stop) { break; }
      show('Оқылып жатыр: <b>' + (i + 1) + ' / ' + items.length + '</b> сабақ…<br><span style="opacity:.7">Бетті жаппаңыз және ештеңе баспаңыз.</span>', btn('stop', 'Тоқтату'));
      var it = items[i];
      if (it.likeBtn && !it.likeBtn.disabled && /\d/.test(it.like || '')) {
        try { it.survey = await readSurvey(it.likeBtn); if (it.survey.err) { stop = true; } } catch (e) { it.survey = { err: 'survey could not be read' }; stop = true; }
      }
    }
  } finally { W.__juz40busy = false; }
  if (stop) { if (box.isConnected) { show('Оқу тоқтатылды. Ашық сауалнама терезесін жабыңыз да, бетбелгіні қайта басыңыз.', btn('close', 'Жабу')); } return; }

  var after = periodPattern.exec(D.body.innerText || '');
  if (!after || after[1] !== pm[1] || after[2] !== pm[2]) { show('Оқу кезінде апта өзгерді. Қажетті аптаны таңдап, қайта көшіріңіз.', btn('close', 'Жабу')); return; }
  var rows = items.map(function (r) { return { num: r.num, date: r.date, time: r.time, teacher: r.teacher, potok: r.potok, agym: r.agym, like: r.like, att: r.att, present: r.present, total: r.total, survey: r.survey || null }; });
  var payload = { source: 'sapaline', v: 2, subject: subject, line: line, period: period, url: location.href, at: new Date().toISOString(), rows: rows };
  json = JSON.stringify(payload);
  var withS = rows.filter(function (r) { return r.survey && !r.survey.err; }).length;
  var errors = rows.filter(function (r) { return r.survey && r.survey.err; });
  var attendance = rows.filter(function (r) { return /\d/.test(r.att || '') || r.survey && /\d/.test(r.survey.present || '') && /\d/.test(r.survey.total || ''); }).length;
  var miss = rows.filter(function (r) { return !(r.survey && !r.survey.err); });
  var subjName = subject === 'physics' ? 'Физика' : subject === 'geometry' ? 'Геометрия' : subject === 'math' ? 'Математика' : subject;
  show('<b>' + esc(subjName) + ' · ' + esc(period) + '</b><br>' + rows.length + ' сабақ, сауалнамасы бар: <b>' + withS + '</b>' +
    '<br>Қатысым дерегі бар: <b>' + attendance + '</b>' +
    (errors.length ? '<br><b>Оқылмаған сауалнама: ' + errors.length + '. Қайта көшіріңіз — импорт бұл деректерді қабылдамайды.</b>' : '') +
    (miss.length ? '<br><span style="opacity:.75">Сауалнамасыз: ' + esc(miss.slice(0, 6).map(function (r) { return r.date + ' ' + r.teacher; }).join('; ')) + (miss.length > 6 ? ' …' : '') + '</span>' : '') +
    '<br><br>«Көшіру» басыңыз немесе JSON файлын жүктеп, JUZ40 әкімші панеліндегі <b>SapaLine-нан импорттау</b> терезесіне қойыңыз немесе файлды ашыңыз.' +
    '<textarea id="juz40-json" readonly style="display:block;width:100%;box-sizing:border-box;height:72px;margin-top:10px;border-radius:10px;border:1px solid rgba(248,236,252,.25);background:rgba(0,0,0,.25);color:#f8ecfc;font:11px/1.35 ui-monospace,Menlo,monospace;padding:8px;pointer-events:auto!important;user-select:text!important">' + esc(json) + '</textarea>',
    '<p data-copy-status role="status" aria-live="polite" style="font-size:12px;line-height:1.5;margin:10px 0 0"></p>' +
    btn('copy', 'Көшіру', true) + btn('select', 'Мәтінді белгілеу') + btn('download', 'JSON жүктеу') + btn('close', 'Жабу'));
})();
