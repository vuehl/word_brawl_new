import test from 'node:test';
import assert from 'node:assert/strict';
import {installCoopDebug} from '../platform/coop-debug.mjs';

test('LAN debug is explicit, reports native state and cannot be enabled in a release',async()=>{
  const env={};let version='develop',enabled=false,calls=0;
  const wx={getAccountInfoSync:()=>({miniProgram:{envVersion:version}}),getAppBaseInfo:()=>({enableDebug:enabled}),
    setEnableDebug(options){calls++;enabled=options.enableDebug;options.success();}};
  installCoopDebug(wx,env);
  assert.equal(calls,0,'Opening the lobby must not change the native debug setting');
  assert.equal(env.getCoopDebugInfo().enabled,false);
  assert.equal((await env.enableCoopDebug()).enabled,true);
  assert.equal(calls,1);
  enabled=false;assert.equal(env.getCoopDebugInfo().enabled,false,'A menu change must override the previous API success');
  version='release';assert.equal(env.getCoopDebugInfo().canEnable,false);
  await assert.rejects(env.enableCoopDebug(),/WSS 合法域名/);
  version='unknown';await assert.rejects(env.enableCoopDebug(),/右上角菜单/);
  assert.equal(calls,1);
});

test('An accepted debug request without a native enabled state is not reported as enabled',async()=>{
  const env={},wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'trial'}}),
    setEnableDebug(options){options.success();}};
  installCoopDebug(wx,env);
  assert.equal((await env.enableCoopDebug()).enabled,null);
  wx.getAppBaseInfo=()=>{throw Error('older runtime');};
  wx.getSystemInfoSync=()=>({enableDebug:false});
  assert.equal((await env.enableCoopDebug()).enabled,false);
  wx.getSystemInfoSync=()=>({enableDebug:true});
  assert.equal(env.getCoopDebugInfo().enabled,true);
});

test('Unsupported, rejected and thrown debug calls give actionable errors',async()=>{
  const env={},wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getAppBaseInfo:()=>({enableDebug:false})};
  installCoopDebug(wx,env);
  await assert.rejects(env.enableCoopDebug(),/右上角菜单/);
  wx.setEnableDebug=options=>options.fail({errMsg:'setEnableDebug:fail cancel'});
  await assert.rejects(env.enableCoopDebug(),/setEnableDebug:fail cancel/);
  wx.setEnableDebug=()=>{throw Error('native failure');};
  await assert.rejects(env.enableCoopDebug(),/native failure/);
  assert.equal(env.getCoopDebugInfo().enabled,false);
});
