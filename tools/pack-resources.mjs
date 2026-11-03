import {createHash} from 'node:crypto';
import path from 'node:path';
import {brotliCompressSync,constants} from 'node:zlib';

const json = value => Buffer.from(JSON.stringify(value));

// Group like files so Brotli can share repeated bytes across asset boundaries.
export function packStream(entries) {
  const names=Object.keys(entries).sort((a,b)=>path.extname(a).localeCompare(path.extname(b))||a.localeCompare(b));
  const manifest=json(names.map(name=>[name,entries[name].length]));
  const header=Buffer.alloc(4);
  header.writeUInt32LE(manifest.length);
  const raw=Buffer.concat([header,manifest,...names.map(name=>entries[name])]);
  const bytes=brotliCompressSync(raw,{params:{
    [constants.BROTLI_PARAM_QUALITY]:10,
    [constants.BROTLI_PARAM_LGWIN]:23,
    [constants.BROTLI_PARAM_SIZE_HINT]:raw.length
  }});
  return {bytes,rawSize:raw.length};
}

// Store each GLB buffer view once, including the embedded textures shared
// between models. The recipe retains headers, padding and byte order.
export function packModels(entries) {
  const chunks=[],known=new Map(),recipes={};
  let length=0;
  for(const [file,raw] of Object.entries(entries)){
    if(!file.endsWith('.glb'))continue;
    const bytes=Buffer.from(raw);
    if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB '+file);
    const end=20+bytes.readUInt32LE(12),bin=end+8;
    const gltf=JSON.parse(bytes.toString('utf8',20,end));
    const cuts=new Set([0,bin,bytes.length]);
    for(const view of gltf.bufferViews||[]){
      const offset=bin+(view.byteOffset||0);cuts.add(offset);cuts.add(offset+view.byteLength);
    }
    const seq=[],bounds=[...cuts].sort((a,b)=>a-b);
    for(let i=1;i<bounds.length;i++){
      const part=bytes.subarray(bounds[i-1],bounds[i]);
      const key=createHash('sha256').update(part).digest('hex');
      if(!known.has(key)){
        known.set(key,[length,part.length]);chunks.push(part);length+=part.length;
      }
      seq.push(known.get(key));
    }
    recipes[file]=seq;delete entries[file];
  }
  entries['model-parts.bin']=Buffer.concat(chunks);
  entries['model-map.json']=json(recipes);
}

export function packLocales(entries, index) {
  const keys=[],ids=new Map(),files={};
  for(const [logical,target] of Object.entries(index)){
    if(!logical.startsWith('locale/'))continue;
    const file=target.split('/')[1],words=JSON.parse(Buffer.from(entries[file]));
    const order=[],values=[];
    for(const [key,value] of Object.entries(words)){
      if(!ids.has(key)){ids.set(key,keys.length);keys.push(key);}
      order.push(ids.get(key));values.push(value);
    }
    files[file]=[order,values];delete entries[file];
  }
  entries['language-tables.json']=json([keys,files]);
}
