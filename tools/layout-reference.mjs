// Capture box metrics from the original responsive CSS. Three and the native
// event handlers remain live. Unseen and changing subtrees use runtime layout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import puppeteer from 'puppeteer-core';
const root=path.resolve(import.meta.dirname,'..'),src=path.join(root,'source'),origin='http://127.0.0.1:18189';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ziling-reference-'));
const server=spawn(process.execPath,[path.join(src,'server.mjs')],{cwd:src,env:{...process.env,PORT:'18189',STORE_DIR:temp},windowsHide:true,stdio:['ignore','pipe','pipe']});
const sleep=n=>new Promise(r=>setTimeout(r,n));
const result={views:[],styles:[]},styleIds=new Map();
const sizes=[[844,390],[667,375],[1024,768]];
let browser;
function keyPart(el){
  if(el.nodeType===3)return '#text';
  return el.id?'#'+el.id:(el.localName+'.'+(el.getAttribute('class')||'').trim().split(/\s+/)[0]);
}
function keyHash(parent,label,index){
  let h=parent;
  for(const char of label+':'+index){h=Math.imul(h^char.charCodeAt(0),16777619);}
  return h>>>0;
}
try{
  for(let i=0;i<80;i++){try{if((await fetch(origin+'/local/health')).ok)break;}catch{}await sleep(150);}
  if(server.exitCode!==null)throw Error('Reference server could not bind to its test port.');
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',protocolTimeout:900000,
    headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage();
  page.on('pageerror',e=>console.error('reference',e.message));
  await page.setViewport({width:844,height:390});
  await page.goto(origin+'/?qa=glyph&lang=zh&touch=1');
  await page.waitForSelector('.auth-card',{timeout:90000});
  async function capture(name){
    if(process.argv.includes('--verify-only'))return;
    // The outgoing screen stays mounted until the original swipe finishes.
    await sleep(1100);
    for(const [i,[w,h]] of sizes.entries()){
      result.views[i]??={w,h,screens:{}};
      await page.setViewport({width:w,height:h});await sleep(200);
      const data=await page.evaluate(({keyPartCode,keyHashCode})=>{
        const part=Function('return ('+keyPartCode+')')(),hash=Function('return ('+keyHashCode+')')(),records={};
        function visit(el,id,inheritedStyle){
          let text=el.nodeType===3;
          if(!text&&!['svg','img','canvas','input'].includes(el.localName)&&el.nodeType!==1)return;
          if(text&&!el.textContent.trim())return;
          const s=text?inheritedStyle:getComputedStyle(el);
          if(s.display==='none'||s.visibility==='hidden')return;
          let rect;
          if(text){const range=document.createRange();range.selectNodeContents(el);rect=range.getBoundingClientRect();}
          else rect=el.getBoundingClientRect();
          if(rect.width||rect.height){
            const row=[rect.x,rect.y,rect.width,rect.height].map(v=>Math.round(v*10)/10);
            const style=[s.fontSize,s.fontWeight,s.color,s.backgroundColor,s.borderTopLeftRadius,s.textAlign,s.opacity];
            const position=text?'':[el.style.left,el.style.top,el.style.transform,el.style.width,el.style.height].map(v=>v||'').join('|');
            records[id]=[...row,style,text?el.textContent.trim():null,text?0:el.offsetWidth,text?0:el.offsetHeight,position];
          }
          if(text||['canvas','svg','img','style','script'].includes(el.localName))return;
          const count={};
          for(const child of el.childNodes){
            if(child.nodeType!==1&&child.nodeType!==3||child.nodeType===3&&!child.textContent.trim())continue;
            const label=part(child),index=count[label]||0;count[label]=index+1;
            visit(child,hash(id,label,index),s);
          }
        }
        visit(document.body,1,null);return records;
      },{keyPartCode:keyPart.toString(),keyHashCode:keyHash.toString()});
      for(const row of Object.values(data)){
        const key=JSON.stringify(row[4]);if(!styleIds.has(key)){styleIds.set(key,result.styles.length);result.styles.push(row[4]);}
        row[4]=styleIds.get(key);
      }
      result.views[i].screens[name]=data;
    }
    await page.setViewport({width:844,height:390});console.log('Measured',name);
  }
  const click=sel=>page.$eval(sel,e=>e.click());
  await capture('auth');await click('.auth-body button');
  await page.waitForSelector('.sp-go');await sleep(800);await capture('sp');await click('.sp-go');
  await page.waitForSelector('.lite-home',{timeout:40000});await page.evaluate(()=>{__glyphApp.halted=true;});
  await capture('lite-home');await click('.lite-mon:nth-child(2)');
  await page.waitForSelector('.ls-go');await capture('ls');await click('.ls-go');
  await page.waitForSelector('.lite-map');await capture('lite-map');await click('.lite-map .btn.big.red');
  await page.waitForFunction(()=>window.__glyphApp?.run?.player,{timeout:60000});
  await page.evaluate(()=>{const r=__glyphApp.run;r.ui.hideModal();r.state='play';r.update(.016);});await sleep(1000);
  await capture('play');
  await page.evaluate(()=>__glyphApp.run.pause());await capture('paused');
  if(!process.argv.includes('--verify-only'))fs.writeFileSync(path.join(root,'platform','layout.bin'),deflateSync(JSON.stringify(result),{level:9}));
  console.log('CSS metrics bytes',fs.statSync(path.join(root,'platform/layout.bin')).size);
  if(process.argv.includes('--verify')||process.argv.includes('--verify-only')){
    const report={};
    await page.setViewport({width:320,height:180});await sleep(300);
    const dest=path.join(root,'验收');fs.mkdirSync(dest,{recursive:true});
    for(const name of ['hero','coverage','regression']){
      const script=fs.readFileSync(path.join(import.meta.dirname,'regression',name+'-scene.js'),'utf8');
      const outcome=await page.evaluate(script);
      report[name]=name==='coverage'?{configurations:outcome.testedSpecies,glyphs:outcome.uniqueGlyphs}:outcome.checks;
      console.log(name,name==='coverage'?report[name]:report[name].length);
      fs.writeFileSync(path.join(dest,'合并原版回归.json'),JSON.stringify(report,null,2));
    }
  }
}finally{await browser?.close();server.kill();fs.rmSync(temp,{recursive:true,force:true});}
