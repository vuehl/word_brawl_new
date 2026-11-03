import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {roster,biomes,events} from '../src/catalogs.js';
import {createProfile} from '../src/progression.js';
import {settleRun,applyAction} from '../local/progression.mjs';
import {constrainLiteProfile} from '../src/lite-rules.js';

test('one full forest, original three guardian groups, sanctuary, three starter kits',()=>{
 assert.deepEqual(roster.map(p=>p.id),[1,4,7]);
 assert.deepEqual(biomes.map(b=>b.id),['forest']);
 assert.equal(events.length,0);
 assert.deepEqual(biomes[0].guardians,[[123,26,55],[127,62,53],[34,76,59]]);
 assert.deepEqual(biomes[0].sanctuary.legendaries,[151]);
 assert.equal(biomes[0].zones.length,2);
 for(const p of roster)assert.equal(p.kit.length,4);
});
test('settlement preserves enemy research and evolution, excludes removed captures and maps',()=>{
 const p=constrainLiteProfile(createProfile('test'));
 const result={species:7,biome:'forest',mode:'standard',tier:0,stage:4,victory:true,kills:100,time:600,level:45,progress:{league:[10,25,7],shinies:[25,4],classics:[10,1],forms:[9,150],seen:[25,151],research:{25:10}}};
 const dust=settleRun(p,result);
 assert.ok(dust>0);assert.deepEqual(p.league,[1,4,7]);assert.deepEqual(p.unlocked,[1,4,7]);
 assert.deepEqual(p.shinies,[4]);assert.deepEqual(p.classics,[1]);assert.deepEqual(p.forms,[9]);
 assert.equal(p.research[25],10);assert.ok(p.seen.includes(151));assert.deepEqual(p.biomes,{forest:1});
 const before=p.stardust;assert.equal(applyAction(p,{k:'lab',id:'reroll',lv:99}),false);assert.equal(p.stardust,before);
});
test('HTTP blocks removed content, saves valid play once, and restores progression',async()=>{
 const root=path.resolve(import.meta.dirname,'..'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'pokebonk-lite-test-'));
 const port=18186;let proc,token;
 const start=async()=>{proc=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STORE_DIR:dir},stdio:['ignore','pipe','pipe']});let errors='';proc.stderr.on('data',b=>errors+=b);for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/local/health`);if(r.ok)return;}catch{}if(proc.exitCode!==null)throw Error(errors);await new Promise(r=>setTimeout(r,50));}throw Error(errors||'Startup timeout');};
 const stop=()=>new Promise(resolve=>{proc.once('exit',resolve);proc.kill();});
 const call=async(route,data,status=200)=>{const r=await fetch(`http://127.0.0.1:${port}/api${route}`,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});assert.equal(r.status,status,route);return r.json();};
 try{
  await start();token=(await call('/auth/guest',{})).token;
  assert.deepEqual((await call('/profile')).profile.league,[1,4,7]);await call('/profile/starter',{id:7});
  assert.deepEqual(await call('/coop/access'),{show:false,play:false});
  for(const route of ['/coop/rooms','/clans/board','/events/halloween26','/seasons/awards'])await call(route,undefined,404);
  const base={species:7,biome:'forest',tier:0,mode:'standard'};
  for(const overrides of [{species:25},{biome:'desert'},{mode:'endless'},{mode:'tower'},{party:'abc'}])await call('/runs',{...base,...overrides},400);
  const run=await call('/runs',base);
  const result={...base,stage:4,kills:100,time:600,level:30,victory:true,progress:{league:[25],research:{25:5},seen:[25]}};
  await call('/runs/'+run.id+'/finish',{result:{...result,species:4}},400);
  const one=await call('/runs/'+run.id+'/finish',{result});const two=await call('/runs/'+run.id+'/finish',{result});
  assert.equal(two.profile.counters.runs,1);assert.equal(two.profile.stardust,one.profile.stardust);assert.deepEqual(two.profile.league,[1,4,7]);assert.deepEqual(two.profile.biomes,{forest:1});
  await stop();await start();const saved=(await call('/profile')).profile;
  assert.equal(saved.research[25],5);assert.equal(saved.stardust,one.profile.stardust);
 }finally{if(proc&&proc.exitCode===null)await stop();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('pokebonk-lite-test-'));await fs.rm(dir,{recursive:true,force:true});}
});

test('best-time records retain the client object schema and fastest splits',()=>{
 const p=constrainLiteProfile(createProfile('timing'));
 p.times['forest-0']=700;constrainLiteProfile(p);
 assert.deepEqual(p.times['forest-0'],{time:700,splits:[]});
 const r={species:4,biome:'forest',mode:'standard',tier:0,stage:4,victory:true,kills:100,time:600,splits:[100,250,400,600],level:30};
 settleRun(p,r);assert.equal(p.times['forest-0'].time,600);assert.deepEqual(p.times['forest-0'].splits,r.splits);
 settleRun(p,{...r,time:800,splits:[200,400,600,800]});assert.equal(p.times['forest-0'].time,600);assert.deepEqual(p.times['forest-0'].splits,r.splits);
});
test('all three dynamically referenced sanctuary models are packaged as valid GLB files',async()=>{
 for(const name of ['sanct_pillar','sanct_gate','shrine']){
  const bytes=await fs.readFile(new URL('../public/assets/models/'+name+'.glb',import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
 }
});
