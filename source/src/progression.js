// Pure rules extracted from the published v0.8.34 client.
import { c as e, d as t, i as n, n as r, o as i, r as a, s as o, t as s, u as c } from "./i18n.js";
import {
  $ as l,
  $n as u,
  $t as d,
  A as f,
  An as p,
  Ar as m,
  At as h,
  B as g,
  Bn as _,
  Br as v,
  Bt as y,
  C as b,
  Cn as x,
  Cr as S,
  Ct as C,
  D as w,
  Dn as T,
  Dr as E,
  Dt as ee,
  E as D,
  En as O,
  Er as te,
  Et as ne,
  F as re,
  Fn as ie,
  Fr as ae,
  Ft as oe,
  G as se,
  Gn as ce,
  Gt as le,
  H as ue,
  Hn as de,
  Hr as fe,
  Ht as pe,
  I as me,
  In as he,
  Ir as ge,
  It as _e,
  J as ve,
  Jn as ye,
  Jt as be,
  K as xe,
  Kn as Se,
  L as Ce,
  Ln as we,
  Lr as Te,
  Lt as Ee,
  M as De,
  Mn as Oe,
  Mr as ke,
  Mt as Ae,
  N as je,
  Nn as Me,
  Nr as Ne,
  Nt as Pe,
  O as Fe,
  On as Ie,
  Or as Le,
  Ot as Re,
  P as ze,
  Pn as Be,
  Pr as Ve,
  Pt as He,
  Q as Ue,
  Qn as We,
  Qt as Ge,
  R as Ke,
  Rn as qe,
  Rr as Je,
  Rt as Ye,
  S as Xe,
  Sr as Ze,
  St as Qe,
  T as $e,
  Tn as et,
  Tr as tt,
  Tt as nt,
  U as rt,
  Un as it,
  Ur as at,
  Ut as ot,
  V as st,
  Vn as ct,
  Vr as lt,
  Vt as ut,
  W as dt,
  Wn as ft,
  Wt as pt,
  X as mt,
  Xn as ht,
  Xt as gt,
  Y as _t,
  Yn as vt,
  Yt as yt,
  Z as bt,
  Zn as xt,
  Zt as St,
  _ as Ct,
  _n as wt,
  _r as Tt,
  _t as Et,
  an as Dt,
  ar as Ot,
  at as kt,
  b as At,
  bn as jt,
  br as Mt,
  bt as Nt,
  cn as Pt,
  cr as Ft,
  ct as It,
  d as Lt,
  dn as Rt,
  dt as zt,
  en as Bt,
  er as Vt,
  et as Ht,
  f as Ut,
  fn as Wt,
  fr as Gt,
  ft as Kt,
  g as qt,
  gn as Jt,
  gr as Yt,
  gt as Xt,
  h as Zt,
  hn as Qt,
  hr as $t,
  ht as en,
  in as tn,
  ir as nn,
  it as rn,
  j as an,
  jn as on,
  jr as sn,
  jt as cn,
  k as ln,
  kn as un,
  kr as dn,
  kt as fn,
  l as pn,
  ln as mn,
  lr as hn,
  lt as gn,
  m as _n,
  mn as vn,
  mr as yn,
  mt as bn,
  n as xn,
  nn as Sn,
  nr as Cn,
  nt as wn,
  on as Tn,
  or as En,
  ot as Dn,
  p as On,
  pn as kn,
  pr as An,
  pt as jn,
  q as Mn,
  qn as Nn,
  qt as Pn,
  rn as Fn,
  rr as In,
  rt as Ln,
  sn as Rn,
  sr as zn,
  st as Bn,
  tn as Vn,
  tr as Hn,
  tt as Un,
  u as Wn,
  un as Gn,
  ur as Kn,
  ut as qn,
  v as Jn,
  vn as Yn,
  vr as Xn,
  vt as Zn,
  w as Qn,
  wn as $n,
  wr as er,
  wt as tr,
  x as nr,
  xn as rr,
  xr as ir,
  xt as ar,
  y as or,
  yn as sr,
  yr as cr,
  yt as lr,
  z as ur,
  zn as dr,
  zr as fr,
  zt as pr,
} from "./config.js";
var bO = [1, 4, 7],
  xO = () => ({ idx: 0, ids: [], prog: [], claimed: [], rerolls: 0 }),
  SO = {
    master: 0.8,
    music: 0.5,
    sfx: 0.7,
    cries: 0.6,
    quality: `high`,
    aimMode: `auto`,
    sensitivity: 1,
    invertY: !1,
    damageNumbers: !0,
    floatText: !0,
    shakeOn: !0,
    screenShake: 1,
    fov: 70,
    showFps: !1,
    reduceFlashes: !1,
    pixel: 0,
    muteHidden: !0,
    hudScale: 1,
    hudOpacity: 1,
    bossBarOpacity: 1,
    showBanners: !0,
    showMinimap: !0,
    showLadder: !0,
    showToasts: !0,
    showStreak: !0,
    showItems: !0,
    mapScale: 1,
    mapIcons: 1,
    mapNorthUp: !1,
    fxOpacity: 1,
    ownFxOpacity: 1,
    fxGlow: 1,
    touchScale: 1,
    camDist: 9,
    calmCandies: !1,
    pickupFx: `full`,
    skipEmptyLevelUp: !1,
    hideOwnFx: !1,
    fixedStick: !1,
    padRumble: !0,
    padDead: 0.15,
    autoUlt: !1,
    ultPose: !0,
    tours: ``,
    hintsSeen: ``,
    tips: !0,
  };
function CO(e) {
  return {
    v: 1,
    name: e,
    created: Date.now(),
    stardust: 0,
    totalStardust: 0,
    unlocked: [],
    league: [],
    starter: 0,
    forms: [],
    research: {},
    captured: {},
    seen: [],
    played: [],
    shinies: [],
    classics: [],
    skins: [],
    team: [],
    lab: {},
    biomes: { forest: 0 },
    quests: {},
    counters: {},
    runs: [],
    best: {},
    times: {},
    kills: {},
    medals: {},
    endless: {},
    settings: { ...SO },
    lastSpecies: 4,
    lastBiome: `forest`,
    banished: [],
    itemsOwned: [],
    itemsOff: [],
    daily: xO(),
    weekly: xO(),
    dailyStreak: { last: 0, n: 0 },
    bag: {},
    avatar: ``,
    frame: ``,
    title: ``,
    cosmetics: [],
  };
}
function wO(e) {
  let t = { ...CO(e.name ?? `Entrenador`), ...e };
  if (
    ((t.settings = { ...SO, ...(e.settings ?? {}) }),
    typeof e.settings?.ownFxOpacity != `number` && (t.settings.ownFxOpacity = t.settings.fxOpacity),
    Array.isArray(t.league) || (t.league = []),
    typeof e.starter != `number`)
  ) {
    t.starter = t.league.find((e) => bO.includes(e)) ?? 1;
    for (let e of bO)
      (t.unlocked.includes(e) || t.unlocked.push(e), t.league.includes(e) || t.league.push(e));
  }
  (Array.isArray(t.shinies) || (t.shinies = []),
    Array.isArray(t.classics) || (t.classics = []),
    Array.isArray(t.team) || (t.team = []),
    Array.isArray(t.played) || (t.played = [...new Set((t.runs ?? []).map((e) => e.species))]),
    Array.isArray(t.skins) || (t.skins = []),
    (!t.times || typeof t.times != `object`) && (t.times = {}),
    (!t.medals || typeof t.medals != `object`) && (t.medals = {}),
    (!t.kills || typeof t.kills != `object`) && (t.kills = {}),
    (!t.endless || typeof t.endless != `object`) && (t.endless = {}));
  for (let e of [`daily`, `weekly`]) {
    let n = t[e];
    (!n ||
      typeof n != `object` ||
      !Array.isArray(n.ids) ||
      !Array.isArray(n.prog) ||
      !Array.isArray(n.claimed)) &&
      (t[e] = xO());
  }
  ((!t.dailyStreak || typeof t.dailyStreak != `object`) && (t.dailyStreak = { last: 0, n: 0 }),
    (!t.bag || typeof t.bag != `object`) && (t.bag = {}),
    Array.isArray(t.cosmetics) || (t.cosmetics = []),
    (!t.events || typeof t.events != `object` || Array.isArray(t.events)) && (t.events = {}),
    Array.isArray(t.itemsOwned) || (t.itemsOwned = []),
    Array.isArray(t.itemsOff) || (t.itemsOff = []),
    typeof t.avatar != `string` && (t.avatar = ``),
    typeof t.frame != `string` && (t.frame = ``),
    typeof t.title != `string` && (t.title = ``),
    (t.biomes = { forest: 0, ...(t.biomes && typeof t.biomes == `object` ? t.biomes : {}) }));
  for (let e = 1; e < fr.length; e++)
    !(fr[e].id in t.biomes) && (t.biomes[fr[e - 1].id] ?? -1) >= 1 && (t.biomes[fr[e].id] = 0);
  return (
    ge(t.lastBiome) || (t.lastBiome = `forest`),
    t.league.length &&
      (!t.league.includes(t.lastSpecies) || !pt.has(t.lastSpecies)) &&
      (t.lastSpecies = t.league.find((e) => pt.has(e)) ?? t.league[0]),
    t
  );
}
var TO = (e) => (e.legendary || e.mythical ? 3 : Math.round(30 + Math.min(70, e.bst / 8))),
  EO = [`rare-candy`, `lucky-egg`, `amulet-coin`];
function DO(e, t, n, r = `add`) {
  let i = e.counters;
  i[t] = r === `add` ? (i[t] ?? 0) + n : Math.max(i[t] ?? 0, n);
}
var OO = [144, 145, 146];
function kO(e, t) {
  return t === `league`
    ? pe(e.league.filter((e) => e !== 151))
    : t === `birds`
      ? OO.filter((t) => e.league.includes(t)).length
      : t.startsWith(`tier_`)
        ? (e.biomes[t.slice(5)] ?? 0)
        : (e.counters[t] ?? 0);
}
function AO(e, t) {
  let n = pt.get(t);
  return n ? ut(n).map((t) => ({ ...t, value: Math.min(t.goal, kO(e, t.counter)) })) : [];
}
function jO(e, t) {
  let n = pt.get(t);
  return n ? ut(n).every((t) => kO(e, t.counter) >= t.goal) : !1;
}
function MO(e, t) {
  if (!Array.isArray(e.seen) || !Array.isArray(e.unlocked) || !e.unlocked.length) return;
  let n = new Set(e.unlocked),
    r = new Set(e.seen);
  for (let i = 1; i <= ae.maxDex; i++) !r.has(i) && t.has(i) && n.has(t.family(i)) && e.seen.push(i);
}
function NO(e, t) {
  let n = Wt.find((e) => e.id === t);
  if (!n) return !1;
  let r = e.lab[t] ?? 0;
  if (r >= n.max) return !1;
  let i = n.cost(r);
  return e.stardust < i ? !1 : ((e.stardust -= i), (e.lab[t] = r + 1), !0);
}
function PO(e, t) {
  let n = vt.get(t);
  return !n || e.itemsOwned.includes(t) || e.stardust < n.price
    ? !1
    : ((e.stardust -= n.price), e.itemsOwned.push(t), !0);
}
function FO(e, t, n, r) {
  if (!r(t)) return !1;
  let i = e.itemsOff.includes(t);
  return n
    ? i || e.itemsOff.length >= on(e.lab) || (vt.has(t) && !e.itemsOwned.includes(t))
      ? !1
      : (e.itemsOff.push(t), !0)
    : i
      ? ((e.itemsOff = e.itemsOff.filter((e) => e !== t)), !0)
      : !1;
}
function IO(e, t) {
  let n = Qt.find((e) => e.id === t);
  return !n || e.quests[n.id] || RO(e, n) < n.goal
    ? !1
    : ((e.quests[n.id] = 1),
      (e.stardust += n.reward),
      (e.totalStardust += n.reward),
      n.title && !e.cosmetics.includes(`title:q:` + n.id) && e.cosmetics.push(`title:q:` + n.id),
      fn(n) && !e.cosmetics.includes(cn(n.look)) && e.cosmetics.push(cn(n.look)),
      !0);
}
for (let e of Qt) e.counter === `@league` && (e.goal = pt.size);
var LO = [`helix`, `dome`, `amber`];
function RO(e, t) {
  let n = Rn.filter((e) => ge(e)),
    r;
  switch (t.counter) {
    case `@hard`:
      r = n.filter((t) => (e.biomes[t] ?? 0) >= 2).length;
      break;
    case `@night`:
      r = n.filter((t) => (e.biomes[t] ?? 0) >= 3).length;
      break;
    case `@champ`:
      r = n.filter((t) => [0, 1, 2].some((n) => (e.medals[t + `-` + n] ?? 0) >= 4)).length;
      break;
    case `@legs`:
      r = n.filter(
        (t) => (e.counters[`leg_` + t] ?? 0) > 0 || (Xn(t) === 4 && (e.biomes[t] ?? 0) >= 1),
      ).length;
      break;
    case `@fossils`:
      r = LO.filter((t) => (e.counters[`fossil_` + t] ?? 0) > 0).length;
      break;
    case `@seen`:
      r = e.seen.filter((e) => Te(e)).length;
      break;
    case `@league`:
      r = pe(e.league);
      break;
    case `@items`:
      r = e.itemsOwned.filter((e) => vt.has(e)).length;
      break;
    default:
      r = fn(t) ? oe(e, t) : (e.counters[t.counter] ?? 0);
  }
  return Math.min(t.goal, r);
}
var zO = [`daily`, `weekly`];
function BO(e, t) {
  for (let n of zO) {
    let r = En(n, t);
    (e[n].idx !== r || e[n].ids.length !== 3) &&
      (e[n] = {
        idx: r,
        ids: [0, 1, 2].map((e) => Mt(n, r, e).id),
        prog: [0, 0, 0],
        claimed: [0, 0, 0, 0],
        rerolls: 0,
      });
  }
}
function VO(e, t, n = 1) {
  e.bag[t] = Math.min(9, (e.bag[t] ?? 0) + n);
}
function HO(e, t, n) {
  let r = e[t];
  if (n < 3) return { dust: O[t][n], items: [] };
  if (t === `weekly`) return { dust: 500, items: S(r.idx) };
  let i = e.dailyStreak,
    a = i.last === r.idx - 1 ? i.n + 1 : i.last === r.idx ? i.n : 1;
  return { dust: 50 * Math.min(5, a), items: [ie(r.idx)] };
}
function UO(e, t, n) {
  let r = e[t];
  if (!Number.isInteger(n) || n < 0 || n > 3 || r.claimed[n]) return !1;
  if (n === 3) return r.claimed[0] === 1 && r.claimed[1] === 1 && r.claimed[2] === 1;
  let i = cr(r.ids[n]);
  return !!i && r.prog[n] >= i.goal;
}
function WO(e, t, n, r) {
  if (!zO.includes(t) || (BO(e, r), !UO(e, t, n))) return !1;
  let i = e[t],
    a = HO(e, t, n);
  ((i.claimed[n] = 1),
    n === 3 &&
      t === `daily` &&
      (e.dailyStreak = { last: i.idx, n: e.dailyStreak.last === i.idx - 1 ? e.dailyStreak.n + 1 : 1 }),
    n < 3 && DO(e, `tasks`, 1));
  for (let t of a.items) VO(e, t);
  return ((e.stardust += a.dust), (e.totalStardust += a.dust), !0);
}
function GO(e, t, n, r) {
  if (!zO.includes(t) || !Number.isInteger(n) || n < 0 || n > 2) return !1;
  BO(e, r);
  let i = e[t],
    a = cr(i.ids[n]);
  if (i.rerolls >= 1 || i.claimed[n] || (a && i.prog[n] >= a.goal)) return !1;
  let o = i.ids[n];
  for (let e = i.rerolls + 1; e < i.rerolls + 8 && i.ids.includes(o); e++) o = Mt(t, i.idx, n, e).id;
  return !i.ids.includes(o) && ((i.ids[n] = o), (i.prog[n] = 0), i.rerolls++, !0);
}

export { CO as createProfile, wO as normalizeProfile, BO as refreshTasks, NO as buyLab, PO as buyItem, FO as archiveItem, IO as claimQuest, RO as questProgress, WO as claimTask, GO as rerollTask, jO as leagueReady };
