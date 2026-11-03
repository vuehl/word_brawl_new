import http from 'node:http';
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
const subpackages=JSON.parse(fs.readFileSync(path.join(game,'game.json'),'utf8')).subpackages || [];
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
await page.setViewport({width:844,height:390,deviceScaleFactor:1});
const failFrame=process.argv.includes('--fail-first-frame');
if(process.argv.includes('--eager-entry'))await page.evaluateOnNewDocument(()=>{window.eagerEntry=true;});
if(failFrame)await page.evaluateOnNewDocument(()=>{window.failFirstFrame=true;});
if(process.argv.includes('--retry-text'))await page.evaluateOnNewDocument(()=>{window.dropTextOnce=true;});
if(process.argv.includes('--legacy-runtime'))await page.evaluateOnNewDocument(()=>{
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
async function verifyStartup(){
  await page.waitForFunction(()=>window.textRequested||window.problem,{timeout:20000});
  if(await page.evaluate(()=>window.problem))throw Error(await page.evaluate(()=>window.problem));
  // Inspect the composited screen while the first resource download is still blocked.
  const cover=await page.screenshot({path:path.join(dir,'00-loading.png')});
  const {data,info}=await sharp(cover).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const at=(x,y)=>3*(Math.floor(y*info.height)*info.width+Math.floor(x*info.width));
  if(data[at(.5,.35)]<190 || data[at(.1,.1)]>80)throw Error('No visible forest boot frame while text download was pending');
  console.log('Boot cover visible before text download');
  await page.evaluate(()=>window.releaseTextDownload());
  if(failFrame){
    await page.waitForFunction(()=>window.problem,{timeout:20000});
    const message=await page.evaluate(()=>window.problem);
    if(!message.includes('test: first game frame failed'))throw Error(message);
    console.log('First game frame error reached the native startup dialog');
    return;
  }
  await page.waitForFunction(()=>window.app?.screen?.querySelector('button')||window.problem,{timeout:90000});
  if(await page.evaluate(()=>window.problem))throw Error(await page.evaluate(()=>window.problem));
  await page.waitForFunction(()=>!window.loadingTitle&&window.app?.screen?.querySelector('.auth-body button'),{timeout:15000});
  await page.evaluate(()=>window.releaseOptionalDownloads());
  async function tap(selector,match){
    const target=await page.waitForFunction((selector,match)=>{
      if(inspected.doc.querySelector('.wipe'))return false;
      for(const el of inspected.doc.querySelectorAll(selector)){
        if(match&&!el.textContent.includes(match)||el.offsetWidth<=2)continue;
        const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
        if(y<0||y>inspected.env.innerHeight){el.scrollIntoView();continue;}
        if(el.contains(inspected.layout.hit(x,y))){window.tap(x,y);return {x,y,label:el.textContent.slice(0,50)};}
      }
      return false;
    },{timeout:45000},selector,match);
    console.log('touch',await target.jsonValue());await target.dispose();await sleep(450);
  }
  await sleep(500);await page.screenshot({path:path.join(dir,'01-start.png')});
  await tap('.auth-body button');await tap('.sp-go');
  await page.waitForFunction(()=>inspected.doc.querySelector('.lite-home'),{timeout:16000});
  await sleep(1000);await page.screenshot({path:path.join(dir,'02-home.png')});
  await tap('.lite-home .lite-mon:nth-child(2)');
  const buttons=await page.evaluate(()=>[...inspected.doc.querySelectorAll('#ui button')].map(e=>[e.className,e.textContent.slice(0,20)]));console.log('roster',buttons.slice(-15));
  await tap('.ls-go');await tap('.lite-map button','进入森林');
  await page.waitForFunction(()=>window.app?.run?.glyphHero&&app.run.glyphActors,{timeout:60000});
  await page.waitForFunction(()=>app.run.glyphHero.ready&&app.run.time>3&&app.run.glyphActors.stats.drawn>0,{timeout:90000});
  await page.screenshot({path:path.join(dir,'03-forest.png')});
  console.log('forest',await page.evaluate(()=>({stage:app.run.stage,state:app.run.state,hero:app.run.player.speciesId,boxes:inspected.doc.body.textContent.slice(-350),time:app.run.time})));
  const missing=await page.evaluate(()=>[...missingAssets]);if(missing.length)throw Error('Missing local assets: '+missing.join(', '));
  if(errors.length)throw Error(errors[0]);
  if(!homePainted)throw Error('Game entered the forest without completing the startup handoff');
}
try{await verifyStartup();}
catch(error){console.error('Stopped on',await page.evaluate(()=>({screen:window.app?.screen?.className,state:window.app?.run?.state,
    text:window.inspected?.doc.body.textContent.slice(-400),errors:window.problem,
    boxes:[...(window.inspected?.doc.querySelectorAll('.lite-map button')||[])].map(el=>{const r=el.getBoundingClientRect();return [el.textContent,r.x,r.y,r.width,r.height,inspected.layout.hit(r.x+r.width/2,r.y+r.height/2)?.className];}),
    missing:[...(window.missingAssets||[])]})));throw error;
 }finally{await b.close();srv.close();}
