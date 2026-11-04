import test from 'node:test';
import assert from 'node:assert/strict';
import {installInvites} from '../platform/invites.mjs';
import {multiplayerConfig} from '../source/src/multiplayer-config.js';

function setup(query={}) {
  const env=Object.assign(new EventTarget(),{Event});
  const state={};
  const wx={getLaunchOptionsSync:()=>({query}),onShow:fn=>state.show=fn,
    onShareAppMessage:fn=>state.shareMenu=fn,showShareMenu(){},
    shareAppMessage:value=>state.shared=value,
    setClipboardData({data,success}){state.clipboard=data;success();},
    getClipboardData({success}){success({data:state.clipboard});}};
  installInvites(wx,env);return {env,state};
}
test('Cold/warm invites preserve leading zeros and only accept this game protocol',()=>{
  const {env,state}=setup({coop:multiplayerConfig.build,room:'001234'});
  assert.equal(env.getCoopInvitation(),'001234');
  env.clearCoopInvitation();assert.equal(env.getCoopInvitation(),'');
  let received=0;env.addEventListener('coopinvite',()=>received++);
  for(const room of ['1','1234567','abc123','123456&server=evil'])state.show({query:{coop:multiplayerConfig.build,room}});
  state.show({query:{coop:'different-build',room:'123456'}});
  assert.equal(received,0);assert.equal(env.getCoopInvitation(),'');
  state.show({query:{coop:multiplayerConfig.build,room:'654321'}});
  assert.equal(received,1);assert.equal(env.getCoopInvitation(),'654321');
  state.show({query:{}});assert.equal(env.getCoopInvitation(),'654321');
  env.clearCoopInvitation();env.getCoopShareRoom=()=>({open:true,code:'654321'});
  state.show({query:{coop:multiplayerConfig.build,room:'654321'}});
  assert.equal(env.getCoopInvitation(),'','Returning from the share sheet must not requeue the current room');
});
test('Share/copy/paste use room codes; sharing never claims delivery',async()=>{
  const {env,state}=setup();
  env.shareCoopRoom('001234');
  assert.equal(new URLSearchParams(state.shared.query).get('room'),'001234');
  assert.equal(new URLSearchParams(state.shared.query).get('coop'),multiplayerConfig.build);
  await env.copyCoopCode('001234');assert.equal(await env.pasteCoopCode(),'001234');
  state.clipboard='字灵房间号：654321';assert.equal(await env.pasteCoopCode(),'654321');
  state.clipboard='1234567';await assert.rejects(env.pasteCoopCode(),/没有六位房间号/);
  const room={open:true,code:'001234',room:{state:'lobby'}};
  env.getCoopShareRoom=()=>room;
  assert.ok(state.shareMenu().query.includes('001234'));
  room.room.state='started';assert.equal(state.shareMenu().query,'');
});
