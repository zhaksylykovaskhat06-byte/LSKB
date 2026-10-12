import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validateState, publicView } from '../lib/validate.js';
import { migrateState } from '../lib/migrations.js';

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync('src/merge.js', 'utf8'), ctx);
const seed = JSON.parse(fs.readFileSync('test/fixture-seed.json', 'utf8'));
const cleanSeed = JSON.parse(fs.readFileSync('seed/data.json', 'utf8'));
const state = () => structuredClone(seed.state);
const row = (extra = {}) => ({ num: '1', date: '12.10.2026', time: '10:00', teacher: 'Сейітов Дәулет', agym: 'ФИЗ-21', survey: { liked: 8, avg: 1, disliked: 1, present: 80, total: 100 }, ...extra });
const payload = rows => ({ source: 'sapaline', subject: 'physics', line: 'smart', period: '4-АЙ 1-АПТА', rows });
const merge = (st, rows) => ctx.mergeSapa(st, payload(rows), { publish: true });
const result = (st, rep) => st.results[rep.weekId][st.months.find(m => m.id === rep.monthId).assignments.find(a => a.teacherId === 't_one' && st.streams.find(s => s.id === a.streamId)?.code === 'ФИЗ-21' && a.subject === 'phys' && a.line === 'SMART').id];

// Different class sizes must use summed counts, not an average of percentages.
let st = state();
let rep = merge(st, [row(), row({ num: '2', time: '11:00', survey: { liked: 3, avg: 2, disliked: 0, present: 10, total: 20 } })]);
let r = result(st, rep);
assert.equal(r.present, 90); assert.equal(r.total, 120); assert.equal(ctx.attendanceOf(r), 75);
assert.equal(r.attendanceLessons, 2); assert.equal(r.attendanceMode, 'weighted');
assert.equal(r.liked, 11); assert.equal(rep.lessons, 2);
assert.equal(st.teachers.filter(t => t.id === 't_one').length, 1, 'no duplicate teacher');
r.notes = ['Өте жақсы', '- Ұсыныс'];
const aid = st.months.find(m => m.id === rep.monthId).assignments.find(a => st.results[rep.weekId][a.id] === r).id;
st.results[rep.weekId].a_retained = { liked: 9, avg: 1, disliked: 0, notes: ['keep'], src: 'SapaLine' };
st.months.find(m => m.id === rep.monthId).assignments.push({ id: 'a_retained', teacherId: 't_two', subject: 'phys', streamId: st.streams[0].id, line: 'SMART' });
rep = merge(st, [row(), row()]); r = result(st, rep);
assert.equal(r.present, 80); assert.equal(r.total, 100); assert.equal(r.liked, 8, 'reimport replaces rather than adds');
assert.equal(rep.duplicates, 1); assert.deepEqual([...r.notes], ['Өте жақсы', '- Ұсыныс']);
assert.ok(rep.retained.includes('a_retained')); assert.equal(st.results[rep.weekId].a_retained.liked, 9);
assert.equal(st.results[rep.weekId][aid], r);
// No survey is needed for attendance. Zero attendance is data, not missing.
st = state(); rep = merge(st, [row({ survey: null, att: '0%' }), row({ num: '2', survey: null, att: '60,5 %' })]); r = result(st, rep);
assert.equal(r.attendancePct, 30.25); assert.equal(r.attendanceMode, 'average'); assert.equal(r.liked, undefined);
assert.equal(ctx.attendanceOf(r), 30.25); assert.equal(rep.lessons, 0);
// Mixed availability uses a clearly marked mean of lesson percentages.
st = state(); rep = merge(st, [row(), row({ num: '2', survey: null, att: '50%' })]);
assert.equal(result(st, rep).attendancePct, 65); assert.equal(result(st, rep).total, undefined);
assert.equal(result(st, rep).attendanceMode, 'average');
// Old imports remain usable, without inventing attendance or erasing known attendance.
st = state(); rep = merge(st, [row()]);
rep = merge(st, [row({ survey: { liked: 1, avg: 0, disliked: 0 } })]);
assert.equal(ctx.attendanceOf(result(st, rep)), 80);
// Reversed teacher names find the same identity; SMART and JUNIOR remain separate.
st = state(); rep = merge(st, [row({ teacher: 'Дәулет Сейітов' })]);
const junior = ctx.mergeSapa(st, { ...payload([row()]), line: 'junior' });
assert.equal(Object.keys(st.results[rep.weekId]).length, 2);
assert.equal(junior.updated, 1);
// Broken/empty exports are rejected atomically, preserving existing results and weeks.
for (const rows of [[], [row({ survey: { err: 'no dialog' } })], [row({ survey: null, like: '80%' })], [row({ survey: { liked: '-2', avg: 1, disliked: 0 } })], [row({ agym: '' })], [row({ survey: { liked: 8, avg: 1, disliked: 1, present: 101, total: 100 } })], [row(), row({ survey: { liked: 9, avg: 0, disliked: 0 } })]]) {
  st = state(); const before = JSON.stringify(st);
  assert.throws(() => merge(st, rows), e => e.code === 'bad_import');
  assert.equal(JSON.stringify(st), before);
}
st = state(); rep = merge(st, [row()]);
const saved = validateState(st), stored = saved.results[rep.weekId][Object.keys(st.results[rep.weekId])[0]];
assert.equal(stored.present, 80); assert.equal(stored.total, 100); assert.equal(stored.attendancePct, 80);
assert.equal(stored.attendanceLessons, 1); assert.equal(stored.attendanceMode, 'weighted');
assert.ok(publicView({ state: saved }).state.results[rep.weekId], 'published attendance reaches visitors');
assert.equal(ctx.attendanceOf({ attendancePct: '' }), null);
assert.equal(ctx.attendanceOf({ attendancePct: 0 }), 0);
assert.equal(ctx.attendanceOf({ present: 0, total: 10 }), 0);
assert.equal(JSON.stringify(migrateState(structuredClone(saved))), JSON.stringify(saved), 'migration is a safe no-op');
// Physics only: other subjects are refused before anything changes; a physics stream code is enough.
for (const subject of ['math', 'geometry', 'Математика']) {
  st = state(); const before = JSON.stringify(st);
  assert.throws(() => ctx.mergeSapa(st, { ...payload([row()]), subject }), e => e.code === 'bad_import' && /физика деректері емес/.test(e.message));
  assert.equal(JSON.stringify(st), before);
}
st = state(); assert.throws(() => ctx.mergeSapa(st, { ...payload([row({ agym: 'МАТ-21' })]), subject: '' }), e => e.code === 'bad_import');
for (const subject of ['fizika', 'Физика', '']) { st = state(); assert.equal(ctx.mergeSapa(st, { ...payload([row()]), subject }).subject, 'phys'); }
// The clean seed (no teachers, months or weeks yet) takes a first import and stays valid.
st = structuredClone(cleanSeed.state); rep = merge(st, [row()]);
assert.equal(st.months.length, 1); assert.equal(st.teachers[0].display, 'Дәулет ағай'); assert.equal(st.streams[0].code, 'ФИЗ-21');
assert.equal(validateState(st).months[0].assignments[0].subject, 'phys');
// Public HTML supports attendance-only rows and a clear missing state.
const app = fs.readFileSync('src/app.js', 'utf8');
vm.runInContext(`var num=v=>Math.max(0,parseInt(v,10)||0), clamp=(v,a,b)=>Math.min(b,Math.max(a,v)), esc=s=>String(s??''), fmtInt=String, fmtPct=v=>v==null?'—':String(v), curPhotos=()=>({}), emblemSVG=()=>'', initials=()=>'', isTip=()=>false, stripTip=s=>s;` + app.slice(app.indexOf('function pctOf('), app.indexOf('function codeOf(')) + app.slice(app.indexOf('function votesHTML('), app.indexOf('function outroHTML(')), ctx);
const entry = { a: { subject: 'phys', line: 'SMART' }, t: { id: 't_one', display: 'Дәулет ағай' }, s: { code: 'ФИЗ-21' }, r: { attendancePct: 0 } };
const html = ctx.teacherHTML(saved, entry, 0, '4-АЙ 1-АПТА');
assert.match(html, /Қатысым пайызы/); assert.match(html, /<strong>0%<\/strong>/); assert.ok(!html.includes('NaN'));
assert.match(ctx.attendanceHTML({}), /Дерек әлі енгізілмеген/);
console.log('✓ Import aggregation, safe reimport, attendance, migration and public rendering');
