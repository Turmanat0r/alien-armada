// api/room.js
//
// Server-authoritative room state for Alien Armada, backed by a Redis store
// (Upstash, via a Vercel Storage/Marketplace integration).
//
// Two properties this file exists to guarantee:
//
//   1. A player's fleet never reaches the opponent's browser. Ships and mines
//      live in hashes the client cannot read; the client asks this function to
//      resolve a shot and only ever learns hit/miss, plus the cells of a ship
//      once it is already sunk. Previously both boards were shipped to both
//      clients and devtools was an instant win.
//
//   2. Concurrent writes cannot clobber each other. Every mutable structure is
//      a Redis HASH keyed by player id, and a player only ever writes its own
//      field, so there is no read-modify-write cycle to lose. Note that ships
//      and mines are deliberately in SEPARATE hashes: you plant mines on your
//      opponent's board, so a single hash would have both players writing the
//      same field and would reintroduce exactly the race this avoids.
//
// Access control is still "knows the room code". That is the right level for a
// game you share by link, but it is not per-user auth -- do not reuse this
// pattern for anything that needs real identity.

const N = 10;
const FLEET = [
  { name: 'Mothership', size: 5 },
  { name: 'Bio-Cruiser', size: 4 },
  { name: 'Void Scout', size: 3 },
  { name: 'Spore Pod', size: 3 },
  { name: 'Probe Drone', size: 2 },
];
const MAX_CHARGES = 4;
const MAX_SEATS = 2;
const ROOM_RE = /^[A-Za-z0-9_-]{4,64}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const ROOM_TTL_SECONDS = 60 * 60 * 12;
const MAX_BODY_BYTES = 256 * 1024;
const STALE_MS = 30000; // opponent considered unresponsive after this

// ---------------------------------------------------------------- redis ----

function env(...names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  return null;
}

async function redisRaw(body) {
  const base = env('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
  if (!base || !token) throw new Error('KV store is not configured (missing env vars)');
  return { base, token, body };
}

async function redisCmd(...args) {
  const { base, token } = await redisRaw();
  const res = await fetch(base, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`redis ${args[0]} failed: HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

/**
 * Runs several commands in one round trip via Upstash's /pipeline endpoint.
 * Falls back to sequential single commands if pipelining is unavailable, so a
 * storage integration without it degrades in latency rather than breaking.
 */
async function redisPipe(commands) {
  if (!commands.length) return [];
  try {
    const { base, token } = await redisRaw();
    const res = await fetch(base.replace(/\/$/, '') + '/pipeline', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('unexpected pipeline response');
    return json.map(r => {
      if (r && r.error) throw new Error(r.error);
      return r ? r.result : null;
    });
  } catch (e) {
    const out = [];
    for (const c of commands) out.push(await redisCmd(...c));
    return out;
  }
}

const K = (room, part) => `room:${room}:${part}`;
const PARTS = ['created', 'seats', 'players', 'meta', 'ships', 'charges', 'shots', 'ready'];

function touch(room) {
  return PARTS.map(p => ['EXPIRE', K(room, p), String(ROOM_TTL_SECONDS)]);
}

/** Upstash returns hashes as either a flat [k,v,...] array or an object. */
function asHash(raw) {
  const out = {};
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i += 2) out[raw[i]] = raw[i + 1];
  } else if (typeof raw === 'object') {
    Object.assign(out, raw);
  }
  return out;
}

function parseHash(raw, fallback) {
  const h = asHash(raw);
  const out = {};
  for (const k of Object.keys(h)) {
    try { out[k] = JSON.parse(h[k]); } catch (e) { out[k] = fallback; }
  }
  return out;
}

// ----------------------------------------------------------- game rules ----

const key = (x, y) => x + ',' + y;

/** Recomputes fleet damage. A mine counts as one free hit on any ship it overlaps. */
function resolveFleet(ships, charges, shots) {
  const hit = new Set((shots || []).filter(s => s.result === 'hit').map(s => key(s.x, s.y)));
  const mine = new Set((charges || []).map(c => key(c[0], c[1])));
  return (ships || []).map(ship => {
    const damaged = ship.cells.filter(([x, y]) => hit.has(key(x, y)) || mine.has(key(x, y)));
    return { ...ship, hitCount: damaged.length, sunk: damaged.length === ship.cells.length };
  });
}

/** Rejects a fleet the client should never have been able to build. */
function validateFleet(ships) {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return 'fleet must have 5 ships';
  const seen = new Set();
  for (const tmpl of FLEET) {
    const ship = ships.find(s => s && s.name === tmpl.name);
    if (!ship) return `missing ${tmpl.name}`;
    if (!Array.isArray(ship.cells) || ship.cells.length !== tmpl.size) {
      return `${tmpl.name} must occupy ${tmpl.size} cells`;
    }
    for (const c of ship.cells) {
      if (!Array.isArray(c) || c.length !== 2) return 'malformed cell';
      const [x, y] = c;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= N || y < 0 || y >= N) {
        return `${tmpl.name} is off the board`;
      }
      if (seen.has(key(x, y))) return 'ships overlap';
      seen.add(key(x, y));
    }
    const xs = ship.cells.map(c => c[0]), ys = ship.cells.map(c => c[1]);
    const straight = new Set(xs).size === 1 || new Set(ys).size === 1;
    const span = Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) + 1;
    if (!straight || span !== tmpl.size) return `${tmpl.name} must be straight and contiguous`;
  }
  return null;
}

function validateCharges(charges) {
  if (!Array.isArray(charges) || charges.length !== MAX_CHARGES) {
    return `must place exactly ${MAX_CHARGES} mines`;
  }
  const seen = new Set();
  for (const c of charges) {
    if (!Array.isArray(c) || c.length !== 2) return 'malformed mine';
    const [x, y] = c;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= N || y < 0 || y >= N) {
      return 'mine is off the board';
    }
    if (seen.has(key(x, y))) return 'duplicate mine';
    seen.add(key(x, y));
  }
  return null;
}

// -------------------------------------------------------------- helpers ----

function bodyToString(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

function readBody(req) {
  const text = bodyToString(req);
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new HttpError(413, 'payload too large');
  if (!text) return {};
  try { return JSON.parse(text); } catch (e) { throw new HttpError(400, 'body must be JSON'); }
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function randomRoomCode() {
  return (Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)).toUpperCase();
}

const newRoundId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

/** Loads everything needed to answer for one player. */
async function loadRoom(room) {
  const [created, players, meta, ships, charges, shots, ready] = await redisPipe([
    ['GET', K(room, 'created')],
    ['HGETALL', K(room, 'players')],
    ['GET', K(room, 'meta')],
    ['HGETALL', K(room, 'ships')],
    ['HGETALL', K(room, 'charges')],
    ['HGETALL', K(room, 'shots')],
    ['HGETALL', K(room, 'ready')],
  ]);
  if (!created) throw new HttpError(404, 'no such battle');
  let parsedMeta = null;
  if (meta) { try { parsedMeta = JSON.parse(meta); } catch (e) { parsedMeta = null; } }
  return {
    players: parseHash(players, null),
    meta: parsedMeta,
    ships: parseHash(ships, []),
    charges: parseHash(charges, []),
    shots: parseHash(shots, []),
    ready: parseHash(ready, {}),
  };
}

/**
 * The only shape that ever reaches a browser. `me` gets their own fleet and
 * the mine damage already showing on it; the opponent's fleet is reduced to
 * shots taken and ships already sunk.
 */
function viewFor(state, me) {
  const ids = Object.keys(state.players);
  const oppId = ids.find(id => id !== me) || null;

  const myFleet = resolveFleet(state.ships[me], state.charges[me], state.shots[me]);
  const mineCells = new Set((state.charges[me] || []).map(c => key(c[0], c[1])));
  const oppFleet = oppId
    ? resolveFleet(state.ships[oppId], state.charges[oppId], state.shots[oppId])
    : [];

  const now = Date.now();
  return {
    players: ids.map(id => {
      const p = state.players[id] || {};
      return {
        id,
        name: p.name || 'Commander',
        commander: p.commander || 'zog',
        score: p.score || 0,
        stale: id !== me && !!p.seen && now - p.seen > STALE_MS,
      };
    }),
    meta: state.meta,
    ready: state.ready,
    self: {
      // Own ships, with the mine damage that is already visible on them.
      ships: myFleet.map(s => ({
        name: s.name, size: s.size, cells: s.cells, hitCount: s.hitCount, sunk: s.sunk,
        mineCells: s.cells.filter(([x, y]) => mineCells.has(key(x, y))),
      })),
      shotsAgainst: state.shots[me] || [],
    },
    enemy: {
      // No cells for ships still afloat -- that is the whole point.
      shotsAgainst: oppId ? (state.shots[oppId] || []) : [],
      fleet: oppFleet.map(s => (s.sunk
        ? { name: s.name, size: s.size, sunk: true, cells: s.cells }
        : { name: s.name, size: s.size, sunk: false })),
    },
  };
}

// --------------------------------------------------------------- actions ----

async function actionCreate(res) {
  let code = randomRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!(await redisCmd('GET', K(code, 'created')))) break;
    code = randomRoomCode();
  }
  await redisPipe([
    ['SET', K(code, 'created'), String(Date.now()), 'EX', String(ROOM_TTL_SECONDS)],
    ['SET', K(code, 'seats'), '0', 'EX', String(ROOM_TTL_SECONDS)],
  ]);
  res.status(200).json({ room: code });
}

async function actionJoin(room, me, body, res) {
  if (!(await redisCmd('GET', K(room, 'created')))) throw new HttpError(404, 'no such battle');

  const existing = await redisCmd('HGET', K(room, 'players'), me);
  if (!existing) {
    // INCR is atomic, so two simultaneous joiners cannot both take the last seat.
    const seat = Number(await redisCmd('INCR', K(room, 'seats')));
    if (seat > MAX_SEATS) {
      await redisCmd('DECR', K(room, 'seats'));
      throw new HttpError(409, 'that battle already has 2 commanders');
    }
  }
  const name = String(body.name || '').slice(0, 16) || 'Commander';
  const commander = ID_RE.test(body.commander || '') ? body.commander : 'zog';
  const prev = existing ? JSON.parse(existing) : {};
  await redisCmd('HSET', K(room, 'players'), me,
    JSON.stringify({ ...prev, id: me, name, commander, score: prev.score || 0, seen: Date.now() }));
  await redisPipe(touch(room));

  res.status(200).json(viewFor(await loadRoom(room), me));
}

async function actionSnapshot(room, me, res) {
  // Doubles as the presence heartbeat.
  const raw = await redisCmd('HGET', K(room, 'players'), me);
  if (raw) {
    try {
      await redisCmd('HSET', K(room, 'players'), me,
        JSON.stringify({ ...JSON.parse(raw), seen: Date.now() }));
    } catch (e) { /* a malformed record should not break polling */ }
  }
  res.status(200).json(viewFor(await loadRoom(room), me));
}

async function actionStart(room, me, res) {
  const state = await loadRoom(room);
  if (!state.players[me]) throw new HttpError(403, 'not in this battle');
  if (Object.keys(state.players).length < MAX_SEATS) throw new HttpError(409, 'need a second commander');
  if (state.meta && state.meta.phase) { res.status(200).json(viewFor(state, me)); return; }

  await redisCmd('SET', K(room, 'meta'), JSON.stringify({
    phase: 'setup', roundId: newRoundId(), turnPlayerId: null, winnerId: null, turnCount: 0,
  }), 'EX', String(ROOM_TTL_SECONDS));
  await redisPipe(touch(room));
  res.status(200).json(viewFor(await loadRoom(room), me));
}

async function actionDeploy(room, me, body, res) {
  const state = await loadRoom(room);
  if (!state.players[me]) throw new HttpError(403, 'not in this battle');
  if (!state.meta || state.meta.phase !== 'setup') throw new HttpError(409, 'not in the deployment phase');

  const oppId = Object.keys(state.players).find(id => id !== me);
  if (!oppId) throw new HttpError(409, 'need a second commander');

  const fleetError = validateFleet(body.ships);
  if (fleetError) throw new HttpError(400, fleetError);
  const chargeError = validateCharges(body.charges);
  if (chargeError) throw new HttpError(400, chargeError);

  const ships = body.ships.map(s => ({
    name: s.name,
    size: s.cells.length,
    cells: s.cells.map(c => [c[0], c[1]]),
  }));
  const charges = body.charges.map(c => [c[0], c[1]]);

  // Own fleet, and the mines this player planted on the opponent. Separate
  // hashes, so the two players never contend for the same field.
  await redisPipe([
    ['HSET', K(room, 'ships'), me, JSON.stringify(ships)],
    ['HSET', K(room, 'charges'), oppId, JSON.stringify(charges)],
    ['HSET', K(room, 'ready'), me, JSON.stringify({ charges: true, fleet: true })],
    ['HSETNX', K(room, 'shots'), me, '[]'],
    ['HSETNX', K(room, 'shots'), oppId, '[]'],
    ...touch(room),
  ]);

  // Once both are ready, the first player listed takes the opening turn.
  const after = await loadRoom(room);
  const ids = Object.keys(after.players);
  const bothReady = ids.length === MAX_SEATS && ids.every(id => after.ready[id] && after.ready[id].fleet);
  if (bothReady && after.meta && after.meta.phase === 'setup') {
    await redisCmd('SET', K(room, 'meta'), JSON.stringify({
      ...after.meta, phase: 'battle', turnPlayerId: ids[0], winnerId: null, turnCount: 0,
    }), 'EX', String(ROOM_TTL_SECONDS));
  }
  res.status(200).json(viewFor(await loadRoom(room), me));
}

async function actionFire(room, me, body, res) {
  const state = await loadRoom(room);
  if (!state.players[me]) throw new HttpError(403, 'not in this battle');
  const meta = state.meta;
  if (!meta || meta.phase !== 'battle') throw new HttpError(409, 'no battle in progress');
  if (meta.turnPlayerId !== me) throw new HttpError(409, 'not your turn');

  const oppId = Object.keys(state.players).find(id => id !== me);
  if (!oppId) throw new HttpError(409, 'no opponent');

  const x = body.x, y = body.y;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= N || y < 0 || y >= N) {
    throw new HttpError(400, 'shot is off the board');
  }
  const shots = state.shots[oppId] || [];
  if (shots.some(s => s.x === x && s.y === y)) throw new HttpError(409, 'already fired there');

  const ships = state.ships[oppId] || [];
  const charges = state.charges[oppId] || [];
  const before = resolveFleet(ships, charges, shots);
  const isHit = ships.some(sh => sh.cells.some(([sx, sy]) => sx === x && sy === y));

  const shot = { x, y, result: isHit ? 'hit' : 'miss', at: Date.now() };
  const next = shots.concat([shot]);
  const after = resolveFleet(ships, charges, next);

  // Shots carry their own consequences so the client never recomputes -- and
  // a ship's cells are only ever revealed at the moment it goes down.
  const destroyed = after.find(s => s.sunk && !before.some(b => b.name === s.name && b.sunk));
  if (destroyed) shot.sunk = { name: destroyed.name, cells: destroyed.cells };
  const allSunk = after.length === FLEET.length && after.every(s => s.sunk);
  shot.final = allSunk;

  const writes = [['HSET', K(room, 'shots'), oppId, JSON.stringify(shots.concat([shot]))]];
  const newMeta = {
    ...meta,
    phase: allSunk ? 'gameOver' : 'battle',
    turnPlayerId: allSunk ? null : oppId,
    winnerId: allSunk ? me : null,
    turnCount: (meta.turnCount || 0) + 1,
  };
  writes.push(['SET', K(room, 'meta'), JSON.stringify(newMeta), 'EX', String(ROOM_TTL_SECONDS)]);
  if (allSunk) {
    const winner = state.players[me] || {};
    writes.push(['HSET', K(room, 'players'), me,
      JSON.stringify({ ...winner, score: (winner.score || 0) + 1 })]);
  }
  await redisPipe(writes.concat(touch(room)));

  res.status(200).json({ shot, ...viewFor(await loadRoom(room), me) });
}

async function actionRematch(room, me, res) {
  const state = await loadRoom(room);
  if (!state.players[me]) throw new HttpError(403, 'not in this battle');
  await redisPipe([
    ['DEL', K(room, 'ships')],
    ['DEL', K(room, 'charges')],
    ['DEL', K(room, 'shots')],
    ['DEL', K(room, 'ready')],
    ['SET', K(room, 'meta'), JSON.stringify({
      phase: 'setup', roundId: newRoundId(), turnPlayerId: null, winnerId: null, turnCount: 0,
    }), 'EX', String(ROOM_TTL_SECONDS)],
    ...touch(room),
  ]);
  res.status(200).json(viewFor(await loadRoom(room), me));
}

// --------------------------------------------------------------- handler ----

module.exports = async (req, res) => {
  try {
    const action = req.query.action;

    if (req.method === 'POST' && action === 'create') return await actionCreate(res);

    const room = req.query.room;
    const me = req.query.me;
    if (!ROOM_RE.test(room || '')) throw new HttpError(400, 'invalid room code');
    if (!ID_RE.test(me || '')) throw new HttpError(400, 'invalid player id');

    if (req.method === 'GET' && action === 'snapshot') return await actionSnapshot(room, me, res);
    if (req.method === 'POST') {
      const body = readBody(req);
      if (action === 'join') return await actionJoin(room, me, body, res);
      if (action === 'start') return await actionStart(room, me, res);
      if (action === 'deploy') return await actionDeploy(room, me, body, res);
      if (action === 'fire') return await actionFire(room, me, body, res);
      if (action === 'rematch') return await actionRematch(room, me, res);
    }
    throw new HttpError(400, 'unknown action');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 502;
    res.status(status).json({ error: e.message || 'upstream error' });
  }
};
