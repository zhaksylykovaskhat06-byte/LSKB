// Where the site's data lives.
//
// On Vercel: a PRIVATE Vercel Blob store connected to the project (Vercel then provides BLOB_STORE_ID,
// or BLOB_READ_WRITE_TOKEN for older stores).
//   data/site.json         the whole site (state + photo map); read uncached, written with an ETag check
//                           so two saves can never silently overwrite each other
//   data/history/*.json    a copy of every save (the newest 40 are kept) — a safety net
//   photos/*.jpg           teacher photos uploaded from the admin panel, served by /api/photo
//   data/session-key.json  a random key that signs admin sessions (made on the first login)
// Until the first save the site shows seed/data.json (the data the project was prepared with).
//
// Locally (npm run dev, no Blob variables) the same layout is kept in ./.data on disk.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { httpError } from './http.js';
import { migrateState } from './migrations.js';

const DATA_PATH = 'data/site.json';
const HISTORY_PREFIX = 'data/history/';
const KEEP_HISTORY = 40;
const ROOT = process.cwd();
const SEED_FILE = process.env.JUZ_SEED_FILE || path.join(ROOT, 'seed', 'data.json'); // JUZ_SEED_FILE: test suite only
const LOCAL_DIR = process.env.LOCAL_DATA_DIR || path.join(ROOT, '.data');
export const PHOTO_PATH = /^photos\/[A-Za-z0-9_-]{1,80}\.(jpg|png|webp)$/;

// Vercel adds BLOB_STORE_ID when a store is connected — or <PREFIX>_STORE_ID when a custom
// "Environment Variable Prefix" was typed while connecting (e.g. keribailanys_STORE_ID). Both work:
// a single *_STORE_ID (or *_READ_WRITE_TOKEN) variable is picked up and handed to the SDK.
function blobAuth() {
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) return {};
  const only = (suffix) => {
    const keys = Object.keys(process.env).filter((k) => k.endsWith(suffix) && process.env[k]);
    return keys.length === 1 ? process.env[keys[0]] : null;
  };
  const storeId = only('_STORE_ID');
  if (storeId) return { storeId };
  const token = only('_READ_WRITE_TOKEN');
  if (token) return { token };
  return null;
}
const auth = () => blobAuth() || {};
export const usingBlob = () => blobAuth() !== null;
const onVercel = () => Boolean(process.env.VERCEL);
/** 'blob' — a Blob store is connected; 'missing' — on Vercel without one (saving cannot work); 'local' — npm run dev */
export const storeStatus = () => (usingBlob() ? 'blob' : onVercel() ? 'missing' : 'local');

let blobLib = null;
async function blob() {
  // JUZ_BLOB_MODULE lets the local test suite swap in a fake Blob store; it is never set on Vercel.
  if (!blobLib) blobLib = await import(process.env.JUZ_BLOB_MODULE || '@vercel/blob');
  return blobLib;
}

const noStore = () => httpError(503, 'Деректер қоймасы қосылмаған: Vercel-де Private Blob дүкенін жасап, жобаға қосыңыз (README, 3-қадам), содан кейін Redeploy жасаңыз.', 'no_store');
const conflict = () => httpError(409, 'Сайттың деректері осы уақытта басқа жерден өзгерді.', 'conflict');

function explainBlobError(e) {
  console.error('Vercel Blob:', e);
  if (e && e.status) return e;
  return httpError(502, 'Деректер қоймасына қол жеткізу мүмкін болмады. Blob дүкені «Private» түрінде жасалып, осы жобаға қосылғанын тексеріңіз (README, 3-қадам).', 'blob_error');
}

let memo = null; // { at, value } — a short per-instance cache for public reads
const MEMO_MS = 10_000;

async function readSeed() {
  return JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));
}

/** Returns { data: { state, photos }, etag } — etag is null while nothing has been saved yet.
 *  withEtag: also ask the store for the version tag (head) — the one a conditional save must quote. The tag in
 *  the content response is not used for that: the CDN may hand it out in another form (e.g. a weak W/"…" tag
 *  for a compressed response), and a save quoting it would be refused although nothing changed. */
export async function readData({ fresh = false, withEtag = false } = {}) {
  if (!fresh && !withEtag && memo && Date.now() - memo.at < MEMO_MS) return memo.value;
  let value;
  if (usingBlob()) {
    const { get, head } = await blob();
    let res, meta = null;
    try {
      // the tag first, then the content: if a save lands in between, the next save is refused (safe), never lost
      if (withEtag) meta = await headOrNull(head, DATA_PATH);
      res = await get(DATA_PATH, { access: 'private', useCache: false, ...auth() });
    } catch (e) {
      throw explainBlobError(e);
    }
    if (res && res.statusCode === 200 && res.stream) {
      const data = JSON.parse(await new Response(res.stream).text());
      if (withEtag && !meta) meta = await headOrNull(head, DATA_PATH).catch(() => null);
      value = { data, etag: meta ? meta.etag : null };
    } else {
      value = { data: await readSeed(), etag: null };
    }
  } else {
    const text = await readLocal();
    value = text == null ? { data: await readSeed(), etag: null } : { data: JSON.parse(text), etag: hash(text) };
  }
  migrateState(value.data.state);
  memo = { at: Date.now(), value };
  return value;
}
async function headOrNull(head, pathname) {
  try {
    return await head(pathname, auth());
  } catch (e) {
    if ((e && e.name === 'BlobNotFoundError') || /not.?found|does not exist/i.test(String(e && e.message))) return null;
    throw e;
  }
}

/** Saves the document only if it is still the version with this etag (null: only if nothing is saved yet);
 *  otherwise throws 409. Returns the etag of the new version. */
export async function writeData(data, etag) {
  const body = JSON.stringify(data);
  let newEtag = null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const historyName = `${stamp}-rev${data.state.rev}.json`;
  if (usingBlob()) {
    const { put, head, list, del, BlobPreconditionFailedError } = await blob();
    let saved;
    try {
      saved = await put(DATA_PATH, body, {
        ...auth(),
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
      });
    } catch (e) {
      if ((BlobPreconditionFailedError && e instanceof BlobPreconditionFailedError) || /precondition|already exists/i.test(String(e && e.message))) {
        console.warn('save refused: the stored version is not', etag || '(none)');
        throw conflict();
      }
      throw explainBlobError(e);
    }
    newEtag = (saved && saved.etag) || null;
    if (!newEtag) {
      try {
        const meta = await headOrNull(head, DATA_PATH);
        newEtag = meta ? meta.etag : null;
      } catch {}
    }
    try {
      await put(HISTORY_PREFIX + historyName, body, { access: 'private', contentType: 'application/json', addRandomSuffix: false, ...auth() });
      const { blobs } = await list({ prefix: HISTORY_PREFIX, limit: 1000, ...auth() });
      const old = blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1)).slice(KEEP_HISTORY).map((b) => b.url);
      if (old.length) await del(old, auth());
    } catch (e) {
      console.warn('history copy skipped:', e && e.message);
    }
  } else if (onVercel()) {
    throw noStore();
  } else {
    // one process locally: a queue makes "check, then write" atomic
    await localQueue(async () => {
      const text = await readLocal();
      if ((etag || null) !== (text == null ? null : hash(text))) throw conflict();
      await fs.mkdir(path.join(LOCAL_DIR, 'history'), { recursive: true });
      await fs.writeFile(path.join(LOCAL_DIR, 'site.json'), body);
      await fs.writeFile(path.join(LOCAL_DIR, 'history', historyName), body);
    });
    newEtag = hash(body);
  }
  memo = null;
  return newEtag;
}

const hash = (text) => crypto.createHash('sha1').update(text).digest('hex');
async function readLocal() {
  try {
    return await fs.readFile(path.join(LOCAL_DIR, 'site.json'), 'utf8');
  } catch {
    return null;
  }
}
let queue = Promise.resolve();
function localQueue(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/** The key that signs admin sessions: random, made once and kept privately next to the data. */
const KEY_PATH = 'data/session-key.json';
let sessionKey = null;
export async function readSessionKey() {
  if (sessionKey) return sessionKey;
  const fresh = JSON.stringify({ key: crypto.randomBytes(32).toString('base64url'), createdAt: new Date().toISOString() });
  if (usingBlob()) {
    const { get, put } = await blob();
    const load = async () => {
      const res = await get(KEY_PATH, { access: 'private', useCache: false, ...auth() });
      return res && res.statusCode === 200 && res.stream ? JSON.parse(await new Response(res.stream).text()).key : null;
    };
    try {
      let key = await load();
      if (!key) {
        try {
          await put(KEY_PATH, fresh, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false, ...auth() });
        } catch (e) {
          if (!/already exists/i.test(String(e && e.message))) throw e; // another instance made it first
        }
        key = await load();
      }
      if (!key) throw new Error('session key missing');
      sessionKey = key;
    } catch (e) {
      throw explainBlobError(e);
    }
  } else if (onVercel()) {
    throw noStore();
  } else {
    const file = path.join(LOCAL_DIR, 'session-key.json');
    try {
      sessionKey = JSON.parse(await fs.readFile(file, 'utf8')).key;
    } catch {
      await fs.mkdir(LOCAL_DIR, { recursive: true });
      try {
        await fs.writeFile(file, fresh, { flag: 'wx' });
      } catch {}
      sessionKey = JSON.parse(await fs.readFile(file, 'utf8')).key;
    }
  }
  return sessionKey;
}

/** Stores an uploaded teacher photo and returns the address the page uses for it. */
export async function putPhoto(buffer, contentType, teacherId) {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const name = `photos/${teacherId}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}.${ext}`;
  if (usingBlob()) {
    const { put } = await blob();
    try {
      await put(name, buffer, { access: 'private', contentType, addRandomSuffix: false, cacheControlMaxAge: 31536000, ...auth() });
    } catch (e) {
      throw explainBlobError(e);
    }
  } else if (onVercel()) {
    throw noStore();
  } else {
    await fs.mkdir(path.join(LOCAL_DIR, 'photos'), { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, name), buffer);
  }
  return `/api/photo?p=${name}`;
}

/** Reads an uploaded photo: { body: Buffer, contentType } or null. */
export async function readPhoto(name) {
  if (!PHOTO_PATH.test(name)) return null;
  if (usingBlob()) {
    const { get } = await blob();
    const res = await get(name, { access: 'private', ...auth() });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return { body: Buffer.from(await new Response(res.stream).arrayBuffer()), contentType: res.blob.contentType || 'image/jpeg' };
  }
  if (onVercel()) return null;
  try {
    const body = await fs.readFile(path.join(LOCAL_DIR, name));
    return { body, contentType: name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg' };
  } catch {
    return null;
  }
}
