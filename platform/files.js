// The boot canvas must be the first canvas created by the mini game.
const {setTimeout,clearTimeout} = require('./timers');
const fs = () => wx.getFileSystemManager();
const info = require('./assets');
const {expandResources,packedInputs} = require('./resource-codec');
const {restoreSprite,resourceEntries,decodeBrotli,decodeText} = require('./resource-runtime');
const hydratedSprites = new Set();
const installs = new Map();
const base = wx.env.USER_DATA_PATH + '/ziling-assets';
function exists(path) { try { fs().accessSync(path); return true; } catch (error) { return false; } }
function downloadPackage(name, progress) {
  return new Promise((resolve,reject) => {
    let timer, lastBytes = 0, lastPercent = 0, done = false;
    function finish(error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(new Error(name + ' 分包：' + (error.errMsg || error.message || error)));
      else resolve();
    }
    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(() => finish('下载长时间没有进展，请检查网络并重新进入'), 45000);
    }
    resetTimer();
    try {
      const task = wx.loadSubpackage({name, success: () => finish(), fail: finish});
      if (task && task.onProgressUpdate) task.onProgressUpdate(event => {
        const bytes = Number.isFinite(event.totalBytesWritten) ? event.totalBytesWritten : 0;
        const percent = Number.isFinite(event.progress) ? event.progress : 0;
        if (done || (bytes <= lastBytes && percent <= lastPercent)) return;
        lastBytes = Math.max(lastBytes, bytes);
        lastPercent = Math.max(lastPercent, percent);
        resetTimer();
        if (progress) progress(lastPercent);
      });
    } catch (error) { finish(error); }
  });
}
async function loadPackage(name, progress) {
  try {
    await downloadPackage(name, progress);
  } catch (error) {
    console.warn('[字灵] 重试下载分包', name, error);
    await new Promise(resolve => setTimeout(resolve, 500));
    await downloadPackage(name, progress);
  }
}
async function unpack(name, revision, progress) {
  const dir = base + '/' + name + '-' + revision;
  if (exists(dir + '/.ready')) return;
  await loadPackage(name, progress);
  // Only an interrupted install can leave an unmarked hash directory.
  if (exists(dir)) fs().rmdirSync(dir, true);
  fs().mkdirSync(dir, true);
  const archive = 'packs/' + name + '/assets.br';
  const manager=fs();
  let raw;
  if (typeof manager.readCompressedFileSync === 'function') {
    try { raw = manager.readCompressedFileSync({filePath:archive, compressionAlgorithm:'br'}); }
    catch (error) { console.warn('[字灵] 原生解压失败，使用备用解码器', name, error); }
  }
  if (!raw || raw.byteLength !== info.rawSizes[name])
    raw = decodeBrotli(new Uint8Array(manager.readFileSync(archive)),info.rawSizes[name]);
  if(!raw || raw.byteLength!==info.rawSizes[name])throw Error('资源包长度不符 '+name);
  const inputs=new Map(),recipes=packedInputs[name]||[];
  let sliceStart = Date.now();
  for (const [file,part] of resourceEntries(raw)) {
    // raw already holds the recipes. Keeping their views avoids a second
    // on-disk copy while the expanded maps and language files are written.
    if(recipes.includes(file))inputs.set(file,part);
    else manager.writeFileSync(dir+'/'+file,part.buffer.slice(part.byteOffset,part.byteOffset+part.byteLength));
    if (Date.now() - sliceStart >= 12) {
      await new Promise(resolve => setTimeout(resolve, 0));
      sliceStart = Date.now();
    }
  }
  expandResources(name,{
    read:(file,encoding)=>encoding?decodeText(inputs.get(file)):inputs.get(file),
    write:(file,data,encoding)=>fs().writeFileSync(dir+'/'+file,data,encoding)
  });
  fs().writeFileSync(dir + '/.ready',revision,'utf8');
}
function resourceFor(raw) {
  const key = decodeURIComponent(raw.split(/[?#]/)[0].replace(/^[a-z]+:\/\/[^/]+\/?/, '')
    .replace(/^(\.\/|\/)+/,'').replace(/^(assets\/)+assets\//,'assets/').replace(/^(data\/)+data\//,'data/'));
  return info.files[key];
}
function pathFor(url) {
  const raw = String(url);
  if (raw.startsWith(wx.env.USER_DATA_PATH + '/') || raw.startsWith('data:')) return raw;
  const file = resourceFor(raw);
  if (!file) return null;
  const [name, hash] = file.split('/');
  const dir=base + '/' + name + '-' + info.packs[name],path=dir+'/'+hash;
  const recipe=info.sprites[hash];
  if(recipe&&!hydratedSprites.has(path)){
    if(!exists(path)){
      const png=restoreSprite(new Uint8Array(fs().readFileSync(dir+'/'+recipe)));
      fs().writeFileSync(path+'.next',png.buffer);
      fs().renameSync(path+'.next',path);
    }
    hydratedSprites.add(path);
  }
  return path;
}
function ensurePack(name, progress) {
  if (!installs.has(name)) {
    installs.set(name, unpack(name,info.packs[name],progress).catch(error => {
      installs.delete(name);
      throw error;
    }));
  }
  return installs.get(name);
}
async function resolvePath(url) {
  const raw = String(url);
  if (!raw.startsWith(wx.env.USER_DATA_PATH + '/') && !raw.startsWith('data:')) {
    const file = resourceFor(raw);
    if (!file) return null;
    await ensurePack(file.split('/')[0]);
  }
  return pathFor(raw);
}
async function init(progress) {
  if (!exists(base)) fs().mkdirSync(base, true);
  for (const [name,version] of Object.entries(info.packs)) {
    // Evict obsolete versions only inside this game's own cache.
    for (const entry of fs().readdirSync(base)) {
      if (new RegExp('^'+name+'-[a-f0-9]{16}$').test(entry) && entry !== name+'-'+version) {
        fs().rmdirSync(base+'/'+entry,true);
      }
    }
  }
  await ensurePack('text', progress);
}
function prepareForest() {
  return Promise.all([ensurePack('world'),ensurePack('art')]);
}
module.exports = {init,pathFor,resolvePath,loadPackage,prepareForest};
