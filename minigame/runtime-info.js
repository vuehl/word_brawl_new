'use strict';

// This is a client revision, not the multiplayer wire protocol version.
const build = '1104.4';
module.exports = function runtimeInfo(wx, gameGlobal) {
  let phase = '启动游戏', loading = false, loadingTitle = '', performance = null;
  const performanceByScene = {};
  const errors = [];
  function read(method) {
    try { return typeof wx[method] === 'function' ? wx[method]() || {} : {}; }
    catch (_) { return {}; }
  }
  const legacy = read('getSystemInfoSync');
  const app = Object.assign({}, legacy, read('getAppBaseInfo'));
  const device = Object.assign({}, legacy, read('getDeviceInfo'));
  function record(error, source) {
    const message = String(error && (error.message || error.errMsg || error.reason) || error || '未知错误');
    errors.push({phase, source:source || '游戏', message:message.slice(0,600),
      stack:String(error && error.stack || '').slice(0,1800)});
    if (errors.length > 5) errors.shift();
  }
  // Keep the original console/WeChat reporting intact. Nothing is sent remotely.
  if (typeof wx.onError === 'function') wx.onError(error => record(error, '微信运行环境'));
  if (typeof wx.onUnhandledRejection === 'function') wx.onUnhandledRejection(event => record(event.reason, '异步任务'));
  function snapshot() {
    const samples={};
    for(const key of Object.keys(performanceByScene))samples[key]=Object.assign({},performanceByScene[key]);
    return {build, phase, wechat:app.version || '未提供', sdk:app.SDKVersion || '未提供',
      platform:device.platform || '未提供', system:device.system || '未提供',
      model:device.model || '未提供',performance:performance&&Object.assign({},performance),
      performanceByScene:samples,
      mode:gameGlobal.isIOSHighPerformanceMode ? 'iOS 高性能模式' : '普通模式',
      errors:errors.map(error => Object.assign({},error))};
  }
  function details() {
    const info = snapshot();
    const samples=[];
    for(const scene of ['home','battle']){
      const value=info.performanceByScene[scene];if(!value)continue;
      samples.push((scene==='battle'?'战斗':'首页')+'最近实测 '+value.fps+' FPS · 每帧 '+value.frameMs+' ms',
        '计算 '+value.simulationMs+' / 场景 '+value.worldMs+' / 界面 '+value.uiMs+' ms',
        '画面 '+value.world.join('×')+' / 界面 '+value.ui.join('×')+' / 绘制 '+value.drawCalls+' 次');
    }
    return ['字灵联机修复版 '+info.build, '微信 '+info.wechat+' / 基础库 '+info.sdk,
      info.model+' / '+info.platform+' / '+info.system+' / '+info.mode, '当前阶段：'+info.phase,
      ...samples,
      ...info.errors.map(error => '['+error.phase+' · '+error.source+'] '+error.message+(error.stack?'\n'+error.stack:''))].join('\n');
  }
  return {
    build, snapshot, record,
    setPerformance(value) {
      performance=value;
      if(value.scene==='home'||value.scene==='battle')performanceByScene[value.scene]=value;
    },
    stage(title) { phase = title; console.info('[字灵阶段]', build, title); },
    loading(title) {
      if (loading && title === loadingTitle) return;
      loading = true; loadingTitle = title;
      try { wx.showLoading({title,mask:true}); } catch (error) { record(error,'加载提示'); }
    },
    hideLoading() {
      if (!loading) return;
      loading = false; loadingTitle = '';
      try { wx.hideLoading(); } catch (error) { record(error,'关闭加载提示'); }
    },
    showDetails() {
      const text = details();
      const content=text.length>1000?text.slice(0,960)+'\n…点击复制信息获取完整内容。':text;
      wx.showModal({title:'游戏运行信息',content,confirmText:'复制信息',cancelText:'关闭',
        success:result => { if (result.confirm && typeof wx.setClipboardData === 'function') wx.setClipboardData({data:text}); }});
    },
  };
};
