import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {showMultiplayer} from '../source/src/multiplayer-ui.js';

function lobby(t, {startRun, onScreen} = {}) {
  const {document} = parseHTML('<html><body></body></html>');
  for (const [name, value] of Object.entries({window:{}, localStorage:{getItem:()=>null}})) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {configurable:true, value});
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  const members = [{id:'host',name:'房主',species:4,ready:true}, {id:'guest',name:'队员',species:7,ready:true}];
  const session = {open:true,me:'guest',mine:members[1],isHost:false,code:'123456',
    room:{members,host:'host',tier:0},ev:{},leaves:0,
    async leave() { this.leaves++; this.open=false; }};
  const app = {coopRoom:session,meta:{profile:{lastSpecies:7},account:{name:'队员'}},menuScene:{},restored:0,starts:0,
    async startRun(config) { this.starts++; return startRun ? startRun(this,config) : true; },
    toMenu() { this.restored++; this.run=this.hud=null; this.menuScene={}; },
    notice() {}};
  const element = (tag, attrs, ...children) => {
    const node=document.createElement(tag);
    for (const [key,value] of Object.entries(attrs)) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2),value);
      else if (key==='style') Object.assign(node.style,value);
      else if (key==='disabled') node.disabled=value;
      else node.setAttribute(key,value);
    }
    node.append(...children); return node;
  };
  showMultiplayer(app,{element,partner:id=>'伙伴'+id,home:()=>{},screen:(_app,_class,node)=>{
    onScreen?.(node); document.body.replaceChildren(node); return node;
  }});
  return {app,session,document,start:session.ev.start,state:{tier:0,seed:42,party:'test-party'}};
}

test('A guest startup error releases the room, restores the menu and allows lobby actions',async t=>{
  const fixture=lobby(t,{startRun(app){
    app.menuScene=null;app.run={};app.hud={};
    throw new ReferenceError("Can't find variable: setTimeout");
  }});
  const {app,session,document,start,state}=fixture;
  await start(state);
  assert.equal(session.leaves,1);assert.equal(app.coopRoom,null);
  assert.equal(app.restored,1);assert.equal(app.run,null);assert.equal(app.hud,null);
  assert.match(document.querySelector('[role="alert"]').textContent,/setTimeout/);
  assert.ok([...document.querySelectorAll('button')].every(button=>!button.disabled));
  const help=[...document.querySelectorAll('button')].find(button=>button.textContent==='怎么玩');
  help.click();await Promise.resolve();
  assert.ok(document.querySelector('.coop-help'),'The recovered lobby still responds to input');
});

test('An error drawing the starting screen also unlocks the lobby',async t=>{
  let failed=false;
  const {app,session,document,start,state}=lobby(t,{onScreen(node){
    if (!failed && node.textContent.includes('正在进入森林')) {failed=true;throw Error('绘制失败');}
  }});
  await start(state);
  assert.equal(app.starts,0);assert.equal(session.leaves,1);
  assert.equal(app.restored,0,'The existing menu scene is retained');
  assert.match(document.querySelector('[role="alert"]').textContent,/绘制失败/);
  assert.ok([...document.querySelectorAll('button')].every(button=>!button.disabled));
});

test('A failed room cleanup does not hide the original startup error or lock retry controls',async t=>{
  const warn=t.mock.method(console,'warn',()=>{});
  const {app,session,document,start,state}=lobby(t,{startRun(){throw Error('战斗资源失败');}});
  session.leave=async()=>{throw Error('连接已断开');};
  await start(state);
  assert.equal(app.coopRoom,null);assert.equal(warn.mock.callCount(),1);
  assert.match(document.querySelector('[role="alert"]').textContent,/战斗资源失败/);
  assert.ok([...document.querySelectorAll('button')].every(button=>!button.disabled));
});

test('A pending successful start is processed once and keeps the live room',async t=>{
  let finish;
  const {app,session,document,start,state}=lobby(t,{startRun:()=>new Promise(resolve=>finish=resolve)});
  const pending=start(state);
  assert.ok([...document.querySelectorAll('button')].every(button=>button.disabled));
  await start(state);assert.equal(app.starts,1);
  finish(true);await pending;await start(state);
  assert.equal(app.starts,1);assert.equal(session.leaves,0);assert.equal(app.coopRoom,session);
});
