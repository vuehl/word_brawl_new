import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'), pub=path.join(root,'public');
const missing=new Set(), checked=new Set();
const queue=['src/boot.js','src/game.js','src/config.js','src/i18n.js'];
while(queue.length){
 const name=queue.shift();if(checked.has(name))continue;checked.add(name);
 const file=name.startsWith('src/')?path.join(root,name):path.join(pub,name);
 let code;try{code=await fs.readFile(file,'utf8');}catch{missing.add(name);continue;}
 for(const m of code.matchAll(/(?:["'`]|url\(["']?)(\.\.?\/[^"'`\s)]+\.(?:js|css|woff2?|png|jpg|webp|svg))(?:["'`]|\))/g)){
  const next=path.posix.normalize(path.posix.join(path.posix.dirname(name),m[1]));
  if(!next.startsWith('../'))queue.push(next);
 }
}
await fs.mkdir(path.join(root,'reports'),{recursive:true});
await fs.writeFile(path.join(root,'reports/missing-assets.json'),JSON.stringify([...missing],null,2));
const files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else{const buf=await fs.readFile(p);files.push({path:path.relative(pub,p).replaceAll('\\','/'),bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex')});}}}
await walk(pub);
await fs.writeFile(path.join(root,'reports/asset-manifest.json'),JSON.stringify({version:'0.8.34',files},null,2));
console.log(JSON.stringify({files:files.length,bytes:files.reduce((a,b)=>a+b.bytes,0),dependencyFiles:checked.size,missing:[...missing]},null,2));
