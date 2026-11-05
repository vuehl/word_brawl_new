import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../platform/timers.js',import.meta.url),'utf8');
function load(scope){
  const context=vm.createContext({...scope,module:{exports:{}}});
  vm.runInContext(source,context);
  return {timers:context.module.exports,context};
}

test('Timers work when only GameGlobal exposes them and keep working after globals change',async()=>{
  const native={};
  const originals={setTimeout,clearTimeout,setInterval,clearInterval};
  for(const [key,fn] of Object.entries(originals))native[key]=function(...args){assert.equal(this,native);return fn(...args);};
  const {timers,context}=load({GameGlobal:native});
  assert.equal(vm.runInContext('typeof setTimeout',context),'undefined');
  for(const key of Object.keys(originals))delete native[key];
  assert.equal(await new Promise(resolve=>timers.setTimeout(resolve,1,'callback result')),'callback result');
  let cancelled=false;
  const id=timers.setTimeout(()=>{cancelled=true;},5);timers.clearTimeout(id);
  await new Promise(resolve=>{
    const interval=timers.setInterval(()=>{timers.clearInterval(interval);resolve();},10);
  });
  assert.equal(cancelled,false);
});

test('Captured ambient timers retain timeout, interval and matched animation cancellation',async()=>{
  const {timers}=load({setTimeout,clearTimeout,setInterval,clearInterval});
  let fired=false;
  const id=timers.requestAnimationFrame(()=>{fired=true;});
  timers.cancelAnimationFrame(id);
  const timestamp=await new Promise(resolve=>timers.requestAnimationFrame(resolve));
  assert.equal(fired,false);assert.equal(typeof timestamp,'number');
});

test('The native animation API keeps its receiver and cancellation method',()=>{
  const native={setTimeout,clearTimeout,setInterval,clearInterval};let saved;
  native.requestAnimationFrame=function(fn){assert.equal(this,native);saved=fn;return 42;};
  native.cancelAnimationFrame=function(id){assert.equal(this,native);assert.equal(id,42);saved=null;};
  const {timers}=load({GameGlobal:native});
  const id=timers.requestAnimationFrame(()=>{});assert.equal(typeof saved,'function');
  timers.cancelAnimationFrame(id);assert.equal(saved,null);
});

test('Missing native scheduling reports an actionable error, without a fake busy loop',()=>{
  assert.throws(()=>load({GameGlobal:{}}),/当前微信未提供 setTimeout/);
});
