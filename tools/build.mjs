import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import esbuild from 'esbuild';
import {parse} from '../source/tools/vendor/acorn.mjs';
import {addBootAssets,bootAssets} from './boot-assets.mjs';
import {lowerUnicodeRegexes} from './device-syntax.mjs';

const root=path.resolve(import.meta.dirname,'..'), src=path.join(root,'source'), platform=path.join(root,'platform');
const out=path.join(root,'minigame'),engine=path.join(out,'engine');
fs.mkdirSync(engine,{recursive:true});
if(!fs.existsSync(path.join(out,'assets.js'))||!fs.existsSync(path.join(out,'packs/art/assets.br'))||process.argv.includes('--assets'))
  execFileSync(process.execPath,[path.join(import.meta.dirname,'assets.mjs')],{stdio:'inherit'});
const read=(f)=>fs.readFileSync(path.join(src,f),'utf8').replace(/\r\n/g,'\n');
const replace=(s,from,to)=>{
  if(!s.includes(from)||s.indexOf(from)!==s.lastIndexOf(from))throw Error('Source anchor changed: '+from.slice(0,80));
  return s.replace(from,to);
};
const shellServer=read('server.mjs');
function serverCode() {
  const imports=shellServer.slice(0,shellServer.indexOf('const PORT')).replace(/^import .+ from 'node:(?:fs(?:\/promises)?|http|path)';\n/gm,'');
  let routes=shellServer.slice(shellServer.indexOf('function accountByToken'),shellServer.indexOf('async function sendFile'));
  // Commit a finish atomically with its idempotency record. No partial result
  // becomes visible to another request if a storage write or handler fails.
  return imports+'\nimport {readStore,writeStore} from "ziling:store";\n'+
    'let store,dirty=false;function persist(){dirty=true;}\n'+routes+
    '\nlet queue=Promise.resolve();\nexport function dispatchApi(url,method,headers,bodyText){\n'+
    '  const next=queue.then(async()=>{\n'+
    '    const key=url.pathname.slice(4);if(key==="/coop/access")return {status:200,data:{show:false,play:false}};\n'+
    '    if(/^\\/(coop|friends|rooms|invites|clans|mail|events|seasons|leaderboard)(\\/|$)/.test(key))return {status:404};\n'+
    '    store??=readStore();store.coopParties??={};for(const a of Object.values(store.accounts))constrainLiteProfile(a.profile);\n'+
    '    const route=matchRoute(method,key);if(!route)return {status:404,data:{error:"Not found."}};\n'+
    '    const before=method==="GET"?null:JSON.stringify(store);dirty=false;\n'+
    '    const res={status:200,data:undefined};try{const value=await route.handler({headers:{authorization:headers.Authorization||headers.authorization},bodyText},res,url,route.params);if(value!==undefined)res.data=value;if(dirty)writeStore(store);return res;}\n'+
    '    catch(error){if(before)store=JSON.parse(before);throw error;}\n'+
    '  });queue=next.catch(()=>{});return next;\n}\n';
}
const sources={
  name:'ziling-platform',setup(build){
    build.onResolve({filter:/^ziling:api$/},args=>({path:args.path,namespace:'ziling'}));
    build.onResolve({filter:/^node:crypto$/},()=>({path:path.join(platform,'crypto.mjs')}));
    build.onResolve({filter:/^ziling:store$/},()=>({path:path.join(platform,'store.mjs')}));
    build.onResolve({filter:/^ziling:clone$/},()=>({path:path.join(platform,'clone.mjs')}));
    build.onResolve({filter:/^ziling:base64$/},()=>({path:path.join(platform,'base64.mjs')}));
    build.onResolve({filter:/^ziling:css-number$/},()=>({path:path.join(platform,'css-number.mjs')}));
    build.onLoad({filter:/core-js[\\/]internals[\\/]global-this\.js$/},()=>({
      contents:'module.exports = typeof globalThis === "object" ? globalThis : GameGlobal;'
    }));
    build.onLoad({filter:/@noble[\\/]hashes[\\/]esm[\\/]_md\.js$/},args=>{
      // SHA-256's 64-bit bit count is two 32-bit words, even on engines without BigInt.
      const contents=replace(fs.readFileSync(args.path,'utf8'),
        'setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);',
        'view.setUint32(blockLen - (isLE ? 4 : 8), Math.floor(this.length / 0x20000000), isLE);\n'+
        '        view.setUint32(blockLen - (isLE ? 8 : 4), this.length * 8, isLE);');
      return {contents,resolveDir:path.dirname(args.path)};
    });
    build.onLoad({filter:/./,namespace:'ziling'},()=>({
      contents:serverCode(),
      resolveDir:src,loader:'js'
    }));
    build.onLoad({filter:/firebase[\\/]shared\.mjs$/},()=>({resolveDir:path.join(src,'firebase'),contents:
      read('firebase/shared.mjs').replace(/export function json\(res,[\s\S]+?(?=export const seasonPayload)/,
        'export function json(res,code,data){res.status=code;res.data=data;}\nexport async function body(req){return req.bodyText ? JSON.parse(req.bodyText):undefined;}\n')
    }));
    build.onLoad({filter:/local[\\/]progression\.mjs$/},()=>({resolveDir:path.join(src,'local'),contents:
      read('local/progression.mjs').replace("import fs from 'node:fs';",'import {cloneData as structuredClone} from "ziling:clone";')
        .replace(/^const pokemon = new Map\(.+;$/m,'const pokemon=new Map('+JSON.stringify(JSON.parse(read('public/data/pokemon.json')).map(p=>[p.id,{family:p.family}]))+');')
    }));
    build.onResolve({filter:/^\.\.\/assets\/three-.+\.js$/},args=>({path:path.join(src,'public/assets',path.basename(args.path))}));
    build.onLoad({filter:/src[\\/]game-font\.js$/},()=>({contents:'export const gameFontsReady=Promise.resolve();'}));
    build.onLoad({filter:/linkedom[\\/]worker\.js$/},args=>{
      let code=fs.readFileSync(args.path,'utf8').replace(/\r\n/g,'\n');
      code=replace(code,'const formatter = new Intl.NumberFormat("en-US", {\n\tuseGrouping: false,\n\tminimumFractionDigits: 0,\n\tmaximumFractionDigits: 6\n});',
        'import {formatFiniteCssNumber} from "ziling:css-number";');
      code=replace(code,'formatter.format(val)','formatFiniteCssNumber(val)');
      code=replace(code,'/^(.+?)\\s+of\\s+(.+)$/is','/^([\\s\\S]+?)\\s+of\\s+([\\s\\S]+)$/i');
      code=replace(code,'/[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]/g, "�"',
        '/[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[\\uD800-\\uDFFF]/g, s=>s.length===2?s:"�"');
      // Both the HTML entity table and CSS data URLs use this bundled decoder.
      // Fold out linkedom's Node-only fallbacks when building the WeChat bundle.
      code='import {decodeBase64String as atob} from "ziling:base64";\n'+code.replaceAll('typeof atob === "function"','true');
      return {contents:code,resolveDir:path.dirname(args.path)};
    });
    build.onLoad({filter:/src[\\/]config\.js$/},args=>({
      contents:lowerUnicodeRegexes(fs.readFileSync(args.path,'utf8')),resolveDir:path.dirname(args.path)
    }));
    build.onLoad({filter:/src[\\/]game\.js$/},()=>{
      let code=read('src/game.js').replace('await gameFontsReady;','');
      // The DOM retry screen cannot be drawn before the WeChat renderer exists.
      code=replace(code,'((n.lastChild.textContent = c(`Error cargando datos: {msg}`, { msg: t(e.message) })),\n          r.append(X(`button`, { class: `btn big red`, onclick: () => location.reload() }, c(`Reintentar`))));\n        return;',
        'throw Error("游戏数据读取失败：" + (e.message || e));');
      code=replace(code,'await new Promise((e) => setTimeout(e, Math.min(5e3, 1e3 + t * 500))));',
        'await new Promise((e) => setTimeout(e, 500)));\n          if (t >= 2) throw Error("WebGL 2 初始化失败：" + (e.message || e));');
      code=replace(code,'(ac(), wL(), await new AL().boot());','export async function launch(){ac();wL();const app=new AL();window.onApp?.(app);await app.boot();return app;}');
      code=replace(code,'if ((this.r.render(n), this.run?.state === \x60play\x60))','if ((this.r.render(n), window.drawUI(this.r.renderer,this.run), window.didRenderRunFrame?.(this.run), this.run?.state === \x60play\x60))');
      code=replace(code,'(this.failing++ % 60 == 0','(window.onBootRenderError?.(e), this.failing++ % 60 == 0');
      return {contents:lowerUnicodeRegexes(code),resolveDir:path.join(src,'src')};
    });
  }
};
// The preview service parses the submitted JavaScript before issuing a QR code.
const previewESVersion=2017;
const common={bundle:true,platform:'browser',format:'cjs',minify:true,target:'es'+previewESVersion,charset:'utf8',legalComments:'eof',
  nodePaths:[path.join(import.meta.dirname,'node_modules')],plugins:[sources],logLevel:'warning'};
const hostBundle=await esbuild.build({...common,define:{document:'undefined'},entryPoints:[path.join(platform,'host.mjs')],write:false});
await esbuild.build({...common,entryPoints:[path.join(import.meta.dirname,'resource-runtime.mjs')],outfile:path.join(out,'resource-runtime.js')});
fs.rmSync(path.join(out,'sprite-png.js'),{force:true});
const result=await esbuild.build({...common,define:{innerWidth:'window.innerWidth',innerHeight:'window.innerHeight',devicePixelRatio:'window.devicePixelRatio'},write:false,stdin:{contents:
  'import "../public/turnstile-stub.js";import {l as language} from "./i18n.js";'+
  'export async function start(){language(window.locale,window.readLocale(window.locale));return require("./game.js").launch();}',resolveDir:path.join(src,'src')}});
const timerBindings='setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame'.split(' ');
const bindings=('globalThis window self document navigator location history localStorage sessionStorage innerWidth innerHeight devicePixelRatio screen '+
  'setTimeout clearTimeout setInterval clearInterval '+
  'getComputedStyle matchMedia performance addEventListener removeEventListener dispatchEvent requestAnimationFrame cancelAnimationFrame '+
  'Image HTMLImageElement HTMLCanvasElement HTMLElement HTMLInputElement HTMLButtonElement HTMLTextAreaElement HTMLSelectElement HTMLAnchorElement HTMLVideoElement Node Element '+
  'Event CustomEvent EventTarget PointerEvent MouseEvent KeyboardEvent ProgressEvent MutationObserver DOMParser OffscreenCanvas ImageBitmap createImageBitmap '+
  'fetch Headers Request Response Blob URL URLSearchParams TextEncoder TextDecoder AbortController AbortSignal AudioContext structuredClone crypto Path2D alert').split(/\s+/);
// A WeChat single-file subpackage executes this file as its entry. It needs
// no sibling imports. Publish before or after the main entry subscribes.
fs.writeFileSync(path.join(out,'play.js'),'(function(){\nconst root=typeof globalThis==="object"?globalThis:GameGlobal;\nfunction setup(host){const globalThis=root,module={exports:{}};const {'+timerBindings.join(',')+'}=host.timers;\n'+
  hostBundle.outputFiles[0].text+'\nreturn module.exports.setup(host);}\n'+
  'async function run(environment){const {'+bindings.join(',')+'}=environment;const module={exports:{}};\n'+
  result.outputFiles[0].text+'\nreturn module.exports.start();}\n'+
  'const box=GameGlobal.zilingPlayEntry||(GameGlobal.zilingPlayEntry={});box.api={setup,run};if(box.receive){box.receive(box.api);delete box.receive;}\n})();\n');
for(const file of ['host.js','original.js'])fs.rmSync(path.join(out,file),{force:true});
fs.copyFileSync(path.join(platform,'files.js'),path.join(out,'files.js'));
fs.copyFileSync(path.join(platform,'timers.js'),path.join(out,'timers.js'));
fs.copyFileSync(path.join(platform,'runtime-info.js'),path.join(out,'runtime-info.js'));
fs.copyFileSync(path.join(platform,'boot-screen.js'),path.join(out,'boot-screen.js'));
fs.copyFileSync(path.join(platform,'resource-codec.js'),path.join(out,'resource-codec.js'));
addBootAssets(out,bootAssets(root));
for(const name of ['game.js','game.json'])fs.copyFileSync(path.join(root,name),path.join(out,name));
const runtimePackages=new Set(['linkedom','typeflex','fflate','@noble/hashes','brotli','core-js','base64-js']);
const notices=[];
for(const name of runtimePackages){
  const dir=path.join(import.meta.dirname,'node_modules',name);
  const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json')));
  const license=fs.readdirSync(dir).find(file=>/^licen[sc]e(?:$|[.])/i.test(file));
  if(license)notices.push(name+' '+pkg.version+'\n'+fs.readFileSync(path.join(dir,license),'utf8'));
  else if(name==='brotli')notices.push(name+' '+pkg.version+'\n'+fs.readFileSync(path.join(import.meta.dirname,'brotli-NOTICE.txt'),'utf8'));
  for(const dep of Object.keys(pkg.dependencies||{}))if(fs.existsSync(path.join(import.meta.dirname,'node_modules',dep,'package.json')))runtimePackages.add(dep);
}
fs.writeFileSync(path.join(out,'packs','text','licenses.txt'),notices.join('\n\n'));
// Remove outputs from builds that shipped the engine as a separate code package.
for(const file of ['game.js','host.js','original.js','licenses.txt','layout.bin','styles.bin'])fs.rmSync(path.join(engine,file),{force:true});
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(path.join(dir,f.name)):[path.join(dir,f.name)]);}
const built=files(out),size=list=>list.reduce((n,f)=>n+fs.statSync(f).size,0);
for(const file of built.filter(f=>f.endsWith('.js'))){
  try{parse(fs.readFileSync(file,'utf8'),{ecmaVersion:previewESVersion});}
  catch(error){throw new Error(path.relative(out,file)+': '+error.message);}
}
const {subpackages}=JSON.parse(fs.readFileSync(path.join(out,'game.json'),'utf8'));
const subRoots=subpackages.map(pkg=>path.resolve(out,pkg.root));
const total=size(built),main=size(built.filter(file=>!subRoots.some(root=>file===root||file.startsWith(root+path.sep))));
console.log('Native project:',(total/1048576).toFixed(2),'MiB, main:',(main/1048576).toFixed(2),'MiB.');
// Leave space for the compiler's metadata below this AppID's measured 20 MiB preview limit.
if(total>20*1048576-128*1024||main>4*1048576-64*1024)throw Error('WeChat preview package budget exceeded.');
