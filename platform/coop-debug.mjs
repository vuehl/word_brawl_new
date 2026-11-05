import {multiplayerConfig} from '../source/src/multiplayer-config.js';

// An explicit setup action for the current LAN preview, never enabled at boot.
// Only the native runtime can confirm its debug state; do not cache success as
// proof that domain validation has been disabled.
export function installCoopDebug(wx,env) {
  if(!multiplayerConfig.url.startsWith('ws://'))return;
  env.getCoopDebugInfo=()=>{
    let version='unknown',enabled=null;
    try{version=wx.getAccountInfoSync?.()?.miniProgram?.envVersion||'unknown';}catch{}
    try{const value=wx.getAppBaseInfo?.()?.enableDebug;if(typeof value==='boolean')enabled=value;}catch{}
    if(enabled===null)try{const value=wx.getSystemInfoSync?.()?.enableDebug;if(typeof value==='boolean')enabled=value;}catch{}
    return {version,enabled,canEnable:['develop','trial'].includes(version)&&typeof wx.setEnableDebug==='function'};
  };
  env.enableCoopDebug=()=>new Promise((resolve,reject)=>{
    const info=env.getCoopDebugInfo();
    if(!info.canEnable){
      reject(Error(info.version==='release'?'此按钮仅供开发/体验版使用；跨网段正式联机需要配置 WSS 合法域名。':'当前环境无法从游戏内开启调试，请使用手机右上角菜单的调试入口。'));
      return;
    }
    const fail=error=>reject(Error('未能开启手机调试：'+String(error?.errMsg||error?.message||error||'请从右上角菜单开启').slice(0,200)));
    try{wx.setEnableDebug({enableDebug:true,success:()=>resolve(env.getCoopDebugInfo()),fail});}catch(error){fail(error);}
  });
}
