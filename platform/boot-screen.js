'use strict';

// Use the screen's WebGL context from the very first draw; this same context
// is later reused by Three. No image, font, engine or subpackage is needed.
module.exports = function createBootScreen(gl) {
  const program = gl.createProgram();
  function attach(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  attach(gl.VERTEX_SHADER, `#version 300 es
    void main(){
      vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
      gl_Position=vec4(p*2.-1.,0.,1.);
    }`);
  attach(gl.FRAGMENT_SHADER, `#version 300 es
    precision mediump float;
    uniform vec2 size;
    uniform float progress;
    out vec4 color;
    float stroke(vec2 p,vec2 a,vec2 b){
      vec2 ab=b-a;
      return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.));
    }
    void main(){
      vec2 p=(gl_FragCoord.xy-0.5*size)/size.y;
      vec3 base=mix(vec3(.035,.115,.09),vec3(.10,.25,.19),clamp(p.y+.5,0.,1.));
      vec2 q=p-vec2(0.,.15);
      float d=min(stroke(q,vec2(0.,-.075),vec2(0.,.075)),stroke(q,vec2(-.062,.035),vec2(.063,.035)));
      d=min(d,min(stroke(q,vec2(0.,.023),vec2(-.066,-.047)),stroke(q,vec2(0.,.023),vec2(.066,-.047))));
      base=mix(base,vec3(.91,.93,.75),1.-smoothstep(.006,.010,d));
      if(abs(p.y+.20)<.009 && abs(p.x)<.23)
        base=p.x<-.23+.46*progress?vec3(.65,.85,.49):vec3(.18,.34,.26);
      color=vec4(base,1.);
    }`);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message=gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw Error(message || '启动画面着色器未就绪');
  }
  const size=gl.getUniformLocation(program,'size'), progress=gl.getUniformLocation(program,'progress');
  return {
    draw(value) {
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      gl.viewport(0,0,w,h);
      gl.useProgram(program);
      gl.uniform2f(size,w,h);
      gl.uniform1f(progress,value);
      gl.drawArrays(gl.TRIANGLES,0,3);
      gl.useProgram(null);
      gl.flush();
    },
    dispose() { gl.deleteProgram(program); }
  };
};
