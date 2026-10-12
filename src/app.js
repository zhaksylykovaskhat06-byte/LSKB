(function () {
'use strict';
/*@CONSTANTS@*/

/* ================= helpers ================= */
var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function uid(p) { return p + '_' + Math.random().toString(36).slice(2, 9); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function num(v) { var n = parseInt(v, 10); return isNaN(n) || n < 0 ? 0 : n; }
function json(o) { return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
function fmtPct(v) { if (v == null || isNaN(v)) return '—'; var r = Math.round(v * 100) / 100; return (r % 1 === 0 ? String(r) : r.toFixed(2)).replace('.', ','); }
function fmtInt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f'); }
var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
var store = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
var sstore = {
  get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};
function copyText(text) {
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy'));
  }
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fallback);
  return fallback();
}

/* ================= SapaLine import (shared with the weekly task) ================= */
/*@MERGE@*/

/* ================= brand ================= */
/* the common JUZ40 emblem (traced from the supplied PNG) */
function logoSVG(cls, w, h) {
  var E = EMBLEM.juz40;
  return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="' + E.vb + '"' + (w ? ' width="' + w + '" height="' + h + '"' : '') + ' fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="' + E.d + '"/></svg>';
}
var LOGO = logoSVG('', 71, 22);

var SUBJ = {
  phys: { hash: ['physics', 'fizika', 'phys', 'fiz'], glyphs: ['F', 'm', 'a', 'v', 't', 's', 'g', 'E', 'p', 'P', 'A', 'Q', 'U', 'I', 'R', 'λ', 'ν', 'ω', 'φ', 'ρ', 'η', 'μ', 'ε', 'Δ', 'Ω', 'τ', '℃', 'K', 'Н', 'Дж', 'Вт', 'Па', 'В', 'Гц', '=', '·', '²', '½', '→', 'mc²', 'ma', 'mgh', 'IR', 'ħ', '∑'] }
};
var SUBJ_KEYS = ['phys'];
function emblemSVG(k, cls) { var E = EMBLEM[k]; return '<svg class="' + (cls || '') + '" viewBox="' + E.vb + '" aria-hidden="true"><path d="' + E.d + '"/></svg>'; }
function heroEmblem(k) {
  var E = EMBLEM[k];
  return '<svg viewBox="' + E.vb + '" aria-hidden="true"><defs><linearGradient id="zg-' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--z1)"/><stop offset=".48" style="stop-color:var(--z2)"/><stop offset="1" style="stop-color:var(--z3)"/></linearGradient></defs>' +
    '<g class="zghost"><path transform="translate(30 26)" d="' + E.d + '"/></g>' +
    '<g class="zmain"><path class="zdepth" transform="translate(-10 12)" d="' + E.d + '"/><path fill="url(#zg-' + k + ')" d="' + E.d + '"/></g></svg>';
}
function initials(name) {
  var parts = String(name || '').replace(/(ағай|апай)$/i, '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '?';
}

/* ================= data ================= */
var SERVER = typeof HOST_MODE !== 'undefined' && HOST_MODE === 'server';
var D = SERVER ? null : JSON.parse($('#juz-state').textContent);
var P = SERVER ? {} : JSON.parse($('#juz-photos').textContent);
var draft = null, draftPhotos = null, photosDirty = false, publishing = false;
function cur() { return draft || D; }
function curPhotos() { return draftPhotos || P; }
function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
function weeksOf(d) {
  var out = [];
  d.months.forEach(function (m) { m.weeks.forEach(function (w) { out.push({ m: m, w: w, id: w.id, label: m.label + ' ' + w.label }); }); });
  return out;
}
function findWeek(d, id) { var ws = weeksOf(d); for (var i = 0; i < ws.length; i++) if (ws[i].id === id) return ws[i]; return null; }
function pctOf(r) {
  if (!r) return null;
  var L = num(r.liked), A = num(r.avg), X = num(r.disliked), T = L + A + X;
  if (T > 0) return 100 * L / T;
  if (r.pct !== '' && r.pct != null && !isNaN(+r.pct)) return clamp(+r.pct, 0, 100);
  return null;
}
function codeOf(s) { return s ? s.code : ''; }
function lineRank(a) { var l = String(a.line || 'SMART').toUpperCase(); return l === 'SMART' ? 0 : l === 'JUNIOR' ? 1 : 2; }
function entriesFor(d, weekId, subject) {
  var wk = findWeek(d, weekId); if (!wk) return [];
  var res = d.results[weekId] || {};
  return wk.m.assignments.map(function (a, i) {
    return { a: a, i: i, t: byId(d.teachers, a.teacherId), s: byId(d.streams, a.streamId), r: res[a.id] };
  }).filter(function (e) { return e.a.subject === subject && e.t && (pctOf(e.r) != null || attendanceOf(e.r) != null); })
    .sort(function (x, y) { return lineRank(x.a) - lineRank(y.a) || codeOf(x.s).localeCompare(codeOf(y.s), 'kk') || x.i - y.i; });
}
function visibleWeeks(d, subject, withDrafts) {
  return weeksOf(d).filter(function (x) { return (x.w.published || withDrafts) && entriesFor(d, x.id, subject).length > 0; });
}

/* ================= view state ================= */
var root = $('#root');
document.documentElement.lang = 'kk';
var view = { subject: initialSubject(), weekId: null };
function initialSubject() {
  var h = (location.hash || '').replace('#', '').toLowerCase();
  for (var i = 0; i < SUBJ_KEYS.length; i++) if (SUBJ[SUBJ_KEYS[i]].hash.indexOf(h) >= 0) return SUBJ_KEYS[i];
  var s = store.get('juz.subject');
  return SUBJ[s] ? s : 'phys';
}
function previewDrafts() { return !!draft; }
function pickWeek(subject, prefer) {
  var ws = visibleWeeks(cur(), subject, previewDrafts());
  if (prefer && ws.some(function (x) { return x.id === prefer; })) return prefer;
  var pub = ws.filter(function (x) { return x.w.published; });
  var list = pub.length ? pub : ws;
  return list.length ? list[list.length - 1].id : null;
}

/* ================= public render ================= */
var KEY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 1a4.5 4.5 0 0 0-4.27 5.92L1 12.15V15h2.85l.65-.65V13h1.35l.65-.65V11h1.35l1.23-1.23A4.5 4.5 0 1 0 10.5 1Zm1.25 4.75a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>';
var adminBtnEl = $('#adminBtn');
adminBtnEl.innerHTML = KEY_ICON + '<span>Әкімші</span>';
function renderHeader() {
  var d = cur();
  $('#logoSlot').innerHTML = LOGO;
  var nav = $('#subjNav');
  nav.innerHTML = SUBJ_KEYS.map(function (k) {
    var S = d.subjects[k];
    return '<button class="subjBtn" type="button" data-subj="' + k + '" aria-pressed="' + (k === view.subject) + '">' + emblemSVG(k) +
      '<span class="full">' + esc(S.name) + '</span><span class="short">' + esc(S.short) + '</span></button>';
  }).join('');
  nav.appendChild(adminBtnEl); // the admin entry sits right after the subject (hidden for visitors)
  var ws = visibleWeeks(d, view.subject, previewDrafts());
  var box = $('#weeks');
  box.innerHTML = (ws.length ? '<span class="weeksLabel">Апта</span>' : '') + ws.map(function (x) {
    return '<button class="weekBtn" type="button" data-week="' + x.id + '" aria-pressed="' + (x.id === view.weekId) + '"' + (x.w.published ? '' : ' data-draft title="Жоба: сайтта әлі көрінбейді"') + '>' + esc(x.label) + '</button>';
  }).join('');
  var on = $('.weekBtn[aria-pressed="true"]', box);
  if (on) box.scrollLeft = Math.max(0, on.offsetLeft - box.clientWidth + on.offsetWidth + 8);
  var ab = $('#adminBtn');
  if (draft && isDirty()) ab.setAttribute('data-dirty', ''); else ab.removeAttribute('data-dirty');
}

function introHTML(d, k, hasList) {
  var S = d.subjects[k];
  var cue = hasList
    ? '<button class="cue cueBtn" type="button" data-go="roster"><span class="cueText">Мұғалімдер тізімі</span><span class="cueArrow" aria-hidden="true">↓</span></button>'
    : '<div class="cue"><span class="cueLine"></span><span class="cueText">Төменге жылжыт</span></div>';
  return '<section class="act intro" data-theme="dark" id="top"><div class="pin"><div class="ambient"></div><div class="introRing"></div>' +
    '<div class="zmark" aria-hidden="true"><div class="zglow"></div>' + heroEmblem(k) + '</div>' +
    '<div class="flow"><p class="eyebrow">' + esc(S.eyebrow) + '</p><h1 class="hero">' + esc(S.title) + '</h1>' +
    '<p class="lede">' + esc(S.lede) + '</p>' + cue + '</div></div></section>';
}
// the list of this week's teachers: one tap on a name opens that teacher's panel
function rosterHTML(d, k, entries, weekLabel) {
  var S = d.subjects[k], groups = [];
  entries.forEach(function (e, i) {
    var line = String(e.a.line || 'SMART').toUpperCase(), g = groups[groups.length - 1];
    if (!g || g.line !== line) groups.push(g = { line: line, items: [] });
    g.items.push({ e: e, i: i });
  });
  var photos = curPhotos();
  return '<section class="act roster" id="roster" data-theme="light" data-flow="natural" aria-label="Мұғалімдер тізімі"><div class="pin"><div class="ambient"></div><div class="flow">' +
    '<p class="rosterEyebrow">' + esc(S.name) + ' · ' + esc(weekLabel) + '</p><h2 class="rosterTitle">Мұғалімдер</h2>' +
    '<p class="rosterHint">Атыңызды басыңыз — өз нәтижеңізге бірден өтесіз. Тізімге «Тізім» батырмасымен ораласыз.</p>' +
    groups.map(function (g) {
      return (groups.length > 1 ? '<p class="rosterGroup"><span>' + esc(g.line) + '</span></p>' : '') + '<div class="rosterGrid">' + g.items.map(function (x) {
        var e = x.e, photo = photos[e.t.id];
        return '<button class="rosterItem" type="button" data-go="' + x.i + '">' +
          '<span class="rosterNum">' + String(x.i + 1).padStart(2, '0') + '</span>' +
          '<span class="rosterPh">' + (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy" decoding="async">' : '<b>' + esc(initials(e.t.display)) + '</b>') + '</span>' +
          '<span class="rosterTxt"><span class="rosterName">' + esc(e.t.display) + '</span><span class="rosterCode">' + esc(e.s ? e.s.code : '') + '</span></span>' +
          '<span class="rosterMetrics"><span>Ұнату <b>' + (pctOf(e.r) == null ? '—' : fmtPct(pctOf(e.r)) + '%') + '</b></span><span>Қатысым <b>' + (attendanceOf(e.r) == null ? '—' : fmtPct(attendanceOf(e.r)) + '%') + '</b></span></span>' +
          '<span class="rosterGo" aria-hidden="true">→</span></button>';
      }).join('') + '</div>';
    }).join('') +
    '</div></div></section>';
}
function isTip(s) { return /^\s*[-–—•→*]/.test(s); }
function stripTip(s) { return String(s).replace(/^\s*[-–—•→*]\s*/, ''); }
function votesHTML(L, A, X, T) {
  function row(lab, v, tone) {
    return '<div class="voteRow"><span class="voteLabel">' + lab + '</span><span class="voteTrack"><span class="voteBar" data-tone="' + tone + '" style="--w:' + (100 * v / T).toFixed(2) + ';--nz:' + (v > 0 ? 1 : 0) + '"></span></span><span class="voteVal">' + fmtInt(v) + '</span></div>';
  }
  return '<div class="votes">' + row('Ұнады', L, 1) + row('Орташа', A, 2) + row('Ұнамады', X, 3) + '</div>';
}
function attendanceHTML(r) {
  var pct = attendanceOf(r);
  var detail = r && sapaNumber(r.total) > 0 && sapaNumber(r.present) != null ? fmtInt(r.present) + ' / ' + fmtInt(r.total) + ' қатысым' : r && r.attendanceMode === 'average' ? 'Сабақ пайыздарының орташа мәні' : '';
  return '<div class="attendance"><span class="attendanceLabel">Қатысым пайызы</span><strong>' + (pct == null ? '—' : fmtPct(pct) + '%') + '</strong>' +
    '<span class="attendanceDetail">' + esc(pct == null ? 'Дерек әлі енгізілмеген' : detail) + '</span>' +
    (pct == null ? '' : '<span class="attendanceTrack"><span style="width:' + pct.toFixed(2) + '%"></span></span>') + '</div>';
}
function teacherHTML(d, e, i, weekLabel) {
  var theme = i % 2 === 0 ? 'dark' : 'light', side = i % 2 === 0 ? 'right' : 'left', sig = (i % 5) + 1;
  var r = e.r, pct = pctOf(r), L = num(r.liked), A = num(r.avg), X = num(r.disliked), T = L + A + X;
  var photo = curPhotos()[e.t.id];
  var notes = (r.notes || []).filter(function (n) { return String(n).trim(); });
  var lessons = num(r.lessons);
  var meta = [];
  if (lessons) meta.push(lessons + ' сабақ');
  if (T) meta.push(fmtInt(T) + ' оқушы бағалады');
  var line = e.a.line && e.a.line !== 'SMART' ? '<span class="pill line">' + esc(e.a.line) + '</span>' : '';
  return '<section class="act teacher" data-theme="' + theme + '" data-side="' + side + '" data-sig="' + sig + '" data-idx="' + i + '" style="--fd:' + (-1.3 * i).toFixed(1) + 's">' +
    '<div class="pin"><div class="ambient"></div><div class="numeral" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</div>' +
    '<div class="flow"><div class="row"><div class="textCol">' +
    '<div class="badges"><span class="pill solid">' + esc(d.subjects[e.a.subject].name) + '</span><span class="pill ghost">' + esc(weekLabel) + '</span>' + line + '</div>' +
    '<h2 class="name">' + (e.s ? esc(e.s.code) + ' <i>|</i> ' : '') + esc(e.t.display) + '</h2>' +
    '<div class="pctRow"><span class="pctNum">' + fmtPct(pct) + '</span><span class="pctSign">' + (pct == null ? '' : '%') + '</span><span class="pctCap">ұнату<br>пайызы</span></div>' +
    (pct == null ? '' : '<div class="pctTrack"><div class="pctFill" style="--pct:' + pct.toFixed(2) + '"></div></div>') +
    attendanceHTML(r) +
    (T ? votesHTML(L, A, X, T) : '') +
    (meta.length ? '<p class="meta">' + meta.join(' · ') + '</p>' : '') +
    (notes.length ? '<ol class="analysis">' + notes.map(function (n) { return '<li' + (isTip(n) ? ' class="tip"' : '') + '>' + esc(stripTip(n)) + '</li>'; }).join('') + '</ol>' : '') +
    '</div><div class="photoCol"><div class="photoFloat"><div class="photoFrame">' +
    (photo ? '<img src="' + esc(photo) + '" alt="' + esc(e.t.display) + '" decoding="async">'
      : '<div class="photoEmpty">' + emblemSVG(e.a.subject) + '<b>' + esc(initials(e.t.display)) + '</b><span>Фото кейін қосылады</span></div>') +
    '</div><div class="photoShadow"></div></div></div></div></div></div></section>';
}
function outroHTML(d, k, entries, theme) {
  var O = d.outro, S = d.subjects[k];
  var L = 0, T = 0, sum = 0, rated = 0;
  entries.forEach(function (e) { var l = num(e.r.liked), t = l + num(e.r.avg) + num(e.r.disliked), p = pctOf(e.r); L += l; T += t; if (p != null) { sum += p; rated++; } });
  var avg = T > 0 ? 100 * L / T : rated ? sum / rated : null;
  var acked = store.get('juz.ack.' + k + '.' + view.weekId);
  return '<section class="act outro" data-theme="' + theme + '"><div class="pin"><div class="ambient"></div><div class="outroRing"></div><div class="flow">' +
    '<p class="outroEyebrow">' + esc(O.eyebrow) + '</p><h2 class="outroTitle">' + esc(O.title) + '</h2><p class="outroText">' + esc(O.text) + '</p>' +
    '<p class="outroStat"><span>Орташа ұнату <b>' + fmtPct(avg) + (avg == null ? '' : '%') + '</b></span><span>Мұғалім <b>' + entries.length + '</b></span>' + (T ? '<span>Жауап <b>' + fmtInt(T) + '</b></span>' : '') + '</p>' +
    '<div class="ackWrap" id="ackWrap">' + (acked ? ackMsgHTML(O) : '<button class="ackBtn" type="button" id="ackBtn">' + esc(O.ack) + '</button>') + '</div>' +
    '<div class="footMark"><span class="footDot"></span><span class="footText">JUZ40 · ' + esc(S.footer) + '</span></div>' +
    '</div></div></section>';
}
// after "Таныстым": the JUZ40 emblem is revealed (animated only right after the click)
function ackMsgHTML(O, anim) {
  return '<div class="ackDone"' + (anim ? ' data-anim' : '') + '><div class="ackLogo" role="img" aria-label="JUZ40">' + logoSVG('ackSvg') + '<span class="ackFlash" aria-hidden="true"></span></div>' +
    '<p class="ackMsg"><span class="ackTick">✓</span>' + esc(O.ackDone) + '</p></div>';
}
function emptyHTML(d, k, hasAny) {
  var S = d.subjects[k];
  return '<section class="act teacher" data-theme="light" data-side="right" data-sig="1" data-flow="natural" data-fixed><div class="pin"><div class="ambient"></div><div class="flow"><div class="row"><div class="textCol">' +
    '<div class="badges"><span class="pill solid">' + esc(S.name) + '</span></div><h2 class="name">' + (hasAny ? 'Бұл апта бос' : 'Нәтижелер жақында') + '</h2>' +
    '<p class="emptyNote">' + (hasAny ? 'Таңдалған аптаға әзірге нәтиже енгізілмеген. Жоғарыдан басқа аптаны таңдаңыз.' : 'Апталық кері байланыс SapaLine сауалнамасы жабылғаннан кейін осында жарияланады.') + '</p>' +
    '</div></div></div></div></section>';
}

var acts = [];
function renderActs() {
  var d = cur(), k = view.subject;
  var wk = view.weekId ? findWeek(d, view.weekId) : null;
  var entries = wk ? entriesFor(d, view.weekId, k) : [];
  var html = introHTML(d, k, entries.length > 0);
  if (entries.length) html += rosterHTML(d, k, entries, wk.label);
  entries.forEach(function (e, i) { html += teacherHTML(d, e, i, wk.label); });
  if (!entries.length) html += emptyHTML(d, k, weeksOf(d).length > 0 && !!wk);
  else html += outroHTML(d, k, entries, entries.length % 2 === 1 ? 'light' : 'dark');
  $('#acts').innerHTML = html;
  acts = $$('#acts > .act');
  var rail = $('#railNums');
  rail.innerHTML = entries.map(function (e, i) { return '<span data-i="' + i + '">' + String(i + 1).padStart(2, '0') + '</span>'; }).join('');
  if (entries.length) $('.rail').removeAttribute('data-empty'); else $('.rail').setAttribute('data-empty', '');
  layout();
  update();
  if (!reduceMotion) { var intro = $('.act.intro'); if (intro) { intro.classList.add('boot'); } }
}
function applySubject() { document.documentElement.setAttribute('data-subj', view.subject); rain.color = null; }
function renderAll() {
  applySubject();
  renderHeader();
  renderActs();
  rainSetSubject(view.subject);
}

/* ================= layout + scroll engine ================= */
var smallMQ = window.matchMedia ? matchMedia('(max-width: 760px)') : { matches: false };
function layout() {
  var vh = window.innerHeight;
  acts.forEach(function (act) {
    if (!act.classList.contains('teacher')) return;
    if (act.getAttribute('data-flow') === 'natural' && act.hasAttribute('data-fixed')) return;
    if (smallMQ.matches) { act.setAttribute('data-flow', 'natural'); return; }
    act.removeAttribute('data-flow');
    var flow = $('.flow', act), row = $('.row', act);
    if (!flow || !row) return;
    var cs = getComputedStyle(flow);
    var need = row.scrollHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    if (need > vh + 2) act.setAttribute('data-flow', 'natural');
  });
}
var ticking = false;
function onScroll() { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); }
var hdrTheme = 'dark';
function update() {
  var vh = window.innerHeight, theme = 'dark', active = -1;
  for (var i = 0; i < acts.length; i++) {
    var act = acts[i], r = act.getBoundingClientRect();
    var isTeacher = act.classList.contains('teacher') && act.hasAttribute('data-idx');
    if (r.top <= 52 && r.bottom > 52) theme = act.getAttribute('data-theme');
    if (isTeacher && r.top < vh * 0.55 && r.bottom > vh * 0.45) active = +act.getAttribute('data-idx');
    if (r.bottom < -vh || r.top > vh * 1.6) continue;
    var natural = act.getAttribute('data-flow') === 'natural' || smallMQ.matches;
    var a = 1, x = 0;
    if (!reduceMotion && !act.classList.contains('intro')) a = clamp((vh * 0.94 - r.top) / (vh * (natural ? 0.5 : 0.68)), 0, 1);
    if (!reduceMotion && !natural) { var hold = r.height - vh; if (hold > vh * 0.3) x = clamp((-r.top - hold + vh * 0.3) / (vh * 0.3), 0, 1); }
    act.style.setProperty('--a', a.toFixed(3));
    act.style.setProperty('--x', x.toFixed(3));
  }
  if (theme !== hdrTheme) { hdrTheme = theme; root.setAttribute('data-hdr', theme); rain.color = null; }
  var nums = $$('#railNums span');
  nums.forEach(function (s, j) { if (j === active) s.setAttribute('data-on', ''); else s.removeAttribute('data-on'); });
  var dot = $('#railDot'), rn = $('#railNums'), list = $('#roster'), first = $('.act.teacher[data-idx="0"]');
  if (nums.length && dot) {
    var before = first && first.getBoundingClientRect().top > vh * 0.45;
    var target = active >= 0 ? nums[active] : (before ? nums[0] : nums[nums.length - 1]);
    dot.style.top = (rn.offsetTop + target.offsetTop + target.offsetHeight / 2 - 4.5) + 'px';
  }
  var fab = $('#toList'), show = !!list && list.getBoundingClientRect().bottom < vh * 0.35;
  if (fab && fab.hasAttribute('data-on') !== show) { if (show) fab.setAttribute('data-on', ''); else fab.removeAttribute('data-on'); }
}

/* one tap to a teacher, one tap back to the list: a short fade hides the jump */
function goTo(el) {
  if (!el) return;
  function to(y) { try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); } }
  function jump() {
    to(Math.round(el.getBoundingClientRect().top + window.scrollY)); // measured now: the page may still have been moving
    update();
    requestAnimationFrame(function () { var t = el.getBoundingClientRect().top; if (Math.abs(t) > 2) { to(Math.round(t + window.scrollY)); update(); } });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    try { el.focus({ preventScroll: true }); } catch (e) {}
  }
  if (reduceMotion) { jump(); return; }
  root.setAttribute('data-jump', '');
  setTimeout(function () { jump(); requestAnimationFrame(function () { root.removeAttribute('data-jump'); }); }, 170);
}
window.addEventListener('scroll', onScroll, { passive: true });
var resizeT = 0;
window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { layout(); update(); rainResize(); }, 120); });

/* ================= glyph rain ================= */
var rain = { cv: $('#rain'), ctx: null, cols: [], glyphs: SUBJ.phys.glyphs, w: 0, h: 0, dpr: 1, last: 0, color: null, run: false };
function rainResize() {
  var cv = rain.cv; if (!cv || !cv.getContext) return;
  rain.dpr = Math.min(2, window.devicePixelRatio || 1);
  rain.w = window.innerWidth; rain.h = window.innerHeight;
  cv.width = Math.round(rain.w * rain.dpr); cv.height = Math.round(rain.h * rain.dpr);
  rain.ctx = cv.getContext('2d'); rain.ctx.setTransform(rain.dpr, 0, 0, rain.dpr, 0, 0);
  var n = Math.max(4, Math.floor(rain.w / 74));
  rain.cols = [];
  for (var i = 0; i < n; i++) rain.cols.push(newCol(i, n, true));
  if (reduceMotion) drawRain(0);
}
function newCol(i, n, initial) {
  var len = 5 + Math.floor(Math.random() * 10), seq = [];
  for (var j = 0; j < len; j++) seq.push(rain.glyphs[Math.floor(Math.random() * rain.glyphs.length)]);
  return { x: (i + 0.25 + Math.random() * 0.5) * rain.w / n, y: initial ? Math.random() * rain.h * 1.4 - rain.h * 0.2 : -Math.random() * rain.h * 0.6, v: 10 + Math.random() * 26, size: 12 + Math.round(Math.random() * 4), seq: seq, flip: 0 };
}
function rainSetSubject(k) {
  var g = SUBJ[k].glyphs;
  if (rain.glyphs === g) return;
  rain.glyphs = g;
  rain.cols.forEach(function (c) { c.seq = c.seq.map(function () { return g[Math.floor(Math.random() * g.length)]; }); });
  if (reduceMotion) drawRain(0);
}
function inkRGB() {
  var v = getComputedStyle(root).getPropertyValue('--ink').trim();
  var m = /^#?([0-9a-f]{6})$/i.exec(v);
  if (!m) return hdrTheme === 'light' ? '23,64,78' : '210,248,255';
  var n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
}
function drawRain(dt) {
  var ctx = rain.ctx; if (!ctx) return;
  if (!rain.color) rain.color = inkRGB();
  ctx.clearRect(0, 0, rain.w, rain.h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (var i = 0; i < rain.cols.length; i++) {
    var c = rain.cols[i];
    c.y += c.v * dt;
    var lh = c.size * 1.35;
    if (c.y - c.seq.length * lh > rain.h) { rain.cols[i] = newCol(i, rain.cols.length, false); continue; }
    c.flip += dt;
    if (c.flip > 0.9) { c.flip = 0; c.seq[Math.floor(Math.random() * c.seq.length)] = rain.glyphs[Math.floor(Math.random() * rain.glyphs.length)]; }
    ctx.font = '500 ' + c.size + 'px "Noto Sans Math","JUZ40","Golos Text",serif';
    for (var j = 0; j < c.seq.length; j++) {
      var y = c.y - j * lh; if (y < -lh || y > rain.h + lh) continue;
      var alpha = j === 0 ? 1 : Math.max(0, 0.85 - j / c.seq.length);
      ctx.fillStyle = 'rgba(' + rain.color + ',' + alpha.toFixed(3) + ')';
      ctx.fillText(c.seq[j], c.x, y);
    }
  }
}
function rainLoop(t) {
  if (!rain.run) return;
  var dt = rain.last ? Math.min(0.1, (t - rain.last) / 1000) : 0;
  if (dt === 0 || dt > 1 / 32) { rain.last = t; drawRain(dt || 0.016); }
  requestAnimationFrame(rainLoop);
}
function rainStart() {
  rainResize();
  if (reduceMotion) return;
  rain.run = true; rain.last = 0; requestAnimationFrame(rainLoop);
}
document.addEventListener('visibilitychange', function () {
  if (reduceMotion) return;
  if (document.hidden) rain.run = false; else if (!rain.run) { rain.run = true; rain.last = 0; requestAnimationFrame(rainLoop); }
});

/* ================= curtain transition ================= */
function jumpTop() { try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); } }
var curtainBusy = false;
function withCurtain(k, swap) {
  if (reduceMotion || curtainBusy) { swap(); jumpTop(); return; }
  curtainBusy = true;
  var c = $('#curtain');
  c.setAttribute('data-subj', k);
  $('#curtainZ').innerHTML = emblemSVG(k);
  c.removeAttribute('data-out'); c.hidden = false;
  $$('#curtain, #curtain *').forEach(function (el) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
  setTimeout(function () {
    swap();
    jumpTop();
    c.setAttribute('data-out', '');
    setTimeout(function () { c.hidden = true; c.removeAttribute('data-out'); curtainBusy = false; }, 460);
  }, 1500);
}

/* ================= finale after «Таныстым» =================
   As on the reference site: a full-screen curtain where the JUZ40 emblem appears and swallows the screen
   (3 s). Then, behind the covered screen, the page goes back to its first screen and the curtain fades away.
   A click or Escape skips ahead. */
function finaleEmblem() {
  var E = EMBLEM.juz40;
  return '<svg viewBox="' + E.vb + '" aria-hidden="true"><defs><linearGradient id="zg-finale" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--z1)"/><stop offset=".48" style="stop-color:var(--z2)"/><stop offset="1" style="stop-color:var(--z3)"/></linearGradient></defs>' +
    '<path fill="url(#zg-finale)" fill-rule="evenodd" d="' + E.d + '"/></svg>';
}
function finale() {
  if (curtainBusy) return;
  if (reduceMotion) { jumpTop(); return; }
  curtainBusy = true;
  var c = $('#curtain'), root = document.documentElement, back, timer;
  c.setAttribute('data-subj', view.subject);
  c.setAttribute('data-mode', 'finale');
  $('#curtainZ').innerHTML = finaleEmblem();
  c.removeAttribute('data-out'); c.hidden = false;
  root.classList.add('finaleOn');
  $$('#curtain, #curtain *').forEach(function (el) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
  function onKey(e) { if (e.key === 'Escape') back(); }
  back = function () {
    if (!timer) return;
    clearTimeout(timer); timer = null;
    document.removeEventListener('keydown', onKey, true);
    c.removeEventListener('click', back);
    // the screen is covered: go back to the first screen, replay its entrance, then lift the curtain
    jumpTop();
    var intro = $('.act.intro');
    if (intro) { intro.classList.remove('boot'); void intro.offsetWidth; intro.classList.add('boot'); }
    c.setAttribute('data-out', '');
    setTimeout(function () {
      c.hidden = true; c.removeAttribute('data-out'); c.removeAttribute('data-mode');
      root.classList.remove('finaleOn');
      curtainBusy = false;
    }, 720);
  };
  timer = setTimeout(back, 3500);
  document.addEventListener('keydown', onKey, true);
  c.addEventListener('click', back);
}

/* ================= public events ================= */
document.addEventListener('click', function (ev) {
  var t = ev.target;
  var go = t.closest && t.closest('#acts [data-go]');
  if (go) { var g = go.getAttribute('data-go'); goTo(g === 'roster' ? $('#roster') : $('.act.teacher[data-idx="' + g + '"]')); return; }
  if (t.closest && t.closest('#toList')) { goTo($('#roster')); return; }
  var rn = t.closest && t.closest('#railNums span');
  if (rn) { goTo($('.act.teacher[data-idx="' + rn.getAttribute('data-i') + '"]')); return; }
  var sb = t.closest && t.closest('.subjBtn');
  if (sb) {
    var k = sb.getAttribute('data-subj');
    if (k === view.subject) return;
    withCurtain(k, function () { view.subject = k; store.set('juz.subject', k); view.weekId = pickWeek(k, null); renderAll(); });
    return;
  }
  var wb = t.closest && t.closest('.weekBtn');
  if (wb) {
    var id = wb.getAttribute('data-week');
    if (id === view.weekId) return;
    withCurtain(view.subject, function () { view.weekId = id; renderAll(); });
    return;
  }
  if (t.closest && t.closest('#hdrHome')) { ev.preventDefault(); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
  if (t.closest && t.closest('#ackBtn')) {
    store.set('juz.ack.' + view.subject + '.' + view.weekId, '1');
    $('#ackWrap').innerHTML = ackMsgHTML(cur().outro, false); // the finale plays over it
    finale();
    return;
  }
  if (t.closest && t.closest('#adminBtn')) { openAdmin(); return; }
});

/* ================= admin: access ================= */
var admin = { open: false, tab: 'results', weekId: null, monthId: null, canEdit: false };
var TABS = [['results', 'Нәтижелер'], ['assign', 'Кім қайда береді'], ['teachers', 'Мұғалімдер'], ['streams', 'Потоктар'], ['periods', 'Айлар мен апталар'], ['texts', 'Мәтіндер']];
var LINES = ['SMART', 'JUNIOR', 'SMART PRO', 'JUZENG'];

/* ================= server mode (own deployment) ================= */
var srv = { admin: false };
function api(method, path, body) {
  var opts = { method: method, credentials: 'same-origin', cache: 'no-store', headers: {} };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(path, opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) { var e = new Error(j.message || j.error || ('HTTP ' + r.status)); e.status = r.status; e.body = j; throw e; }
      return j;
    });
  });
}
function serverLoad() { return api('GET', '/api/data').then(function (j) { D = j.state; P = j.photos || {}; srv.etag = j.etag; }); } // etag: only for the admin
function serverSession() { return api('GET', '/api/session').then(function (j) { srv.admin = !!j.admin; srv.checked = true; return j; }).catch(function () { srv.checked = true; return {}; }); }
function loginBox(msg) {
  var m = $('#modal');
  m.innerHTML = '<form class="modalBox" id="loginForm" role="dialog" aria-modal="true" aria-labelledby="lgT">' + LOGO +
    '<h4 id="lgT" style="margin-top:14px">Әкімші панелі</h4><p>Кері байланыс сайтының деректері мен суреттерін осы жерден өзгертесіз.</p>' +
    '<label class="aField"><span>Құпиясөз</span><input class="aIn" type="password" id="lgPw" autocomplete="current-password" required></label>' +
    '<p id="lgErr" role="alert" style="color:var(--bad);margin:10px 0 0;min-height:1.3em">' + esc(msg || '') + '</p>' +
    '<div class="aRow" style="margin-top:6px"><button class="aBtn" type="button" data-m="0">Бас тарту</button><button class="aBtn primary" type="submit" id="lgBtn">Кіру</button></div></form>';
  m.hidden = false;
  var pw = $('#lgPw'); if (pw) pw.focus();
  if (!msg) api('GET', '/api/session?check=1').then(function (j) {
    var el = $('#lgErr');
    if (el && !el.textContent && j && j.storeOk === false) el.textContent = j.storeMessage || 'Деректер қоймасы (Blob) қосылмаған.';
  }).catch(function () {});
}
document.addEventListener('submit', function (ev) {
  if (!ev.target || ev.target.id !== 'loginForm') return;
  ev.preventDefault();
  var btn = $('#lgBtn'); if (btn) btn.disabled = true;
  api('POST', '/api/session', { password: $('#lgPw').value }).then(function () {
    srv.admin = true; admin.canEdit = true; $('#adminBtn').hidden = false;
    // visitors only receive published weeks — reload the full data before anything can be edited
    return serverLoad().then(function () {
      closeModal(false);
      if (!draft) { view.weekId = pickWeek(view.subject, view.weekId); renderAll(); }
      openAdmin();
    });
  }).catch(function (e) {
    if (btn) btn.disabled = false;
    var el = $('#lgErr');
    if (el) el.textContent = e.status === 401 ? 'Құпиясөз қате.' : e.status === 429 ? 'Тым көп әрекет. Біраз уақыттан кейін қайталаңыз.' : (e.body && e.body.message) || 'Кіру сәтсіз. Қайталап көріңіз.';
  });
});

function detectAdmin() {
  if (SERVER) {
    serverSession().then(function () {
      if (srv.admin) { admin.canEdit = true; $('#adminBtn').hidden = false; }
      if (/^\/admin\/?$/.test(location.pathname) || /admin/i.test(location.hash || '')) { if (srv.admin) openAdmin(); else loginBox(); }
    });
    return;
  }
  var forced = /admin/i.test(location.hash || '');
  if (forced) $('#adminBtn').hidden = false;
  var C = window.claude;
  if (!C || typeof C.use !== 'function') return;
  C.use('user').then(function (u) {
    if (!u) return false;
    return u.canEdit();
  }).then(function (can) {
    admin.canEdit = !!can;
    if (can) $('#adminBtn').hidden = false;
    if (can) resumeAfterSave();
  }).catch(function () {});
}
function isDirty() {
  if (!draft) return false;
  return photosDirty || json(draft) !== json(D);
}
function ensureDraft() { if (!draft) { draft = clone(D); draftPhotos = Object.assign({}, P); photosDirty = false; } }
function openAdmin(tab) {
  ensureDraft();
  if (tab) admin.tab = tab;
  if (!admin.weekId || !findWeek(draft, admin.weekId)) admin.weekId = view.weekId || (weeksOf(draft).slice(-1)[0] || {}).id || null;
  if (!admin.monthId || !byId(draft.months, admin.monthId)) { var wk = admin.weekId && findWeek(draft, admin.weekId); admin.monthId = wk ? wk.m.id : ((draft.months.slice(-1)[0] || {}).id || null); }
  admin.open = true;
  var el = $('#admin'); el.hidden = false;
  document.body.style.overflow = 'hidden';
  renderAdmin();
  el.scrollTop = 0;
}
function closeAdmin() {
  admin.open = false;
  $('#admin').hidden = true;
  document.body.style.overflow = '';
  if (draft && !isDirty()) { draft = null; draftPhotos = null; }
  view.weekId = pickWeek(view.subject, view.weekId);
  renderAll();
}

/* ================= admin: render ================= */
function renderAdmin() {
  var dirty = isDirty();
  $('#admin').innerHTML =
    '<div class="aTop"><h2 class="aTitle">' + LOGO + '<span>Әкімші панелі</span></h2>' +
    '<span class="aStatus" id="aStatus"' + (dirty ? ' data-dirty' : '') + '><i></i><span>' + (dirty ? 'Сақталмаған өзгерістер бар' : 'Барлығы сайтта жарияланған') + '</span></span>' +
    '<div class="aActions"><button class="aBtn ghost" type="button" data-act="discard"' + (dirty ? '' : ' disabled') + '>Өзгерістерді тастау</button>' +
    '<button class="aBtn" type="button" data-act="close">Сайтты қарау</button>' +
    (SERVER ? '<button class="aBtn ghost" type="button" data-act="logout">Шығу</button>' : '') +
    '<button class="aBtn primary" type="button" data-act="save" id="aSave"' + (dirty ? '' : ' disabled') + '>Сақтау және жариялау</button></div></div>' +
    '<div class="aTabs" role="tablist">' + TABS.map(function (t) { return '<button class="aTab" type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (admin.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
    '<div class="aBody">' + tabBody() + '</div>';
}
function refreshStatus() {
  var dirty = isDirty();
  var st = $('#aStatus');
  if (st) { if (dirty) st.setAttribute('data-dirty', ''); else st.removeAttribute('data-dirty'); $('span', st).textContent = dirty ? 'Сақталмаған өзгерістер бар' : 'Барлығы сайтта жарияланған'; }
  var sv = $('#aSave'); if (sv) sv.disabled = !dirty || publishing;
  var ds = $('[data-act="discard"]'); if (ds) ds.disabled = !dirty;
}
function tabBody() {
  switch (admin.tab) {
    case 'assign': return tabAssign();
    case 'teachers': return tabTeachers();
    case 'streams': return tabStreams();
    case 'periods': return tabPeriods();
    case 'texts': return tabTexts();
    default: return tabResults();
  }
}
function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
function avatar(id, name) {
  var p = draftPhotos[id];
  return p ? '<img class="aAva" src="' + esc(p) + '" alt="">' : '<span class="aAva">' + esc(initials(name)) + '</span>';
}
function resultCount(weekId) { var r = draft.results[weekId] || {}; return Object.keys(r).filter(function (k) { return pctOf(r[k]) != null; }).length; }

function importRow(note) {
  return '<div class="aRow" style="margin-top:12px"><button class="aBtn primary" type="button" data-act="import">SapaLine-нан импорттау</button>' +
    '<span class="aSrc" style="margin:0">' + note + '</span></div>';
}
function tabResults() {
  var d = draft, ws = weeksOf(d);
  if (!ws.length) return '<div class="aCard"><div class="aEmpty">Әзірге бірде-бір апта жоқ. «Айлар мен апталар» бөлімінде ай мен апта қосыңыз немесе SapaLine-нан импорттаңыз — ай мен апта өзі қосылады.</div>' + importRow('SapaLine-дағы апта сандары бірден толады') + '</div>';
  var wk = findWeek(d, admin.weekId) || ws[ws.length - 1]; admin.weekId = wk.id;
  var res = d.results[wk.id] || {};
  var head = '<div class="aCard"><div class="aRow" style="justify-content:space-between">' +
    '<label class="aField" style="flex:1 1 240px;max-width:340px"><span>Апта</span><select class="aSel" id="aWeekSel" data-act="pick-week">' +
    ws.slice().reverse().map(function (x) { return opt(x.id, x.label + (x.w.published ? '  · сайтта' : '  · жоба'), x.id === wk.id); }).join('') + '</select></label>' +
    '<label class="aToggle"><input type="checkbox" data-bind="months|' + wk.m.id + '|weeks|' + wk.w.id + '|published"' + (wk.w.published ? ' checked' : '') + '><span>Бұл апта сайтта көрінсін</span></label></div>' +
    importRow('Ұнату және қатысым деректерін SapaLine-нан алып, мұғалім-поток бойынша қосады') +
    '<p class="aHint" style="margin-top:12px">Қолмен толтыру да мүмкін: SapaLine-дағы «Ұнау %» ұяшығын ашқанда шығатын <b>Ұнады / Орташа / Ұнамады</b> сандарын апта бойынша қосып жазыңыз — пайыз өзі есептеледі. Сан болмаса, тек пайызды жазуға болады. Қатысым: «Қатысты» және «Жалпы» сандарын немесе пайызын жазыңыз. Пікірлер: әр жолға бір пікір, «-» белгісімен басталған жол ұсыныс болып көрсетіледі. Нәтижесі жоқ мұғалім сайтта шықпайды.</p></div>';
  var body = SUBJ_KEYS.map(function (k) {
    var rows = wk.m.assignments.filter(function (a) { return a.subject === k; });
    var title = '<div class="aSubjHead">' + emblemSVG(k) + esc(d.subjects[k].name) + ' · ' + wk.label + '</div>';
    if (!rows.length) return '<div class="aCard">' + title + '<div class="aEmpty">Бұл айда ' + esc(d.subjects[k].name.toLowerCase()) + ' пәніне мұғалім бекітілмеген. «Кім қайда береді» бөлімінен қосыңыз.</div></div>';
    return '<div class="aCard">' + title + '<div class="aTableWrap"><table class="aTable"><thead><tr><th>Мұғалім</th><th>Ұнады</th><th>Орташа</th><th>Ұнамады</th><th>Сабақ</th><th>Ұнату %</th><th>Қатысты</th><th>Жалпы</th><th>Қатысым %</th><th>Пікірлер</th></tr></thead><tbody>' +
      rows.map(function (a) {
        var t = byId(d.teachers, a.teacherId), s = byId(d.streams, a.streamId), r = res[a.id] || {};
        var base = 'results|' + wk.id + '|' + a.id + '|';
        var hasCounts = num(r.liked) + num(r.avg) + num(r.disliked) > 0;
        var p = pctOf(r);
        function n(f, ph) { return '<input class="aIn num" type="text" inputmode="numeric" aria-label="' + f + '" data-kind="int" data-bind="' + base + f + '" value="' + (r[f] === '' || r[f] == null ? '' : esc(r[f])) + '" placeholder="' + (ph || '0') + '">'; }
        return '<tr><td><div class="aWho">' + (t ? avatar(t.id, t.display) : '<span class="aAva">?</span>') + '<div><b>' + esc(t ? t.display : 'Мұғалім таңдалмаған') + '</b><small>' + esc((s ? s.code : '—') + (a.line && a.line !== 'SMART' ? ' · ' + a.line : '')) + '</small>' + (r.src ? '<div class="aSrc">' + esc(r.src) + '</div>' : '') + '</div></div></td>' +
          '<td>' + n('liked') + '</td><td>' + n('avg') + '</td><td>' + n('disliked') + '</td><td>' + n('lessons', '—') + '</td>' +
          '<td><div class="aPct" data-pct="' + wk.id + '|' + a.id + '">' + (p == null ? '—' : fmtPct(p) + '%') + '</div>' +
          '<input class="aIn num" type="text" inputmode="decimal" aria-label="Пайыз қолмен" data-kind="pct" data-bind="' + base + 'pct" data-manual="' + wk.id + '|' + a.id + '" placeholder="% қолмен" style="margin-top:6px;width:96px"' + (hasCounts ? ' hidden' : '') + ' value="' + (r.pct === '' || r.pct == null ? '' : esc(String(r.pct).replace('.', ','))) + '"></td>' +
          '<td>' + n('present', '—') + '</td><td>' + n('total', '—') + '</td>' +
          '<td><div class="aPct" data-att="' + wk.id + '|' + a.id + '">' + (attendanceOf(r) == null ? '—' : fmtPct(attendanceOf(r)) + '%') + '</div>' +
          '<input class="aIn num" type="text" inputmode="decimal" aria-label="Қатысым пайызы қолмен" data-kind="pct" data-bind="' + base + 'attendancePct" data-att-manual="' + wk.id + '|' + a.id + '" placeholder="% қолмен"' + (sapaNumber(r.total) > 0 && sapaNumber(r.present) != null ? ' hidden' : '') + ' value="' + (r.attendancePct == null || r.attendancePct === '' ? '' : esc(String(r.attendancePct).replace('.', ','))) + '"></td>' +
          '<td class="aNotes"><textarea class="aTa" rows="3" data-kind="lines" data-bind="' + base + 'notes" placeholder="Сабақтың күшті тұстары…&#10;- Келесі аптаға ұсыныс">' + esc((r.notes || []).join('\n')) + '</textarea></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }).join('');
  return head + body;
}

function tabAssign() {
  var d = draft;
  if (!d.months.length) return '<div class="aEmpty">Алдымен «Айлар мен апталар» бөлімінде ай қосыңыз.</div>';
  var m = byId(d.months, admin.monthId) || d.months[d.months.length - 1]; admin.monthId = m.id;
  var idx = d.months.indexOf(m);
  var tOpts = function (sel) { return opt('', '— таңдаңыз —', !sel) + d.teachers.map(function (t) { return opt(t.id, t.display + ' (' + t.full + ')', t.id === sel); }).join(''); };
  var sOpts = function (sel) { return opt('', '—', !sel) + d.streams.map(function (s) { return opt(s.id, s.code + (s.name ? ' · ' + s.name : ''), s.id === sel); }).join(''); };
  var subjOpts = function (sel) { return SUBJ_KEYS.map(function (k) { return opt(k, d.subjects[k].name, k === sel); }).join(''); };
  var lineOpts = function (sel) { return LINES.map(function (l) { return opt(l, l, l === (sel || 'SMART')); }).join(''); };
  return '<div class="aCard"><div class="aRow">' +
    '<label class="aField" style="flex:0 1 220px"><span>Ай</span><select class="aSel" data-act="pick-month">' + d.months.slice().reverse().map(function (x) { return opt(x.id, x.label, x.id === m.id); }).join('') + '</select></label>' +
    '<button class="aBtn" type="button" data-act="asg-add">+ Жол қосу</button>' +
    (idx > 0 ? '<button class="aBtn" type="button" data-act="asg-copy">Алдыңғы айдан көшіру</button>' : '') + '</div>' +
    '<p class="aHint" style="margin-top:12px">Осы айда кім қай пәннен, қай потокта сабақ береді. Әр жол сайтта бөлек бөлім болады. Ай сайын өзгерсе, жаңа ай қосып, тізімді осы жерден түзетесіз — өткен айлардың нәтижелері өзгермейді.</p>' +
    (m.assignments.length ? '<div class="aTableWrap"><table class="aTable"><thead><tr><th>Мұғалім</th><th>Пән</th><th>Поток</th><th>Желі</th><th></th></tr></thead><tbody>' +
      m.assignments.map(function (a) {
        var b = 'months|' + m.id + '|assignments|' + a.id + '|';
        return '<tr><td style="min-width:220px"><select class="aSel" data-bind="' + b + 'teacherId" data-restructure>' + tOpts(a.teacherId) + '</select></td>' +
          '<td style="min-width:140px"><select class="aSel" data-bind="' + b + 'subject" data-restructure>' + subjOpts(a.subject) + '</select></td>' +
          '<td style="min-width:170px"><select class="aSel" data-bind="' + b + 'streamId">' + sOpts(a.streamId) + '</select></td>' +
          '<td style="min-width:120px"><select class="aSel" data-bind="' + b + 'line">' + lineOpts(a.line) + '</select></td>' +
          '<td><button class="aBtn danger icon" type="button" data-act="asg-del" data-id="' + a.id + '" aria-label="Жолды өшіру">Өшіру</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="aEmpty">Бұл айға әлі ешкім бекітілмеген. «+ Жол қосу» немесе «Алдыңғы айдан көшіру» батырмасын басыңыз.</div>') + '</div>';
}

function tabTeachers() {
  var d = draft;
  return '<div class="aCard"><div class="aRow" style="justify-content:space-between"><p class="aHint" style="margin:0">«Сайттағы аты» бөлім тақырыбында шығады (мысалы, «Дәулет ағай»). «Толық аты» SapaLine-дағыдай жазылады. Фотоны ауыстыру үшін суретті басыңыз.</p>' +
    '<button class="aBtn" type="button" data-act="teacher-add">+ Мұғалім қосу</button></div></div>' +
    '<div class="aGrid">' + d.teachers.map(function (t) {
      var p = draftPhotos[t.id];
      return '<div class="aCard tCard"><label class="tPhoto">' + (p ? '<img src="' + esc(p) + '" alt="">' : '<span>Фото қосу</span>') +
        '<input type="file" accept="image/*" data-photo="' + t.id + '" aria-label="' + esc(t.display) + ' фотосы"></label>' +
        '<div class="tFields"><label class="aField"><span>Сайттағы аты</span><input class="aIn" data-bind="teachers|' + t.id + '|display" value="' + esc(t.display) + '"></label>' +
        '<label class="aField"><span>Толық аты</span><input class="aIn" data-bind="teachers|' + t.id + '|full" value="' + esc(t.full) + '"></label>' +
        '<div class="aRow">' + (p ? '<button class="aBtn icon" type="button" data-act="photo-del" data-id="' + t.id + '">Фотоны алу</button>' : '') +
        '<button class="aBtn danger icon" type="button" data-act="teacher-del" data-id="' + t.id + '">Өшіру</button></div></div></div>';
    }).join('') + '</div>';
}

function tabStreams() {
  var d = draft;
  return '<div class="aCard"><div class="aRow" style="justify-content:space-between"><p class="aHint" style="margin:0">Поток коды бөлім тақырыбында мұғалімнің атының алдында тұрады: «ФИЗ-11 | Асхат ағай». Атауы тек осы панельде көрінеді.</p>' +
    '<button class="aBtn" type="button" data-act="stream-add">+ Поток қосу</button></div>' +
    (d.streams.length ? '<div class="aTableWrap" style="margin-top:12px"><table class="aTable"><thead><tr><th>Код</th><th>Атауы</th><th>Қолданылуы</th><th></th></tr></thead><tbody>' +
      d.streams.map(function (s) {
        var used = 0; d.months.forEach(function (m) { m.assignments.forEach(function (a) { if (a.streamId === s.id) used++; }); });
        return '<tr><td style="min-width:130px"><input class="aIn" data-bind="streams|' + s.id + '|code" value="' + esc(s.code) + '"></td>' +
          '<td style="min-width:200px"><input class="aIn" data-bind="streams|' + s.id + '|name" value="' + esc(s.name || '') + '" placeholder="Мысалы, Қыркүйек ағымы"></td>' +
          '<td><span class="chip">' + used + ' жол</span></td>' +
          '<td><button class="aBtn danger icon" type="button" data-act="stream-del" data-id="' + s.id + '">Өшіру</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="aEmpty" style="margin-top:12px">Поток жоқ. «+ Поток қосу» батырмасын басыңыз.</div>') + '</div>';
}

function tabPeriods() {
  var d = draft;
  return '<div class="aCard"><div class="aRow" style="justify-content:space-between"><p class="aHint" style="margin:0">Жаңа ай қосқанда соңғы айдағы «кім қайда береді» тізімі көшіріледі — өзгергенін ғана түзетесіз. Апта сайтта «Сайтта» қосулы және нәтижесі бар болғанда ғана көрінеді.</p>' +
    '<button class="aBtn primary" type="button" data-act="month-add">+ Ай қосу</button></div></div>' +
    d.months.slice().reverse().map(function (m) {
      return '<div class="aCard aMonth"><div class="aRow"><label class="aField" style="flex:0 1 160px"><span>Ай</span><input class="aIn" data-bind="months|' + m.id + '|label" value="' + esc(m.label) + '"></label>' +
        '<span class="chip">' + m.assignments.length + ' мұғалім-поток</span><span style="flex:1"></span>' +
        '<button class="aBtn" type="button" data-act="week-add" data-id="' + m.id + '">+ Апта қосу</button>' +
        '<button class="aBtn danger" type="button" data-act="month-del" data-id="' + m.id + '">Айды өшіру</button></div>' +
        (m.weeks.length ? m.weeks.map(function (w) {
          var n = resultCount(w.id);
          return '<div class="aWeekRow"><input class="aIn" style="width:130px" aria-label="Апта атауы" data-bind="months|' + m.id + '|weeks|' + w.id + '|label" value="' + esc(w.label) + '">' +
            '<label class="aToggle"><input type="checkbox" data-bind="months|' + m.id + '|weeks|' + w.id + '|published"' + (w.published ? ' checked' : '') + '><span>Сайтта</span></label>' +
            '<span class="chip' + (w.published ? ' on' : ' draft') + '">' + (w.published ? 'жарияланған' : 'жоба') + '</span><span class="chip">' + n + ' нәтиже</span><span style="flex:1"></span>' +
            '<button class="aBtn icon" type="button" data-act="goto-week" data-id="' + w.id + '">Нәтижелер</button>' +
            '<button class="aBtn danger icon" type="button" data-act="week-del" data-id="' + w.id + '" data-month="' + m.id + '">Өшіру</button></div>';
        }).join('') : '<div class="aEmpty">Бұл айда апта жоқ.</div>') + '</div>';
    }).join('');
}

function tabTexts() {
  var d = draft;
  function f(path, label, val, area) {
    return '<label class="aField"><span>' + label + '</span>' + (area ? '<textarea class="aTa" rows="3" data-bind="' + path + '">' + esc(val) + '</textarea>' : '<input class="aIn" data-bind="' + path + '" value="' + esc(val) + '">') + '</label>';
  }
  return '<div class="aGrid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">' + SUBJ_KEYS.map(function (k) {
    var S = d.subjects[k], b = 'subjects|' + k + '|';
    return '<div class="aCard" style="display:flex;flex-direction:column;gap:10px"><div class="aSubjHead" style="margin:0">' + emblemSVG(k) + esc(S.name) + ' беті</div>' +
      f(b + 'name', 'Пән атауы', S.name) + f(b + 'short', 'Қысқа атауы (телефонда)', S.short) + f(b + 'eyebrow', 'Тақырып үстіндегі жазу', S.eyebrow) +
      f(b + 'title', 'Басты тақырып', S.title) + f(b + 'lede', 'Сипаттама', S.lede, true) + f(b + 'footer', 'Төменгі белгі', S.footer) + '</div>';
  }).join('') +
    '<div class="aCard" style="display:flex;flex-direction:column;gap:10px"><div class="aSubjHead" style="margin:0">Аптаның қорытындысы</div>' +
    f('outro|eyebrow', 'Үстіңгі жазу', d.outro.eyebrow) + f('outro|title', 'Тақырып', d.outro.title) + f('outro|text', 'Мәтін', d.outro.text, true) +
    f('outro|ack', 'Батырма', d.outro.ack) + f('outro|ackDone', 'Басқаннан кейінгі жазу', d.outro.ackDone) + '</div></div>';
}

/* ================= admin: editing ================= */
function setPath(obj, parts, value) {
  var o = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    var k = parts[i];
    if (Array.isArray(o)) o = byId(o, k);
    else { if (o[k] == null) o[k] = {}; o = o[k]; }
    if (!o || typeof o !== 'object') return false;
  }
  if (Array.isArray(o)) return false;
  o[parts[parts.length - 1]] = value;
  return true;
}
function readInput(el) {
  var kind = el.getAttribute('data-kind');
  if (el.type === 'checkbox') return el.checked;
  var v = el.value;
  if (kind === 'int') { v = v.replace(/[^\d]/g, ''); return v === '' ? '' : parseInt(v, 10); }
  if (kind === 'pct') { v = v.replace(',', '.').replace(/[^\d.]/g, ''); return v === '' || isNaN(+v) ? '' : clamp(+v, 0, 100); }
  if (kind === 'lines') return v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  return v;
}
function onAdminInput(ev) {
  var el = ev.target.closest && ev.target.closest('[data-bind]');
  if (!el || !draft) return;
  var parts = el.getAttribute('data-bind').split('|');
  setPath(draft, parts, readInput(el));
  if (parts[0] === 'results') {
    var key = parts[1] + '|' + parts[2];
    var r = (draft.results[parts[1]] || {})[parts[2]] || {};
    if (['present', 'total', 'attendancePct'].indexOf(parts[3]) >= 0) { delete r.attendanceMode; delete r.attendanceLessons; }
    var p = pctOf(r);
    var cell = $('[data-pct="' + key + '"]'); if (cell) cell.textContent = p == null ? '—' : fmtPct(p) + '%';
    var man = $('[data-manual="' + key + '"]'); if (man) man.hidden = num(r.liked) + num(r.avg) + num(r.disliked) > 0;
    var ap = attendanceOf(r), attCell = $('[data-att="' + key + '"]'); if (attCell) attCell.textContent = ap == null ? '—' : fmtPct(ap) + '%';
    var attManual = $('[data-att-manual="' + key + '"]'); if (attManual) attManual.hidden = sapaNumber(r.total) > 0 && sapaNumber(r.present) != null;
    cleanResult(parts[1], parts[2]);
  }
  if (ev.type === 'change' && el.hasAttribute('data-restructure')) renderAdmin();
  refreshStatus();
  renderHeader();
}
function cleanResult(weekId, asgId) {
  var wr = draft.results[weekId]; if (!wr || !wr[asgId]) return;
  var r = wr[asgId];
  var empty = ['liked', 'avg', 'disliked', 'lessons', 'pct', 'present', 'total', 'attendancePct'].every(function (f) { return r[f] === '' || r[f] == null; }) && !(r.notes && r.notes.length);
  if (empty) { delete wr[asgId]; if (!Object.keys(wr).length) delete draft.results[weekId]; }
}
function nextLabel(label, suffix, fallback) {
  var m = String(label || '').match(/(\d+)/);
  return m ? String(label).replace(m[1], String(+m[1] + 1)) : fallback || ('1-' + suffix);
}
function resultsFor(asgIds) {
  var n = 0;
  Object.keys(draft.results).forEach(function (w) { asgIds.forEach(function (a) { if (draft.results[w][a]) n++; }); });
  return n;
}
function dropResults(asgIds) {
  Object.keys(draft.results).forEach(function (w) { asgIds.forEach(function (a) { delete draft.results[w][a]; }); if (!Object.keys(draft.results[w]).length) delete draft.results[w]; });
}
function afterStructural() { renderAdmin(); renderHeader(); }

function onAdminClick(ev) {
  var t = ev.target;
  var tab = t.closest && t.closest('[data-tab]');
  if (tab) { admin.tab = tab.getAttribute('data-tab'); renderAdmin(); $('#admin').scrollTop = 0; return; }
  var b = t.closest && t.closest('[data-act]');
  if (!b || b.tagName === 'SELECT' || b.disabled) return;
  var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
  var d = draft;
  switch (act) {
    case 'close': closeAdmin(); return;
    case 'save': save(); return;
    case 'discard':
      confirmBox('Өзгерістерді тастау керек пе?', 'Соңғы жарияланған нұсқа қайта ашылады. Сақталмаған өзгерістер жойылады.', 'Тастау', true).then(function (ok) {
        if (!ok) return; draft = clone(D); draftPhotos = Object.assign({}, P); photosDirty = false; renderAdmin(); renderHeader();
      });
      return;
    case 'asg-add': {
      var m = byId(d.months, admin.monthId); if (!m) return;
      m.assignments.push({ id: uid('a'), teacherId: '', subject: 'phys', streamId: '', line: 'SMART' });
      afterStructural(); return;
    }
    case 'asg-copy': {
      var mm = byId(d.months, admin.monthId), prev = d.months[d.months.indexOf(mm) - 1]; if (!mm || !prev) return;
      var go = function () {
        dropResults(mm.assignments.map(function (a) { return a.id; }));
        mm.assignments = prev.assignments.map(function (a) { return { id: uid('a'), teacherId: a.teacherId, subject: a.subject, streamId: a.streamId, line: a.line || 'SMART' }; });
        afterStructural(); toast(prev.label + ' тізімі көшірілді');
      };
      if (mm.assignments.length) confirmBox('Тізімді ауыстыру керек пе?', mm.label + ' айындағы қазіргі ' + mm.assignments.length + ' жол ' + prev.label + ' тізімімен ауыстырылады' + (resultsFor(mm.assignments.map(function (a) { return a.id; })) ? ', олардың нәтижелері де өшеді' : '') + '.', 'Ауыстыру', true).then(function (ok) { if (ok) go(); });
      else go();
      return;
    }
    case 'asg-del': {
      var m2 = byId(d.months, admin.monthId); if (!m2) return;
      var n = resultsFor([id]);
      var del = function () { m2.assignments = m2.assignments.filter(function (a) { return a.id !== id; }); dropResults([id]); afterStructural(); };
      if (n) confirmBox('Жолды өшіру керек пе?', 'Бұл жолдың ' + n + ' аптада нәтижесі бар. Өшірсеңіз, нәтижелері де өшеді.', 'Өшіру', true).then(function (ok) { if (ok) del(); });
      else del();
      return;
    }
    case 'teacher-add': {
      d.teachers.push({ id: uid('t'), full: 'Жаңа мұғалім', display: 'Жаңа мұғалім' });
      afterStructural(); toast('Мұғалім қосылды — атын жазып, фото қосыңыз'); return;
    }
    case 'teacher-del': {
      var te = byId(d.teachers, id); if (!te) return;
      var ids = []; d.months.forEach(function (m) { m.assignments.forEach(function (a) { if (a.teacherId === id) ids.push(a.id); }); });
      confirmBox(te.display + ' өшірілсін бе?', ids.length ? 'Ол ' + ids.length + ' жолда бекітілген. Сол жолдар мен олардың нәтижелері де өшеді.' : 'Мұғалім тізімнен өшіріледі.', 'Өшіру', true).then(function (ok) {
        if (!ok) return;
        d.teachers = d.teachers.filter(function (x) { return x.id !== id; });
        d.months.forEach(function (m) { m.assignments = m.assignments.filter(function (a) { return a.teacherId !== id; }); });
        dropResults(ids); delete draftPhotos[id]; photosDirty = true; afterStructural();
      });
      return;
    }
    case 'photo-del': delete draftPhotos[id]; photosDirty = true; afterStructural(); return;
    case 'stream-add': d.streams.push({ id: uid('s'), code: 'ФИЗ-', name: '' }); afterStructural(); return;
    case 'stream-del': {
      var st = byId(d.streams, id); if (!st) return;
      confirmBox(st.code + ' өшірілсін бе?', 'Бұл поток бекітілген жолдарда «—» болып қалады.', 'Өшіру', true).then(function (ok) {
        if (!ok) return;
        d.streams = d.streams.filter(function (s) { return s.id !== id; });
        d.months.forEach(function (m) { m.assignments.forEach(function (a) { if (a.streamId === id) a.streamId = ''; }); });
        afterStructural();
      });
      return;
    }
    case 'month-add': {
      var last = d.months[d.months.length - 1];
      var nm = { id: uid('m'), label: nextLabel(last && last.label, 'АЙ', '1-АЙ'), weeks: [{ id: uid('w'), label: '1-АПТА', published: false }], assignments: [] };
      if (last) nm.assignments = last.assignments.map(function (a) { return { id: uid('a'), teacherId: a.teacherId, subject: a.subject, streamId: a.streamId, line: a.line || 'SMART' }; });
      d.months.push(nm); admin.monthId = nm.id; admin.weekId = nm.weeks[0].id;
      afterStructural(); toast(nm.label + ' қосылды, тізім соңғы айдан көшірілді'); return;
    }
    case 'month-del': {
      var mo = byId(d.months, id); if (!mo) return;
      var n3 = mo.weeks.reduce(function (s, w) { return s + resultCount(w.id); }, 0);
      confirmBox(mo.label + ' өшірілсін бе?', 'Айдың ' + mo.weeks.length + ' аптасы' + (n3 ? ' және ' + n3 + ' нәтиже' : '') + ' өшеді.', 'Өшіру', true).then(function (ok) {
        if (!ok) return;
        mo.weeks.forEach(function (w) { delete d.results[w.id]; });
        d.months = d.months.filter(function (m) { return m.id !== id; });
        afterStructural();
      });
      return;
    }
    case 'week-add': {
      var mw = byId(d.months, id); if (!mw) return;
      var lw = mw.weeks[mw.weeks.length - 1];
      var w = { id: uid('w'), label: nextLabel(lw && lw.label, 'АПТА', '1-АПТА'), published: false };
      mw.weeks.push(w); admin.weekId = w.id;
      afterStructural(); toast(mw.label + ' ' + w.label + ' қосылды (жоба)'); return;
    }
    case 'week-del': {
      var mx = byId(d.months, b.getAttribute('data-month')); if (!mx) return;
      var wx = byId(mx.weeks, id); if (!wx) return;
      var n4 = resultCount(id);
      confirmBox(mx.label + ' ' + wx.label + ' өшірілсін бе?', n4 ? 'Аптаның ' + n4 + ' нәтижесі де өшеді.' : 'Апта бос.', 'Өшіру', true).then(function (ok) {
        if (!ok) return; mx.weeks = mx.weeks.filter(function (x) { return x.id !== id; }); delete d.results[id]; afterStructural();
      });
      return;
    }
    case 'goto-week': admin.weekId = id; admin.tab = 'results'; renderAdmin(); $('#admin').scrollTop = 0; return;
    case 'logout': api('DELETE', '/api/session').catch(function () {}).then(function () { location.href = '/'; }); return;
    case 'import': importBox(); return;
  }
}

/* ================= admin: SapaLine import window ================= */
function importBox() {
  var m = $('#modal');
  modalResolve = null;
  m.innerHTML = '<div class="modalBox wide" role="dialog" aria-modal="true" aria-labelledby="imT"><h4 id="imT">SapaLine-нан импорттау</h4>' +
    '<ol class="imSteps"><li>SapaLine-да <b>Live Sabaq</b> → Физика бетін ашып, керек аптаны таңдаңыз.</li>' +
    '<li>Бетбелгілер жолағындағы <b>JUZ40 · SapaLine</b> батырмасын басыңыз. Сабақтар оқылып болған соң <b>Көшіру</b> немесе <b>JSON жүктеу</b> басыңыз. Бұрынғы бетбелгіні осы терезедегі жаңа нұсқамен ауыстырыңыз.</li>' +
    '<li>Төмендегі өріске қойып (⌘V / Ctrl+V) немесе жүктелген JSON файлды ашып, <b>Импорттау</b> басыңыз. Сандарды тексеріп, «Сақтау және жариялау» басасыз.</li></ol>' +
    '<div class="imBm"><a class="bmLink" href="' + esc(BOOKMARKLET) + '" title="Бетбелгілер жолағына сүйреп апарыңыз">' + emblemSVG(view.subject) + 'JUZ40 · SapaLine</a>' +
    '<span>Бір рет қана: батырманы браузердің бетбелгілер жолағына сүйреп апарыңыз. Сүйреу болмаса, кодты көшіріп, жаңа бетбелгінің мекенжайына қойыңыз.</span>' +
    '<button class="aBtn icon" type="button" data-imp="copybm">Кодты көшіру</button></div>' +
    '<label class="aField"><span>SapaLine-нан көшірілген деректер</span><textarea class="aTa" id="imText" rows="4" spellcheck="false" autocomplete="off" placeholder="Осында қойыңыз"></textarea></label>' +
    '<label class="aField"><span>Немесе Sapaline-нан жүктелген JSON файлды ашыңыз</span><input class="aIn" type="file" id="imFile" accept=".json,application/json" data-import-file aria-label="JSON файлды ашу"></label>' +
    '<p class="imErr" id="imErr" role="alert"></p>' +
    '<label class="aToggle"><input type="checkbox" id="imPub" checked><span>Импорттан кейін апта сайтта көрінсін</span></label>' +
    '<div class="aRow" style="margin-top:18px"><button class="aBtn" type="button" data-m="0">Бас тарту</button><button class="aBtn primary" type="button" data-imp="go">Импорттау</button></div></div>';
  m.hidden = false;
  var ta = $('#imText'); if (ta) ta.focus();
}
function importReport(rep) {
  var out = [rep.updated + ' мұғалім-поток жаңарды, ' + rep.lessons + ' сабақтың сауалнамасы қосылды.'];
  rep.lines.forEach(function (l) { out.push('• ' + (l.code ? l.code + ' | ' : '') + l.name + ' — ' + (l.pct == null ? 'ұнату дерегі жоқ' : 'ұнату ' + fmtPct(l.pct) + '%') + ' · қатысым ' + (l.attendancePct == null ? '—' : fmtPct(l.attendancePct) + '%') + ' (' + l.lessons + ' сауалнамалы сабақ)'); });
  if (rep.missing.length) out.push('', 'Сауалнамасыз (' + rep.missing.length + '): ' + rep.missing.slice(0, 8).join('; ') + (rep.missing.length > 8 ? ' …' : ''));
  if (rep.attendanceMissing.length) out.push('', 'Қатысым дерегі жоқ (' + rep.attendanceMissing.length + '): ' + rep.attendanceMissing.slice(0, 8).join('; '));
  if (rep.retained.length) out.push('', 'Экспортта жоқ ' + rep.retained.length + ' бұрынғы нәтиже сақталды.');
  if (rep.duplicates) out.push('', 'Қайталанған ' + rep.duplicates + ' жол бір рет есептелді.');
  if (rep.created.length) out.push('', 'Қосылды: ' + rep.created.join('; ') + '.');
  if (rep.added.length) out.push('', 'Жаңа: ' + rep.added.join('; ') + '.');
  out.push('', rep.published ? 'Апта сайтта көрінеді. Тексеріп, «Сақтау және жариялау» басыңыз.' : 'Апта әзірге жоба. Тексеріп, «Сақтау және жариялау» басыңыз.');
  return out.join('\n');
}
function doImport() {
  var ta = $('#imText'), err = $('#imErr');
  var text = ta ? ta.value.trim() : '';
  var say = function (msg) { if (err) err.textContent = msg; };
  if (!text) { say('Алдымен SapaLine-нан көшірген деректерді қойыңыз.'); return; }
  var payload;
  try { payload = JSON.parse(text); } catch (e) { say('Деректер толық көшірілмеген сияқты. SapaLine-дағы «Көшіру» батырмасын қайта басып, қайта қойыңыз.'); return; }
  ensureDraft();
  var work = clone(draft), rep;
  try { rep = mergeSapa(work, payload, { uid: uid, publish: !!($('#imPub') && $('#imPub').checked) }); }
  catch (e) { say(e && e.code === 'bad_import' ? e.message : 'Импорт сәтсіз аяқталды: деректерді тексеріңіз.'); return; }
  if (!rep.updated) { say('Бұл аптада ұнату немесе қатысым дерегі бар сабақ табылмады.'); return; }
  draft = work;
  admin.tab = 'results'; admin.weekId = rep.weekId; admin.monthId = rep.monthId;
  if (SUBJ[rep.subject]) view.subject = rep.subject;
  closeModal(false);
  renderAdmin(); renderHeader(); $('#admin').scrollTop = 0;
  confirmBox((cur().subjects[rep.subject] || {}).name + ' · ' + rep.period, importReport(rep), null);
}
function readImportFile(file) {
  if (!file) return Promise.reject(new Error('Файл таңдалмаған.'));
  if (file.size > 2000000) return Promise.reject(new Error('JSON файл тым үлкен (ең көбі 2 МБ).'));
  return file.text().then(function (text) {
    var payload;
    try { payload = JSON.parse(text); } catch (e) { throw new Error('Бұл файлда жарамды JSON жоқ. Sapaline-нан қайта жүктеңіз.'); }
    if (!payload || !Array.isArray(payload.rows)) throw new Error('Бұл Sapaline экспортына ұқсамайды: сабақтар тізімі жоқ.');
    return text;
  });
}
function onAdminChange(ev) {
  var t = ev.target;
  if (t.matches && t.matches('input[type=file][data-import-file]')) {
    var file = t.files && t.files[0], ta = $('#imText'), err = $('#imErr');
    if (!file) return;
    readImportFile(file).then(function (text) {
      if (!ta || !ta.isConnected) return;
      ta.value = text; if (err) err.textContent = '';
      toast('Файл ашылды. «Импорттау» басыңыз.');
    }).catch(function (e) { if (err) err.textContent = e.message; });
    return;
  }
  if (t.matches && t.matches('[data-act="pick-week"]')) { admin.weekId = t.value; var wk = findWeek(draft, t.value); if (wk) admin.monthId = wk.m.id; renderAdmin(); return; }
  if (t.matches && t.matches('[data-act="pick-month"]')) { admin.monthId = t.value; renderAdmin(); return; }
  if (t.matches && t.matches('input[type=file][data-photo]')) {
    var file = t.files && t.files[0], id = t.getAttribute('data-photo');
    if (!file) return;
    fileToPhoto(file).then(function (url) {
      return SERVER ? api('POST', '/api/photo', { teacherId: id, dataUrl: url }).then(function (j) { return j.url; }) : url;
    }).then(function (url) { draftPhotos[id] = url; photosDirty = true; afterStructural(); toast('Фото жүктелді'); })
      .catch(function (e) {
        if (e && e.status === 401) { loginBox('Сессия аяқталды. Қайта кіріңіз.'); return; }
        toast(e && e.status ? 'Фотоны сақтау сәтсіз аяқталды.' : 'Бұл суретті ашу мүмкін болмады. JPG немесе PNG таңдаңыз.', 'bad');
      });
    return;
  }
  onAdminInput(ev);
}
function fileToPhoto(file) {
  return new Promise(function (resolve, reject) {
    var fr = new FileReader();
    fr.onerror = function () { reject(fr.error); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { reject(new Error('decode')); };
      img.onload = function () {
        var s = Math.min(1, 720 / img.width, 960 / img.height);
        var w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        var q = 0.86, url = c.toDataURL('image/jpeg', q);
        while (url.length > 240000 && q > 0.5) { q -= 0.08; url = c.toDataURL('image/jpeg', q); }
        resolve(url);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
var adminEl = $('#admin');
adminEl.addEventListener('click', onAdminClick);
adminEl.addEventListener('input', function (ev) { if (ev.target.matches && ev.target.matches('select, input[type=file], input[type=checkbox]')) return; onAdminInput(ev); });
adminEl.addEventListener('change', onAdminChange);
$('#modal').addEventListener('change', onAdminChange);
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape' && !$('#modal').hidden) { closeModal(false); return; }
  if (ev.key === 'Escape' && admin.open) closeAdmin();
});

/* ================= modal + toast ================= */
var modalResolve = null;
function confirmBox(title, text, okLabel, danger) {
  return new Promise(function (resolve) {
    modalResolve = resolve;
    var m = $('#modal');
    m.innerHTML = '<div class="modalBox" role="dialog" aria-modal="true" aria-labelledby="mTitle"><h4 id="mTitle">' + esc(title) + '</h4><p>' + esc(text) + '</p>' +
      '<div class="aRow"><button class="aBtn" type="button" data-m="0">' + (okLabel ? 'Бас тарту' : 'Түсінікті') + '</button>' + (okLabel ? '<button class="aBtn ' + (danger ? 'danger' : 'primary') + '" type="button" data-m="1">' + esc(okLabel) + '</button>' : '') + '</div></div>';
    m.hidden = false;
    var b = $('[data-m="' + (okLabel ? '1' : '0') + '"]', m); if (b) b.focus();
  });
}
function closeModal(v) { var m = $('#modal'); m.hidden = true; m.innerHTML = ''; if (modalResolve) { var r = modalResolve; modalResolve = null; r(v); } }
$('#modal').addEventListener('click', function (ev) {
  var t = ev.target;
  if (t.closest && t.closest('.bmLink')) { ev.preventDefault(); toast('Бұл батырманы бетбелгілер жолағына сүйреп апарыңыз — ол SapaLine бетінде басылады'); return; }
  var imp = t.closest && t.closest('[data-imp]');
  if (imp) {
    if (imp.getAttribute('data-imp') === 'go') doImport();
    else copyText(BOOKMARKLET).then(function () { toast('Код көшірілді: жаңа бетбелгі жасап, мекенжай өрісіне қойыңыз'); }, function () { toast('Көшіру мүмкін болмады. Батырманы сүйреп апарыңыз.', 'bad'); });
    return;
  }
  var b = t.closest && t.closest('[data-m]');
  if (b) closeModal(b.getAttribute('data-m') === '1'); else if (t === $('#modal')) closeModal(false);
});
var toastT = 0;
function toast(msg, tone) {
  var t = $('#toast'); t.textContent = msg; t.hidden = false;
  if (tone) t.setAttribute('data-tone', tone); else t.removeAttribute('data-tone');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, tone === 'bad' ? 6000 : 3200);
}

/* ================= save (republish this page) ================= */
function buildContent(d, photos) {
  return TITLE_TAG + HEAD_LINKS +
    '<style id="juz-fonts">' + $('#juz-fonts').textContent + '</style>' +
    '<style id="juz-css">' + $('#juz-css').textContent + '</style>' + SHELL +
    '<script type="application/json" id="juz-state">' + json(d) + '<\/script>' +
    '<script type="application/json" id="juz-photos">' + json(photos) + '<\/script>' +
    '<script id="juz-app">' + $('#juz-app').textContent + '<\/script>';
}
function saveServer(opts) {
  opts = opts || {}; // opts.quiet: the weekly task saves — report problems in the return value, open no dialogs
  var photos = {}; draft.teachers.forEach(function (t) { if (draftPhotos[t.id]) photos[t.id] = draftPhotos[t.id]; });
  publishing = true; refreshStatus();
  var btn = $('#aSave'); if (btn) btn.textContent = 'Сақталуда…';
  var body = { state: draft, photos: photos, baseRev: D.rev || 0 };
  if (srv.etag !== undefined) body.baseEtag = srv.etag; // which saved version these edits started from
  return api('PUT', '/api/data', body).then(function (j) {
    D = j.state; P = j.photos || {}; srv.etag = j.etag; draft = clone(D); draftPhotos = Object.assign({}, P); photosDirty = false; publishing = false;
    if (admin.open) renderAdmin(); renderHeader(); toast('Сақталды — сайт жаңартылды');
    return { ok: true, rev: D.rev };
  }).catch(function (e) {
    publishing = false; if (btn) btn.textContent = 'Сақтау және жариялау'; refreshStatus();
    var out = { ok: false, status: e.status || 0, message: (e.body && e.body.message) || e.message };
    if (opts.quiet) return out;
    if (e.status === 401) { loginBox('Сессия аяқталды. Қайта кіріп, «Сақтау» батырмасын қайта басыңыз.'); return out; }
    if (e.status === 409) {
      confirmBox('Сайттың жаңа нұсқасы бар', 'Панельді ашқаннан кейін сайт басқа жерден (басқа құрылғыдан не басқа әкімшіден) жаңартылған. Жаңа нұсқаны ашып, өзгерістерді қайта енгізіңіз.', 'Жаңа нұсқаны ашу').then(function (ok) {
        if (!ok) return;
        serverLoad().then(function () { draft = clone(D); draftPhotos = Object.assign({}, P); photosDirty = false; renderAdmin(); renderHeader(); });
      });
      return out;
    }
    toast(e.body && e.body.message ? e.body.message : 'Сақтау сәтсіз аяқталды. Қайталап көріңіз.', 'bad');
    return out;
  });
}
function save() {
  if (!draft || publishing) return;
  if (SERVER) { saveServer(); return; }
  var d = clone(draft);
  d.rev = (D.rev || 0) + 1; d.saveId = uid('v'); d.updatedAt = new Date().toISOString();
  var photos = {}; d.teachers.forEach(function (t) { if (draftPhotos[t.id]) photos[t.id] = draftPhotos[t.id]; });
  var html = SKELETON_HEAD + buildContent(d, photos) + SKELETON_TAIL;
  if (html.length > 15.5e6) { toast('Бет тым үлкен. Бірнеше фотоны кішірейтіңіз немесе өшіріңіз.', 'bad'); return; }
  var C = window.claude;
  var getArt = C && typeof C.use === 'function' ? C.use('artifact') : Promise.resolve(null);
  publishing = true; refreshStatus();
  var btn = $('#aSave'); if (btn) btn.textContent = 'Жариялануда…';
  getArt.then(function (art) {
    if (!art) throw { code: 'unavailable_here' };
    var stashed = sstore.set('juz.stash', JSON.stringify({ saveId: d.saveId, base: D.saveId, draft: draft, photos: draftPhotos, ui: { tab: admin.tab, weekId: admin.weekId, monthId: admin.monthId, subject: view.subject, view: view.weekId } }));
    if (!stashed) sstore.set('juz.stash', JSON.stringify({ saveId: d.saveId, base: D.saveId, ui: { tab: admin.tab, weekId: admin.weekId, monthId: admin.monthId, subject: view.subject, view: view.weekId } }));
    return art.publish(html);
  }).then(function () {
    toast('Сақталды. Сайт жаңа нұсқаға ауысып жатыр…');
  }).catch(function (err) {
    publishing = false;
    if (btn) btn.textContent = 'Сақтау және жариялау';
    refreshStatus();
    var code = err && err.code;
    if (code === 'conflict') { toast('Осы уақытта сайттың басқа нұсқасы жарияланды. Бет жаңарғанда өзгерістеріңізді қалпына келтіруді ұсынамын.', 'bad'); return; }
    sstore.del('juz.stash');
    if (code === 'not_writer' || code === 'not_granted' || code === 'consent_required' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') {
      confirmBox('Сақтау мүмкін емес', 'Бұл бетті өзгертуге құқық керек. Сайтты claude.ai ішінде иесі немесе Editor ретінде ашыңыз.', null); return;
    }
    if (code === 'unavailable_here') { confirmBox('Сақтау мүмкін емес', 'Сақтау тек claude.ai ішінде ашылған бетте жұмыс істейді.', null); return; }
    if (code === 'too_large') { toast('Бет тым үлкен. Бірнеше фотоны кішірейтіңіз.', 'bad'); return; }
    if (code === 'rate_limited') { toast('Тым жиі сақталып жатыр. Бір минуттан кейін қайталаңыз.', 'bad'); return; }
    toast('Жариялау сәтсіз аяқталды. Қайта басып көріңіз.', 'bad');
  });
}
function resumeAfterSave() {
  var raw = sstore.get('juz.stash'); if (!raw) return;
  var s; try { s = JSON.parse(raw); } catch (e) { sstore.del('juz.stash'); return; }
  sstore.del('juz.stash');
  var ui = s.ui || {};
  if (ui.subject && SUBJ[ui.subject]) view.subject = ui.subject;
  admin.tab = ui.tab || admin.tab; admin.weekId = ui.weekId || null; admin.monthId = ui.monthId || null;
  if (D.saveId === s.saveId) {
    view.weekId = pickWeek(view.subject, ui.view);
    renderAll(); openAdmin(); toast('Сақталды — сайт жаңартылды');
    return;
  }
  if (s.draft && s.base !== D.saveId) {
    confirmBox('Өзгерістеріңіз сақталмай қалды', 'Сіз жариялап жатқанда сайттың басқа нұсқасы шықты. Өз өзгерістеріңізді қайта ашып, тексеріп, қайта жариялауға болады.', 'Қайта ашу').then(function (ok) {
      if (!ok) return;
      draft = s.draft; draftPhotos = s.photos || Object.assign({}, P); photosDirty = true;
      openAdmin();
    });
  }
}

/* ================= weekly task hooks (Claude's scheduled task on the owner's computer) =================
   The task reads SapaLine in the owner's browser, then opens /admin#juz=<data> from the SapaLine tab, so the
   numbers travel inside the browser and are never retyped. Everything below needs the admin to be logged in:
   saving goes through the same PUT /api/data (cookie) as the «Сақтау» button.
   #juz= payload: { v: 1, items: [{ subject: 'physics', line: 'smart'|'junior', period: '3-АЙ 4-АПТА',
     rows: [[date, time, teacher, agym, liked, avg, disliked]] (liked..disliked null when the lesson has no survey),
     expect: { liked, avg, disliked, lessons } (sums over the rows that have a survey, counted on the SapaLine side) }] } */
var autoPending = null, autoItems = null;
function autoReadHash() {
  var m = /[#&]juz=([^&]*)/.exec(location.hash || '');
  if (!m) return;
  try { autoPending = JSON.parse(decodeURIComponent(m[1])); } catch (e) { autoPending = { error: 'payload could not be read' }; }
  if (!autoPending || (!autoPending.error && !Array.isArray(autoPending.items))) autoPending = { error: 'payload has no items' };
  autoItems = null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
}
autoReadHash();
window.addEventListener('hashchange', autoReadHash); // the same tab opened /admin#juz=… again without reloading
function autoIsAdmin() { return SERVER ? !!srv.admin : !!admin.canEdit; }
// merges the SapaLine items into `state` (in place) and checks every item against the sums counted on SapaLine.
// Which weeks get switched on: only the newest week of the payload, and only if that week is new on the site or
// still has no numbers — a week the admin already has (and may have hidden on purpose) keeps its setting.
// An older week (e.g. Junior had no lessons this week) only refreshes its numbers, and only if it is on the site.
function autoMerge(state, items) {
  var reports = [], problems = [];
  function pkey(p) { var m = /(\d+)\s*-\s*АЙ\s*(\d+)\s*-\s*АПТА/i.exec(String(p || '')); return m ? +m[1] * 100 + +m[2] : -1; }
  function weekOf(p) {
    var m = /(\d+)\s*-\s*АЙ\s*(\d+)\s*-\s*АПТА/i.exec(String(p || '')); if (!m) return null;
    var mo = (state.months || []).filter(function (x) { return String(x.label).replace(/\s+/g, '').toUpperCase() === m[1] + '-АЙ'; })[0];
    return mo ? (mo.weeks || []).filter(function (w) { return String(w.label).replace(/\s+/g, '').toUpperCase() === m[2] + '-АПТА'; })[0] || null : null;
  }
  var list = items.map(function (it) {
    it = it || {};
    var rows = (it.rows || []).map(function (r) {
      if (r && !Array.isArray(r) && typeof r === 'object') return r;
      r = r || [];
      return { date: r[0], time: r[1], teacher: r[2], agym: r[3], present: r[7], total: r[8], att: r[9], survey: r[4] == null ? null : { liked: r[4], avg: r[5], disliked: r[6] } };
    });
    var withSurvey = rows.filter(function (r) { return r.survey && (+r.survey.liked || 0) + (+r.survey.avg || 0) + (+r.survey.disliked || 0) > 0; }).length;
    var wk = weekOf(it.period);
    return { it: it, rows: rows, withSurvey: withSurvey, hasMetrics: withSurvey > 0 || rows.some(function (r) { return attendanceOf({ present: r.present != null ? r.present : r.survey && r.survey.present, total: r.total != null ? r.total : r.survey && r.survey.total, attendancePct: r.att != null ? r.att : r.attendancePct }) != null; }), key: pkey(it.period), week: wk, hadNumbers: !!(wk && state.results[wk.id] && Object.keys(state.results[wk.id]).length) };
  });
  var newest = list.reduce(function (a, x) { return x.hasMetrics ? Math.max(a, x.key) : a; }, -1);
  list.forEach(function (x) {
    var it = x.it, line = String(it.line || 'smart').toUpperCase();
    if (!x.hasMetrics) { reports.push({ subject: it.subject, line: line, period: it.period, skipped: 'no lesson with feedback or attendance yet', rows: x.rows.length }); return; }
    if (x.key < newest && !x.week) { reports.push({ subject: it.subject, line: line, period: it.period, skipped: 'an older week that is not on the site', rows: x.rows.length }); return; }
    var publish = x.key === newest && (!x.week || !x.hadNumbers), wasOn = !!(x.week && x.week.published);
    var rep = mergeSapa(state, { subject: it.subject, line: line, period: it.period, rows: x.rows }, { uid: uid, publish: publish });
    var got = rep.lines.reduce(function (a, l) { a.liked += l.liked; a.avg += l.avg; a.disliked += l.disliked; a.lessons += l.lessons; return a; }, { liked: 0, avg: 0, disliked: 0, lessons: 0 });
    var want = it.expect;
    if (!want) problems.push(rep.subject + ' ' + line + ' ' + rep.period + ': no expect sums were sent');
    else if (+want.liked !== got.liked || +want.avg !== got.avg || +want.disliked !== got.disliked || +want.lessons !== got.lessons) {
      problems.push(rep.subject + ' ' + line + ' ' + rep.period + ': SapaLine ' + JSON.stringify(want) + ' but the site counted ' + JSON.stringify(got));
    }
    var T = got.liked + got.avg + got.disliked;
    reports.push({ subject: rep.subject, line: line, period: rep.period, lessons: rep.lessons, overall: fmtPct(T ? 100 * got.liked / T : null) + '%',
      week: rep.published ? (wasOn ? 'already on the site' : 'switched on now') : 'kept hidden (switched off in the admin panel)',
      teachers: rep.lines.map(function (l) { return l.name + ' · ' + l.code + ': ' + (l.pct == null ? 'ұнату дерегі жоқ' : 'ұнату ' + fmtPct(l.pct) + '%') + ' · қатысым ' + (l.attendancePct == null ? '—' : fmtPct(l.attendancePct) + '%') + ' (' + l.lessons + ' сауалнамалы сабақ)'; }),
      noSurvey: rep.missing, added: rep.added, created: rep.created });
  });
  return { reports: reports, problems: problems };
}
window.juzAuto = {
  v: 1,
  status: function () {
    return { v: 1, server: SERVER, loaded: !!D, checked: SERVER ? !!srv.checked : true, admin: autoIsAdmin(), rev: D ? D.rev : null,
      pending: autoPending && autoPending.items ? autoPending.items.length : 0, pendingError: (autoPending && autoPending.error) || null,
      imported: !!autoItems, dirty: isDirty(), saving: !!publishing };
  },
  importPending: function () {
    if (!D) return { ok: false, error: 'page still loading' };
    if (!autoIsAdmin()) return { ok: false, error: 'not logged in as admin' };
    if (!autoPending || !autoPending.items) return { ok: false, error: (autoPending && autoPending.error) || 'nothing to import' };
    if (isDirty()) return { ok: false, error: 'the admin panel has unsaved changes; reload the page first' };
    var work = clone(D), out;
    try { out = autoMerge(work, autoPending.items); } catch (e) { return { ok: false, error: (e && e.message) || 'import failed' }; }
    if (out.problems.length) return { ok: false, error: 'numbers do not match', problems: out.problems, reports: out.reports };
    autoItems = autoPending.items; autoPending = null;
    draft = work; draftPhotos = Object.assign({}, P); photosDirty = false;
    if (admin.open) renderAdmin(); renderHeader();
    return { ok: true, changed: isDirty(), reports: out.reports };
  },
  save: function () {
    if (!SERVER) return Promise.resolve({ ok: false, error: 'only on the deployed site' });
    if (publishing) return Promise.resolve({ ok: false, error: 'a save is already running' });
    if (!autoItems) return Promise.resolve({ ok: false, error: 'run importPending() first' });
    if (!isDirty()) return Promise.resolve({ ok: true, unchanged: true, rev: D.rev });
    return saveServer({ quiet: true }).then(function (r) {
      if (r.ok || r.status !== 409) return r;
      // saved from somewhere else meanwhile: take the newest data, merge the same SapaLine numbers again, save once more
      return serverLoad().then(function () {
        var work = clone(D), out;
        try { out = autoMerge(work, autoItems); } catch (e) { return { ok: false, error: (e && e.message) || 'import failed after reloading' }; }
        if (out.problems.length) return { ok: false, error: 'numbers do not match after reloading', problems: out.problems };
        draft = work; draftPhotos = Object.assign({}, P); photosDirty = false;
        if (!isDirty()) return { ok: true, unchanged: true, rev: D.rev, retried: true };
        return saveServer({ quiet: true }).then(function (r2) { r2.retried = true; return r2; });
      });
    });
  },
  // what a visitor sees now (no cookie): the revision and the weeks that are on the site
  verify: function () {
    return fetch('/api/data', { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var s = j.state || {}, weeks = [];
      (s.months || []).forEach(function (m) { (m.weeks || []).forEach(function (w) { weeks.push(m.label + ' ' + w.label + ': ' + Object.keys((s.results || {})[w.id] || {}).length + ' rows'); }); });
      return { rev: s.rev, weeks: weeks };
    });
  }
};

/* ================= boot ================= */
function boot(hot) {
  document.documentElement.setAttribute('data-subj', view.subject);
  if (SERVER) {
    rainStart();
    serverLoad().then(function () { start(hot || {}); }).catch(function () {
      $('#acts').innerHTML = '<section class="act teacher" data-theme="light" data-sig="1" data-flow="natural" data-fixed><div class="pin"><div class="flow"><div class="row"><div class="textCol"><h2 class="name">Деректер жүктелмеді</h2><p class="emptyNote">Интернетті тексеріп, бетті қайта жаңартыңыз.</p></div></div></div></div></section>';
    });
    return;
  }
  start(hot);
  rainStart();
}
function start(hot) {
  if (hot && hot.draft) {
    draft = hot.draft; draftPhotos = hot.photos || Object.assign({}, P); photosDirty = !!hot.photosDirty;
    if (hot.ui) { admin.tab = hot.ui.tab || admin.tab; admin.weekId = hot.ui.weekId || null; admin.monthId = hot.ui.monthId || null; }
  }
  if (hot && hot.subject && SUBJ[hot.subject]) view.subject = hot.subject;
  view.weekId = pickWeek(view.subject, hot && hot.weekId);
  renderAll();
  detectAdmin();
  if (hot && hot.adminOpen && draft) openAdmin();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); update(); });
}
var H = window.claude && window.claude.hot;
if (H && typeof H.snapshot === 'function') {
  try {
    H.snapshot(function () {
      if (publishing) return { subject: view.subject, weekId: view.weekId };
      return { subject: view.subject, weekId: view.weekId, draft: isDirty() ? draft : null, photos: isDirty() ? draftPhotos : null, photosDirty: photosDirty, adminOpen: admin.open, ui: { tab: admin.tab, weekId: admin.weekId, monthId: admin.monthId } };
    });
  } catch (e) {}
}
if (H && typeof H.ready === 'function') H.ready(boot); else boot((H && H.data) || {});
})();
