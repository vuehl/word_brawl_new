import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {installRunLoading} from '../platform/run-loading.mjs';
const createRuntime=createRequire(import.meta.url)('../platform/runtime-info.js');

test('The phone report records its real SDK, mode and errors without suppressing errors or sending them',()=>{
  let onError,onRejection,modal,clipboard;const titles=[];
  const wx={getAppBaseInfo:()=>({version:'8.0.68',SDKVersion:'3.17.5'}),getDeviceInfo:()=>({platform:'ios',system:'iOS 18.6'}),
    onError:fn=>onError=fn,onUnhandledRejection:fn=>onRejection=fn,
    showLoading:({title,mask})=>{assert.equal(mask,true);titles.push(title);},hideLoading:()=>titles.push('hidden'),
    showModal:options=>modal=options,setClipboardData:({data})=>clipboard=data};
  const runtime=createRuntime(wx,{isIOSHighPerformanceMode:false});
  runtime.stage('正在生成森林场景');runtime.loading('正在生成森林场景');runtime.loading('正在生成森林场景');
  onError("LifeCycle.load fail: Can't find variable: setTimeout");onRejection({reason:Error('战斗纹理失败')});
  const info=runtime.snapshot();
  assert.equal(info.build,'1104.4');assert.equal(info.wechat,'8.0.68');assert.equal(info.sdk,'3.17.5');
  assert.equal(info.mode,'普通模式');assert.equal(info.errors.length,2);assert.equal(info.phase,'正在生成森林场景');
  info.errors[0].message='changed';assert.match(runtime.snapshot().errors[0].message,/setTimeout/);
  runtime.showDetails();assert.equal(clipboard,undefined,'Opening diagnostics does not copy or send anything');
  modal.success({confirm:true});assert.match(clipboard,/8\.0\.68/);assert.match(clipboard,/setTimeout/);
  runtime.hideLoading();runtime.hideLoading();assert.deepEqual(titles,['正在生成森林场景','hidden']);
});

test('The report supports old system-info APIs and bounds retained errors',()=>{
  const runtime=createRuntime({getSystemInfoSync:()=>({version:'8.0.68',SDKVersion:'3.17.4',platform:'ios',system:'iOS 17'})},{isIOSHighPerformanceMode:true});
  for(let i=0;i<10;i++)runtime.record(Error('failure '+i));
  assert.equal(runtime.snapshot().mode,'iOS 高性能模式');assert.equal(runtime.snapshot().sdk,'3.17.4');
  assert.equal(runtime.snapshot().errors.length,5);assert.match(runtime.snapshot().errors[0].message,/failure 5/);
});

test('Returning to the home retains the last battle measurement in the phone report',()=>{
  let modal,clipboard;
  const runtime=createRuntime({showModal:options=>modal=options,setClipboardData:({data})=>clipboard=data},{});
  const sample={frameMs:50,simulationMs:12,worldMs:20,uiMs:10,world:[1266,585],ui:[1688,780],drawCalls:75};
  runtime.setPerformance({...sample,scene:'battle',fps:20});
  runtime.setPerformance({...sample,scene:'home',fps:30});
  runtime.showDetails();modal.success({confirm:true});
  assert.match(clipboard,/战斗最近实测 20 FPS/);
  assert.match(clipboard,/首页最近实测 30 FPS/);
  assert.equal(runtime.snapshot().performance.fps,30);
});

function paintFixture(){
  let id=0;const frames=new Map(),timeouts=new Map(),titles=[];
  const timers={requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(fn,delay)=>{assert.ok([250,20000].includes(delay));timeouts.set(++id,fn);return id;},clearTimeout:id=>timeouts.delete(id)};
  const runtime={stage:()=>{},loading:title=>titles.push(title),hideLoading:()=>titles.push('hidden'),record:()=>{},snapshot:()=>({}),showDetails:()=>{}};
  const env={};installRunLoading(env,runtime,timers);
  const paint=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());};
  return {env,frames,timeouts,titles,paint};
}

test('Heavy scene work waits until the loading indicator has had a frame to paint',async()=>{
  const {env,frames,timeouts,titles,paint}=paintFixture();let started=false;
  const work=env.showRunLoading('正在生成森林场景').then(()=>{started=true;});
  assert.deepEqual(titles,['正在生成森林场景']);assert.equal(started,false);
  paint();await Promise.resolve();assert.equal(started,false);
  paint();await work;assert.equal(started,true);assert.equal(timeouts.size,0);assert.equal(frames.size,0);
  env.hideRunLoading();assert.equal(titles.at(-1),'hidden');
});

test('A paused RAF cannot strand the native loading overlay indefinitely',async()=>{
  const {env,frames,timeouts}=paintFixture();
  const work=env.showRunLoading('正在加载森林资源');
  [...timeouts.values()][0]();await work;
  assert.equal(frames.size,0);assert.equal(timeouts.size,0);
});

test('Startup waits for the actual new battle frame, not a menu or an old run',async()=>{
  const {env,timeouts}=paintFixture();const run={};let ready=false;
  const work=env.waitForRunFrame(run).then(()=>{ready=true;});
  env.didRenderRunFrame({});await Promise.resolve();assert.equal(ready,false);
  env.didRenderRunFrame(run);await work;assert.equal(ready,true);assert.equal(timeouts.size,0);
});

test('First-frame errors or a missing battle frame reject startup so the lobby can recover',async()=>{
  const {env,timeouts}=paintFixture();
  const work=env.waitForRunFrame({});
  env.onRunRenderError(Error('WebGL battle frame failed'));
  await assert.rejects(work,/WebGL battle frame failed/);assert.equal(timeouts.size,0);
  const stalled=env.waitForRunFrame({});
  [...timeouts.values()][0]();
  await assert.rejects(stalled,/战斗画面未能显示/);assert.equal(timeouts.size,0);
});

test('Cooperative readiness waits until the actor textures are ready',async()=>{
  const {env}=paintFixture();const run={coop:{loading:true},glyphActors:{ready:false},glyphHero:{ready:true}};
  let ready=false;const pending=env.waitForRunFrame(run).then(()=>{ready=true;});
  env.didRenderRunFrame(run);await Promise.resolve();assert.equal(ready,false);
  run.glyphActors.ready=true;env.didRenderRunFrame(run);await pending;assert.equal(ready,true);
});
