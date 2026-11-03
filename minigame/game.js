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

// Submit a real frame on WeChat's animation clock, then return to the event loop.
// Some clients suspend that clock until the loading cover disappears.
function presentBootFrame(screen) {
  screen.draw(0.08);
  return new Promise((resolve, reject) => {
    let waiting = true;
    const finish = () => { waiting = false; resolve(); };
    const timer = setTimeout(finish, 80);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => {
      if (!waiting) return;
      clearTimeout(timer);
      try { screen.draw(0.08); } catch (error) { reject(error); return; }
      setTimeout(finish, 0);
    });
  });
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

async function launchEngine(host, play) {
  const env = await play.setup(host);
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
  let phase = '创建画面', splash, nativeLoading = false, active = true;
  function stage(title) {
    phase = title;
    console.info('[字灵启动]', title, Date.now() - began, 'ms');
    if (nativeLoading) wx.showLoading({title, mask:true});
  }
  try {
    stage('字灵 · 打开森林');
    const canvas = wx.createCanvas();
    const view = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    canvas.width = Math.max(1, Math.round(view.windowWidth || canvas.width || 640));
    canvas.height = Math.max(1, Math.round(view.windowHeight || canvas.height || 360));
    let gl;
    try { gl = canvas.getContext('webgl2', {alpha:true, antialias:false, depth:true, stencil:false}); }
    catch (error) { console.warn('[字灵启动] 尝试默认 WebGL 2 参数', error); }
    if (!gl) gl = canvas.getContext('webgl2');
    if (!gl) throw Error('当前微信环境无法创建 WebGL 2 画面，请更新微信后重新进入。');
    try {
      splash = require('./boot-screen')(gl);
      await presentBootFrame(splash);
      console.info('[字灵启动] 启动画面已提交', Date.now() - began, 'ms');
    } catch (error) {
      console.warn('[字灵启动] 启动画面不可用', error);
      if (splash) splash.dispose();
      splash = null;
      nativeLoading = true;
    }
    const files = require('./files');
    const host = GameGlobal.ziling = {canvas, files};
    stage('准备游戏资源');
    const downloaded = {text:0,play:0};
    let last = -1;
    function progress(group, percent) {
      if (!active || !Number.isFinite(percent)) return;
      downloaded[group] = percent;
      const step = Math.floor((downloaded.text + downloaded.play) / 10) * 5;
      if (step <= last) return;
      last = step;
      if (splash) splash.draw(0.08 + step * 0.007);
      if (nativeLoading) wx.showLoading({title:'准备资源 ' + step + '%', mask:true});
    }
    const [play] = await withTimeout(Promise.all([
      files.loadPackage('play', p=>progress('play',p)).then(()=>{
        progress('play',100);
        return withTimeout(waitForPlayEntry(),15000,'玩法分包已下载，但微信未执行入口。');
      }),
      files.init(p=>progress('text',p)).then(()=>progress('text',100))
    ]), 120000, '准备游戏数据超时，请重新进入。');
    stage('绘制游戏首页');
    if (splash) {
      splash.draw(0.9);
      splash.dispose();
      splash = null;
    }
    if (nativeLoading) {
      wx.hideLoading();
      nativeLoading = false;
    }
    await withTimeout(launchEngine(host,play), 60000, '游戏首页未能在限时内绘制，请重新进入。');
    console.info('[字灵启动] 游戏首页已绘制', Date.now() - began, 'ms');
  } catch (error) {
    active = false;
    if (splash) splash.dispose();
    if (nativeLoading) wx.hideLoading();
    console.error('[字灵] ' + phase + '失败', error);
    const restart = typeof wx.restartMiniProgram === 'function';
    wx.showModal({title:phase + '失败', content:(error && (error.errMsg || error.message)) || String(error),
      confirmText:restart ? '重新进入' : '退出游戏', showCancel:false,
      success:() => restart ? wx.restartMiniProgram({}) : wx.exitMiniProgram({})});
    return;
  }
}
start();
