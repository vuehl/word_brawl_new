import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom/worker';

const bundle=await build({bundle:true,entryPoints:[fileURLToPath(new URL('../platform/layout.mjs',import.meta.url))],
  nodePaths:[fileURLToPath(new URL('./node_modules',import.meta.url))],write:false,format:'esm'});
const {createLayout}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

function fixture(scale){
  const {document}=parseHTML('<html><body><div id="ui"><div class="tc"><div class="tc-stick on"><i></i></div></div></div></body></html>');
  const definitions=[
    ['#ui','#ui',{position:'absolute',inset:'0'}],
    ['.tc','.tc',{position:'absolute',inset:'0','--tcs':String(scale)}],
    ['.tc-stick','.tc-stick',{position:'absolute',width:'calc(128px * var(--tcs))',height:'calc(128px * var(--tcs))',
      margin:'calc(-64px * var(--tcs)) 0 0 calc(-64px * var(--tcs))','pointer-events':'none'}],
    ['.tc-stick>i','i',{position:'absolute',left:'50%',top:'50%',width:'calc(58px * var(--tcs))',height:'calc(58px * var(--tcs))',margin:'calc(-29px * var(--tcs))'}],
  ];
  const uiAssets={rules:definitions.map(([selector,key,style],i)=>[selector,Object.entries(style),key,'',1,i]),
    layout:{views:[{w:800,h:320,screens:{play:{}}}],styles:[]}};
  const layout=createLayout(document,{w:800,h:320},{getContext:()=>({measureText:t=>({width:t.length*6})})}, {},uiAssets);
  const stick=document.querySelector('.tc-stick'),knob=stick.firstElementChild;
  return {layout,stick,knob,document};
}

for(const scale of [.7,1,1.5])test('Joystick centering and incremental layout at scale '+scale,()=>{
  const {layout,stick,knob}=fixture(scale);
  stick.style.left='120px';stick.style.top='200px';
  layout.refresh('play');
  const center=el=>{const b=layout.box(el);return [b.x+b.w/2,b.y+b.h/2];};
  const near=(actual,expected)=>actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<.6,JSON.stringify({actual,expected})));
  near(center(stick),[120,200]);near(center(knob),[120,200]);
  const parent=layout.box(stick.parentElement);
  stick.style.top='100px';knob.style.transform='translate(0px, -24px)';
  const changed=layout.refreshSubtree(stick);
  assert.equal(changed.length,2,'Only the stick and its knob should be recalculated');
  assert.equal(layout.box(stick.parentElement),parent,'The rest of the HUD must reuse its layout');
  near(center(stick),[120,100]);near(center(knob),[120,76]);
  assert.equal(layout.hit(120,100),stick.parentElement,'A moving joystick must remain transparent to hit testing');
  layout.dispose();
});

test('HUD layout reuses geometry for paint changes and rebuilds for new content',()=>{
  const {layout,document}=fixture(1),hud=document.createElement('div'),fill=document.createElement('i');
  hud.style.cssText='width:200px;height:20px';
  fill.style.cssText='width:200px;height:20px;transform-origin:left top';
  hud.append(fill);document.getElementById('ui').append(hud);
  layout.refresh('play');const original=layout.box(hud).node;
  fill.style.transform='scaleX(0.5)';hud.style.opacity='0.5';layout.refresh('play');
  assert.equal(layout.box(hud).node,original,'Health changes must not allocate another Yoga tree');
  assert.equal(layout.box(fill).w,100,'The cached health fill still reflects its new value');
  assert.equal(layout.box(fill).opacity,.5,'Opacity still propagates through the cached HUD');
  const label=document.createElement('span');label.textContent='升级';hud.append(label);layout.refresh('play');
  assert.ok(layout.box(label),'New gameplay controls must appear immediately');
  const rebuilt=layout.box(hud).node;
  assert.notEqual(rebuilt,original,'Adding content must trigger layout');
  hud.style.width='240px';layout.refresh('play');
  assert.equal(layout.box(hud).w,240,'Changed dimensions must not reuse stale geometry');
  label.remove();layout.refresh('play');assert.equal(layout.box(label),undefined);
  layout.dispose();
});

test('An unchanged live menu reuses layout, and room/member changes still rebuild it',()=>{
  const {layout,document}=fixture(1);
  const screen=document.createElement('div');screen.className='screen coop-lan';screen.setAttribute('data-live-layout','');
  screen.style.cssText='width:400px;height:180px';screen.textContent='等待伙伴';
  document.getElementById('ui').append(screen);
  layout.refresh();const original=layout.box(screen).node;
  for(let i=0;i<12;i++){layout.refresh();assert.equal(layout.box(screen).node,original);}
  const member=document.createElement('button');member.textContent='新伙伴 已准备';screen.append(member);layout.refresh();
  assert.ok(layout.box(member));assert.notEqual(layout.box(screen).node,original);
  layout.dispose();
});
