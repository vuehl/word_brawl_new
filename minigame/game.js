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

async function launchEngine(host) {
  const env = await require('./host').setup(host);
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
  const engine = require('./original')(env).then(() => { booted = true; });
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
    const gl = canvas.getContext('webgl2', {alpha:true, antialias:false, depth:true, stencil:false});
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
    let last = -1;
    await withTimeout(files.init(percent => {
      const step = Math.floor(percent / 5) * 5;
      if (!active || !Number.isFinite(step) || step <= last) return;
      last = step;
      if (splash) splash.draw(0.08 + step * 0.007);
      if (nativeLoading) wx.showLoading({title:'准备资源 ' + step + '%', mask:true});
    }), 120000, '准备游戏数据超时，请重新进入。');
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
    await withTimeout(launchEngine(host), 60000, '游戏首页未能在限时内绘制，请重新进入。');
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
