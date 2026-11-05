import test from 'node:test';
import assert from 'node:assert/strict';
import {wechatAudioContext} from '../platform/audio.mjs';

test('A callback-only native decoder returns a pending Promise and keeps native receivers',async()=>{
  let complete;const data=new ArrayBuffer(4),buffer={duration:1,getChannelData:()=>new Float32Array(4)};
  const native={sampleRate:48000,listener:null};
  Object.defineProperty(native,'decodeAudioData',{value:function(bytes,success){
    assert.equal(this,native);assert.equal(bytes,data);complete=success;
  }});
  Object.defineProperty(native,'createGain',{value:function(){assert.equal(this,native);return 'gain';}});
  Object.defineProperty(native,'state',{get(){assert.equal(this,native);return 'running';}});
  const context=wechatAudioContext({createWebAudioContext:()=>native});
  let settled=false;
  const pending=context.decodeAudioData(data).then(value=>{settled=true;return value;});
  assert.equal(typeof pending.catch,'function');
  await Promise.resolve();assert.equal(settled,false);
  complete(buffer);assert.equal(await pending,buffer);
  assert.equal(context.createGain(),'gain');assert.equal(context.state,'running');
  const handler=()=>{};context.onstatechange=handler;assert.equal(native.onstatechange,handler);
});

test('Native decode failures and exceptions reject safely; a later decode still works',async()=>{
  let mode='reject';const buffer={getChannelData(){}};
  const native={decodeAudioData(_bytes,success,failure){
    if(mode==='throw')throw Error('native decode error');
    queueMicrotask(()=>mode==='success'?success(buffer):failure({errMsg:'unsupported audio codec'}));
  }};
  const context=wechatAudioContext({createWebAudioContext:()=>native});
  await assert.rejects(context.decodeAudioData(new ArrayBuffer(0)),/unsupported audio codec/);
  mode='throw';await assert.rejects(context.decodeAudioData(new ArrayBuffer(0)),/native decode error/);
  mode='success';assert.equal(await context.decodeAudioData(new ArrayBuffer(0)),buffer);
});

test('Promise, direct buffer and mixed runtimes settle once without an unhandled rejection',async()=>{
  const buffer={getChannelData(){}};
  for(const mode of ['promise','direct','both']){
    let callbacks=0;
    const context=wechatAudioContext({createWebAudioContext:()=>({decodeAudioData(_data,success){
      if(mode==='promise')return Promise.resolve(buffer);
      if(mode==='direct')return buffer;
      success(buffer);return Promise.reject(Error('late native rejection'));
    }})});
    assert.equal(await context.decodeAudioData(new ArrayBuffer(4),()=>callbacks++),buffer);
    assert.equal(callbacks,1);
  }
  const context=wechatAudioContext({createWebAudioContext:()=>({decodeAudioData:()=>Promise.reject(Error('promise failure'))})});
  await assert.rejects(context.decodeAudioData(new ArrayBuffer(0)),/promise failure/);
});

test('A decoder that never calls back times out instead of leaving audio loading forever',async()=>{
  const context=wechatAudioContext({createWebAudioContext:()=>({decodeAudioData(){}})},{decodeTimeoutMs:15});
  await assert.rejects(context.decodeAudioData(new ArrayBuffer(0)),/音频解码超时/);
});
