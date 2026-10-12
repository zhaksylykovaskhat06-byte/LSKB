/* Merges one SapaLine week into the site state (in place) and returns a report.
   payload is what the "JUZ40 · SapaLine" bookmarklet (and the weekly task) produce:
   { subject: 'physics', line: 'smart', period: '3-АЙ 4-АПТА',
     rows: [{ date, time, teacher, potok, agym, like, att, survey: { liked, avg, disliked, present, total } }] }
   Per teacher + stream the week's survey counts are summed over every lesson that has a survey;
   the page then shows like% = liked / (liked + avg + disliked).
   A missing month / week / teacher / stream / assignment is created (a new month copies the last
   month's "who teaches where" list). Notes the admin already wrote for that week are kept. */
// Shared by the importer and public/admin views. Missing values stay missing (zero is valid).
function sapaNumber(v, percent) {
  if (v == null || String(v).trim() === '' || /^[—–-]$/.test(String(v).trim())) return null;
  var text = String(v).trim().replace(/\s/g, '').replace(percent ? /%$/ : /$^/, '').replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  var n = Number(text);
  return Number.isFinite(n) && n >= 0 && (percent ? n <= 100 : Number.isInteger(n) && n <= 10000000) ? n : null;
}
function attendanceOf(r) {
  if (!r) return null;
  var present = sapaNumber(r.present), total = sapaNumber(r.total);
  if (present != null && total > 0 && present <= total) return 100 * present / total;
  return sapaNumber(r.attendancePct, true);
}
function mergeSapa(state, payload, opts) {
  opts = opts || {};
  var makeId = opts.uid || function (p) { return p + '_' + Math.random().toString(36).slice(2, 9); };
  function fail(msg) { var e = new Error(msg); e.code = 'bad_import'; throw e; }
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function find(arr, fn) { for (var i = 0; i < arr.length; i++) if (fn(arr[i])) return arr[i]; return null; }
  function idFree(prefix, wanted) {
    var used = {};
    state.months.forEach(function (m) { used[m.id] = 1; m.weeks.forEach(function (w) { used[w.id] = 1; }); });
    return used[wanted] ? makeId(prefix) : wanted;
  }

  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.rows)) fail('Бұл SapaLine деректеріне ұқсамайды: «rows» тізімі жоқ.');
  if (!payload.rows.length || payload.rows.length > 10000) fail('Сабақтар тізімі бос немесе тым үлкен.');
  // The site has one subject: physics. Another subject's page (maths, geometry, …) is refused, so its numbers
  // can never land among the physics teachers.
  var subj = norm(payload.subject);
  var codes = payload.rows.map(function (r) { return norm(r && r.agym); }).join(' ');
  var subject = /^(phys|physics|fiz|fizika|физика)$/.test(subj) || /phys|fiz|физ/.test(subj) ? 'phys' : null;
  if (!subject && !subj && /физ/.test(codes)) subject = 'phys';
  if (!subject) fail(subj || /мат|геом/.test(codes)
    ? 'Бұл физика деректері емес' + (subj ? ' (' + subj + ')' : '') + '. SapaLine-да Live Sabaq → Физика бетін ашып, қайта көшіріңіз.'
    : 'Пән анықталмады: SapaLine-да Live Sabaq → Физика бетін ашып көшіріңіз.');
  var pm = /^\s*(\d+)\s*[-–—]\s*АЙ\s*(\d+)\s*[-–—]\s*АПТА\s*$/i.exec(String(payload.period || ''));
  if (!pm) fail('Апта анықталмады: кезең «3-АЙ 4-АПТА» түрінде болуы керек.');
  var monN = +pm[1], weekN = +pm[2];
  if (monN < 1 || monN > 120 || weekN < 1 || weekN > 12) fail('Ай немесе апта нөмірі дұрыс емес.');
  var period = monN + '-АЙ ' + weekN + '-АПТА';
  var lineName = String(payload.line || 'smart').trim().toUpperCase() || 'SMART';
  var report = { subject: subject, period: period, created: [], added: [], missing: [], attendanceMissing: [], retained: [], lines: [], lessons: 0, updated: 0, duplicates: 0 };


  // Validate the complete export before creating anything. An unreadable survey is not a zero.
  var seen = Object.create(null), usable = [];
  payload.rows.forEach(function (r, index) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) fail('Сабақ жолы дұрыс емес: ' + (index + 1));
    var name = String(r.teacher || '').replace(/\s+/g, ' ').trim();
    var code = String(r.agym || '').replace(/\s+/g, ' ').trim();
    var label = [r.date, r.time, name || '?'].filter(Boolean).join(' ');
    if (!name || !code) fail('Мұғалім немесе ағым жоқ: ' + label);
    var survey = r.survey, counts = null;
    if (survey && survey.err || !survey && sapaNumber(r.like, true) != null) fail('Сауалнама оқылмаған: ' + label + '. SapaLine-нан қайта көшіріңіз.');
    if (survey) {
      counts = {};
      ['liked', 'avg', 'disliked'].forEach(function (k) {
        var n = sapaNumber(survey[k]);
        if (n == null) fail('Сауалнама саны дұрыс емес (' + k + '): ' + label);
        counts[k] = n;
      });
      if (counts.liked + counts.avg + counts.disliked === 0) counts = null;
    }
    var present = sapaNumber(r.present), total = sapaNumber(r.total);
    if (present == null) present = sapaNumber(survey && survey.present);
    if (total == null) total = sapaNumber(survey && survey.total);
    if (present != null && total != null && present > total) fail('Қатысты саны жалпы саннан артық: ' + label);
    var weighted = present != null && total > 0;
    var att = weighted ? 100 * present / total : sapaNumber(r.att != null ? r.att : r.attendancePct, true);
    var key = r.num != null && String(r.num).trim() !== '' ? 'num:' + r.num : r.date && r.time ? [r.date, r.time, norm(name), norm(code), norm(r.potok)].join('|') : null;
    var signature = JSON.stringify([name, code, r.date, r.time, counts, present, total, att]);
    if (key && seen[key]) {
      if (seen[key] !== signature) fail('Бір сабақтың екі түрлі жолы бар: ' + label);
      report.duplicates += 1; return;
    }
    if (key) seen[key] = signature;
    if (!counts) report.missing.push(label);
    if (att == null) report.attendanceMissing.push(label);
    if (counts || att != null) usable.push({ row: r, name: name, code: code, counts: counts, present: present, total: total, weighted: weighted, att: att });
  });
  if (!usable.length) fail('Ұнату немесе қатысым деректері бар сабақ табылмады.');

  // month + week
  var month = find(state.months, function (m) { return norm(m.label) === norm(monN + '-АЙ'); });
  if (!month) {
    var prev = state.months[state.months.length - 1];
    month = { id: idFree('m', 'm_' + monN), label: monN + '-АЙ', weeks: [], assignments: [] };
    if (prev) month.assignments = prev.assignments.map(function (a) { return { id: makeId('a'), teacherId: a.teacherId, subject: a.subject, streamId: a.streamId, line: a.line || 'SMART' }; });
    state.months.push(month);
    report.created.push('ай ' + month.label + (prev ? ' (тізім ' + prev.label + ' айынан көшірілді)' : ''));
  }
  var week = find(month.weeks, function (w) { return norm(w.label) === norm(weekN + '-АПТА'); });
  if (!week) {
    week = { id: idFree('w', 'w_' + monN + '_' + weekN), label: weekN + '-АПТА', published: false };
    month.weeks.push(week);
    month.weeks.sort(function (a, b) { var x = /(\d+)/.exec(a.label), y = /(\d+)/.exec(b.label); return (x ? +x[1] : 99) - (y ? +y[1] : 99); });
    report.created.push('апта ' + period);
  }
  report.weekId = week.id; report.monthId = month.id;

  // lookups
  // a teacher is found by the SapaLine name, the full name, or its first two words in either order
  // (SapaLine sometimes writes "Қуаныш Нұрдәулет" for "Нұрдәулет Қуаныш")
  function swapKey(n) { return norm(n).split(' ').slice(0, 2).sort().join(' '); }
  var byName = Object.create(null), bySwap = Object.create(null);
  state.teachers.forEach(function (t) {
    [t.sapa, t.full].forEach(function (n) { if (n) { byName[norm(n)] = t; if (!bySwap[swapKey(n)]) bySwap[swapKey(n)] = t; } });
    var two = String(t.full || '').trim().split(/\s+/).slice(0, 2).join(' ');
    if (two && !byName[norm(two)]) byName[norm(two)] = t;
  });
  var byCode = Object.create(null);
  state.streams.forEach(function (s) { if (s.code) byCode[norm(s.code)] = s; });

  var acc = {}, order = [], dates = {};
  usable.forEach(function (item) {
    var r = item.row, name = item.name, code = item.code, counts = item.counts;
    var t = byName[norm(name)] || bySwap[swapKey(name)];
    if (!t) {
      var parts = name.split(' '), given = parts.length > 1 ? parts[1] : parts[0];
      var female = /(қызы|кызы|ова|ева|ина|ская)$/i.test(parts[0]);
      t = { id: makeId('t'), full: name, display: given + (female ? ' апай' : ' ағай'), sapa: name };
      state.teachers.push(t); byName[norm(name)] = t; bySwap[swapKey(name)] = t;
      report.added.push('мұғалім ' + name + ' → «' + t.display + '» (атын, фотосын тексеріңіз)');
    } else if (!t.sapa) {
      t.sapa = name;
    }
    var st = byCode[norm(code)];
    if (!st) {
      st = { id: makeId('s'), code: code, name: '' };
      state.streams.push(st); byCode[norm(code)] = st;
      report.added.push('поток ' + code);
    }
    var a = find(month.assignments, function (x) { return x.teacherId === t.id && x.subject === subject && x.streamId === st.id && String(x.line || 'SMART').toUpperCase() === lineName; });
    if (!a) {
      a = { id: makeId('a'), teacherId: t.id, subject: subject, streamId: st.id, line: lineName };
      month.assignments.push(a);
      report.added.push(month.label + ': ' + t.display + ' · ' + st.code);
    }
    if (!acc[a.id]) { acc[a.id] = { liked: 0, avg: 0, disliked: 0, lessons: 0, present: 0, total: 0, attSum: 0, attendanceLessons: 0, countedLessons: 0 }; order.push(a.id); dates[a.id] = {}; }
    var c = acc[a.id];
    if (counts) { c.liked += counts.liked; c.avg += counts.avg; c.disliked += counts.disliked; c.lessons += 1; report.lessons += 1; }
    if (item.att != null) {
      c.attSum += item.att; c.attendanceLessons += 1;
      if (item.weighted) { c.present += item.present; c.total += item.total; c.countedLessons += 1; }
    }
    if (r.date) dates[a.id][r.date] = 1;
  });

  if (!state.results[week.id]) state.results[week.id] = {};
  var res = state.results[week.id];
  // An absent export row must never erase an existing result (filtered/incomplete exports are possible).
  month.assignments.forEach(function (a) {
    if (a.subject === subject && String(a.line || 'SMART').toUpperCase() === lineName && res[a.id] && !acc[a.id]) report.retained.push(a.id);
  });
  function dkey(d) { var m = /^(\d{1,2})\.(\d{1,2})/.exec(d); return m ? (+m[2]) * 100 + (+m[1]) : 9999; }
  order.forEach(function (id) {
    var c = acc[id], before = res[id] || {};
    var ds = Object.keys(dates[id]).sort(function (x, y) { return dkey(x) - dkey(y); });
    var result = { notes: before.notes || [], src: 'SapaLine · ' + period + (ds.length ? ' · ' + ds.join(', ') : '') };
    ['liked', 'avg', 'disliked', 'lessons', 'pct'].forEach(function (key) {
      if (c.lessons && key !== 'pct') result[key] = c[key];
      else if (!c.lessons && before[key] != null) result[key] = before[key];
    });
    if (c.attendanceLessons) {
      result.attendanceLessons = c.attendanceLessons;
      result.attendanceMode = c.countedLessons === c.attendanceLessons ? 'weighted' : 'average';
      result.attendancePct = result.attendanceMode === 'weighted' ? 100 * c.present / c.total : c.attSum / c.attendanceLessons;
      if (result.attendanceMode === 'weighted') { result.present = c.present; result.total = c.total; }
    } else {
      ['present', 'total', 'attendancePct', 'attendanceLessons', 'attendanceMode'].forEach(function (key) { if (before[key] != null) result[key] = before[key]; });
    }
    res[id] = result;
    var a = find(month.assignments, function (x) { return x.id === id; });
    var t = find(state.teachers, function (x) { return x.id === a.teacherId; });
    var st = find(state.streams, function (x) { return x.id === a.streamId; });
    var T = c.liked + c.avg + c.disliked;
    report.lines.push({ code: st ? st.code : '', name: t ? t.display : '', liked: c.liked, avg: c.avg, disliked: c.disliked, lessons: c.lessons, pct: T ? 100 * c.liked / T : null, attendancePct: attendanceOf(result), attendanceLessons: result.attendanceLessons || 0, attendanceMode: result.attendanceMode });
  });
  if (!Object.keys(res).length) delete state.results[week.id];
  report.updated = order.length;
  if (opts.publish && order.length) week.published = true;
  report.published = !!week.published;
  return report;
}
