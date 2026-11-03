import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {brotliDecompressSync} from 'node:zlib';
import sharp from 'sharp';
import index from '../minigame/assets.js';
import codec from '../platform/resource-codec.js';
import {restoreSprite} from './sprite-png.mjs';
import {unpackStream} from './resource-stream.mjs';
const root=path.resolve(import.meta.dirname,'..'), pub=path.join(root,'source/public');
const packs={};
const digest=b=>createHash('sha256').update(b).digest('hex');
for(const [group,expected] of Object.entries(index.packs)){
  const raw=fs.readFileSync(path.join(root,'minigame/packs',group,'assets.br'));
  assert.equal(digest(raw).slice(0,16),expected);
  const decoded=brotliDecompressSync(raw);
  assert.equal(decoded.length,index.rawSizes[group]);
  const files=packs[group]=Object.create(null);
  unpackStream(decoded,(name,data)=>{files[name]=data;});
  codec.expandResources(group,{
    read:(name,encoding)=>encoding?Buffer.from(files[name]).toString(encoding):files[name],
    write:(name,data,encoding)=>{files[name]=Buffer.from(data,encoding);}
  });
  if(group==='art')for(const [name,recipe] of Object.entries(index.sprites))files[name]=restoreSprite(files[recipe]);
}
function bytes(key){const [group,file]=index.files[key].split('/');return packs[group][file];}
for(const [key,ref] of Object.entries(index.files)){
  const data=bytes(key);assert.ok(data,'Missing '+key);assert.equal(digest(data).slice(0,16),path.basename(ref,path.extname(ref)));
}
const count={};
for(const category of ['pmd','portraits','icons']){
  count[category]=0;
  for(let n=1;n<=151;n++){
    const key='assets/'+category+'/'+n+'.png',source=path.join(pub,'overrides',key);
    const decode=b=>sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const [a,b]=await Promise.all([decode(source),decode(bytes(key))]);
    assert.deepEqual(a.info,b.info,key);
    for(let i=0;i<a.data.length;i+=4){
      if(a.data[i+3]!==b.data[i+3]||(a.data[i+3]&&a.data.readUIntBE(i,3)!==b.data.readUIntBE(i,3)))throw Error('Changed visible pixel: '+key+' @ '+i/4);
    }
    count[category]++;
  }
}
const models=Object.keys(index.files).filter(k=>k.startsWith('assets/models/'));
for(const key of models)assert.equal(digest(bytes(key)),digest(fs.readFileSync(path.join(pub,'overrides',key))),key);
for(const key of ['glyphs/semantic-atlas.png','glyphs/hero-atlas.png'])assert.equal(digest(bytes(key)),digest(fs.readFileSync(path.join(pub,key))));
const report={mappedResources:Object.keys(index.files).length,RGBA:count,originalModels:models.length,originalGlyphAtlases:2,
  altarSpriteIncluded:!!index.files['assets/pmd/201.png'],allArchiveHashesVerified:true};
const out=path.join(root,'验收');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'资源核验.json'),JSON.stringify(report,null,2));
console.log(report);
