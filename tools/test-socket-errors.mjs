import test from 'node:test';
import assert from 'node:assert/strict';
import {wechatSocket} from '../platform/socket.mjs';
import {RelayRoom} from '../source/src/multiplayer.js';

const url='ws://192.168.8.55:8787/ws';
function mockSocket(mode,error) {
  const state={closed:0,handlers:{}};
  const wx={connectSocket(options) {
    if(mode==='throw')throw error;
    if(mode==='sync-fail')options.fail(error);
    if(mode==='async-fail')queueMicrotask(()=>state.handlers.error(error));
    return {
      onOpen:fn=>state.handlers.open=fn,onMessage:fn=>state.handlers.message=fn,
      onError:fn=>state.handlers.error=fn,onClose:fn=>state.handlers.close=fn,
      close(){state.closed++;},send(){},
    };
  }};
  return {state,factory:(url,events)=>wechatSocket(wx,url,events)};
}

test('WeChat domain/network errors reach the room UI with their original details',async()=>{
  for(const mode of ['async-fail','sync-fail','throw']){
    const error={errMsg:'connectSocket:fail url not in domain list',errCode:10001};
    const {state,factory}=mockSocket(mode,error);
    await assert.rejects(RelayRoom.connect({url,factory,name:'测试'}),error=>{
      assert.match(error.message,/url not in domain list/);
      assert.match(error.message,/10001/);
      assert.match(error.message,/微信域名校验未通过/);
      assert.doesNotMatch(error.message,/healthz/,'A confirmed domain rejection should not ask the player to recheck the server');
      return true;
    });
    assert.equal(state.closed,mode==='throw'?0:1,'A rejected connection must not leak its SocketTask');
  }
});

test('Error then close reports one failure and a stale open cannot revive a socket',()=>{
  const {state,factory}=mockSocket('manual');let failures=0,opened=0;
  const socket=factory(url,{open:()=>opened++,message(){},error:()=>failures++,close(){}});
  state.handlers.error({errMsg:'network unreachable'});
  state.handlers.error({errMsg:'repeated failure'});
  state.handlers.open();
  assert.equal(failures,1);assert.equal(opened,0);assert.equal(socket.send('hello'),false);
  socket.close();socket.close();assert.equal(state.closed,1);
});
