'use strict';

// Each octal digit is one three-pixel row, top to bottom. No font or texture is needed.
const digitMasks = [0o75557,0o26227,0o71747,0o71717,0o55711,0o74717,0o74757,0o71222,0o75757,0o75717];
const percentMask = 0o51245;

module.exports = async function presentBootFrame(gl) {
  let program = gl.createProgram();
  function attach(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  function dispose() {
    if (program) gl.deleteProgram(program);
    program = null;
  }
  try {
    attach(gl.VERTEX_SHADER, `#version 300 es
      void main(){
        vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
        gl_Position=vec4(p*2.-1.,0.,1.);
      }`);
    attach(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      precision highp int;
      uniform vec2 size;
      uniform int percent, glyphCount;
      uniform ivec4 glyphs;
      uniform bool overScene;
      out vec4 color;
      void main(){
        float pixel=max(1.,floor(min(size.x/185.,size.y/110.)+.5));
        float halfWidth=floor(min(size.x*.27,size.y*.28));
        vec2 p=gl_FragCoord.xy-floor(vec2(.5,.12)*size);
        vec2 q=abs(p-vec2(0.,2.5*pixel))-vec2(halfWidth+2.*pixel,5.5*pixel);
        float edge=length(max(q,0.))+min(max(q.x,q.y),0.)-1.5*pixel;
        if(edge>0.){
          if(overScene) discard;
          color=vec4(16./255.,42./255.,34./255.,1.);
          return;
        }
        vec3 ink=edge> -1.?vec3(.25,.39,.32):vec3(.035,.105,.085);
        if(abs(p.x)<halfWidth && p.y>=-2.*pixel && p.y<0.)
          ink=(p.x+halfWidth)*100.<2.*halfWidth*float(percent)?vec3(.68,.89,.52):vec3(.22,.35,.28);
        vec2 cells=p/pixel+vec2(float(glyphCount*4-1)*.5,-2.);
        if(cells.x>=0. && cells.x<float(glyphCount*4-1) && cells.y>=0. && cells.y<5.){
          int x=int(cells.x),column=x%4;
          if(column<3 && (glyphs[x/4] & (1<<(3*int(cells.y)+2-column)))!=0)
            ink=vec3(.93,.97,.86);
        }
        color=vec4(ink,1.);
      }`);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {
      throw Error(gl.getProgramInfoLog(program) || '启动画面着色器未就绪');
    }
    const size=gl.getUniformLocation(program,'size'), percent=gl.getUniformLocation(program,'percent');
    const glyphs=gl.getUniformLocation(program,'glyphs'), count=gl.getUniformLocation(program,'glyphCount');
    const overScene=gl.getUniformLocation(program,'overScene'), masks=new Int32Array(4);
    function draw(value, overlay=false) {
      if (!program) return;
      const digits=String(value);
      for(let i=0;i<digits.length;i++)masks[i]=digitMasks[Number(digits[i])];
      masks[digits.length]=percentMask;
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      if(overlay){
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        gl.colorMask(true,true,true,true);
      }
      gl.viewport(0,0,w,h);
      gl.useProgram(program);
      gl.uniform2f(size,w,h);
      gl.uniform1i(percent,value);
      gl.uniform1i(count,digits.length+1);
      gl.uniform4iv(glyphs,masks);
      gl.uniform1i(overScene,overlay?1:0);
      gl.drawArrays(gl.TRIANGLES,0,3);
      gl.useProgram(null);
      gl.flush();
    }
    draw(0);
    await new Promise(resolve=>{
      if (typeof requestAnimationFrame !== 'function') { setTimeout(resolve,0); return; }
      const timer=setTimeout(resolve,80);
      requestAnimationFrame(()=>{clearTimeout(timer);resolve();});
    });
    draw(0);
    await new Promise(resolve=>setTimeout(resolve,0));
    return {draw,dispose};
  } catch(error) {
    dispose();
    throw error;
  }
};
