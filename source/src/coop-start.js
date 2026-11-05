// Uses the existing relay's authenticated control channel. Readiness means a
// rendered scene, not the lobby's Ready button. Clocks are sampled after loading.
export class CoopStart {
  constructor({me,host,members,party,send,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,timeout=90000}) {
    Object.assign(this,{me,host,party,send,now,setTimer,clearTimer,timeout});
    this.members=members.map(m=>m.id);this.loaded=new Set();this.startedAt=now();
    this.local=false;this.done=false;this.round=0;this.probes=new Map();this.samples=0;this.probeId=0;
    this.offset=0;this.bestRTT=Infinity;this.acks=new Set();this.nextProbe=-Infinity;
    this.promise=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});
    this.promise.catch(()=>{}); // A remote failure can arrive during local loading.
    this.timer=this.setTimer(()=>this.tick(),100);
  }
  packet(kind,data={},to='') { return this.send(to,{t:'load-sync',v:1,party:this.party,kind,...data}); }
  ready(progress) {
    this.progress=progress;this.title=undefined;
    if(!this.local&&!this.done){this.local=true;if(this.me===this.host)this.loaded.add(this.me);this.tick(false);}
    this.status();return this.promise;
  }
  status() {
    const title=this.at?'全员就绪，'+Math.max(1,Math.ceil((this.at-this.hostNow())/1000))+' 秒后开始':
      '等待队友加载 '+this.loaded.size+'/'+this.members.length;
    if(title!==this.title){this.title=title;this.progress?.(title);}
  }
  hostNow() { return this.now()+this.offset; }
  receive(from,message) {
    if(message?.t!=='load-sync')return false;
    if(this.done||message.v!==1||message.party!==this.party||!this.members.includes(from))return true;
    const m=message,leader=from===this.host;
    if(m.kind==='abort'){this.cancel('队友未能完成加载，请重新组队。'+String(m.reason||'').slice(0,120),false);return true;}
    if(this.me===this.host){
      if(m.kind==='probe'&&Number.isInteger(m.id))this.packet('clock',{id:m.id,hostTime:this.now()},from);
      if(m.kind==='ready'){
        this.loaded.add(from);this.packet('progress',{loaded:[...this.loaded]});this.maybeSchedule();
      }
      if(m.kind==='ack'&&m.round===this.round&&this.at){
        this.acks.add(from);
        if(this.acks.size===this.members.length){
          if(this.at-this.now()<1000)this.schedule();
          else {this.committed=true;this.packet('go',{round:this.round,at:this.at});}
        }
      }
    }else if(leader){
      if(m.kind==='clock'&&!this.sentReady&&this.probes.has(m.id)&&Number.isFinite(m.hostTime)){
        const sent=this.probes.get(m.id),end=this.now(),rtt=end-sent;this.probes.delete(m.id);this.samples++;
        if(rtt<this.bestRTT){this.bestRTT=rtt;this.offset=m.hostTime-(sent+end)/2;}
        if(this.samples>=3&&!this.sentReady){this.sentReady=true;this.loaded.add(this.me);this.packet('ready',{},this.host);}
      }
      if(m.kind==='progress'&&Array.isArray(m.loaded))this.loaded=new Set(m.loaded.filter(id=>this.members.includes(id)));
      if(m.kind==='prepare'&&this.local&&this.sentReady&&Number.isInteger(m.round)&&m.round>=this.round&&Number.isFinite(m.at)){
        this.round=m.round;this.at=m.at;this.committed=false;this.packet('ack',{round:this.round},this.host);
      }
      if(m.kind==='go'&&m.round===this.round&&m.at===this.at&&this.local)this.committed=true;
    }
    this.status();return true;
  }
  maybeSchedule(){if(this.local&&this.loaded.size===this.members.length&&!this.at)this.schedule();}
  schedule(){
    if(++this.round>3){this.cancel('开局同步超时，请检查网络后重新组队');return;}
    this.at=this.now()+3000;this.acks=new Set([this.me]);this.committed=false;
    this.packet('prepare',{round:this.round,at:this.at});this.status();
  }
  tick(reschedule=true) {
    if(this.done)return;
    const now=this.now();
    if(now-this.startedAt>this.timeout){this.cancel('等待队友加载超时，请双方重新扫描同一份新版预览码');return;}
    if(this.local){
      if(this.me===this.host){
        this.maybeSchedule();
        if(this.at&&!this.committed&&this.at-now<1000)this.schedule();
      }else if(!this.sentReady&&now>=this.nextProbe){
        const id=++this.probeId;this.probes.set(id,now);this.nextProbe=now+180;
        if(this.probes.size>12)this.probes.delete(this.probes.keys().next().value);
        this.packet('probe',{id},this.host);
      }
      this.status();
      if(this.committed&&this.hostNow()>=this.at){
        this.done=true;this.clearTimer(this.timer);this.resolve({startAt:this.at,offset:this.offset});return;
      }
    }
    if(reschedule&&!this.done)this.timer=this.setTimer(()=>this.tick(),this.committed?Math.min(100,Math.max(1,this.at-this.hostNow())):100);
  }
  checkRoom(room){
    if(!this.done&&(room.host!==this.host||this.members.some(id=>!room.members.some(m=>m.id===id))))
      this.cancel('有队友在加载时离开，请重新组队');
  }
  cancel(reason='开局已取消',notify=true){
    if(this.done)return;
    if(notify)this.packet('abort',{reason:String(reason).slice(0,160)});
    this.error=Error(reason);this.done=true;this.clearTimer(this.timer);this.reject(this.error);
  }
}
