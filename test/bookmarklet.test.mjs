// DOM fixtures reflect the table/cards and survey controls used by the existing Sapaline integration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('src/bookmarklet.js', 'utf8');
const visible = { offsetWidth: 100, offsetHeight: 20, getClientRects: () => [{}] };
async function extract({ path = '/live-sabaq/smart/physics', copyMode = 'legacy', mobile = false, hidden = false, periodChanges = false, like = '80%', att = '80,5%', empty = false, headers = ['№', 'Күні', 'Уақыты', 'Мұғалім', 'Поток', 'Ағым', 'Ұнау   %', 'Қатысым %'] } = {}) {
  let dialog = null;
  const values = ['1', '12.10.2026', '10:00', 'Сейітов Дәулет', '11', 'ФИЗ-11', like, att];
  const handlers = {}, calls = { selected: 0, clipboard: 0, legacy: 0, downloaded: 0, stopped: 0, prevented: 0 };
  const status = { textContent: '' }, textarea = { value: '', focus() {}, select() { calls.selected++; }, setSelectionRange() {} };
  const box = { innerHTML: '', isConnected: true, setAttribute() {}, querySelector: s => s === '#juz40-json' ? textarea : status, addEventListener(type, fn, capture) { handlers[type] = fn; if (type === 'click') assert.equal(capture, true); }, remove() { this.isConnected = false; } };
  const link = { click() { calls.downloaded++; }, remove() {} };
  const inputValues = { 'Ұнады': '80', 'Орташа': '15', 'Ұнамады': '5', 'Жалпы': '100', 'Қатысты': '80', 'Опрос өтті': '90' };
  const button = { innerText: like, getAttribute: () => null, disabled: false, scrollIntoView() {}, click() {
    const close = { innerText: 'Close', getAttribute: () => 'Close', click() { dialog = null; } };
    dialog = { ...visible, querySelector(selector) { const label = selector.match(/aria-label="([^"]+)"/)?.[1]; return label && label in inputValues ? { value: inputValues[label] } : null; }, querySelectorAll: () => [close] };
    if (periodChanges) body.innerText = 'Live Sabaq · 4-АЙ 2-АПТА';
  } };
  const cells = values.map((v, i) => ({ innerText: v, querySelector: selector => i === 6 && selector.startsWith('button') ? button : null }));
  const tr = { ...(hidden ? { offsetWidth: 0, offsetHeight: 0, getClientRects: () => [] } : visible), children: cells };
  const table = { ...visible, querySelectorAll: selector => selector === 'thead th' ? headers.map(innerText => ({ innerText })) : empty ? [] : [tr] };
  const fields = headers.slice(1).map((h, i) => {
    const el = { children: [], textContent: h };
    el.parentElement = { querySelector: selector => i === 5 && selector.startsWith('button') ? button : selector.startsWith('input') ? { value: values[i + 1] } : null, innerText: h + '\n' + values[i + 1] };
    return el;
  });
  const card = { ...visible, innerText: '№ 1', querySelectorAll: () => fields };
  const body = { innerText: 'Live Sabaq · 4–АЙ 1–АПТА', appendChild() {} };
  const document = { body, hidden: false, activeElement: null, getElementById: () => null, createElement: tag => tag === 'a' ? link : box, execCommand() { calls.legacy++; if (copyMode === 'throwAll') throw new Error('blocked'); return copyMode === 'legacy'; }, querySelectorAll(selector) {
    if (selector === 'table') return mobile ? [] : [table];
    if (selector === '[role=dialog]') return dialog ? [dialog] : [];
    if (selector === '.row-cards > div.rounded-xl') return empty ? [] : [card];
    return [];
  }, dispatchEvent() {} };
  const ctx = vm.createContext({ document, window: {}, location: { hostname: 'sapaline.app', pathname: path, href: 'https://sapaline.app' + path }, navigator: copyMode === 'unavailable' ? {} : { clipboard: { writeText(text) { calls.clipboard++; assert.equal(text, textarea.value); if (copyMode === 'throwAll') throw new Error('blocked'); return copyMode === 'async' ? Promise.resolve() : Promise.reject(new Error('denied')); } } }, Blob, URL: { createObjectURL: () => 'blob:test-export', revokeObjectURL() {} }, setTimeout: fn => fn(), KeyboardEvent: class {}, console });
  await vm.runInContext(source, ctx);
  const raw = box.innerHTML.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)?.[1];
  textarea.value = raw ? raw.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '';
  return { html: box.innerHTML, payload: raw ? JSON.parse(textarea.value) : null, busy: ctx.window.__juz40busy, status, textarea, calls, link,
    async click(action) {
      const control = { textContent: 'Көшіру', getAttribute: () => action };
      handlers.click({ target: { closest: () => control }, stopPropagation() { calls.stopped++; }, preventDefault() { calls.prevented++; } });
      await Promise.resolve(); await Promise.resolve(); return control;
    }
  };
}
for (const mobile of [false, true]) {
  const out = await extract({ mobile });
  assert.equal(out.payload.v, 2); assert.equal(out.payload.period, '4-АЙ 1-АПТА');
  assert.equal(out.payload.subject, 'physics'); assert.equal(out.payload.rows.length, 1);
  assert.equal(out.payload.rows[0].survey.present, '80'); assert.equal(out.payload.rows[0].survey.total, '100');
  assert.equal(out.payload.rows[0].att, '80,5%'); assert.equal(out.busy, false);
}
const attendanceOnly = await extract({ like: '—', att: '0%' });
assert.equal(attendanceOnly.payload.rows[0].survey, null); assert.equal(attendanceOnly.payload.rows[0].att, '0%');
assert.equal((await extract({ empty: true })).payload, null);
assert.equal((await extract({ hidden: true })).payload, null);
for (const path of ['/live-sabaq/smart/math', '/live-sabaq/junior/geometry']) { const other = await extract({ path }); assert.equal(other.payload, null); assert.match(other.html, /физика емес/); }
assert.equal((await extract({ path: '/live-sabaq/smart/fizika' })).payload.subject, 'physics');
const changed = await extract({ periodChanges: true }); assert.equal(changed.payload, null); assert.match(changed.html, /апта өзгерді/);
const columns = await extract({ headers: ['№', 'Күні', 'Уақыты', 'Teacher', 'Поток', 'Ағым', 'Ұнау %', 'Қатысым %'] });
assert.equal(columns.payload, null); assert.match(columns.html, /Кесте бағандары өзгерген/);
console.log('✓ Sapaline table/card extraction, counts, attendance-only export and changed-page guards');

// Exercise the actual copy-button event handler, including denial and synchronous API throws.
for (const copyMode of ['legacy', 'async', 'denied', 'unavailable', 'throwAll']) {
  const out = await extract({ copyMode }); const button = await out.click('copy');
  assert.equal(out.calls.legacy, 1); assert.equal(out.calls.stopped, 1); assert.equal(out.calls.prevented, 1);
  if (['legacy', 'async'].includes(copyMode)) {
    assert.equal(button.textContent, 'Көшірілді ✓'); assert.match(out.status.textContent, /Деректер көшірілді/);
  } else {
    assert.equal(button.textContent, 'Қайта көшіру'); assert.match(out.status.textContent, /Ctrl\+C/); assert.match(out.status.textContent, /JSON жүктеу/);
  }
  if (copyMode === 'legacy') assert.equal(out.calls.clipboard, 0, 'synchronous success needs no permission prompt');
  await out.click('select'); assert.match(out.status.textContent, /Мәтін белгіленді/);
  await out.click('download'); assert.equal(out.calls.downloaded, 1);
  assert.equal(out.link.download, 'sapaline-physics-smart-m4-w1.json'); assert.match(out.status.textContent, /JSON жүктелді/);
}
const appContext = vm.createContext({});
const appSource = fs.readFileSync('src/app.js', 'utf8');
vm.runInContext(appSource.slice(appSource.indexOf('function readImportFile('), appSource.indexOf('function onAdminChange(')), appContext);
const exported = (await extract()).textarea.value;
assert.equal(await appContext.readImportFile({ size: exported.length, text: () => Promise.resolve(exported) }), exported);
await assert.rejects(appContext.readImportFile({ size: 2000001 }), /тым үлкен/);
await assert.rejects(appContext.readImportFile({ size: 1, text: () => Promise.resolve('{') }), /жарамды JSON жоқ/);
await assert.rejects(appContext.readImportFile({ size: 2, text: () => Promise.resolve('{}') }), /экспортына ұқсамайды/);
console.log('✓ Copy buttons, blocked clipboard fallbacks, JSON download and file import');

// Dispatch a file-selection change through the registered modal handler (the modal is outside #admin).
const events = {}, importText = { value: 'unchanged', isConnected: true }, importError = { textContent: 'old' };
const nodes = {
  '#admin': { addEventListener() {} },
  '#modal': { addEventListener(type, fn) { events[type] = fn; } },
  '#imText': importText, '#imErr': importError
};
const ui = vm.createContext({ $: selector => nodes[selector], toast() {}, onAdminClick() {}, onAdminInput() {} });
vm.runInContext(appSource.slice(appSource.indexOf('function readImportFile('), appSource.indexOf('function fileToPhoto(')), ui);
vm.runInContext(appSource.slice(appSource.indexOf("var adminEl = $('#admin');"), appSource.indexOf("document.addEventListener('keydown'", appSource.indexOf("var adminEl = $('#admin');"))), ui);
assert.equal(typeof events.change, 'function', 'file selection must reach the modal listener');
events.change({ target: { matches: selector => selector === 'input[type=file][data-import-file]', files: [{ size: exported.length, text: () => Promise.resolve(exported) }] } });
for (let i = 0; i < 5; i++) await Promise.resolve();
assert.equal(importText.value, exported); assert.equal(importError.textContent, '');
events.change({ target: { matches: selector => selector === 'input[type=file][data-import-file]', files: [{ size: 1, text: () => Promise.resolve('{') }] } });
for (let i = 0; i < 5; i++) await Promise.resolve();
assert.equal(importText.value, exported, 'a bad file cannot erase valid import text'); assert.match(importError.textContent, /жарамды JSON жоқ/);
console.log('✓ JSON-file change event reaches the import modal without changing saved results');
