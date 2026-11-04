import {multiplayerConfig} from '../source/src/multiplayer-config.js';

export function installInvites(wx,env) {
  let invitation='';
  function receive(options) {
    const query=options?.query,code=String(query?.room||'');
    if(query?.coop!==multiplayerConfig.build||!/^\d{6}$/.test(code))return;
    const current=env.getCoopShareRoom?.();
    if(current?.open&&current.code===code)return;
    invitation=code;
    env.dispatchEvent(new env.Event('coopinvite'));
  }
  env.getCoopInvitation=()=>invitation;
  env.clearCoopInvitation=()=>{invitation='';};
  const shareData=code=>({title:code?'字灵 · 来房间 '+code+' 一起冒险':'字灵 · 和朋友一起拆字冒险',
    query:code?'coop='+encodeURIComponent(multiplayerConfig.build)+'&room='+code:''});
  env.shareCoopRoom=code=>{
    if(!/^\d{6}$/.test(code))throw Error('房间号无效，请重新创建房间');
    if(typeof wx.shareAppMessage!=='function')throw Error('当前环境无法分享，请复制房间号给朋友');
    // Called only by the player's invite button. Opening the share sheet does
    // not confirm a message was sent; WeChat may not report that outcome.
    wx.shareAppMessage(shareData(code));
  };
  env.copyCoopCode=code=>new Promise((resolve,reject)=>{
    if(!wx.setClipboardData){reject(Error('当前环境无法复制，请记下房间号 '+code));return;}
    wx.setClipboardData({data:String(code),success:resolve,fail:()=>reject(Error('复制失败，请记下房间号 '+code))});
  });
  env.pasteCoopCode=()=>new Promise((resolve,reject)=>{
    if(!wx.getClipboardData){reject(Error('当前环境无法粘贴，请手动输入六位房间号'));return;}
    wx.getClipboardData({success:r=>{
      const text=String(r.data||'').trim(),code=/^\d{6}$/.test(text)?text:/房间(?:号)?\s*[:：]?\s*(\d{6})(?!\d)/.exec(text)?.[1];
      code?resolve(code):reject(Error('剪贴板里没有六位房间号，请先让房主复制房间号'));
    },fail:()=>reject(Error('读取失败，请手动输入六位房间号'))});
  });
  wx.onShow?.(receive);
  try{receive(wx.getLaunchOptionsSync?.());}catch{}
  wx.onShareAppMessage?.(()=>{
    const room=env.getCoopShareRoom?.();
    return shareData(room?.open&&room.room.state==='lobby'?room.code:'');
  });
  try{wx.showShareMenu?.({withShareTicket:false,menus:['shareAppMessage']});}catch{}
}
