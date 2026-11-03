import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {parse} from './vendor/acorn.mjs';
const root=path.resolve(import.meta.dirname,'..');
const paths=new Set();
const stringOf=n=>n?.type==='Literal'&&typeof n.value==='string'?n.value:n?.type==='TemplateLiteral'&&n.expressions.length===0?n.quasis[0].value.cooked:null;
function walk(n){if(!n||typeof n!=='object')return;const value=stringOf(n);if(value&&/^(?:ui|env|models|music|pmd|portraits|icons|front|cries|items)\/[\w/.-]+\.(?:png|jpg|ogg|glb|json)$/.test(value))paths.add('assets/'+value);if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='Z'){const icon=stringOf(n.arguments[0]);if(icon&&/^[\w-]+$/.test(icon))paths.add('assets/ui/icons/'+icon+'.png');}for(const val of Object.values(n))if(Array.isArray(val))val.forEach(walk);else if(val&&typeof val==='object')walk(val);}
for(const file of ['src/game.js','src/config.js'])walk(parse(await fs.readFile(path.join(root,file),'utf8'),{ecmaVersion:'latest',sourceType:'module'}));
const missing=[...paths].filter(p=>!existsSync(path.join(root,'public',p))&&!existsSync(path.join(root,'public/overrides',p)));
await fs.writeFile(path.join(root,'reports/missing-runtime-assets.json'),JSON.stringify(missing,null,2));
console.log(JSON.stringify({referenced:paths.size,missing},null,2));
