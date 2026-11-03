// Local-only test adapter. Uses Chrome's real WebGL2, Canvas 2D, image decoder and touch events.
import {strFromU8,strToU8} from 'fflate';
const storage=new Map(),dirs=new Set(['/userdata']),data=new Map(),archives=new Map(),events={};
// Simulate optional downloads stalling until the guest screen is usable.
const optionalDownloadGate = new Promise(resolve => { window.releaseOptionalDownloads=resolve; });
const textDownloadGate = new Promise(resolve => { window.releaseTextDownload=resolve; });
window.loadFixtureData=async name=>{
  for(const file of window.packageData[name]){
    const response=await fetch('/'+file);
    if(!response.ok)throw Error('Missing packaged file '+file);
    archives.set(file,new Uint8Array(await response.arrayBuffer()));
  }
};
function bytes(path){const v=data.get(path)||archives.get(path);if(!v)throw Error('Missing file '+path);return v;}
const fs={
  accessSync(path){if(!dirs.has(path)&&!data.has(path)&&!archives.has(path))throw Error('ENOENT '+path);},
  mkdirSync(path){dirs.add(path);},rmdirSync(path){for(const f of [...data.keys()])if(f.startsWith(path+'/'))data.delete(f);dirs.delete(path);},
  readdirSync(path){return [...new Set([...dirs,...data.keys()].filter(k=>k.startsWith(path+'/')).map(k=>k.slice(path.length+1).split('/')[0]))];},
  readFileSync(path,encoding){const b=bytes(path);return encoding?strFromU8(b):b.slice().buffer;},
  writeFileSync(path,b){data.set(path,typeof b==='string'?strToU8(b):new Uint8Array(b));},
  copyFileSync(from,to){data.set(to,bytes(from));},renameSync(from,to){data.set(to,bytes(from));data.delete(from);},unlinkSync(path){data.delete(path);},
  readFile({filePath,success,fail}){queueMicrotask(()=>{try{success({data:fs.readFileSync(filePath)});}catch(e){fail(e);}});}
};
let first=true,screen=null;
function canvas(){const el=document.createElement('canvas');if(first){first=false;screen=el;document.body.appendChild(el);}return el;}
const imageSrc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
globalThis.GameGlobal={};
Object.defineProperty(GameGlobal,'ziling',{get(){return window.__host;},set(host){
  window.__host=host;host.inspect=s=>{
    window.inspected=s;
    if(window.failFirstFrame)s.env.drawUI=()=>{throw Error('test: first game frame failed');};
  };host.onApp=app=>window.app=app;
  const resolve=host.files.pathFor;window.missingAssets=new Set();
  host.files.pathFor=url=>{const p=resolve(url);if(!p)window.missingAssets.add(String(url));return p;};
  const resolveAsync=host.files.resolvePath;
  host.files.resolvePath=async url=>{const p=await resolveAsync(url);if(!p)window.missingAssets.add(String(url));return p;};
}});
globalThis.wx={
  env:{USER_DATA_PATH:'/userdata'},getFileSystemManager:()=>fs,getWindowInfo:()=>({windowWidth:innerWidth,windowHeight:innerHeight,pixelRatio:devicePixelRatio}),
  getRandomValues({length,success}){success({randomValues:crypto.getRandomValues(new Uint8Array(length)).buffer});},
  createCanvas:canvas,createOffscreenCanvas:()=>document.createElement('canvas'),
  createImage(){const img=new Image();Object.defineProperty(img,'src',{get(){return imageSrc.get.call(img);},set(path){
    if(data.has(path)){const url=URL.createObjectURL(new Blob([bytes(path)]));img.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});imageSrc.set.call(img,url);}
    else imageSrc.set.call(img,path);
  }});return img;},
  loadFont(path){const family=path.includes('bold')?'Bold'+path.slice(-10):'Face'+path.slice(-14,-4);
    const face=new FontFace(family,bytes(path));document.fonts.add(face);face.load().catch(console.error);return family;},
  createWebAudioContext:()=>new AudioContext(),getStorageSync:k=>localStorage.getItem(k)||'',setStorageSync:(k,v)=>localStorage.setItem(k,v),removeStorageSync:k=>localStorage.removeItem(k),
  showLoading(o){window.loadingTitle=o.title;},hideLoading(){window.loadingTitle=null;},showModal(o){window.problem=o.content;console.error('WX MODAL',o.content);},
  async loadSubpackage(o){try{
    if(o.name==='text'){
      window.textRequested=true;
      await textDownloadGate;
      if(window.dropTextOnce){window.dropTextOnce=false;throw Error('test: dropped download');}
    }
    if(['art','world','sound'].includes(o.name))await optionalDownloadGate;
    await window.loadFixtureData(o.name);
    o.success();}catch(e){o.fail(e);}}
};
for(const [key,event] of Object.entries({TouchStart:'touchstart',TouchEnd:'touchend',TouchMove:'touchmove',TouchCancel:'touchcancel',Hide:'pagehide',Show:'pageshow'})){
  wx['on'+key]=fn=>{events[key]=fn;if(event.startsWith('touch'))document.addEventListener(event,fn,{passive:false});};
}
window.tap=(x,y,kind='tap',id=1)=>{const t={identifier:id,clientX:x,clientY:y,pageX:x,pageY:y};
  const send=k=>events[k]?.({touches:k==='TouchEnd'?[]:[t],changedTouches:[t]});
  if(kind==='tap'||kind==='down')send('TouchStart');if(kind==='move')send('TouchMove');if(kind==='tap'||kind==='up')send('TouchEnd');};
