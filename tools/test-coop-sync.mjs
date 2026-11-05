import test from 'node:test';
import assert from 'node:assert/strict';
import {CoopStart} from '../source/src/coop-start.js';

function network({count=2,delay=20,drop=()=>false,timeout=90000}={}) {
  let clock=0,id=0;const jobs=new Map(),gates=[],messages=[];
  const members=Array.from({length:count},(_,i)=>({id:String(i)}));
  const setTimer=(fn,ms)=>{jobs.set(++id,{fn,at:clock+ms});return id;};
  const clearTimer=id=>jobs.delete(id);
  for(let i=0;i<count;i++)gates.push(new CoopStart({me:String(i),host:'0',members,party:'match',timeout,
    now:()=>clock+[100000,-35000,600000,2500][i],setTimer,clearTimer,
    send(to,data){messages.push({from:String(i),to,data});
      for(let j=0;j<count;j++)if(j!==i&&(!to||to===String(j))&&!drop(String(i),String(j),data))
        setTimer(()=>gates[j].receive(String(i),structuredClone(data)),delay);
      return true;
    }}));
  const advance=ms=>{
    const end=clock+ms;let steps=0;
    while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
      assert.ok(++steps<20000,'Startup must not busy-loop');clock=next[1].at;jobs.delete(next[0]);next[1].fn();}
    clock=end;
  };
  return {gates,jobs,messages,advance,now:()=>clock};
}

test('The fast host stays frozen until a slow iPhone renders; different device clocks use one countdown',async()=>{
  const n=network({count:4});const progress=[];
  const promises=n.gates.map((g,i)=>i===3?null:g.ready(title=>progress.push(title)));
  n.advance(8000);assert.ok(n.gates.every(g=>!g.done));assert.equal(n.gates[0].at,undefined);
  promises[3]=n.gates[3].ready();n.advance(1000);
  assert.ok(n.gates.every(g=>g.at===n.gates[0].at&&g.committed));
  assert.ok(n.gates.every(g=>!g.done));
  n.advance(3000);const results=await Promise.all(promises);
  assert.ok(n.gates.every(g=>g.done));assert.equal(n.jobs.size,0);
  assert.ok(results.every(r=>r.startAt===results[0].startAt));
  assert.ok(Math.abs(results[1].offset-135000)<1);assert.ok(progress.some(p=>p.includes('秒后开始')));
});

test('No client starts when countdown acknowledgement is missing',async()=>{
  const n=network({drop:(_from,_to,m)=>m.kind==='ack'});
  const promises=n.gates.map(g=>g.ready());n.advance(15000);
  const results=await Promise.allSettled(promises);
  assert.ok(results.every(r=>r.status==='rejected'));assert.equal(n.jobs.size,0);
  assert.ok(n.messages.some(m=>m.data.kind==='abort'));
});

test('Load failure, a departing member and timeout reject waiting clients instead of starting solo',async()=>{
  for(const failure of ['load','leave','timeout']){
    const n=network({timeout:3000});const host=n.gates[0].ready();n.advance(500);
    if(failure==='load')n.gates[1].cancel('纹理加载失败');
    if(failure==='leave')n.gates.forEach(g=>g.checkRoom({host:'0',members:[{id:'0'}]}));
    n.advance(4000);await assert.rejects(host,/加载|离开|超时/);assert.equal(n.jobs.size,0);
  }
});

test('Stale matches and a guest cannot send the host countdown',async()=>{
  const n=network({count:3});n.gates[1].ready();
  n.gates[1].receive('2',{t:'load-sync',v:1,party:'match',kind:'prepare',round:99,at:1});
  n.gates[1].receive('0',{t:'load-sync',v:1,party:'old-match',kind:'prepare',round:99,at:1});
  assert.equal(n.gates[1].at,undefined);n.gates.forEach(g=>g.cancel());n.advance(100);
  assert.equal(n.jobs.size,0);
});
