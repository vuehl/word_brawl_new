// Isolated verification UI, never mounted by the normal 18086 launcher.
export function mountLiteQA(app) {
  if(location.port!=='18187'||new URLSearchParams(location.search).get('qa')!=='1'||document.querySelector('#lite-qa'))return;
  const panel=document.createElement('aside');panel.id='lite-qa';
  panel.style.cssText='position:fixed;right:10px;top:10px;z-index:100000;width:230px;background:#10221fee;color:white;padding:12px;border-radius:10px;font:12px monospace;pointer-events:auto';
  const label=document.createElement('strong');label.textContent='隔离 QA：非正常通关';panel.append(label);
  const status=document.createElement('pre');status.style.whiteSpace='pre-wrap';panel.append(status);
  const action=(name,fn)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='display:block;width:100%;margin:6px 0;padding:7px;color:black;background:white';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(error){status.textContent=String(error);console.error(error);}finally{b.disabled=false;}};panel.append(b);};
  for(const id of [1,4,7])action('QA 出战 '+id,async()=>{if(app.run&&app.run.state!=='over')await app.run.finish(false,true);await app.startRun({species:id,biome:'forest',tier:0,boosts:[],mode:'standard'});});
  action('QA 下一森林区域',async()=>{const r=app.run;if(r&&r.stage<4)await r.changeZone();});
  action('QA 生成小火龙捕获',()=>{const r=app.run;r.capture.spawnEncounter(4);const i=r.capture.index;if(i>=0){r.enemies.x[i]=r.player.pos.x+3;r.enemies.z[i]=r.player.pos.z;r.enemies.y[i]=r.player.pos.y;r.capture.onDefeated(i);r.capture.sure=true;}});
  action('QA 投球',()=>app.run.capture.throwBall());
  action('QA 胜利结算',async()=>{const r=app.run;if(r.stage!==4)throw Error('先加载圣地');await r.finish(true);});
  action('QA 暂停',()=>app.run?.pause());
  action('QA 定格画面',()=>{
    const run=app.run;
    if(!run||!['play','paused'].includes(run.state))throw Error('请先进入游戏并关闭升级或过场界面');
    run.state='paused';run.input.releaseLock();run.ui.hideModal();
  });
  action('QA 恢复画面',()=>app.run?.resume());
  document.body.append(panel);
  setInterval(()=>{const r=app.run;if(r&&!['over','dead'].includes(r.state))r.player.hp=r.player.maxHp;status.textContent=JSON.stringify({stage:r?.stage,state:r?.state,level:r?.player?.level,capture:r?.capture?.state,captured:r?.stats?.captured,league:app.meta.profile.league},null,2);},300);
}
