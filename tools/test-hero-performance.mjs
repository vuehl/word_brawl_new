import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {build} from 'esbuild';
const bundled=await build({entryPoints:[path.resolve(import.meta.dirname,'../source/src/glyph-hero.js')],bundle:true,write:false,format:'esm',
  plugins:[{name:'original-three',setup(build){build.onResolve({filter:/^\.\.\/assets\/three-.+\.js$/},args=>({path:path.resolve(import.meta.dirname,'../source/public/assets',path.basename(args.path))}));}}]});
const {GlyphHero}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));

function hero(t,mobileGraphics){
  const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  const draws=[];
  const context=new Proxy({clearRect:(...args)=>draws.push(args)},{get:(obj,key)=>key in obj?obj[key]:()=>{}});
  globalThis.window={mobileGraphics};globalThis.document={createElement:()=>({getContext:()=>context})};
  t.after(()=>{if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else delete globalThis.window;
    if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else delete globalThis.document;});
  const run={time:0,player:{speciesId:4,speedNow:2,animT:0,squash:0,hurtT:0,moves:[],pos:{x:0,y:0,z:0},renderScale:1},
    r:{shared:{},scene:{add:()=>{}}},sprites:{get:()=>({bodyHeight:()=>1})},enemies:{nearest:()=>-1}};
  const actor=new GlyphHero(run,{fragmentShader:'',lookPal:{}});
  const render=()=>actor.render(null,0,0,0,0,[1,1,1,0],0);
  return {run,actor,render,draws};
}

test('iOS hero redraws its vector texture at 15 Hz while position uniforms update every frame',t=>{
  const {run,actor,render,draws}=hero(t,{heroTextureSize:384,heroFPS:15});
  for(let i=0;i<60;i++){
    run.time=i/60;run.player.animT=run.time;run.player.pos.x=i;
    render();assert.equal(actor.material.uniforms.uPos.value[0],i);
  }
  assert.ok(draws.length>=14&&draws.length<=16,'Animation must remain active at the bounded cadence');
  assert.ok(draws.every(args=>args[2]===384&&args[3]===384));
  assert.equal(actor.texture.generateMipmaps,false);
  assert.equal(actor.textureUpdates,draws.length);
  const before=draws.length;run.time+=.001;actor.attack();render();
  assert.equal(draws.length,before+1,'An attack pose must update immediately');
});

test('The existing full-resolution hero animation stays active on other render profiles',t=>{
  const {run,actor,render,draws}=hero(t,{});
  for(let i=0;i<30;i++){run.time=i/30;run.player.animT=run.time;render();}
  assert.equal(draws.length,30);assert.equal(actor.canvas.width,512);
  assert.equal(actor.texture.generateMipmaps,true);
});
