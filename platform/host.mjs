import 'core-js/modules/es.array.at.js';
import 'core-js/modules/es.array.flat.js';
import 'core-js/modules/es.array.flat-map.js';
import 'core-js/modules/es.object.from-entries.js';
import 'core-js/modules/es.object.has-own.js';
import 'core-js/modules/es.promise.finally.js';
import 'core-js/modules/es.string.at-alternative.js';
import 'core-js/modules/es.string.match-all.js';
import 'core-js/modules/es.string.replace-all.js';
import * as D from 'linkedom/worker';
import {strFromU8,strToU8} from 'fflate';
import {LocalURL,Params} from './url.mjs';
import {createFetch,Headers,Request,Response,Blob} from './http.mjs';
import {createLayout} from './layout.mjs';
import {readUIAssets} from './reference.mjs';
import {paint,compositor} from './paint.mjs';
import {installSurfaces} from './surfaces.mjs';
import {CanvasPath} from './path.mjs';
import {cloneData} from './clone.mjs';
import {initCrypto,random} from './crypto.mjs';
import {dispatchApi} from 'ziling:api';

class InputEvent extends D.Event {
  constructor(type,options={}){super(type,{bubbles:options.bubbles!==false,cancelable:true});Object.assign(this,options);}
}
class AbortSignal extends D.EventTarget {static any(signals){return signals[0];}}
class AbortController {constructor(){this.signal=new AbortSignal();}abort(){this.signal.aborted=true;this.signal.dispatchEvent(new D.Event('abort'));}}
class TextDecoder {decode(input){return strFromU8(new Uint8Array(input?.buffer||input||0,input?.byteOffset||0,input?.byteLength));}}
class TextEncoder {encode(text){return strToU8(text);}}
function storage(prefix) {
  return {getItem(k){const v=wx.getStorageSync(prefix+k);return v===''||v===undefined?null:String(v);},
    setItem(k,v){wx.setStorageSync(prefix+k,String(v));},removeItem(k){wx.removeStorageSync(prefix+k);}};
}
export async function setup(host) {
  await initCrypto();
  const {document:doc}=D.parseHTML('<!doctype html><html><head></head><body><canvas id="game"></canvas><div id="ui"></div></body></html>');
  const win=new D.EventTarget(),system=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();
  const view={w:system.windowWidth,h:system.windowHeight,dpr:system.pixelRatio||1};
  if(system.safeArea)view.insets={left:system.safeArea.left,top:system.safeArea.top,
    right:Math.max(0,view.w-system.safeArea.right),bottom:Math.max(0,view.h-system.safeArea.bottom)};
  const {Image,makeCanvas,screen}=installSurfaces(D,doc,host,view);
  let scale=Math.min(view.dpr,2);const uiCanvas=makeCanvas();uiCanvas.width=Math.round(view.w*scale);uiCanvas.height=Math.round(view.h*scale);
  const fonts={};
  for(const weight of ['regular','bold'])fonts[weight]=wx.loadFont(host.files.pathFor('fonts/'+weight+'.ttf'))||'sans-serif';
  host.fonts=fonts;
  const uiAssets=readUIAssets(host.files);
  let layout=createLayout(doc,view,uiCanvas,fonts,uiAssets);
  let draw=null,last=-Infinity,dirty=true,active=null,captured=new Map(),pointers=new Map();
  const property=(key,get,set)=>Object.defineProperty(D.Element.prototype,key,{configurable:true,get,set});
  function rect(el) {
    const box=el===screen||el===doc.documentElement||el===doc.body?{x:0,y:0,w:view.w,h:view.h}:layout.box(el)||{x:0,y:0,w:0,h:0};
    return {x:box.x,y:box.y,left:box.x,top:box.y,width:box.w,height:box.h,right:box.x+box.w,bottom:box.y+box.h};
  }
  for(const prefix of ['client','offset'])for(const [dim,key,measured] of [['Width','width','naturalW'],['Height','height','naturalH']])
    property(prefix+dim,function(){return layout.box(this)?.[measured]??rect(this)[key];});
  property('offsetLeft',function(){return rect(this).left;});property('offsetTop',function(){return rect(this).top;});
  property('scrollHeight',function(){return this.clientHeight+(this._scrollMax||0);});
  property('scrollWidth',function(){return this.clientWidth;});
  property('scrollTop',function(){return this._scroll||0;},function(n){this._scroll=Math.min(this._scrollMax||0,Math.max(0,n));dirty=true;});
  D.Element.prototype.getBoundingClientRect=function(){return rect(this);};
  D.Element.prototype.getClientRects=function(){return this.offsetWidth?[rect(this)]:[];};
  D.Element.prototype.setPointerCapture=function(id){captured.set(id,this);};
  D.Element.prototype.hasPointerCapture=function(id){return captured.get(id)===this;};
  D.Element.prototype.releasePointerCapture=function(id){if(captured.get(id)===this)captured.delete(id);};
  D.Element.prototype.focus=function(){active=this;this.dispatchEvent(new D.Event('focus'));};
  D.Element.prototype.blur=function(){if(active===this)active=null;this.dispatchEvent(new D.Event('blur'));};
  D.Element.prototype.scrollIntoView=function(){for(let p=this.parentElement;p;p=p.parentElement)if(p._scrollMax){p.scrollTop+=rect(this).y-rect(p).y;break;}};
  D.Element.prototype.scrollTo=function(x,y){this.scrollTop=typeof x==='object'?x.top||0:y||0;};
  D.Element.prototype.animate=function(_frames,timing){let done,timer;const a={finished:new Promise(r=>{done=r;}),cancel(){clearTimeout(timer);done();}};
    timer=setTimeout(()=>{done();a.onfinish?.();},typeof timing==='number'?timing:(timing?.duration||0));return a;};
  D.Element.prototype.getAnimations=()=>[];
  doc.getAnimations=()=>[];
  doc.fonts={ready:Promise.resolve(),load:()=>Promise.resolve([])};doc.hasFocus=()=>!doc.hidden;
  doc.hidden=false;doc.visibilityState='visible';doc.elementFromPoint=(x,y)=>layout.hit(x,y);
  Object.defineProperty(doc,'activeElement',{get:()=>active||doc.body});
  doc.exitPointerLock=()=>{};doc.documentElement.requestFullscreen=()=>Promise.resolve();doc.exitFullscreen=()=>Promise.resolve();
  const fs=wx.getFileSystemManager(),localStorage=storage('ziling.web.');
  let locale=localStorage.getItem('pokebonk.lang')||'zh';
  const loc=new LocalURL('https://ziling.local/?touch=1');
  loc.reload=()=>wx.restartMiniProgram?.({});loc.replace=value=>{const next=new LocalURL(value);const lang=next.searchParams.get('lang');if(lang)localStorage.setItem('pokebonk.lang',lang);loc.reload();};
  const history={state:null,pushState(state){this.state=state;},replaceState(state){this.state=state;},back(){win.dispatchEvent(new D.Event('popstate'));}};
  const matchMedia=q=>Object.assign(new D.EventTarget(),{media:q,matches:/pointer:\s*coarse|hover:\s*none|orientation:\s*landscape/.test(q)});
  function computed(el){return new Proxy(el.style,{get(t,k){if(k==='getPropertyValue')return key=>layout.box(el)?.s[key]||t.getPropertyValue(key)||'';
    const key=String(k).replace(/[A-Z]/g,m=>'-'+m.toLowerCase());return layout.box(el)?.s[key]||t.getPropertyValue(key)||(k==='gridTemplateColumns'?'1fr':'');}});}
  function show(hide){
    doc.hidden=hide;doc.visibilityState=hide?'hidden':'visible';doc.dispatchEvent(new D.Event('visibilitychange'));win.dispatchEvent(new D.Event(hide?'pagehide':'pageshow'));
    if(hide){for(const [id,p] of pointers)p.target.dispatchEvent(new InputEvent('pointercancel',{pointerId:id,pointerType:'touch'}));pointers.clear();captured.clear();}dirty=true;
  }
  wx.onHide(()=>show(true));wx.onShow(()=>show(false));
  function keyboard(el){
    if(!wx.showKeyboard)return;
    wx.showKeyboard({defaultValue:el.value||'',maxLength:Number(el.maxLength)>0?Number(el.maxLength):140,multiple:el.localName==='textarea',confirmType:'done'});
    active=el;
  }
  wx.onKeyboardInput?.(r=>{if(active){active.value=r.value;active.dispatchEvent(new InputEvent('input'));dirty=true;}});
  wx.onKeyboardConfirm?.(r=>{if(active){active.value=r.value;active.dispatchEvent(new InputEvent('change'));active.blur();}wx.hideKeyboard?.({});});
  function setRange(el,x){const b=rect(el),lo=+(el.min||0),hi=+(el.max||100),step=+(el.step||1);el.value=String(lo+Math.round(Math.max(0,Math.min(1,(x-b.x)/b.width))*(hi-lo)/step)*step);el.dispatchEvent(new InputEvent('input'));}
  function touches(kind,event){
    dirty=true;
    for(const t of event.changedTouches||event.touches||[]){
      const id=t.identifier??0,x=t.clientX??t.pageX,y=t.clientY??t.pageY;
      let p=pointers.get(id);
      if(kind==='down'){
        const target=layout.hit(x,y);p={target,x,y,lastY:y,scrolled:false};pointers.set(id,p);
      }
      if(!p)continue;
      const target=captured.get(id)||p.target,options={pointerId:id,pointerType:'touch',clientX:x,clientY:y,pageX:x,pageY:y,button:0,buttons:kind==='up'?0:1,isPrimary:pointers.keys().next().value===id,bubbles:true};
      if(kind==='move'&&p.target.type!=='range'){
        for(let sc=p.target;sc;sc=sc.parentElement){
          if(sc._scrollMax>0&&/auto|scroll/.test([layout.box(sc)?.s.overflow,layout.box(sc)?.s['overflow-y']].join(' '))&&Math.abs(y-p.y)>5){
            sc.scrollTop+=p.lastY-y;p.scrolled=true;break;
          }
        }
      }
      p.lastY=y;
      target.dispatchEvent(new InputEvent('pointer'+kind,options));
      win.dispatchEvent(new InputEvent('pointer'+kind,{...options,bubbles:false}));
      target.dispatchEvent(new InputEvent('touch'+({down:'start',move:'move',up:'end',cancel:'cancel'}[kind]),{touches:event.touches||[],changedTouches:event.changedTouches||[],bubbles:true}));
      const input=p.target.closest?.('input,textarea');
      if(input?.type==='range'&&(kind==='down'||kind==='move'))setRange(input,x);
      if(kind==='up'||kind==='cancel'){
        if(kind==='up'&&!p.scrolled&&Math.hypot(x-p.x,y-p.y)<15&&!p.target.closest?.('[disabled]')){
          if(input){if(input.type==='checkbox'){input.checked=!input.checked;input.dispatchEvent(new InputEvent('change'));}
            else if(input.type==='range')input.dispatchEvent(new InputEvent('change'));else if(!['button','submit'].includes(input.type))keyboard(input);}
          p.target.dispatchEvent(new InputEvent('click',options));
        }
        captured.delete(id);pointers.delete(id);
      }
    }
  }
  wx.onTouchStart(e=>touches('down',e));wx.onTouchMove(e=>touches('move',e));wx.onTouchEnd(e=>touches('up',e));wx.onTouchCancel(e=>touches('cancel',e));
  const fetch=createFetch(host.files,dispatchApi);
  const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame.bind(globalThis):fn=>setTimeout(()=>fn(Date.now()),16);
  const perf=typeof performance!=='undefined'?performance:{now:Date.now};
  const env=Object.assign(win,{...D,document:doc,Image,HTMLVideoElement:D.HTMLVideoElement,location:loc,history,localStorage,sessionStorage:storage('ziling.session.'),
    Blob,URL:LocalURL,URLSearchParams:Params,fetch,Request,Headers,Response,AbortController,AbortSignal,TextDecoder,TextEncoder,createImageBitmap:undefined,ImageBitmap:undefined,OffscreenCanvas:undefined,
    ProgressEvent:InputEvent,MouseEvent:InputEvent,KeyboardEvent:InputEvent,PointerEvent:InputEvent,Path2D:CanvasPath,MutationObserver:doc.defaultView.MutationObserver,
    innerWidth:view.w,innerHeight:view.h,devicePixelRatio:view.dpr,screen:{width:view.w,height:view.h,orientation:{type:'landscape-primary',lock:()=>Promise.resolve()}},
    navigator:{userAgent:'MicroMessenger MiniGame',language:'zh-CN',languages:['zh-CN'],maxTouchPoints:5,getGamepads:()=>[],onLine:true},
    AudioContext:wx.createWebAudioContext?class {constructor(){return wx.createWebAudioContext();}}:undefined,
    crypto:{getRandomValues(a){new Uint8Array(a.buffer,a.byteOffset,a.byteLength).set(random(a.byteLength));return a;}},
    structuredClone:cloneData,
    getComputedStyle:computed,matchMedia,setTimeout:(...args)=>setTimeout(...args),clearTimeout:id=>clearTimeout(id),
    setInterval:(...args)=>setInterval(...args),clearInterval:id=>clearInterval(id),performance:perf,requestAnimationFrame:raf,
    cancelAnimationFrame:typeof cancelAnimationFrame==='function'?cancelAnimationFrame:clearTimeout,
    addEventListener:win.addEventListener.bind(win),removeEventListener:win.removeEventListener.bind(win),dispatchEvent:win.dispatchEvent.bind(win),
    alert:msg=>wx.showModal({title:'字灵',content:String(msg),showCancel:false}),open:()=>null,
    drawUI(renderer){
      const now=perf.now(),changed=dirty||now-last>=80||!draw;
      if(changed){paint(layout,layout.refresh(env.__pb?.run?.state),view,scale);last=now;dirty=false;}
      if(!draw)draw=compositor(renderer.getContext(),uiCanvas);draw(renderer,changed);
    },
    locale,readLocale(lang){const p=host.files.pathFor('locale/'+lang+'.json');return p?JSON.parse(fs.readFileSync(p,'utf8')):{};},
  });
  env.window=env.self=env.globalThis=env;
  wx.onWindowResize?.(size=>{
    const info=wx.getWindowInfo?wx.getWindowInfo():size;
    view.w=env.innerWidth=env.screen.width=info.windowWidth;
    view.h=env.innerHeight=env.screen.height=info.windowHeight;
    view.dpr=env.devicePixelRatio=info.pixelRatio||view.dpr;
    if(info.safeArea)view.insets={left:info.safeArea.left,top:info.safeArea.top,
      right:Math.max(0,view.w-info.safeArea.right),bottom:Math.max(0,view.h-info.safeArea.bottom)};
    scale=Math.min(view.dpr,2);uiCanvas.width=Math.round(view.w*scale);uiCanvas.height=Math.round(view.h*scale);
    layout=createLayout(doc,view,uiCanvas,fonts,uiAssets);dirty=true;env.dispatchEvent(new D.Event('resize'));
  });
  if(host.inspect)host.inspect({env,doc,layout,touches,uiCanvas});
  return env;
}
