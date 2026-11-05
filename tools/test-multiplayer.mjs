import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import {RelayRoom} from '../source/src/multiplayer.js';
import {wechatSocket} from '../platform/socket.mjs';

const root = path.resolve(import.meta.dirname, '..');
let processHandle, url, base;
const sessions = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) { for (let n=0;n<150;n++) { if (check()) return; await delay(20); } throw Error('Timed out waiting for relay event'); }
function wxFactory(url, events) {
  return wechatSocket({connectSocket({url}) {
    const ws = new WebSocket(url), callbacks = {}; ws.binaryType = 'arraybuffer';
    ws.onopen = () => callbacks.open?.(); ws.onmessage = e => callbacks.message?.({data:e.data});
    ws.onerror = () => callbacks.error?.(); ws.onclose = () => callbacks.close?.();
    return {onOpen: fn=>callbacks.open=fn, onMessage: fn=>callbacks.message=fn, onError: fn=>callbacks.error=fn, onClose: fn=>callbacks.close=fn,
      send({data,fail,complete}) { try { ws.send(data); } catch(e) { fail?.(e); } finally { complete?.(); } }, close() { ws.close(); }};
  }}, url, events);
}
async function connect(options={}) { const s=await RelayRoom.connect({url,name:'测试伙伴',species:4,...options});sessions.push(s);return s; }
before(async()=>{
  const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  base='http://127.0.0.1:'+port;url='ws://127.0.0.1:'+port+'/ws';
  processHandle=spawn(path.join(root,'backend/dist/ziling-server-'+(process.platform==='win32'?'windows-amd64.exe':'linux-amd64')),['-listen','127.0.0.1:'+port],{stdio:['ignore','pipe','pipe']});
  let failure='';processHandle.stderr.on('data',data=>failure+=data);processHandle.on('error',e=>failure+=e.message);
  for(let n=0;n<100;n++){try{if((await fetch(base+'/healthz')).ok)return;}catch{}if(processHandle.exitCode!==null)throw Error(failure);await delay(50);}throw Error(failure||'Backend did not start');
});
after(async()=>{for(const s of sessions)await s.leave();if(processHandle?.exitCode===null){const exited=new Promise(r=>processHandle.once('exit',r));processHandle.kill();await exited;}});

test('health, invalid rooms/builds, four-person capacity and immutable start',async()=>{
  assert.equal((await (await fetch(base+'/healthz')).json()).build,'ziling-coop-1');
  await assert.rejects(connect({code:'000000'}),/房间不存在/);
  const host=await connect({name:'房主'});
  assert.match(host.code,/^\d{6}$/);
  await assert.rejects(host.start(),/至少两人/);
  const guest=await connect({code:host.code,factory:wxFactory,species:7});
  await until(()=>host.others.length===1);
  await assert.rejects(guest.start(),/只有房主/);
  await assert.rejects(guest.setSettings('forest',2),/只有房主/);
  await assert.rejects(host.start(),/所有成员准备/);
  await assert.rejects(host.setPick(25),/可用伙伴/);
  const third=await connect({code:host.code});const fourth=await connect({code:host.code});
  await assert.rejects(connect({code:host.code}),/房间已满/);
  for(const s of [host,guest,third,fourth])await s.setReady(true);
  await host.setSettings('forest',1);
  assert.ok(host.room.members.every(m=>!m.ready));
  for(const s of [host,guest,third,fourth])await s.setReady(true);
  let starts=0;guest.ev.start=()=>starts++;
  await host.start();await until(()=>guest.room.state==='started'&&third.room.state==='started'&&fourth.room.state==='started');
  assert.equal(starts,1);assert.match(host.room.party,/^lan-[a-f0-9]{32}$/);
  assert.ok(host.room.seed>0&&host.room.seed<2**31);
  for(const s of [guest,third,fourth]){assert.equal(s.room.seed,host.room.seed);assert.equal(s.room.party,host.room.party);}
  await assert.rejects(guest.setPick(1),/已开始/);
  await assert.rejects(connect({code:host.code}),/已开局/);
  let ctl,snapshot;guest.ev.ctl=(from,data)=>ctl={from,data};guest.ev.snap=(from,data)=>snapshot={from,data};
  host.mesh.sendCtl(guest.me,{t:'xp',v:5});host.mesh.sendSnap(guest.me,new Uint8Array([5,17,0,255]).buffer);
  await until(()=>ctl&&snapshot);assert.equal(ctl.from,host.me);assert.equal(ctl.data.v,5);assert.equal(snapshot.from,host.me);
  assert.deepEqual([...new Uint8Array(snapshot.data)],[5,17,0,255]);
  // Relay stamps sender identity, ignoring a forged field in the outer packet.
  ctl=null;host.send({op:'ctl',to:guest.me,from:third.me,data:{t:'k',n:20}});await until(()=>ctl);assert.equal(ctl.from,host.me);
  const isolated=await connect();let leaked=false;isolated.ev.ctl=()=>leaked=true;
  host.mesh.sendCtl(isolated.me,{t:'k',n:999});await delay(150);assert.equal(leaked,false);
  let gone;guest.ev.link=(id,state)=>gone={id,state};await host.leave();await until(()=>gone);
  assert.equal(gone.id,host.me);assert.equal(guest.room.host,guest.me);
  for(const s of [guest,third,fourth,isolated])await s.leave();
});

test('kick and host migration in lobby, socket drop cleans membership and empty rooms',async()=>{
  const host=await connect(),guest=await connect({code:host.code}),third=await connect({code:host.code});
  let kicked;guest.ev.closed=reason=>kicked=reason;await host.kick(guest.me);await until(()=>kicked);assert.match(kicked,/移出/);
  assert.equal(host.room.members.length,2);
  const code=host.code;host.socket.close();await until(()=>third.isHost&&third.room.members.length===1);
  await third.leave();await until(()=>!third.open);
  await delay(100);await assert.rejects(connect({code}),/房间不存在/);
});

test('version mismatch, oversized packets and invalid JSON are rejected',async()=>{
  const raw=()=>new Promise(resolve=>{const ws=new WebSocket(url);ws.onopen=()=>resolve(ws);});
  const ws=await raw();const reply=new Promise(resolve=>ws.onmessage=e=>resolve(JSON.parse(e.data)));
  ws.send(JSON.stringify({op:'create',id:1,species:4,protocol:1,build:'old'}));assert.match((await reply).error,/版本不一致/);ws.close();
  for(const payload of ['{broken','x'.repeat(70*1024)]){const socket=await raw();const closed=new Promise(resolve=>socket.onclose=resolve);socket.send(payload);await closed;}
});

test('The existing Go relay carries scene readiness and a common start without leaking startup packets into combat', {timeout:12000},async()=>{
  const host=await connect(),guest=await connect({code:host.code,factory:wxFactory});
  await host.setReady(true);await guest.setReady(true);await host.start();
  await until(()=>guest.startGate);
  let leaked=0,hostAt,guestAt;host.ev.ctl=guest.ev.ctl=()=>leaked++;
  const waiting=host.waitForBattleStart().then(()=>{hostAt=Date.now();});
  await delay(500);assert.equal(hostAt,undefined);assert.equal(host.startGate.at,undefined);
  const following=guest.waitForBattleStart().then(()=>{guestAt=Date.now();});
  await Promise.all([waiting,following]);
  assert.equal(host.startGate.at,guest.startGate.at);assert.ok(Math.abs(hostAt-guestAt)<250);
  assert.equal(leaked,0);
  await host.leave();await guest.leave();
});

test('A peer failure cancels a pending scene load through the existing relay', {timeout:5000},async()=>{
  const host=await connect(),guest=await connect({code:host.code});
  await host.setReady(true);await guest.setReady(true);await host.start();
  await until(()=>guest.startGate);
  const stalled=host.duringLoading(new Promise(()=>{}));
  guest.cancelStart('战斗纹理加载失败');
  await assert.rejects(stalled,/纹理加载失败/);assert.equal(host.startGate.local,false);
  await host.leave();await guest.leave();
});
