// Two isolated saves, the built WeChat entry, real WebGL and the real relay.
import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import puppeteer from 'puppeteer-core';
import {verifyTouchMovement} from './verify-touch.mjs';
import {RelayRoom} from '../source/src/multiplayer.js';

const root=path.resolve(import.meta.dirname,'..'),game=path.join(root,'minigame');
const output=path.join(root,'验收','多人联机');fs.mkdirSync(output,{recursive:true});
const fixture=(await build({bundle:true,entryPoints:[path.join(import.meta.dirname,'wx-fixture.mjs')],write:false,format:'iife'})).outputFiles[0].text;
const packages=JSON.parse(fs.readFileSync(path.join(game,'game.json'))).subpackages;
const modules=[],data={main:[]},entries={};
for(const pkg of packages){data[pkg.name]=[];entries[pkg.name]=pkg.root.endsWith('.js')?pkg.root:pkg.root.replace(/\/$/,'')+'/game.js';}
for(const entry of fs.readdirSync(game,{recursive:true})){
  const name=entry.split(path.sep).join('/'),pkg=packages.find(({root})=>name===root||name.startsWith(root.replace(/\/$/,'')+'/'));
  if(!pkg&&name.endsWith('.js'))modules.push(name);
  if(/\.(br|bin)$/.test(name))data[pkg?.name||'main'].push(name);
}
const definitions=modules.map(name=>'defs['+JSON.stringify(name)+']=function(require,module,exports){\n'+fs.readFileSync(path.join(game,name),'utf8')+'\n};').join('\n');
const boot='const defs={},cache={};\n'+definitions+`
function load(p){if(cache[p])return cache[p].exports;const m=cache[p]={exports:{}};defs[p](q=>load(p.slice(0,p.lastIndexOf('/')+1)+q.slice(2)+'.js'),m,m.exports);return m.exports;}
loadFixtureData('main').then(()=>load('game.js')).catch(e=>{window.problem=e.message;console.error(e)});`;
const files=new Set([...Object.values(data).flat(),...Object.values(entries)]);
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<meta charset="utf-8"><style>*{margin:0}canvas{display:block;width:100vw;height:100vh}</style><body><script src="/fixture.js"></script><script src="/boot.js"></script>');}
  if(req.url==='/fixture.js'||req.url==='/boot.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(req.url==='/boot.js'?boot:'window.packageData='+JSON.stringify(data)+';window.packageEntries='+JSON.stringify(entries)+';'+fixture);}
  if(files.has(req.url.slice(1))){if(req.url.endsWith('.js'))res.setHeader('Content-Type','text/javascript');return fs.createReadStream(path.join(game,req.url.slice(1))).pipe(res);}
  res.statusCode=req.url==='/favicon.ico'?204:404;res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const relay=spawn(path.join(root,'backend/dist/ziling-server-'+(process.platform==='win32'?'windows-amd64.exe':'linux-amd64')),['-listen','127.0.0.1:'+port],{stdio:['ignore','pipe','pipe']});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const errors=[],pages=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function tap(page,selector,text){
  await page.waitForFunction((selector,text)=>{
    const {doc,layout}=inspected;
    if(doc.querySelector('.wipe'))return false;
    for(const el of doc.querySelectorAll(selector)){
      if(text&&!el.textContent.includes(text)||el.disabled||el.offsetWidth<2)continue;
      const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      if(el.contains(layout.hit(x,y))){const c=doc.getElementById('game').getBoundingClientRect();window.tap(x-c.left,y-c.top);return true;}
      el.scrollIntoView();
    }return false;
  },{timeout:45000},selector,text);await sleep(300);
}
try{
  for(let i=0;i<2;i++){
    const context=await browser.createBrowserContext(),page=await context.newPage();pages.push(page);
    await page.setViewport({width:844,height:390,deviceScaleFactor:i===0?3:2});
    page.on('pageerror',e=>errors.push(e.stack||e.message));
    page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404')){errors.push(m.text());console.log('client',i,m.text());}});
    await page.evaluateOnNewDocument(()=>{window.phoneLayout=true;for(const key of ['Intl','Buffer','atob','btoa'])delete window[key];});
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.releaseTextDownload&&window.releaseOptionalDownloads,{timeout:15000});
    await page.evaluate(()=>{releaseTextDownload();releaseOptionalDownloads();});
    await page.waitForFunction(()=>window.app?.meta&&window.inspected?.doc.querySelector('.auth-body button'),{timeout:45000});
    await page.evaluate(port=>{const factory=inspected.env.createCoopSocket;inspected.env.createCoopSocket=(_url,events)=>factory('ws://127.0.0.1:'+port+'/ws',events);},port);
    await tap(page,'.auth-body button');await tap(page,'.sp-go');
    await tap(page,'.lite-home button','多人联机');
    await page.evaluate(i=>{
      const input=inspected.doc.querySelector('input[aria-label="你的昵称"]');input.value='伙伴'+(i+1);input.dispatchEvent(new inspected.env.Event('input',{bubbles:true}));
    },i);
  }
  const [host,guest]=pages;
  await tap(host,'button','怎么玩');
  assert.ok(await host.evaluate(()=>inspected.doc.querySelector('.coop-help').textContent.includes('左侧按住拖动摇杆')));
  await tap(host,'button','收起说明');
  await tap(host,'button','创建房间');await host.waitForFunction(()=>app.coopRoom?.code,{timeout:30000});
  const code=await host.evaluate(()=>app.coopRoom.code);
  await tap(host,'button','复制房间号');
  assert.equal(await host.evaluate(()=>window.fixtureClipboard),code);
  await guest.evaluate(code=>{window.fixtureClipboard=code;},code);
  await tap(guest,'button','粘贴房间号');
  assert.equal(await guest.evaluate(()=>inspected.doc.querySelector('input[aria-label="六位房间号"]').value),code);
  await tap(host,'button','邀请好友');
  const share=await host.evaluate(()=>window.fixtureShare);
  assert.equal(new URLSearchParams(share.query).get('room'),code);
  // Re-enter from a shared card while the game is already open.
  await tap(guest,'button','返回首页');
  await guest.evaluate(query=>window.fixtureEvent('Show',{query}),Object.fromEntries(new URLSearchParams(share.query)));
  await guest.waitForFunction(code=>inspected.doc.querySelector('input[aria-label="六位房间号"]')?.value===code,{},code);
  await tap(guest,'button','加入房间');await guest.waitForFunction(()=>app.coopRoom?.room.members.length===2,{timeout:30000});
  await tap(guest,'.lite-actions button','火');
  // A full lobby must remain usable on a short landscape phone, including
  // the host's controls below the member list. Extra peers use the real relay.
  const extra=[];
  try {
    for(let i=3;i<=4;i++)extra.push(await RelayRoom.connect({url:'ws://127.0.0.1:'+port+'/ws',code,name:'伙伴'+i,species:1}));
    await host.waitForFunction(()=>app.coopRoom.room.members.length===4);
    await host.setViewport({width:667,height:375,deviceScaleFactor:2});
    await tap(host,'button','复制房间号');
    assert.equal(await host.evaluate(()=>fixtureClipboard),code);
    await tap(host,'button','准备');
    assert.equal(await host.evaluate(()=>app.coopRoom.mine.ready),true);
    await host.screenshot({path:path.join(output,'01-四人房间-短横屏.png')});
    assert.ok(await host.evaluate(()=>{
      const button=[...inspected.doc.querySelectorAll('button')].find(el=>el.textContent==='开始冒险');
      const b=inspected.layout.box(button);
      return b.y>=b.clip.y&&b.y+b.h<=b.clip.b+1;
    }),'Full lobby must show the complete host start button without scrolling');
    await tap(host,'button','取消准备');
  } finally {for(const session of extra)await session.leave();}
  await host.waitForFunction(()=>app.coopRoom.room.members.length===2);
  await host.setViewport({width:844,height:390,deviceScaleFactor:3});
  // Both players must prepare. The host start button stays disabled beforehand.
  assert.equal(await host.evaluate(()=>[...inspected.doc.querySelectorAll('button')].find(e=>e.textContent==='开始冒险').disabled),true);
  await tap(host,'button','准备');await tap(guest,'button','准备');
  await host.screenshot({path:path.join(output,'01-房间.png')});
  if(process.argv.includes('--lobby-only')) {
    console.log('Native lobby checks passed: invitations, clipboard and four-player short landscape layout');
  } else {
  await tap(host,'button','开始冒险');
  for(const page of pages)await page.waitForFunction(()=>app.run?.coop&&app.run.state==='play',{timeout:45000});
  for(const page of pages){await page.evaluate(()=>{app.run.player.iframes=3600;});await page.waitForFunction(()=>[...app.run.coop.peers.values()].some(p=>p.last),{timeout:15000});}
  const graphics=await host.evaluate(()=>{
    // Chrome's software renderer deliberately defaults to low quality. Select
    // the same high preset offered to the player before measuring its buffers.
    app.meta.profile.settings.quality='high';app.applySettings();
    const r=app.r; r.setDynRes(1);r.resize();
    const base=r.composer.inputBuffer.width,ui=inspected.uiCanvas.width;
    r.setDynRes(.6);r.resize();const minimum=r.composer.inputBuffer.width;
    r.setDynRes(1);r.resize();
    return {base,minimum,ui,width:innerWidth,dpr:devicePixelRatio,quality:{...r.quality}};
  });
  assert.equal(graphics.quality.saver,false,'Phone screen size must not automatically enable battery saver');
  assert.ok(graphics.base>=graphics.width*2.45,'High quality world must render above 2x CSS pixels on a 3x phone: '+JSON.stringify(graphics));
  assert.ok(graphics.minimum>=graphics.width*1.49,'Dynamic resolution must retain readable world details');
  assert.ok(graphics.ui>=graphics.width*2.9,'HUD must use the phone pixel density');
  const seeds=await Promise.all(pages.map(page=>page.evaluate(()=>({seed:app.run.seed,party:app.run.coop.party,stage:app.run.stage,peers:app.run.coop.peers.size}))));
  assert.equal(seeds[0].seed,seeds[1].seed);assert.equal(seeds[0].party,seeds[1].party);assert.equal(seeds[0].peers,1);
  const movement=await verifyTouchMovement(host);
  if(await host.evaluate(()=>app.run.state==='paused'))await tap(host,'.modal button','继续');
  const position=await host.evaluate(()=>({x:app.run.player.pos.x,z:app.run.player.pos.z}));
  await guest.waitForFunction(pos=>{const peer=[...app.run.coop.peers.values()][0];return Math.hypot(peer.x-pos.x,peer.z-pos.z)<1;},{timeout:10000},position);
  for(const page of pages)await page.evaluate(()=>{
    const r=app.run,e=r.enemies,p=r.player.pos;
    const i=e.spawn(52,p.x+12,p.z-3,1,1,0);e.hp[i]=e.maxHp[i]=100000;e.y[i]=r.terrain.surface(e.x[i],e.z[i]);
    e.frozen[i]=3600;window.coopGlyphIndex=i;
  });
  for(const page of pages)await page.waitForFunction(()=>app.run.coop.proxies.size>0,{timeout:25000});
  for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:path.join(output,'02-玩家'+(i+1)+'-森林.png')});
  const proxies=await Promise.all(pages.map(page=>page.evaluate(()=>app.run.coop.proxies.size)));
  assert.ok(proxies.every(n=>n>0),'Both clients receive shared enemies');
  // Attack the host's enemy from the guest. HP and the glyph must round-trip
  // through the owner's combat calculation rather than a local visual effect.
  const glyph=await host.evaluate(()=>{const r=app.run,e=r.enemies,i=window.coopGlyphIndex;return {key:((e.gen[i]&15)<<12)|(i&4095),slot:r.coop.mySlot,glyph:'止',step:1};});
  await guest.evaluate(g=>{
    const r=app.run;
    for(const i of r.coop.proxies.values())if(r.coop.pSlot[i]===g.slot&&r.coop.pKey[i]===g.key){
      r.combat.hit(i,30000,{type:'normal',cls:'physical',fixed:true,noReact:true,silent:true,knock:0});return;
    }throw Error('Missing proxy for combat test');
  },glyph);
  await host.waitForFunction(()=>app.run.enemies.hp[window.coopGlyphIndex]<80000&&app.run.glyphActors.states.get(window.coopGlyphIndex)?.glyph==='止',{timeout:12000});
  await guest.waitForFunction(g=>{
    const r=app.run;
    for(const i of r.coop.proxies.values())if(r.coop.pSlot[i]===g.slot&&r.coop.pKey[i]===g.key)return r.glyphActors.states.get(i)?.step>=g.step;
    return false;
  },{timeout:12000},glyph);
  // A lost relay connection must visibly end this client's run.
  await guest.evaluate(()=>window.fixtureSockets[window.fixtureSockets.length-1].close());
  await guest.waitForFunction(()=>app.run.state==='over',{timeout:15000});
  await guest.waitForFunction(()=>app.meta.profile.runs[0]?.coop?.members?.length===2,{timeout:12000});
  await host.waitForFunction(()=>[...app.run.coop.peers.values()].every(p=>p.gone),{timeout:10000});
  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,seeds,proxies,glyph,graphics,movement,checks:['native lobby touch','copy and paste room code','share query and warm invitation entry','four-member short landscape lobby','wx SocketTask transport','shared seed','held joystick movement with two fingers','touch release/cancel/background','high DPI world and UI','peer movement','shared enemies','remote combat and glyph decomposition','disconnect ends local run','cooperative settlement saved'],errors},null,2));
  console.log('Native multiplayer smoke passed',JSON.stringify({seeds,proxies,glyph}));
  }
}catch(error){
  for(let i=0;i<pages.length;i++){
    await pages[i].screenshot({path:path.join(output,'failure-'+i+'.png')}).catch(()=>{});
    console.log('client state',i,await pages[i].evaluate(()=>({problem:window.problem,text:window.inspected?.doc.body.textContent.slice(-2500),state:window.app?.run?.state})).catch(()=>null));
  }throw error;
}finally{await browser.close();await new Promise(r=>server.close(r));if(relay.exitCode===null)relay.kill();}
