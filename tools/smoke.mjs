import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {build} from 'esbuild';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..'),game=path.join(root,'minigame');
const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const dir=process.env.ZILING_QA||path.join(os.tmpdir(),'ziling-native-check');fs.mkdirSync(dir,{recursive:true});
const fixture=(await build({bundle:true,entryPoints:[path.join(import.meta.dirname,'wx-fixture.mjs')],write:false,format:'iife'})).outputFiles[0].text;
// On the phone the main CommonJS loader cannot see modules inside a subpackage.
const config=JSON.parse(fs.readFileSync(path.join(game,'game.json'),'utf8'));
assert.equal(config.deviceOrientation,'portrait');
const subpackages=config.subpackages || [];
const modules=[], packageData={main:[]};
const packageEntries={};
for(const pkg of subpackages)packageData[pkg.name]=[];
for(const pkg of subpackages)packageEntries[pkg.name]=pkg.root.endsWith('.js')?pkg.root:pkg.root.replace(/\/$/,'')+'/game.js';
for(const entry of fs.readdirSync(game,{recursive:true})){
  const file=entry.split(path.sep).join('/');
  const pkg=subpackages.find(({root})=>file===root||file.startsWith(root.replace(/\/$/,'')+'/'));
  if(!pkg && file.endsWith('.js'))modules.push(file);
  if(/\.(br|bin)$/.test(file))packageData[pkg?.name||'main'].push(file);
}
const dataUrls=new Set(Object.values(packageData).flat().map(file=>'/'+file));
function script(){return 'const defs={}, cache={};\n'+modules.map(p=>'defs['+JSON.stringify(p)+']=function(require,module,exports){\n'+fs.readFileSync(path.join(game,p),'utf8')+'\n};').join('\n')+
 '\nfunction load(p){if(!defs[p])throw Error("module "+p+" is not defined");if(cache[p])return cache[p].exports;const m=cache[p]={exports:{}};const req=q=>load(p.slice(0,p.lastIndexOf("/")+1)+q.slice(2)+".js");defs[p](req,m,m.exports);return m.exports;}'+
 '\nwindow.loadFixtureData("main").then(async()=>{if(window.eagerEntry)await window.runFixtureEntry("play");load("game.js");}).catch(e=>{window.problem=e.message;console.error(e);});';}
const srv=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<meta charset=utf-8><style>*{margin:0}canvas{display:block;width:100vw;height:100vh}</style><body><script src="/fixture.js"></script><script src="/boot.js"></script>');}
  if(req.url==='/fixture.js'||req.url==='/boot.js'){res.setHeader('content-type','application/javascript;charset=utf-8');return res.end(req.url==='/fixture.js'?'window.packageData='+JSON.stringify(packageData)+';window.packageEntries='+JSON.stringify(packageEntries)+';\n'+fixture:script());}
  if(Object.values(packageEntries).includes(req.url.slice(1))){res.setHeader('content-type','application/javascript;charset=utf-8');return fs.createReadStream(path.join(game,req.url.slice(1))).pipe(res);}
  if(dataUrls.has(req.url))return fs.createReadStream(path.join(game,req.url.slice(1))).pipe(res);
  if(req.url==='/favicon.ico'){res.statusCode=204;return res.end();}
  res.statusCode=404;res.end();
});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const b=await puppeteer.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling']});
const page=await b.newPage(),errors=[];
let homePainted=false;
page.on('console',m=>{if(m.type()==='info'&&m.text().startsWith('[字灵启动] 游戏首页已绘制'))homePainted=true;});
page.on('console',async m=>{if(m.type()==='error'||m.type()==='warn'){const msg=m.text();if(!msg.includes('favicon')&&!msg.includes('ReadPixels')){
  console.log(m.type(),msg.slice(0,600));if(m.type()==='error')for(const arg of m.args())try{const stack=await arg.evaluate(a=>a?.stack);if(stack)console.log(stack.slice(0,1400));}catch{}
  if(m.type()==='error'&&!msg.includes('404 (Not Found)'))errors.push(msg);}}});
page.on('pageerror',e=>{console.error(e.stack);errors.push(e.message);});
await page.setViewport({width:390,height:844,deviceScaleFactor:1});
// The phone runtime may omit internationalization and browser/Node Base64 globals.
await page.evaluateOnNewDocument(()=>{
  for(const name of ['Intl','atob','btoa','Buffer'])delete window[name];
  // Observe the submitted WebGL uniforms without adding a diagnostics API to the game.
  const gl=WebGL2RenderingContext.prototype,lookup=gl.getUniformLocation,set=gl.uniform1i;
  const locations=new WeakMap(),bootLocations=new WeakSet();
  window.bootPercentages=[];
  window.holdHomeStatus=true;
  gl.getUniformLocation=function(program,name){
    const loc=lookup.call(this,program,name);
    if(name==='percent' && loc)locations.set(program,loc);
    if(name==='overScene' && locations.has(program))bootLocations.add(locations.get(program));
    return loc;
  };
  gl.uniform1i=function(loc,value){
    if(loc && bootLocations.has(loc))window.bootPercentages.push(value);
    return set.call(this,loc,value);
  };
});
const failFrame=process.argv.includes('--fail-first-frame');
const phoneLayout=process.argv.includes('--phone-layout');
if(phoneLayout)await page.evaluateOnNewDocument(()=>{window.phoneLayout=true;});
if(process.argv.includes('--eager-entry'))await page.evaluateOnNewDocument(()=>{window.eagerEntry=true;});
if(failFrame)await page.evaluateOnNewDocument(()=>{window.failFirstFrame=true;});
if(process.argv.includes('--retry-text'))await page.evaluateOnNewDocument(()=>{window.dropTextOnce=true;});
if(process.argv.includes('--legacy-runtime'))await page.evaluateOnNewDocument(()=>{
  // Some phone 2D contexts only implement the older path primitives.
  for(const method of ['ellipse','roundRect','setLineDash'])delete CanvasRenderingContext2D.prototype[method];
  delete window.BigInt;
  delete DataView.prototype.setBigUint64;
  delete Array.prototype.flat;
  delete Array.prototype.flatMap;
  delete String.prototype.matchAll;
  delete String.prototype.replaceAll;
  delete Object.fromEntries;
  delete Object.hasOwn;
  delete Promise.prototype.finally;
  delete Array.prototype.at;
  delete String.prototype.at;
  window.TextDecoder=window.TextEncoder=undefined;
});
await page.goto('http://127.0.0.1:'+srv.address().port);
console.log('CDP',b.wsEndpoint(),dir);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function verifyProgressImage(percent, filename){
  const image=await page.screenshot(filename?{path:path.join(dir,filename)}:{});
  const {data,info:{width,height,channels}}=await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const pixel=Math.max(1,Math.round(Math.min(width/185,height/110)));
  const cx=Math.floor(width/2),cy=Math.floor(height*.12);
  const half=Math.floor(Math.min(width*.27,height*.28));
  const red=(x,y)=>data[((height-1-Math.floor(y))*width+Math.floor(x))*channels];
  let filled=0;
  for(let x=cx-half;x<cx+half;x++)if(red(x,cy-pixel)>140)filled++;
  assert.ok(Math.abs(filled-2*half*percent/100)<=1,'Progress bar length at '+percent+'%');
  const label=percent+'%', start=cx-(label.length*4-1)*pixel/2;
  const expected={'0':0o75557,'5':0o74717,'6':0o74757,'7':0o71222,'9':0o75717,'%':0o51245};
  for(let i=0;i<label.length;i++){
    let bits=0;
    for(let y=4;y>=0;y--)for(let x=0;x<3;x++)
      bits=bits*2+Number(red(start+(4*i+x+.5)*pixel,cy+(2+y+.5)*pixel)>210);
    assert.equal(bits,expected[label[i]],'Visible character '+label[i]+' in '+label);
  }
  if(percent===95){
    // At this stage the forest backdrop should be visible above the panel.
    const upper=await sharp(image).extract({left:0,top:0,width,height:Math.floor(height/2)}).png().toBuffer();
    const {channels:rgb}=await sharp(upper).removeAlpha().stats();
    assert.ok(rgb.some(channel=>channel.max-channel.min>40),'Scene was covered by the loading panel');
  }
}
async function verifyStartup(){
  await page.waitForFunction(()=>window.textRequested&&window.playDownloaded||window.problem,{timeout:20000});
  if(await page.evaluate(()=>window.problem))throw Error(await page.evaluate(()=>window.problem));
  await verifyProgressImage(50);
  await page.evaluate(()=>window.reportTextProgress(50));
  await verifyProgressImage(67,'00-loading.png');
  console.log('Verified 50% and 67% labels and bar lengths during a stalled download');
  await page.evaluate(()=>window.releaseTextDownload());
  if(failFrame){
    await page.waitForFunction(()=>window.problem,{timeout:20000});
    const message=await page.evaluate(()=>window.problem);
    if(!message.includes('test: first game frame failed'))throw Error(message);
    assert.ok(!(await page.evaluate(()=>bootPercentages.includes(100))),'Failed home frame reached 100%');
    console.log('First game frame error reached the native startup dialog');
    return;
  }
  await page.waitForFunction(()=>window.bootPercentages.filter(n=>n===95).length>=2||window.problem,{timeout:60000});
  if(await page.evaluate(()=>window.problem))throw Error(await page.evaluate(()=>window.problem));
  await verifyProgressImage(95,'00-background.png');
  await page.evaluate(()=>window.releaseHomeStatus());
  await page.waitForFunction(()=>window.app?.screen?.querySelector('button')||window.problem,{timeout:90000});
  if(await page.evaluate(()=>window.problem))throw Error(await page.evaluate(()=>window.problem));
  await page.waitForFunction(()=>!window.loadingTitle&&window.app?.screen?.querySelector('.auth-body button'),{timeout:15000});
  const canvasChecks=await page.evaluate(()=>{
    const screen=inspected.doc.getElementById('game'),gl=screen.getContext('webgl2');
    const canvas=inspected.doc.createElement('canvas'),ctx=canvas.getContext('2d');
    ctx.fillStyle='#123456';ctx.fillRect(0,0,2,2);
    const target=inspected.doc.createElement('canvas'),copy=target.getContext('2d');
    copy.drawImage(canvas,0,0);
    const raw=screen._surface.getContext('webgl2'),property=Object.getOwnPropertyDescriptor(raw,'canvas');
    return [property.configurable,property.writable,raw.canvas===screen._surface,gl.canvas===screen,
      ctx.canvas===canvas,Reflect.set(gl,'canvas',canvas),gl.getParameter===gl.getParameter,
      Boolean(gl.getParameter(gl.VERSION)),Array.from(copy.getImageData(0,0,1,1).data)];
  });
  assert.deepEqual(canvasChecks,[false,false,true,true,true,false,true,true,[18,52,86,255]]);
  // Exercise both consumers: named HTML entities and imported CSS data URLs.
  const decoded=await page.evaluate(()=>{
    const el=inspected.doc.createElement('div'),style=inspected.doc.createElement('style');
    el.innerHTML='&amp;&Afr;&NotEqualTilde;';
    style.textContent='@import url("data:text/css;base64,LnByb2JlIHsgY29sb3I6IHJlZDsgfQ");';
    return [el.textContent,style.sheet.cssRules[0].styleSheet.cssRules[0]?.style.getPropertyValue('color')];
  });
  if(decoded[0]!=='&𝔄≂̸'||decoded[1]!=='red')throw Error('Base64 decode regression: '+JSON.stringify(decoded));
  const dimensions=await page.evaluate(()=>{
    const style=inspected.doc.createElement('style');
    style.textContent='.probe{width:99.9999995px;left:-0.0000004px;top:-1.2345675px;opacity:0.12345678}';
    const values=style.sheet.cssRules[0].style;
    return ['width','left','top','opacity'].map(key=>values.getPropertyValue(key)).join(' ');
  });
  if(dimensions!=='100px 0px -1.234568px 0.123457')throw Error('CSS number formatting regression: '+dimensions);
  if(!phoneLayout)await page.evaluate(()=>window.releaseOptionalDownloads());
  async function shown(selector,expected=1){
    try{await page.waitForFunction((selector,expected)=>{
      const elements=[...inspected.doc.querySelectorAll(selector)];
      return elements.length===expected&&elements.every(el=>{
        const b=inspected.layout.box(el);
        return b&&b.opacity>0&&b.w>1&&b.h>1&&b.x>=b.clip.x-1&&b.y>=b.clip.y-1&&
          b.x+b.w<=b.clip.r+1&&b.y+b.h<=b.clip.b+1;
      });
    },{timeout:10000},selector,expected);}
    catch(error){
      const boxes=await page.evaluate(sel=>[...inspected.doc.querySelectorAll(sel)].map(el=>{
        const b=inspected.layout.box(el);
        return b&&[b.x,b.y,b.w,b.h,b.clip];
      }),selector);
      await page.screenshot({path:path.join(dir,'layout-failure.png')});
      throw Error('Not fully visible: '+selector+' ('+expected+' expected) '+JSON.stringify(boxes),{cause:error});
    }
  }
  async function resize(width,height){
    await page.setViewport({width,height,deviceScaleFactor:2});
    await page.waitForFunction((w,h)=>inspected.env.innerWidth===(w<=h?w:w-44)&&
      inspected.env.innerHeight===(w<=h?h-98:h-44)&&inspected.env.matchMedia('(orientation: portrait)').matches===(w<=h),
      {timeout:5000},width,height);
  }
  async function tap(selector,match){
    const target=await page.waitForFunction((selector,match)=>{
      if(inspected.doc.querySelector('.wipe'))return false;
      for(const el of inspected.doc.querySelectorAll(selector)){
        if(match&&!el.textContent.includes(match)||el.offsetWidth<=2)continue;
        const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
        if(el.contains(inspected.layout.hit(x,y))){
          const screen=inspected.doc.getElementById('game').getBoundingClientRect();
          window.tap(x-screen.left,y-screen.top);return {x,y,label:el.textContent.slice(0,50)};
        }
        el.scrollIntoView();
      }
      return false;
    },{timeout:45000},selector,match);
    console.log('touch',await target.jsonValue());await target.dispose();await sleep(450);
  }
  await sleep(500);await page.screenshot({path:path.join(dir,'01-start.png')});
  if(phoneLayout){await shown('.auth-body button');await shown('.auth-note');}
  await tap('.auth-body button');
  if(phoneLayout){
    await resize(375,720);
    await shown('.sp-card',3);await shown('.sp-pas span',3);await shown('.sp-move',3);await shown('.sp-go');
    const previews=await page.evaluate(()=>[...inspected.doc.querySelectorAll('.sp-show canvas')].map(canvas=>
      canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((v,i)=>i%4===3&&v>0)));
    assert.deepEqual(previews,[true,true,true],'All partners have a visible glyph while artwork is downloading');
    await page.evaluate(()=>window.releaseOptionalDownloads());
    await page.screenshot({path:path.join(dir,'01-partners.png')});
    // Choose a different card on a short phone, then switch back for the run.
    await resize(320,568);
    await tap('.sp-card:nth-child(3)');
    assert.ok(await page.evaluate(()=>inspected.doc.querySelector('.sp-card:nth-child(3)').classList.contains('on')));
    await tap('.sp-card:nth-child(2)');
    await shown('.sp-go');
  }
  await tap('.sp-go');
  await page.waitForFunction(()=>inspected.doc.querySelector('.lite-home'),{timeout:16000});
  await sleep(1000);await page.screenshot({path:path.join(dir,'02-home.png')});
  if(phoneLayout){
    for(const [w,h] of [[320,568],[430,932],[768,1024],[812,360],[390,844]]){
      await resize(w,h);
      await shown('.lite-mon',3);await shown('.lite-actions button',3);await shown('.lite-save');
    }
  }
  await tap('.lite-home .lite-mon:nth-child(2)');
  const buttons=await page.evaluate(()=>[...inspected.doc.querySelectorAll('#ui button')].map(e=>[e.className,e.textContent.slice(0,20)]));console.log('roster',buttons.slice(-15));
  if(phoneLayout){
    await shown('.ls-grid .ls-name',3);await shown('.ls-cta .ls-go');
    await page.screenshot({path:path.join(dir,'02-roster.png')});
    const scroll=await page.evaluate(()=>{
      const profile=inspected.doc.querySelector('.ls-profile'),r=profile.getBoundingClientRect();
      const screen=inspected.doc.getElementById('game').getBoundingClientRect();
      const x=r.left+r.width*.5-screen.left,y=r.top+r.height*.75-screen.top;
      const before=profile.scrollTop;
      window.tap(x,y,'down');window.tap(x,y-64,'move');window.tap(x,y-64,'up');
      return profile.scrollTop-before;
    });
    assert.ok(scroll>20,'Partner details respond to a swipe');
    await shown('.ls-cta .ls-go');
  }
  await tap('.ls-go');
  if(phoneLayout){
    await shown('.lite-bosses>div',4);await shown('.lite-actions button',3);await shown('.lite-map .btn.big');
    await page.screenshot({path:path.join(dir,'02-map.png')});
  }
  await tap('.lite-map button','进入森林');
  await page.waitForFunction(()=>window.app?.run?.glyphHero&&app.run.glyphActors,{timeout:60000});
  await page.waitForFunction(()=>app.run.glyphHero.ready&&app.run.time>3&&app.run.glyphActors.stats.drawn>0,{timeout:90000});
  await page.screenshot({path:path.join(dir,'03-forest.png')});
  if(phoneLayout){
    await shown('.tc-pause');await shown('.tc-jump');await shown('.tl-name');await shown('.ht-biome');
    const hud=await page.evaluate(()=>['.hud-top','.ht-c','.timer'].map(sel=>{
      const b=inspected.layout.box(inspected.doc.querySelector(sel));
      return {sel,x:b.x,y:b.y,w:b.w,h:b.h,naturalH:b.naturalH,metric:b.metric,style:b.el.getAttribute('style')};
    }));
    assert.ok(hud[0].h<70&&hud[2].h<48,'Top HUD intrudes into the playfield: '+JSON.stringify(hud));
    const controlsClear=await page.evaluate(()=>{
      const controls=['.tc-pause','.tc-aim','.tc-ultb','.tc-jump','.tc-dash','.tc-lock','.minimap'].map(sel=>inspected.doc.querySelector(sel).getBoundingClientRect());
      return controls.every((a,i)=>controls.slice(i+1).every(b=>a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top));
    });
    assert.ok(controlsClear,'Portrait combat buttons overlap');
    assert.equal(await page.evaluate(()=>app.hud.els.biome.textContent),'青翠森林');
    const render=await page.evaluate(()=>({world:app.r.composer.inputBuffer.width,screen:app.r.canvas.width,
      ui:inspected.uiCanvas.width,width:app.r.canvas.clientWidth,dynamic:app.r.dynRes}));
    assert.ok(render.screen>=render.ui-1&&render.world>=render.width*1.6*render.dynamic-2,
      'Character strokes should be sampled above logical phone resolution: '+JSON.stringify(render));
    console.log('Portrait render buffers',render);
    const start=await page.evaluate(()=>{
      const screen=inspected.doc.getElementById('game').getBoundingClientRect();
      const x=inspected.env.innerWidth*.2-screen.left,y=inspected.env.innerHeight*.65-screen.top;
      window.tap(x,y,'down');window.tap(x+38,y,'move');
      return {x,y,px:app.run.player.pos.x,pz:app.run.player.pos.z};
    });
    await page.waitForFunction(({px,pz})=>Math.hypot(app.run.player.pos.x-px,app.run.player.pos.z-pz)>.2,{timeout:7000},start);
    const stickOffset=await page.evaluate(({x,y})=>{
      const b=inspected.doc.querySelector('.tc-stick').getBoundingClientRect();
      const screen=inspected.doc.getElementById('game').getBoundingClientRect();
      return Math.hypot(b.x+b.width/2-x-screen.x,b.y+b.height/2-y-screen.y);
    },start);
    assert.ok(stickOffset<5,'The moving stick is drawn away from the thumb: '+stickOffset);
    const multi=await page.evaluate(({x,y})=>{
      const sx=inspected.env.innerWidth*.72;
      window.tap(sx,y,'down',2);window.tap(sx+18,y,'move',2);window.tap(sx+18,y,'up',2);
      return Math.hypot(app.run.input.stickX,app.run.input.stickY);
    },start);
    assert.ok(multi>.1,'A right-thumb camera drag released the left movement stick');
    await page.evaluate(({x,y})=>window.tap(x+38,y,'up'),start);
    const simultaneous=await page.evaluate(({x,y})=>{
      const left={identifier:3,clientX:x,clientY:y},right={identifier:4,clientX:x+190,clientY:y};
      inspected.touches('down',{touches:[left,right],changedTouches:[left,right]});
      const moved={...left,clientX:x+30};
      inspected.touches('move',{touches:[moved,right],changedTouches:[moved]});
      const speed=Math.hypot(app.run.input.stickX,app.run.input.stickY);
      inspected.touches('cancel',{touches:[],changedTouches:[moved,right]});
      return [speed,app.run.input.stickX,app.run.input.stickY];
    },start);
    assert.ok(simultaneous[0]>.1&&simultaneous[1]===0&&simultaneous[2]===0,'Simultaneous touches and cancellation');
    await tap('.tc-pause');
    await page.waitForFunction(()=>app.run.state==='paused');
    await page.screenshot({path:path.join(dir,'04-pause.png')});
    await tap('.modal button','继续');
    await page.waitForFunction(()=>app.run.state==='play');
    // Trigger a real upgrade choice without waiting for a random combat drop.
    await page.evaluate(()=>{app.run.pendingLevels=1;app.run.doLevelUp();});
    await shown('.modal .card h3',3);
    await shown('.modal .actions button',3);
    assert.equal(await page.evaluate(()=>Boolean(inspected.doc.querySelector('body > .run-hint'))),false,'Tutorial covers upgrade choices');
    await page.screenshot({path:path.join(dir,'05-upgrade.png')});
    await tap('.modal .card');await page.waitForFunction(()=>app.run.state==='play');
  }
  console.log('forest',await page.evaluate(()=>({stage:app.run.stage,state:app.run.state,hero:app.run.player.speciesId,boxes:inspected.doc.body.textContent.slice(-350),time:app.run.time})));
  if(phoneLayout){
    const runs=await page.evaluate(()=>app.meta.profile.counters.runs||0);
    await resize(320,568);
    await tap('.tc-pause');
    await tap('.pz .sm-foot .btn.red');
    await tap('.pz .sm-foot .btn.armed');
    await shown('.sm-modal .sm-foot button',2);
    const scrolled=await page.evaluate(()=>{
      const list=inspected.doc.querySelector('.sm-modal .sm-body'),b=list.getBoundingClientRect(),
        screen=inspected.doc.getElementById('game').getBoundingClientRect();
      const x=b.left+b.width/2-screen.left,y=b.top+b.height*.8-screen.top;
      window.tap(x,y,'down');window.tap(x,y-56,'move');window.tap(x,y-56,'up');
      return list.scrollTop;
    });
    assert.ok(scrolled>20,'Short-phone results must scroll independently of the menu buttons');
    await page.screenshot({path:path.join(dir,'06-result.png')});
    await tap('.sm-modal .sm-foot button:first-child');
    await page.waitForFunction(()=>inspected.doc.querySelector('.lite-home')&&!app.run);
    assert.equal(await page.evaluate(()=>app.meta.profile.counters.runs),runs+1);
    console.log('Short-phone settlement returned to the home screen with the run saved');
  }
  const missing=await page.evaluate(()=>[...missingAssets]);if(missing.length)throw Error('Missing local assets: '+missing.join(', '));
  if(errors.length)throw Error(errors[0]);
  if(!homePainted)throw Error('Game entered the forest without completing the startup handoff');
  const values=await page.evaluate(()=>bootPercentages);
  assert.equal(values[0],0);
  for(let i=1;i<values.length;i++)assert.ok(values[i]>=values[i-1],'Progress moved backwards');
  assert.equal(values[values.length-1],100);
  assert.equal(values.filter(n=>n===100).length,1);
  console.log('Boot percentages through the first home frame:',[...new Set(values)].join(', '));
}
try{await verifyStartup();}
catch(error){console.error('Stopped on',await page.evaluate(()=>({screen:window.app?.screen?.className,state:window.app?.run?.state,
    text:window.inspected?.doc.body.textContent.slice(-400),errors:window.problem,
    boxes:[...(window.inspected?.doc.querySelectorAll('.lite-map button')||[])].map(el=>{const r=el.getBoundingClientRect();return [el.textContent,r.x,r.y,r.width,r.height,inspected.layout.hit(r.x+r.width/2,r.y+r.height/2)?.className];}),
    missing:[...(window.missingAssets||[])]})));throw error;
 }finally{await b.close();srv.close();}
