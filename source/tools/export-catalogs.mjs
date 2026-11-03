import fs from 'node:fs/promises';
import * as catalogs from '../src/catalogs.js';
const data={};
for(const [name,value]of Object.entries(catalogs))data[name]=value.map(row=>({...row,...(typeof row.cost==='function'?{costByLevel:Array.from({length:row.max},(_,i)=>row.cost(i))}:{})}));
await fs.writeFile(new URL('../reports/catalogs.json',import.meta.url),JSON.stringify(data,null,2));
console.log(Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])));
