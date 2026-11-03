import {strFromU8,strToU8} from 'fflate';
import {LocalURL} from './url.mjs';
export class Headers {
  constructor(values={}) {this.values={};for(const [k,v] of Object.entries(values.values||values))this.set(k,v);}
  set(k,v){this.values[k.toLowerCase()]=String(v);}
  get(k){return this.values[k.toLowerCase()]??null;}
  has(k){return this.get(k)!==null;}
}
export class Request {
  constructor(url,init={}){this.url=String(url.url||url);Object.assign(this,init);}
}
export class Blob {
  constructor(parts,{type=''}={}) {
    this.type=type;
    const chunks=parts.map(p=>typeof p==='string'?strToU8(p):new Uint8Array(p.buffer||p,p.byteOffset||0,p.byteLength));
    this.data=new Uint8Array(chunks.reduce((n,p)=>n+p.length,0));
    let i=0;for(const p of chunks){this.data.set(p,i);i+=p.length;}this.size=i;
  }
  async arrayBuffer(){return this.data.buffer;}
}
export class Response {
  constructor(data,status=200,headers={}) {this.data=data;this.ok=status>=200&&status<300;this.status=status;this.headers=new Headers(headers);}
  async text(){return typeof this.data==='string'?this.data:strFromU8(new Uint8Array(this.data||0));}
  async json(){return JSON.parse(await this.text());}
  async arrayBuffer(){return typeof this.data==='string'?strToU8(this.data).buffer:this.data;}
  async blob(){return new Blob([await this.arrayBuffer()],{type:this.headers.get('content-type')||''});}
}
export function createFetch(files,api) {
  const fs=wx.getFileSystemManager(),tmp=wx.env.USER_DATA_PATH+'/ziling-images';
  // Embedded GLB textures are released by GLTFLoader after the image has loaded.
  try{fs.rmdirSync(tmp,true);}catch{}fs.mkdirSync(tmp,true);
  let seq=0;
  LocalURL.objectFiles=new Map();
  LocalURL.createObjectURL=blob=>{
    const path=tmp+'/'+(++seq)+(blob.type==='image/png'?'.png':blob.type==='image/webp'?'.webp':'.jpg');
    const url='blob:ziling/'+seq;
    fs.writeFileSync(path,blob.data.buffer);LocalURL.objectFiles.set(url,path);return url;
  };
  LocalURL.revokeObjectURL=url=>{const path=LocalURL.objectFiles.get(url);if(path){LocalURL.objectFiles.delete(url);try{fs.unlinkSync(path);}catch{}}};
  return async function fetch(input,init={}) {
    const req=typeof input==='string'?new Request(input,init):input;
    const url=new LocalURL(req.url);
    if(url.pathname.startsWith('/api/')) {
      const result=await api(url,req.method||'GET',req.headers?.values||req.headers||{},req.body);
      return new Response(result.data===undefined?'':JSON.stringify(result.data),result.status,{'content-type':'application/json'});
    }
    const path=await files.resolvePath(req.url);
    if(!path)return new Response('',404);
    return new Promise((resolve,reject)=>fs.readFile({filePath:path,success:r=>resolve(new Response(r.data)),fail:reject}));
  };
}
