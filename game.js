'use strict';

async function withTimeout(work, ms, message) {
  let timer;
  try {
    return await Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(message)), ms);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

function waitForPlayEntry() {
  const box = GameGlobal.zilingPlayEntry || (GameGlobal.zilingPlayEntry = {});
  return new Promise((resolve,reject) => {
    function accept(api) {
      if (api && typeof api.setup==='function' && typeof api.run==='function') resolve(api);
      else reject(Error('玩法入口无效，请重新进入当前预览版本。'));
    }
    if (box.api) accept(box.api);
    else box.receive = accept;
  });
}

async function launchEngine(host, play, showProgress) {
  const env = await play.setup(host);
  showProgress(95);
  if (host.onApp) env.onApp = host.onApp;
  let booted = false;
  const firstFrame = new Promise((resolve, reject) => {
    const draw = env.drawUI;
    let failures = 0;
    env.onBootRenderError = error => {
      if (++failures >= 3) {
        env.onBootRenderError = undefined;
        reject(error);
      }
    };
    env.drawUI = renderer => {
      draw(renderer);
      showProgress(booted ? 100 : 95, renderer);
      if (!booted) return;
      env.drawUI = draw;
      env.onBootRenderError = undefined;
      resolve();
    };
  });
  const engine = play.run(env).then(() => { booted = true; });
  await Promise.all([firstFrame, engine]);
}

async function start() {
  const began = Date.now();
  let phase = '创建画面', splash, shown = 0;
  function stage(title) {
    phase = title;
    console.info('[字灵启动]', title, Date.now() - began, 'ms');
  }
  function showProgress(value, renderer) {
    if (!splash || value < shown || (value === shown && !renderer)) return;
    shown = value;
    try {
      splash.draw(value, !!renderer);
    } catch (error) {
      console.warn('[字灵启动] 无法更新加载进度', error);
      splash.dispose();
      splash = null;
    } finally {
      if (renderer) renderer.resetState();
    }
  }
  try {
    stage('字灵 · 打开森林');
    const canvas = wx.createCanvas();
    const view = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    canvas.width = Math.max(1, Math.round(view.windowWidth || canvas.width || 360));
    canvas.height = Math.max(1, Math.round(view.windowHeight || canvas.height || 640));
    let gl;
    try { gl = canvas.getContext('webgl2', {alpha:true, antialias:false, depth:true, stencil:false}); }
    catch (error) { console.warn('[字灵启动] 尝试默认 WebGL 2 参数', error); }
    if (!gl) gl = canvas.getContext('webgl2');
    if (!gl) throw Error('当前微信环境无法创建 WebGL 2 画面，请更新微信后重新进入。');
    try {
      splash = await require('./boot-screen')(gl);
      console.info('[字灵启动] 启动画面已提交', Date.now() - began, 'ms');
    } catch (error) {
      console.warn('[字灵启动] 启动画面不可用', error);
    }
    const files = require('./files');
    const host = GameGlobal.ziling = {canvas, files};
    stage('准备游戏资源');
    const downloaded = {play:0, text:0};
    function packageProgress(name, percent) {
      if (!Number.isFinite(percent)) return;
      downloaded[name] = Math.max(downloaded[name], Math.min(100, percent));
      // Reserve the last 15% for unpacking, entry registration and the first rendered home frame.
      showProgress(5 + Math.floor((45 * downloaded.play + 35 * downloaded.text) / 100));
    }
    showProgress(5);
    const [play] = await withTimeout(Promise.all([
      files.loadPackage('play', p=>packageProgress('play',p)).then(()=>{
        packageProgress('play',100);
        return withTimeout(waitForPlayEntry(),15000,'玩法分包已下载，但微信未执行入口。');
      }),
      files.init(p=>packageProgress('text',p)).then(()=>packageProgress('text',100))
    ]), 120000, '准备游戏数据超时，请重新进入。');
    stage('绘制游戏首页');
    showProgress(90);
    await withTimeout(launchEngine(host,play,showProgress), 60000, '游戏首页未能在限时内绘制，请重新进入。');
    console.info('[字灵启动] 游戏首页已绘制', Date.now() - began, 'ms');
  } catch (error) {
    console.error('[字灵] ' + phase + '失败', error);
    const restart = typeof wx.restartMiniProgram === 'function';
    wx.showModal({title:phase + '失败', content:(error && (error.errMsg || error.message)) || String(error),
      confirmText:restart ? '重新进入' : '退出游戏', showCancel:false,
      success:() => restart ? wx.restartMiniProgram({}) : wx.exitMiniProgram({})});
  } finally {
    if (splash) splash.dispose();
    splash = null;
  }
}
start();
