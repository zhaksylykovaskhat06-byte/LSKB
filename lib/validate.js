// Checks and normalises what the admin panel saves, so the stored document always has the shape the
// page expects (and nothing else): unknown fields are dropped, texts and lists are capped.
import { httpError } from './http.js';
import { migrateState } from './migrations.js';

const ID = /^[A-Za-z0-9_-]{1,48}$/;
const PHOTO_URL = /^(\/photos\/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)|\/api\/photo\?p=photos\/[A-Za-z0-9_-]{1,80}\.(jpg|png|webp))$/;
const SUBJECTS = ['phys'];

const bad = (msg) => httpError(400, 'Деректер дұрыс емес: ' + msg, 'invalid');
const str = (v, max) => (v == null ? '' : String(v)).slice(0, max);
const count = (v) => {
  if (v === '' || v == null) return '';
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 10_000_000) : '';
};
const pct = (v) => {
  if (v === '' || v == null) return '';
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : '';
};
function list(v, max, what) {
  if (!Array.isArray(v)) throw bad(`«${what}» тізім болуы керек`);
  if (v.length > max) throw bad(`«${what}» тым көп (${v.length} > ${max})`);
  return v;
}
function id(v, what) {
  if (typeof v !== 'string' || !ID.test(v)) throw bad(`${what} идентификаторы дұрыс емес`);
  return v;
}
function unique(items, what) {
  const seen = new Set();
  for (const x of items) {
    if (seen.has(x.id)) throw bad(`${what} идентификаторы қайталанады (${x.id})`);
    seen.add(x.id);
  }
  return seen;
}

export function validateState(st) {
  if (!st || typeof st !== 'object' || Array.isArray(st)) throw bad('state жоқ');
  if (st._public) throw bad('бет толық жүктелмеген. Бетті жаңартып, қайта кіріңіз');
  const subjects = {};
  for (const k of SUBJECTS) {
    const s = (st.subjects && st.subjects[k]) || {};
    subjects[k] = { name: str(s.name, 60), short: str(s.short, 20), eyebrow: str(s.eyebrow, 160), title: str(s.title, 160), lede: str(s.lede, 800), footer: str(s.footer, 80) };
  }
  const o = st.outro || {};
  const outro = { eyebrow: str(o.eyebrow, 160), title: str(o.title, 200), text: str(o.text, 1500), ack: str(o.ack, 60), ackDone: str(o.ackDone, 300) };

  const streams = list(st.streams, 300, 'streams').map((s) => ({ id: id(s && s.id, 'Поток'), code: str(s.code, 40), name: str(s.name, 160) }));
  const teachers = list(st.teachers, 500, 'teachers').map((t) => {
    const x = { id: id(t && t.id, 'Мұғалім'), full: str(t.full, 200), display: str(t.display, 100) };
    if (t.sapa) x.sapa = str(t.sapa, 200);
    return x;
  });
  const streamIds = unique(streams, 'Поток');
  const teacherIds = unique(teachers, 'Мұғалім');

  const months = list(st.months, 120, 'months').map((m) => ({
    id: id(m && m.id, 'Ай'),
    label: str(m.label, 40),
    weeks: list(m.weeks, 12, 'weeks').map((w) => ({ id: id(w && w.id, 'Апта'), label: str(w.label, 40), published: w.published === true })),
    assignments: list(m.assignments, 400, 'assignments').map((a) => ({
      id: id(a && a.id, 'Бөлу'),
      teacherId: a.teacherId && teacherIds.has(a.teacherId) ? a.teacherId : '',
      subject: SUBJECTS.includes(a.subject) ? a.subject : 'phys',
      streamId: a.streamId && streamIds.has(a.streamId) ? a.streamId : '',
      line: str(a.line || 'SMART', 30),
    })),
  }));
  unique(months, 'Ай');
  const weeks = months.flatMap((m) => m.weeks);
  const weekIds = unique(weeks, 'Апта');
  unique(months.flatMap((m) => m.assignments), 'Бөлу');

  const results = {};
  const raw = st.results && typeof st.results === 'object' ? st.results : {};
  for (const [wk, rows] of Object.entries(raw)) {
    if (!weekIds.has(wk) || !rows || typeof rows !== 'object') continue;
    const out = {};
    for (const [aid, r] of Object.entries(rows).slice(0, 400)) {
      if (!ID.test(aid) || !r || typeof r !== 'object') continue;
      const x = { liked: count(r.liked), avg: count(r.avg), disliked: count(r.disliked), lessons: count(r.lessons) };
      x.notes = Array.isArray(r.notes) ? r.notes.slice(0, 40).map((n) => str(n, 800).trim()).filter(Boolean) : [];
      if (r.pct !== undefined) x.pct = pct(r.pct);
      for (const key of ['present', 'total', 'attendanceLessons']) if (r[key] !== undefined) x[key] = count(r[key]);
      if (r.attendancePct !== undefined) x.attendancePct = pct(r.attendancePct);
      if (['weighted', 'average'].includes(r.attendanceMode)) x.attendanceMode = r.attendanceMode;
      if (x.present !== '' && x.present != null && x.total !== '' && x.total != null && x.present > x.total) throw bad('Қатысты саны жалпы саннан артық');
      if (r.src) x.src = str(r.src, 300);
      out[aid] = x;
    }
    if (Object.keys(out).length) results[wk] = out;
  }

  const state = { v: 1, rev: 0, saveId: '', updatedAt: '', subjects, outro, streams, teachers, months, results };
  if (JSON.stringify(state).length > 2_000_000) throw bad('деректер тым үлкен');
  return migrateState(state);
}

export function validatePhotos(photos, state) {
  const out = {};
  if (photos == null) return out;
  if (typeof photos !== 'object' || Array.isArray(photos)) throw bad('photos');
  const ids = new Set(state.teachers.map((t) => t.id));
  for (const [tid, url] of Object.entries(photos)) {
    if (!ids.has(tid) || url == null || url === '') continue;
    if (typeof url !== 'string' || !PHOTO_URL.test(url)) throw bad(`фото мекенжайы (${tid}). Фотоны қайта жүктеңіз`);
    out[tid] = url;
  }
  return out;
}

/** What visitors get: only the weeks that are switched on ("Сайтта"); drafts stay on the server. */
export function publicView(data) {
  const st = data.state;
  const months = st.months.map((m) => ({ ...m, weeks: m.weeks.filter((w) => w.published) }));
  const live = new Set(months.flatMap((m) => m.weeks.map((w) => w.id)));
  const results = {};
  for (const [wk, rows] of Object.entries(st.results || {})) if (live.has(wk)) results[wk] = rows;
  return { state: { ...st, months, results, _public: true }, photos: data.photos || {} };
}
