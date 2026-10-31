// POST /api/aukcion?op=host    — the host screen sends its public game state, gets back the players and their bets
// POST /api/aukcion?op=player  — a phone sends { pid, name, bet? } and gets back the host's current state
// A small in-memory relay for the Smart Friday «Қате аукционы» game (public/aukcion). Nothing here is permanent:
// the host screen keeps the real game state and re-sends it every second, and phones re-send their bet on every
// poll, so a cold start of this function heals itself within a couple of seconds.
import { readBody, send } from '../lib/http.js';

const rooms = globalThis.__aukcionRooms || (globalThis.__aukcionRooms = new Map());
const MAX_PLAYERS = 400;

function room(id) {
  let r = rooms.get(id);
  if (!r) {
    r = { state: null, stateAt: 0, players: new Map() };
    rooms.set(id, r);
  }
  return r;
}
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    const op = new URL(req.url, 'http://local').searchParams.get('op');
    const body = (await readBody(req, 200_000)) || {};
    const id = clean(body.room, 60) || 'default';
    const r = room(id);
    const now = Date.now();

    if (op === 'host') {
      if (body.state && typeof body.state === 'object') {
        r.state = body.state;
        r.stateAt = now;
      }
      if (body.reset) r.players.clear();
      const players = {};
      for (const [pid, p] of r.players) players[pid] = { name: p.name, bet: p.bet, seen: now - p.seen };
      return send(res, 200, { ok: true, players });
    }

    if (op === 'player') {
      const pid = clean(body.pid, 40);
      const name = clean(body.name, 40);
      if (!pid || !name) return send(res, 400, { error: 'pid/name' });
      let p = r.players.get(pid);
      if (!p) {
        if (r.players.size >= MAX_PLAYERS) return send(res, 429, { error: 'full' });
        p = { name, bet: null, seen: now };
        r.players.set(pid, p);
      }
      p.name = name;
      p.seen = now;
      const b = body.bet;
      if (b && Number.isInteger(b.i) && (b.v === 'yes' || b.v === 'no') && [100, 200, 300].includes(b.stake)) {
        p.bet = { i: b.i, v: b.v, stake: b.stake };
      }
      const fresh = r.state && now - r.stateAt < 20_000;
      return send(res, 200, { ok: true, hostOnline: !!fresh, state: r.state });
    }

    return send(res, 400, { error: 'op' });
  } catch (e) {
    return send(res, e && e.status ? e.status : 500, { error: (e && e.message) || 'error' });
  }
}
