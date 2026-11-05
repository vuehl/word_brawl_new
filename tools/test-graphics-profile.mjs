import test from 'node:test';
import assert from 'node:assert/strict';
import {graphicsProfile,uiScale,uiSchedule} from '../platform/graphics-profile.mjs';
import {framePerformance} from '../platform/frame-performance.mjs';
import {adaptiveResolution} from '../source/src/adaptive-resolution.js';

test('Ordinary iOS uses a bounded world and a separate sharper UI without changing Android quality',()=>{
  const phone={width:844,height:390,dpr:3},ios=graphicsProfile({platform:'ios'},false);
  assert.equal(ios.bloom,false);assert.equal(ios.outline,false);
  assert.ok(844*390*ios.maxRatio**2<=ios.maxPixels);
  assert.ok(uiScale(phone,ios)>=1.5);assert.ok(uiScale(phone,ios)>ios.maxRatio);
  const android=graphicsProfile({platform:'android'},false);
  assert.equal(android.maxRatio,2.5);assert.equal(uiScale(phone,android),3);
  assert.equal(graphicsProfile({platform:'ios'},true).name,'ios-high-performance');
});

test('An idle home stops constant repaints, while changed labels and native taps remain responsive',()=>{
  const schedule=uiSchedule(graphicsProfile({platform:'ios'},false));
  assert.equal(schedule.shouldPaint(0,undefined),true);
  let paints=0;for(let t=1000/60;t<=1000;t+=1000/60)paints+=schedule.shouldPaint(t,undefined)?1:0;
  assert.ok(paints<=2);
  schedule.invalidate();assert.equal(schedule.shouldPaint(1200,undefined),true);
  schedule.invalidate(true);assert.equal(schedule.shouldPaint(1201,undefined),true);
  assert.equal(schedule.shouldPaint(1202,'play'),true,'A scene change must paint immediately');
});

const initial=()=>({t:0,frames:0,js:0,good:0,wait:8,lastUp:-1e9});
test('Frames slower than 250 ms still reduce load on the phone',()=>{
  const state=initial();let scale=1;
  for(let i=0;i<5;i++)scale=adaptiveResolution(state,{seconds:.4,workMs:350,now:i*400,scale,minScale:.6,targetFPS:30,active:true,allowCpuBound:true});
  assert.ok(scale<1,'A 2.5 FPS phone must not remain stuck at maximum resolution');
  assert.ok(scale>=.6);
});

test('A stable 30 FPS cap is healthy, and paused/background time does not force a downgrade',()=>{
  const state=initial();let scale=1;
  for(let i=0;i<300;i++)scale=adaptiveResolution(state,{seconds:1/30,workMs:10,now:i*1000/30,scale,minScale:.6,targetFPS:30,active:true,allowCpuBound:true});
  assert.equal(scale,1);
  assert.equal(adaptiveResolution(state,{seconds:6,workMs:5,now:16000,scale,minScale:.6,targetFPS:30,active:false}),1);
  assert.equal(state.frames,0);
});

test('The non-mobile CPU-bound path does not degrade world resolution unnecessarily',()=>{
  const state=initial();let scale=1;
  for(let i=0;i<60;i++)scale=adaptiveResolution(state,{seconds:.04,workMs:39,now:i*40,scale,minScale:.6,targetFPS:60,active:true});
  assert.equal(scale,1);
});

test('Diagnostics count completed frames and separate simulation, scene and UI costs',()=>{
  let clock=0;const reports=[],meter=framePerformance(()=>clock,value=>reports.push(value));
  for(let i=0;i<30;i++){clock=(i+1)*1000/30;meter.record(4,12,3,()=>({drawCalls:10}));}
  assert.deepEqual(reports,[{drawCalls:10,fps:30,frameMs:33,simulationMs:4,worldMs:9,uiMs:3}]);
  clock+=30000;meter.reset();clock+=1000;meter.record(2,4,1,()=>({}));
  assert.equal(reports[1].fps,1,'A slow frame must not be replaced by a made-up FPS floor');
});
