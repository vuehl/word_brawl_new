import {CanvasPath} from './path.mjs';
import {LocalURL} from './url.mjs';
// The combat atlas uses ellipses and single-radius rounded rectangles even
// when the phone exposes only the original 2D path primitives.
const pathFallbacks={
  ellipse(x,y,rx,ry,angle,start,end,ccw=false) {
    this.save();
    this.translate(x,y);this.rotate(angle);this.scale(rx,ry);
    this.arc(0,0,1,start,end,ccw);
    this.restore();
  },
  roundRect(x,y,width,height,radius=0) {
    const r=Math.min(radius,Math.abs(width)/2,Math.abs(height)/2);
    const right=x+width,bottom=y+height,dx=Math.sign(width)*r;
    this.moveTo(x+dx,y);
    this.arcTo(right,y,right,bottom,r);this.arcTo(right,bottom,x,bottom,r);
    this.arcTo(x,bottom,x,y,r);this.arcTo(x,y,x+dx,y,r);
    this.closePath();
  },
  // A context without dash support can still stroke the minimap paths.
  setLineDash() {}
};
export function installSurfaces(D,doc,host,view) {
  const rawSet=D.Element.prototype.setAttribute;
  const prop=(obj,key,get,set)=>Object.defineProperty(obj,key,{configurable:true,get,set});
  const screen=doc.getElementById('game');screen._surface=host.canvas;
  const makeCanvas=()=>wx.createOffscreenCanvas?wx.createOffscreenCanvas({type:'2d',width:1,height:1}):wx.createCanvas();
  function surface(el) {
    if(!el._surface){
      el._surface=makeCanvas();el._surface.width=el._width??300;el._surface.height=el._height??150;
    }
    return el._surface;
  }
  for(const dim of ['width','height'])prop(D.HTMLCanvasElement.prototype,dim,function(){return surface(this)[dim];},
    function(n){const dimValue=Math.max(1,Math.floor(Number(n)||1));this['_'+dim]=dimValue;surface(this)[dim]=dimValue;});
  function wrapContext(native,el,type) {
    const cache=Object.create(null);
    // A native context can lock its own canvas and methods. The game sees the
    // DOM canvas on a separate object; native getters and methods retain their receiver.
    const facade=Object.create(native,{canvas:{value:el,enumerable:true}});
    return new Proxy(facade,{
      get(_facade,k) {
        if(k==='canvas')return el;
        let v=native[k];
        if(type==='2d'&&typeof v!=='function'&&Object.hasOwn(pathFallbacks,k))v=pathFallbacks[k];
        if(typeof v!=='function')return v;
        if(!cache[k]){
          if(['drawImage','createPattern','texImage2D','texSubImage2D','texImage3D','texSubImage3D','copyImageSubData'].includes(k))
            cache[k]=(...args)=>v.apply(native,args.map(a=>a?._surface||a));
          else if(['fill','stroke','clip','isPointInPath'].includes(k))cache[k]=(...args)=>{
            if(args[0] instanceof CanvasPath){args.shift().trace(native);}return v.apply(native,args);
          };
          else cache[k]=v.bind(native);
        }
        return cache[k];
      },
      set(_facade,k,v){
        if(k==='canvas')return false;
        if(k==='font'&&typeof v==='string'&&host.fonts){
          const family=/bold|[6-9]00/i.test(v)?host.fonts.bold:host.fonts.regular;
          v=v.replace(/['"]?Ziling Swei['"]?/g,'"'+family+'"');
        }
        return Reflect.set(native,k,v);
      }
    });
  }
  D.HTMLCanvasElement.prototype.getContext=function(type,attrs) {
    this._contexts ||= {};
    if(!this._contexts[type]){
      const c=surface(this).getContext(type,attrs);
      if(c)this._contexts[type]=wrapContext(c,this,type);
    }
    return this._contexts[type]||null;
  };
  D.HTMLCanvasElement.prototype.toDataURL=function(...args){return surface(this).toDataURL(...args);};
  const ip=D.HTMLImageElement.prototype;
  function setImage(el,src) {
    src=String(src);if(el._src===src)return;el._src=src;el._ready=false;
    const image=wx.createImage();el._surface=image;
    const finish=ok=>{if(image!==el._surface)return;el._ready=ok;el.dispatchEvent(new D.Event(ok?'load':'error'));};
    image.onload=()=>finish(true);image.onerror=()=>finish(false);
    const embedded=LocalURL.objectFiles?.get(src);
    if(embedded)image.src=embedded;
    else host.files.resolvePath(src).then(path=>{
      if(image!==el._surface)return;
      if(path)image.src=path;else finish(false);
    }).catch(error=>{console.warn('[字灵] 图片读取失败',src,error);finish(false);});
  }
  ip.setAttribute=function(name,value){rawSet.call(this,name,value);if(name==='src')setImage(this,value);};
  prop(ip,'src',function(){return this._src||'';},function(v){this.setAttribute('src',v);});
  prop(ip,'currentSrc',function(){return this.src;});
  prop(ip,'complete',function(){return !!this._ready;});
  for(const dim of ['width','height']){
    prop(ip,'natural'+dim[0].toUpperCase()+dim.slice(1),function(){return this._ready?this._surface[dim]:0;});
    prop(ip,dim,function(){return Number(this.getAttribute(dim))||this._surface?.[dim]||0;},function(v){rawSet.call(this,dim,String(v));});
  }
  function Image(w,h){const img=doc.createElement('img');if(w)img.width=w;if(h)img.height=h;return img;}
  return {Image,makeCanvas,screen};
}
