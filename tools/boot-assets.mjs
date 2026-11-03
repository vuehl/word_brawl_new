import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {brotliDecompressSync,deflateSync} from 'node:zlib';
import postcss from 'postcss';
import {packStream} from './pack-resources.mjs';
import {unpackStream} from './resource-stream.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0,16);

export function bootAssets(root) {
  const read=file=>fs.readFileSync(path.join(root,'source',file),'utf8').replace(/\r\n/g,'\n');
  const css=read('public/assets/main-BnZCGLop-mvlr7rzv.css')+'\n'+read('src/customize.js').split('style.textContent=').pop().split(String.fromCharCode(96))[1];
  const rules=[];
  postcss.parse(css).walkRules(rule=>{
    let media='';
    for(let p=rule.parent;p;p=p.parent){if(p.type==='atrule'&&p.name!=='media')return;if(p.name==='media')media=p.params;}
    const declarations=rule.nodes.filter(x=>x.type==='decl').map(d=>[d.prop,d.value+(d.important?'!important':'')]);
    for(const sel of rule.selectors){
      if(/::|:(hover|focus-visible|focus-within|active)\b/.test(sel))continue;
      const last=sel.split(/[\s>+~]+/).at(-1);
      const key=(last.split(/[:[]/)[0].match(/[.#][\w-]+/g)||[]).at(-1)||last.match(/^[a-z][\w-]*/i)?.[0]||'*';
      const weight=(sel.match(/#[\w-]+/g)||[]).length*100+(sel.match(/[.:[\]]/g)||[]).length*10+(sel.match(/(?:^|[\s>+~])[a-z][\w-]*/gi)||[]).length;
      rules.push([sel,declarations,key,media,weight,rules.length]);
    }
  });
  return {
    'engine/layout.bin':fs.readFileSync(path.join(root,'platform/layout.bin')),
    'engine/styles.bin':deflateSync(JSON.stringify(rules),{level:9})
  };
}

// Keep incremental builds in sync with the full asset build.
// Put the UI data there too, so it needn't be downloaded before game.js runs.
export function addBootAssets(out, assets) {
  const manifestPath = path.join(out,'assets.js');
  const info = createRequire(import.meta.url)(manifestPath);
  const files = Object.entries(assets).map(([key,data])=>({key,data,name:hash(data)+path.extname(key)}));
  const archive = path.join(out,'packs/text/assets.br');
  const packed = fs.readFileSync(archive);
  if (hash(packed)===info.packs.text && files.every(({key,name})=>info.files[key]==='text/'+name)) return;
  const entries = Object.create(null);
  unpackStream(brotliDecompressSync(packed), (name,bytes)=>{entries[name]=bytes;});
  for (const {key,data,name} of files) {
    const previous = info.files[key];
    entries[name]=data;
    info.files[key]='text/'+name;
    if (previous && !Object.values(info.files).includes(previous)) delete entries[previous.slice('text/'.length)];
  }
  const {bytes,rawSize}=packStream(entries);
  info.packs.text=hash(bytes);
  info.rawSizes.text=rawSize;
  fs.writeFileSync(archive+'.next',bytes);
  fs.renameSync(archive+'.next',archive);
  fs.writeFileSync(manifestPath+'.next','module.exports = '+JSON.stringify(info)+';\n');
  fs.renameSync(manifestPath+'.next',manifestPath);
}
