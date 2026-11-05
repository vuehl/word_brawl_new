import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from 'linkedom/worker';
import {installSurfaces} from '../platform/surfaces.mjs';

test('WeChat texture uploads omit the unsupported conversion flag and retain other pixel state',()=>{
  const {document}=D.parseHTML('<html><body><canvas id="game"></canvas></body></html>');
  const calls=[],native={};
  Object.defineProperty(native,'pixelStorei',{value:function(name,value){assert.equal(this,native);calls.push([name,value]);}});
  const host={canvas:{getContext:()=>native}};
  installSurfaces(D,document,host,{});
  const canvas=document.getElementById('game'),gl=canvas.getContext('webgl2');
  assert.equal(gl.canvas,canvas);
  for(let i=0;i<100;i++)gl.pixelStorei(0x9243,0);
  gl.pixelStorei(0x9240,true); // UNPACK_FLIP_Y_WEBGL
  gl.pixelStorei(0x9241,true); // UNPACK_PREMULTIPLY_ALPHA_WEBGL
  gl.pixelStorei(0x0cf5,4); // UNPACK_ALIGNMENT
  assert.deepEqual(calls,[[0x9240,true],[0x9241,true],[0x0cf5,4]]);
});
