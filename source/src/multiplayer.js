import {multiplayerConfig} from './multiplayer-config.js';

export function browserSocket(url, events) {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => events.open();
  ws.onmessage = event => events.message(event.data);
  ws.onerror = () => events.error();
  ws.onclose = () => events.close();
  return {
    send(data, disposable = false) {
      if (ws.readyState !== 1) return false;
      if (ws.bufferedAmount > 256 * 1024 && disposable) return false;
      if (ws.bufferedAmount > 1024 * 1024) { ws.close(); return false; }
      ws.send(data); return true;
    },
    close() { ws.close(); },
  };
}

// Implements the room/mesh interface consumed by the existing cooperative
// simulation. Binary snapshots stay binary, including on wx.connectSocket.
export class RelayRoom {
  constructor(url, factory = browserSocket) {
    this.url = url; this.factory = factory; this.ev = {}; this.pending = new Map();
    this.sequence = 0; this.alive = true; this.inRun = false; this.startedSeen = false;
    this.room = {members: [], state: 'lobby'}; this.me = null;
    this.mesh = {
      broadcast: data => this.control('', data),
      sendCtl: (to, data) => this.control(to, data),
      sendSnap: (to, data) => this.snapshot(to, data),
      rtt: () => this.roundTrip || 0,
    };
  }
  static async connect({url = multiplayerConfig.url, code, name, species = 4, factory = browserSocket}) {
    if (!/^wss?:\/\/[^\s]+\/ws$/.test(url)) throw Error('联机服务地址应为 ws://服务器:8787/ws 或 wss://域名/ws');
    const session = new RelayRoom(url, factory);
    try {
      await new Promise((resolve, reject) => {
        session.connectReject = reject;
        session.connectTimer = setTimeout(() => session.end('连接超时：请确认手机能访问服务器，并已开启微信调试模式'), 10000);
        session.socket = factory(url, {
          open() { clearTimeout(session.connectTimer); session.connectReject = null; resolve(); },
          message(data) { session.receive(data); },
          error() { session.end('无法连接联机服务：请检查服务地址、同一内网、防火墙和微信调试模式'); },
          close() { session.end('与联机服务的连接已断开，请返回首页重新组队'); },
        });
      });
      await session.request(code ? 'join' : 'create', {code, name, species, protocol: multiplayerConfig.protocol, build: multiplayerConfig.build});
      session.pongAt = Date.now();
      session.heartbeat = setInterval(() => {
        if (Date.now() - session.pongAt > 45000) session.end('网络连接已超时，请重新组队');
        else { session.pingAt = Date.now(); session.send({op: 'ping'}); }
      }, 10000);
      return session;
    } catch (error) { session.end(error.message, false); throw error; }
  }
  get open() { return this.alive; }
  get code() { return this.room.code; }
  get mine() { return this.room.members.find(member => member.id === this.me); }
  get others() { return this.room.members.filter(member => member.id !== this.me); }
  get isHost() { return this.room.host === this.me; }
  linkState(id) { return this.alive && this.room.members.some(member => member.id === id) ? 'open' : 'closed'; }
  send(message) { return this.alive && this.socket?.send(JSON.stringify(message)); }
  request(op, data = {}) {
    return new Promise((resolve, reject) => {
      if (!this.alive) { reject(Error('连接已关闭，请重新组队')); return; }
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.end('服务器响应超时，请重新组队'); }, 10000);
      this.pending.set(id, {resolve, reject, timer});
      if (!this.send({...data, op, id})) this.end('联机消息发送失败，请重新组队');
    });
  }
  apply(room) {
    if (!room || !Array.isArray(room.members)) return;
    const previous = this.room.members;
    this.room = room;
    for (const member of previous) if (!room.members.some(next => next.id === member.id)) this.ev.link?.(member.id, 'closed');
    this.ev.change?.();
    if (room.state === 'started' && !this.startedSeen) { this.startedSeen = true; this.ev.start?.(room); }
  }
  receive(raw) {
    if (!this.alive) return;
    if (raw instanceof ArrayBuffer) {
      if (raw.byteLength < 2) return;
      const from = this.room.members.find(member => member.slot === new Uint8Array(raw)[0]);
      if (from && from.id !== this.me) this.ev.snap?.(from.id, raw.slice(1));
      return;
    }
    let message; try { message = JSON.parse(raw); } catch { return; }
    if (message.op === 'pong') { this.pongAt = Date.now(); this.roundTrip = this.pongAt - (this.pingAt || this.pongAt); return; }
    if (message.op === 'closed') { this.end(message.reason); return; }
    if (message.op === 'room') { this.apply(message.room); return; }
    if (message.op === 'ctl') { if (this.others.some(member => member.id === message.from)) this.ev.ctl?.(message.from, message.data); return; }
    if (message.op !== 'reply') return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id); clearTimeout(pending.timer);
    if (message.error) { pending.reject(Error(message.error)); return; }
    this.me = message.me; this.apply(message.room); pending.resolve(message);
  }
  control(to, data) { return this.send({op: 'ctl', to, data}); }
  snapshot(to, data) {
    const target = this.room.members.find(member => member.id === to);
    if (!this.alive || !target) return false;
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const packet = new Uint8Array(bytes.length + 1); packet[0] = target.slot; packet.set(bytes, 1);
    return this.socket.send(packet.buffer, true);
  }
  setPick(species) { return this.request('pick', {species}); }
  setReady(ready) { return this.request('ready', {ready}); }
  setSettings(_biome, tier) { return this.request('settings', {tier}); }
  kick(to) { return this.request('kick', {to}); }
  start() { return this.request('start'); }
  leave() { this.send({op: 'leave'}); this.end('已离开房间', false); return Promise.resolve(); }
  end(reason = '房间已关闭', notify = true) {
    if (!this.alive) return;
    this.alive = false; clearInterval(this.heartbeat); clearTimeout(this.connectTimer);
    this.connectReject?.(Error(reason)); this.connectReject = null;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(Error(reason)); }
    this.pending.clear(); this.socket?.close();
    if (notify) this.ev.closed?.(reason);
  }
}
