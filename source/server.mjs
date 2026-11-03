import {constrainLiteProfile, validLiteRun} from './src/lite-rules.js';
// PokéBonk — local server.
// Serves editable client code and local assets without upstream fallback.
// Implements the client's HTTP API against a local JSON store.
import http from 'node:http';
import { applyAction as applyProfileAction, refreshTasks, rerollTask, settleRun, claimEvent } from './local/progression.mjs';
import { Zn as medalFor } from './src/config.js';
import { writeFileSync, mkdirSync, renameSync, copyFileSync } from 'node:fs';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  now, token, newProfile, newAccount, hashPassword, checkPassword,
  SEASON, EVENTS, seasonPayload, boardFor, json, body,
} from './firebase/shared.mjs';

const PORT = Number(process.env.PORT || 18086);
const ROOT = path.resolve(import.meta.dirname, 'public');
const DATA = path.resolve(process.env.STORE_DIR || path.join(import.meta.dirname, 'lite-data'));
const SOURCE_ROOT = path.resolve(import.meta.dirname, 'src');
const NET_ROOT = path.resolve(import.meta.dirname, 'net');
const FIREBASE_ROOT = path.resolve(import.meta.dirname, 'firebase');

// --firebase (or FIREBASE=true) routes /api through the stateless Firebase
// backend (Firebase Auth + Firestore + RTDB) instead of the JSON store.
const firebaseMatch = null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// ---------------------------------------------------------------- store ----

const STORE = path.join(DATA, 'store.json');
let store = { accounts: {}, runs: {}, nextRun: 1 };
try { store = JSON.parse(await readFile(STORE, 'utf8')); } catch(e) {
  if(e.code !== 'ENOENT') {
    try { store=JSON.parse(await readFile(STORE+'.bak','utf8'));console.warn('Recovered store.json from backup.'); }
    catch { throw Error('Save file is damaged. Restore a backup before starting; existing files were preserved.'); }
  }
}
// Social collections (friends/presence/rooms/invites). Created lazily so old
// store files keep loading; persisted with the rest of the store.
store.friends ||= {};   // key `uidA_uidB` -> edge
store.pres ||= {};      // uid -> { at, room, play }
store.rooms ||= {};     // code -> room
store.invites ||= {};   // `${to}|${from}` -> invite
store.clans ||= {};     // clanId -> clan document (see firebase/clans.mjs)
store.coopRooms ||= {};  // CODE -> co-op room (signals, chat, members)
store.coopInvites ||= {}; // id -> room invite
store.coopParties ||= {}; // party -> seed (one world per party)
for(const a of Object.values(store.accounts))constrainLiteProfile(a.profile);
function persist() {
  for(const a of Object.values(store.accounts))constrainLiteProfile(a.profile);
  mkdirSync(DATA, {recursive:true});
  const tmp=STORE+'.tmp';
  writeFileSync(tmp, JSON.stringify(store));
  if(existsSync(STORE)) copyFileSync(STORE, STORE+'.bak');
  renameSync(tmp, STORE);
}

function accountByToken(req) {
  const auth = req.headers.authorization || '';
  const t = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!t) return null;
  return Object.values(store.accounts).find((a) => a.token === t) || null;
}

function accountByName(name) {
  const k = String(name || '').toLowerCase();
  return Object.values(store.accounts).find((a) => a.name.toLowerCase() === k) || null;
}

// ------------------------------------------------------------ season cfg ---
// (SEASON, EVENTS, seasonPayload are imported from ./firebase/shared.mjs)

// ------------------------------------------------------------------ api ----
// (json, body are imported from ./firebase/shared.mjs)

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

// --- status / meta
route('GET', '/status', () => ({
  maintenance: { on: false, title: '', message: '', eta: 0 },
  bypass: false, season: seasonPayload(), events: EVENTS,
  registration: { inviteOnly: false },
}));

route('GET', '/news', () => []);
route('GET', '/version.json', () => ({ build: 'local', version: '0.0.0' }));

// --- auth
route('POST', '/auth/guest', async (req, res) => {
  const acc = newAccount(`Guest ${crypto.randomBytes(2).toString('hex').toUpperCase()}`, true);
  store.accounts[acc.id] = acc;
  persist();
  json(res, 200, { id: acc.id, name: acc.name, token: acc.token, guest: true });
});

route('GET', '/auth/me', (req, res) => {
  const acc = accountByToken(req);
  if (!acc) return json(res, 401, { error: 'Invalid session.' });
  acc.lastSeen = now();
  json(res, 200, { id: acc.id, name: acc.name, guest: acc.guest, created: acc.created });
});

route('GET', '/auth/name', (req, res, url) => {
  const name = url.searchParams.get('name') || '';
  json(res, 200, { ok: name.length >= 3 && name.length <= 16 && !accountByName(name), name });
});

route('POST', '/auth/register', async (req, res) => {
  const b = await body(req) || {};
  if (!b.name || !b.password) return json(res, 400, { error: 'Missing data.' });
  if (accountByName(b.name)) return json(res, 409, { error: 'That name is already in use.' });
  const acc = newAccount(b.name, false);
  acc.password = await hashPassword(b.password);
  store.accounts[acc.id] = acc;
  persist();
  json(res, 200, { id: acc.id, name: acc.name, token: acc.token, guest: false });
});

route('POST', '/auth/login', async (req, res) => {
  const b = await body(req) || {};
  const acc = accountByName(b.name);
  if (!acc || !(await checkPassword(b.password, acc.password))) {
    return json(res, 401, { error: 'Incorrect username or password.' });
  }
  acc.token = token();
  acc.lastSeen = now();
  persist();
  json(res, 200, { id: acc.id, name: acc.name, token: acc.token, guest: false });
});

route('POST', '/auth/logout', (req, res) => json(res, 204, undefined));

route('POST', '/auth/upgrade', async (req, res) => {
  const acc = accountByToken(req);
  if (!acc) return json(res, 401, { error: 'Invalid session.' });
  const b = await body(req) || {};
  if (accountByName(b.name)) return json(res, 409, { error: 'That name is already in use.' });
  acc.name = b.name;
  acc.guest = false;
  acc.password = await hashPassword(b.password);
  acc.profile.name = b.name;
  persist();
  json(res, 200, { id: acc.id, name: acc.name, token: acc.token, guest: false });
});

// --- profile
const requireAccount = (req, res) => {
  const acc = accountByToken(req);
  if (!acc) json(res, 401, { error: 'Invalid session.' });
  return acc;
};

route('GET', '/profile', (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  refreshTasks(acc.profile, now());
  json(res, 200, { profile: acc.profile, now: now() });
});

route('PUT', '/profile/prefs', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  const p = acc.profile;
  if (b.settings && typeof b.settings === 'object') p.settings = { ...p.settings, ...b.settings };
  for (const k of ['lastSpecies', 'lastBiome', 'avatar', 'frame', 'title', 'skins', 'team']) {
    if (b[k] !== undefined) p[k] = b[k];
  }
  persist();
  json(res, 204, undefined);
});

route('POST', '/profile/starter', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  const p = acc.profile;
  const id = Number(b.id);
  if(p.starter && p.starter !== id)return json(res,409,{error:'Starter already chosen.'});
  if (![1, 4, 7].includes(id)) return json(res, 400, { error: 'Invalid starter.' });
  p.starter = id;
  p.lastSpecies = id;
  if (!p.league.includes(id)) p.league.push(id);
  if (!p.unlocked.includes(id)) p.unlocked.push(id);
  persist();
  json(res, 200, { profile: p });
});

route('POST', '/lab/buy', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  const p = acc.profile;
  applyProfileAction(p, { k: 'lab', id: b.id });
  persist();
  json(res, 200, { profile: p });
});

route('POST', '/items/buy', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  const p = acc.profile;
  applyProfileAction(p, { k: 'item', key: b.key });
  persist();
  json(res, 200, { profile: p });
});

route('POST', '/items/archive', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  const p = acc.profile;
  applyProfileAction(p, { k: 'archive', key: b.key, off: b.off });
  persist();
  json(res, 200, { profile: p });
});

route('POST', '/quests/claim', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  const p = acc.profile;
  applyProfileAction(p, { k: 'quest', id: b.id });
  persist();
  json(res, 200, { profile: p });
});

route('POST', '/tasks/claim', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  const p = acc.profile;
  applyProfileAction(p, { k: 'task', period: b.period, slot: b.slot });
  persist();
  json(res, 200, { profile: p });
});

// Batched profile mutations. The 0.8.29 client always has `backend.actions`, so
// lab/item/archive/quest/task go through here and never call the routes above.
route('POST', '/profile/actions', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  const list = Array.isArray(b.actions) ? b.actions.slice(0, 64) : [];
  let applied = 0;
  for (const a of list) if (applyProfileAction(acc.profile, a)) applied++;
  persist();
  json(res, 200, { profile: acc.profile, applied });
});

route('POST', '/tasks/reroll', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b=await body(req)||{};
  rerollTask(acc.profile,b.period,b.slot,now());
  persist();
  json(res, 200, { profile: acc.profile });
});

route('GET', '/records', (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  json(res, 200, []);
});
route('GET', '/records/endless', (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  json(res, 200, []);
});

// --- boards
route('GET', '/leaderboard', (req, res, url) => {
  json(res, 200, boardFor(
    Object.values(store.accounts),
    url.searchParams.get('mode') || 'kills',
    url.searchParams.get('season') || 'week',
    Number(url.searchParams.get('limit') || 50),
    url,
    accountByToken(req),
  ));
});
route('GET', '/leaderboard/pokemon', () => ({ entries: [] }));
route('GET', '/seasons/awards', (req, res) => json(res, 200, []));
route('POST', '/seasons/claim', (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  json(res, 200, { profile: acc.profile });
});

// --- events
route('GET', '/events/:id', (req, res, url, params) => {
  const ev = EVENTS.find((e) => e.id === params.id);
  if (!ev) return json(res, 404, { error: 'Event not found.' });
  const acc=accountByToken(req);
  json(res, 200, { event: ev, profile:acc?.profile, board:{entries:[],me:null,players:0}, clans:{entries:[],me:null,players:0,clans:0} });
});
route('POST', '/events/:id/track', async (req, res, url, params) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b=await body(req)||{};
  claimEvent(acc.profile,params.id,'track',b.step);
  persist();
  json(res, 200, { profile: acc.profile });
});
route('POST', '/events/:id/quest', async (req, res, url, params) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b=await body(req)||{};
  claimEvent(acc.profile,params.id,'quest',b.quest);
  persist();
  json(res, 200, { profile: acc.profile });
});

// --- players
route('GET', '/players', (req, res, url) => {
  const id = url.searchParams.get('id');
  const name = url.searchParams.get('name');
  const acc = id ? store.accounts[id] : accountByName(name);
  if (!acc) return json(res, 404, { error: 'Player not found.' });
  json(res, 200, {
    id: acc.id, name: acc.name, created: acc.created,
    species: acc.profile.lastSpecies, avatar: acc.profile.avatar,
    frame: acc.profile.frame, title: acc.profile.title, skins: acc.profile.skins,
    league: acc.profile.league, kills: {}, records: [], runs: [],
  });
});
// `/players/search` (name search, excluding yourself) is registered by the shared
// social route table below, so both backends answer identically.
route('POST', '/players/:id/report', (req, res) => json(res, 204, undefined));

// --- runs
route('POST', '/runs', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  if(!validLiteRun(b))return json(res,400,{error:'Forest Lite supports three partners, forest, and single-player classic mode only.'});
  const id = `run-${store.nextRun++}`;
  // Co-op: the seed belongs to the party so every member builds the same world.
  let seed;
  if (b.party) {
    const key = String(b.party);
    if (store.coopParties[key] === undefined) store.coopParties[key] = crypto.randomInt(1, 2 ** 31);
    seed = store.coopParties[key];
  } else {
    seed = b.seed ?? crypto.randomInt(1, 2 ** 31);
  }
  const boosts=[...new Set(Array.isArray(b.boosts)?b.boosts:[])].filter(k=>(acc.profile.bag[k]??0)>0);
  for(const k of boosts){acc.profile.bag[k]--;if(!acc.profile.bag[k])delete acc.profile.bag[k];}
  store.runs[id] = { id, account: acc.id, cfg: b, seed, started: now() };
  persist();
  json(res, 200, { id, seed, party: b.party ?? null, ranked: true, boosts });
});

route('GET', '/runs/:id/build', (req, res, url, params) => {
  const run = store.runs[params.id];
  if (!run) return json(res, 404, { error: 'Run not found.' });
  json(res, 200, { run: run.cfg, seed: run.seed });
});

route('POST', '/runs/:id/checkpoint', async (req, res, url, params) => {
  const run = store.runs[params.id];
  if (!run) return json(res, 404, { error: 'Run not found.' });
  const b = await body(req) || {};
  run.cps = (run.cps || []).concat(b.cps || []).slice(-600);
  json(res, 204, undefined);
});

route('POST', '/runs/:id/finish', async (req, res, url, params) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  const result = b.result || {};
  const p = acc.profile;
  const run = store.runs[params.id];
  if (!run || run.account !== acc.id) return json(res,404,{error:'Run not found.'});
  if(run.response)return json(res,200,{...run.response,profile:p});
  if(!validLiteRun(result) || result.species!==run.cfg.species || result.biome!==run.cfg.biome || (result.tier??0)!==(run.cfg.tier??0))return json(res,400,{error:'Result does not match this forest run.'});
  run.finished=now();
  const recordKey=result.biome+'-'+(result.tier??0);
  const prevKills=p.kills[recordKey]??null;
  const prevBest=p.times[recordKey]?.time??null;
  const medal=(!result.mode||['standard','classic'].includes(result.mode)) ? medalFor(result.biome,result.tier??0,result.time,!!result.victory) : 0;
  p.medals[recordKey]=Math.max(p.medals[recordKey]??0,medal);

  const entry = {
    ...result, id: params.id, date: now(), season: SEASON.n,
    score: result.kills || 0, ranked: false, medal,
  };
  p.runs = [entry, ...(p.runs || [])].slice(0, 50);
  const stardust = settleRun(p,result);
  persist();

  run.response = {
    record: entry,
    ranked: false,
    guest: !!acc.guest,
    review: false,
    stardust,
    ends: SEASON.end,
    rewards: { stardust },
    kills: null,
    pb: !!result.victory && (prevBest===null || result.time<prevBest),
    prevBest,
    prevKills,
    weekPb: false,
    killsPb: prevKills===null || result.kills>prevKills,
    medal,
    medalDust: 0,
    mon: null,
  };
  persist();
  json(res,200,{...run.response,profile:p});
});

// --- social (single-player stubs that still satisfy the client contract)
route('GET', '/mail', (req, res) => json(res, 200, []));
route('POST', '/mail/read', (req, res) => json(res, 204, undefined));
route('POST', '/mail/:id/answer', (req, res) => json(res, 204, undefined));
route('POST', '/mail/:id/claim', (req, res) => json(res, 204, undefined));

route('GET', '/clans/board', (req, res) => json(res, 200, { entries: [], info: seasonPayload() }));
route('POST', '/clans/claim', (req, res) => json(res, 400, { error: 'Clans are not available in local mode.' }));
route('POST', '/clans/expand', (req, res) => json(res, 400, { error: 'Clans are not available in local mode.' }));

route('POST', '/feedback', (req, res) => json(res, 204, undefined));

route('POST', '/account/rename', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  const b = await body(req) || {};
  if (accountByName(b.name)) return json(res, 409, { error: 'That name is already in use.' });
  acc.name = b.name;
  acc.profile.name = b.name;
  persist();
  json(res, 200, { name: acc.name });
});
route('GET', '/account/rename', (req, res) => json(res, 200, { wait: 0 }));
route('POST', '/account/reset', async (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  acc.profile = newProfile(acc.name);
  persist();
  json(res, 200, { ok: true });
});
route('POST', '/account/delete', (req, res) => {
  const acc = requireAccount(req, res);
  if (!acc) return;
  delete store.accounts[acc.id];
  persist();
  json(res, 200, { ok: true });
});

function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    if (r.pattern === pathname) return { handler: r.handler, params: {} };
    if (!r.pattern.includes(':')) continue;
    const a = r.pattern.split('/');
    const b = pathname.split('/');
    if (a.length !== b.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
      else if (a[i] !== b[i]) { ok = false; break; }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

async function sendFile(res, file, patch) {
  const st = await stat(file);
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'content-length': patch ? patch.length : st.size,
    'cache-control': 'no-cache',
  });
  if (patch) res.end(patch);
  else createReadStream(file).pipe(res);
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  rel = rel.replace(/^(?:assets\/)+assets\//, 'assets/').replace(/^(?:data\/)+data\//, 'data/');
  if (rel === '') rel = 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';

  const base = rel.startsWith('src/') ? SOURCE_ROOT : ROOT;
  const relative = rel.startsWith('src/') ? rel.slice(4) : rel;
  let file = path.resolve(base, relative);
  const inside = file.startsWith(base + path.sep);
  if(!inside){res.writeHead(403);return res.end('Forbidden');}
  const override = path.resolve(ROOT,'overrides',rel);
  if(override.startsWith(path.join(ROOT,'overrides')+path.sep)&&existsSync(override))file=override;
  let buf = null;

  if (inside && existsSync(file)) {
    const ext = path.extname(file);
    if (ext === '.html' && rel === 'index.html') {
      let src = await readFile(file, 'utf8');
      const before = src;
      src = src.replace(/<script[^>]*static\.cloudflareinsights\.com[\s\S]*?<\/script>/g, '');
      if (src !== before) return sendFile(res, file, Buffer.from(src));
    }
    return sendFile(res, file);
  }
  if (!path.extname(rel)) return sendFile(res, path.join(ROOT, 'index.html'));
  console.warn('[missing-local-asset]', rel);
  res.writeHead(404, {'content-type':'text/plain'});
  return res.end('Not found');
}

// Standalone loopback-only HTTP server.

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob: data:; img-src 'self' data: blob:; media-src 'self' data: blob:; worker-src 'self' blob:;");
  if(url.pathname==='/api/coop/access')return json(res,200,{show:false,play:false});
  if(/^\/(?:signaling|net)(?:\/|$)/.test(url.pathname)||/^\/api\/(?:coop|friends|rooms|invites|clans|mail|events|seasons|leaderboard)(?:\/|$)/.test(url.pathname))return json(res,404,{error:'Not included in Forest Lite.'});
  if(url.pathname==='/local/health')return json(res,200,{name:'pokebonk-forest-lite',version:'0.8.34',offline:true});

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    });
    return res.end();
  }

  if (url.pathname.startsWith('/api/')) {
    const apiPath = url.pathname.slice(4) || '/';
    const m = firebaseMatch ? firebaseMatch(req.method, apiPath) : matchRoute(req.method, apiPath);
    if (!m) return json(res, 404, { error: 'Not found.' });
    try {
      const out = await m.handler(req, res, url, m.params);
      if (out !== undefined && !res.writableEnded) json(res, 200, out);
      return;
    } catch (e) {
      console.error(`${req.method} ${url.pathname}`, e);
      return json(res, 500, { error: 'Internal local server error.' });
    }
  }

  try {
    return await serveStatic(req, res, url.pathname);
  } catch (e) {
    console.error('static', url.pathname, e);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Internal error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PokéBonk local → http://127.0.0.1:${PORT}/`);
});
