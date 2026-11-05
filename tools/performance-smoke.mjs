// Compare real work done by the built phone adapter. Desktop FPS is not iPhone FPS.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import puppeteer from 'puppeteer-core';

const root=path.resolve(import.meta.dirname,'..'),game=path.join(root,'minigame');
const baseline=process.argv.includes('--baseline');
const playArgument=process.argv.indexOf('--play-file');
const playFile=playArgument<0?path.join(game,'play.js'):path.resolve(process.argv[playArgument+1]);
const out=path.join(root,'验收','苹果性能');fs.mkdirSync(out,{recursive:true});
const fixture=(await build({bundle:true,entryPoints:[path.join(import.meta.dirname,'wx-fixture.mjs')],write:false,format:'iife'})).outputFiles[0].text;
const packages=JSON.parse(fs.readFileSync(path.join(game,'game.json'))).subpackages;
const data={main:[]},entries={},modules=[];
for(const pkg of packages){data[pkg.name]=[];entries[pkg.name]=pkg.root.endsWith('.js')?pkg.root:pkg.root+'/game.js';}
for(const file of fs.readdirSync(game,{recursive:true})){
  const name=file.split(path.sep).join('/'),pkg=packages.find(p=>name===p.root||name.startsWith(p.root+'/'));
  if(!pkg&&name.endsWith('.js'))modules.push(name);
  if(/\.(br|bin)$/.test(name))data[pkg?.name||'main'].push(name);
}
const boot='const defs={},cache={};\n'+modules.map(name=>'defs['+JSON.stringify(name)+']=function(require,module,exports){\n'+fs.readFileSync(path.join(game,name),'utf8')+'\n};').join('\n')+`
function load(p){if(cache[p])return cache[p].exports;const m=cache[p]={exports:{}};defs[p](q=>load(p.slice(0,p.lastIndexOf('/')+1)+q.slice(2)+'.js'),m,m.exports);return m.exports;}
loadFixtureData('main').then(()=>load('game.js'));`;
const files=new Set([...Object.values(data).flat(),...Object.values(entries)]);
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<meta charset="utf-8"><style>*{margin:0}canvas{width:100vw;height:100vh}</style><body><script src="/fixture.js"></script><script src="/boot.js"></script>');}
  if(req.url==='/fixture.js'||req.url==='/boot.js'){res.setHeader('content-type','text/javascript');return res.end(req.url==='/boot.js'?boot:'window.packageData='+JSON.stringify(data)+';window.packageEntries='+JSON.stringify(entries)+';'+fixture);}
  if(files.has(req.url.slice(1))){if(req.url.endsWith('.js'))res.setHeader('content-type','text/javascript');return fs.createReadStream(req.url==='/play.js'?playFile:path.join(game,req.url.slice(1))).pipe(res);}
  res.statusCode=204;res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const page=await browser.newPage(),errors=[];
page.on('pageerror',e=>{errors.push(e.stack||e.message);console.log('pageerror',e.message);});
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404')){errors.push(m.text());console.log('client error',m.text());}});
await page.setViewport({width:844,height:390,deviceScaleFactor:3});
await page.evaluateOnNewDocument(()=>{window.phoneLayout=true;window.fixturePlatform='ios';});
const wait=fn=>page.waitForFunction(fn,{timeout:90000,polling:100});
async function measure(label){
  const result=await page.evaluate(async()=>{
    const env=inspected.env,layout=inspected.layout,wasHalted=app.halted;
    app.halted=true;await new Promise(requestAnimationFrame);
    const now=performance.now.bind(performance),descriptor=Object.getOwnPropertyDescriptor(performance,'now');
    const refresh=layout.refresh;let layouts=0,rebuilds=0,rootNode=layout.box(inspected.doc.body)?.node;
    layout.refresh=function(...args){layouts++;const boxes=refresh.apply(this,args),next=layout.box(inspected.doc.body)?.node;if(next!==rootNode)rebuilds++;rootNode=next;return boxes;};
    let time=now()+1000;Object.defineProperty(performance,'now',{configurable:true,value:()=>time});
    try{
      env.drawUI(app.r.renderer,app.run);await Promise.resolve();layouts=0;rebuilds=0;
      const began=now();
      for(let i=0;i<60;i++){time+=1000/60;env.drawUI(app.r.renderer,app.run);await Promise.resolve();}
      const elapsed=now()-began;
      return {state:app.run?.state||'home',frames:60,layouts,rebuilds,uiCpuMs:Math.round(elapsed),world:[app.r.composer.inputBuffer.width,app.r.composer.inputBuffer.height],
        ui:[inspected.uiCanvas.width,inspected.uiCanvas.height],bloom:app.r.finalPass.enabled,outline:app.r.outlinePass.enabled,
        profile:env.mobileGraphics,drawCalls:app.r.renderer.info.render.calls};
    }finally{layout.refresh=refresh;if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now;app.halted=wasHalted;}
  });
  console.log(label,JSON.stringify(result));return result;
}
async function measureHUD(){
  return page.evaluate(async()=>{
    const run=app.run,hud=run.ui,halted=app.halted;
    app.halted=true;await new Promise(requestAnimationFrame);
    const now=performance.now.bind(performance),descriptor=Object.getOwnPropertyDescriptor(performance,'now');
    const update=hud.touch.update,lagT=hud.lagT;let touchUpdates=0,hudUpdates=0,minimapUpdates=0,time=now()+1000;
    hud.touch.update=function(...args){touchUpdates++;return update.apply(this,args);};
    Object.defineProperty(performance,'now',{configurable:true,value:()=>time});
    try{
      for(let i=0;i<60;i++){
        time+=1000/60;const previousHud=hud.hudAt,previousMap=hud.mmAt;
        hud.hud(run);hudUpdates+=hud.hudAt!==previousHud?1:0;minimapUpdates+=hud.mmAt!==previousMap?1:0;
      }
      return {calls:60,touchUpdates,hudUpdates,minimapUpdates,heroTexture:[run.glyphHero.canvas.width,run.glyphHero.canvas.height]};
    }finally{
      hud.touch.update=update;hud.hudAt=-Infinity;hud.mmAt=0;hud.lagT=lagT;
      if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now;
      app.halted=halted;
    }
  });
}
try{
  await page.goto('http://127.0.0.1:'+server.address().port);
  await wait(()=>window.releaseTextDownload&&window.releaseOptionalDownloads);
  await page.evaluate(()=>{releaseTextDownload();releaseOptionalDownloads();});
  await wait(()=>!!(window.app?.meta&&window.inspected?.doc.querySelector('.auth-body button')&&!window.loadingTitle));
  await page.evaluate(()=>inspected.doc.querySelector('.auth-body button').click());
  await wait(()=>!!inspected.doc.querySelector('.sp-go'));
  await page.evaluate(()=>inspected.doc.querySelector('.sp-go').click());
  await wait(()=>!!inspected.doc.querySelector('.lite-home'));
  await wait(()=>!inspected.doc.querySelector('.wipe'));
  // Counter Chrome's intentional software-GPU low preset so both runs measure
  // the same saved high setting that a real iPhone may already have.
  await page.evaluate(()=>{app.meta.profile.settings.quality='high';app.applySettings();});
  const home=await measure('home');
  await page.screenshot({path:path.join(out,(baseline?'baseline':'optimized')+'-home.png')});
  assert.equal(await page.evaluate(()=>app.startRun({species:4,biome:'forest',tier:0,boosts:[],mode:'standard'})),true);
  await page.evaluate(()=>{app.run.player.iframes=3600;});
  await wait(()=>app.run.state==='play'&&app.run.time>1);
  const battle=await measure('battle');
  const hud=baseline?null:await measureHUD();
  if(hud){
    assert.equal(hud.touchUpdates,60,'Input and the stick must still update on every call');
    assert.ok(hud.hudUpdates>=8&&hud.hudUpdates<=10);assert.ok(hud.minimapUpdates>=4&&hud.minimapUpdates<=5);
    assert.deepEqual(hud.heroTexture,[384,384]);console.log('HUD work',JSON.stringify(hud));
  }
  await page.screenshot({path:path.join(out,(baseline?'baseline':'optimized')+'-battle.png')});
  if(!baseline){
    assert.equal(home.bloom,false);assert.equal(battle.bloom,false);
    assert.equal(home.outline,false);assert.equal(battle.outline,false);
    assert.ok(home.world[0]*home.world[1]<=800000,'Ordinary iOS world exceeds its pixel budget');
    assert.ok(home.ui[0]>=844*1.5,'Text must retain a sharp independent UI layer');
    assert.ok(home.layouts<=2,'An unchanged home must not relayout continuously');
    assert.equal(home.rebuilds,0,'An unchanged home must retain its geometry');
    assert.equal(battle.state,'play');
    assert.ok(battle.layouts<=8,'Combat HUD paints at its bounded cadence while the stick has its own layer');
    assert.equal(battle.rebuilds,0,'An unchanged HUD must retain its geometry');
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,(baseline?'baseline':'optimized')+'.json'),JSON.stringify({ok:true,home,battle,hud,errors},null,2));
}catch(error){
  console.log('failed state',await page.evaluate(()=>({title:document.title,body:document.body.textContent.slice(0,500),problem:window.problem,game:window.inspected?.doc.body.textContent.slice(-500)})));
  await page.screenshot({path:path.join(out,'failure.png')});throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
