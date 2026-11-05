const colorTokens=/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black|transparent|red|blue|green|yellow|orange|gray|purple)\b/gi;
function colors(v=''){return v.match(colorTokens)||[];}
function rounded(ctx,x,y,w,h,r) {
  r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function background(ctx,style,b) {
  const value=style['background-color']||style.background||style['background-image']||'';
  const c=colors(value);if(!c.length)return null;
  if(c.length===1||!value.includes('gradient'))return c[c.length-1];
  const {x,y,w,h}=b,radial=value.includes('radial-gradient');
  const g=radial?ctx.createRadialGradient(x+w/2,y+h/2,0,x+w/2,y+h/2,Math.max(w,h)*.7):
    ctx.createLinearGradient(x,y,x+(value.includes('90deg')?w:w*.2),y+h);
  for(let i=0;i<c.length;i++)g.addColorStop(i/(c.length-1),c[i]);return g;
}
export function paint(layout,boxes,view,scale) {
  const ctx=layout.context;
  ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,view.width,view.height);
  ctx.translate(view.x,view.y);
  for(const b of boxes) {
    const {x,y,w,h,s,el,tag,clip}=b;
    if(w<.1||h<.1||x+w<clip.x||y+h<clip.y||x>clip.r||y>clip.b||b.opacity===0)continue;
    ctx.save();ctx.beginPath();ctx.rect(clip.x,clip.y,clip.r-clip.x,clip.b-clip.y);ctx.clip();
    ctx.globalAlpha=b.opacity;
    // Body sits behind the WebGL canvas in the desktop stacking order.
    if(tag!=='body'&&tag!=='#text'){
      const bg=background(ctx,s,b),border=s.border||s['border-top']||'',line=parseFloat(border)||0;
      const radiusValue=s['border-radius']||'0';
      const radius=parseFloat(radiusValue)*(radiusValue.endsWith('%')?Math.min(w,h)/100:1);
      if(bg||line){rounded(ctx,x,y,w,h,radius);
        if(bg){ctx.fillStyle=bg;ctx.fill();}
        if(line){ctx.strokeStyle=colors(s['border-color']||border)[0]||'#dedbe8';ctx.lineWidth=line;ctx.stroke();}}
      if(el._scrollMax>1&&h>20){
        const thumb=Math.max(12,h*h/(h+el._scrollMax));
        ctx.fillStyle='rgba(70,65,92,.45)';
        ctx.fillRect(x+w-4,y+(h-thumb)*(el._scroll||0)/el._scrollMax,3,thumb);
      }
    }
    if(tag==='#text'){
      ctx.font=layout.font(s);ctx.fillStyle=s.color||'#2a2440';ctx.textBaseline='middle';
      const text=el.textContent.replace(/\s+/g,' ').trim();
      const lines=b.singleLine?[text]:layout.wrap(text,w,s,ctx),lh=h/Math.max(1,lines.length);
      const side=s['text-align'];ctx.textAlign=side==='center'?'center':side==='right'?'right':'left';
      const tx=side==='center'?x+w/2:side==='right'?x+w:x;
      lines.forEach((l,i)=>ctx.fillText(l,tx,y+(i+.5)*lh,w));
    } else if(tag==='img'||tag==='canvas'){
      const image=el._surface;
      if(image&&(tag==='canvas'||el.complete)&&image.width&&image.height){
        const ratio=Math.min(w/image.width,h/image.height),dw=ratio*image.width,dh=ratio*image.height;
        ctx.imageSmoothingEnabled=s['image-rendering']!=='pixelated';
        ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
      }
    } else if(tag==='input'||tag==='select'){
      ctx.font=layout.font(s);ctx.fillStyle=s.color;
      if(el.type==='range'){
        const f=(+el.value-+(el.min||0))/(+(el.max||100)-+(el.min||0));
        ctx.fillStyle='#bcb6c9';ctx.fillRect(x,y+h/2-2,w,4);ctx.fillStyle='#3a8cff';
        ctx.beginPath();ctx.arc(x+w*Math.max(0,Math.min(1,f)),y+h/2,6,0,2*Math.PI);ctx.fill();
      }else if(el.type==='checkbox'){ctx.fillText(el.checked?'☑':'☐',x,y+h*.75);}
      else ctx.fillText(el.value||el.placeholder||'',x+3,y+h*.7);
    }
    ctx.restore();
  }
}
// Draw the UI after the original post-processing pipeline using the same screen framebuffer.
export function compositor(gl,canvas) {
  function shader(type,source){
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;
  }
  const prog=gl.createProgram();
  gl.attachShader(prog,shader(gl.VERTEX_SHADER,'#version 300 es\nout vec2 uv;void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=vec2(v.x,1.-v.y);gl_Position=vec4(v*2.-1.,0.,1.);}'));
  gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision mediump float;in vec2 uv;out vec4 color;uniform sampler2D ui;void main(){color=texture(ui,uv);}'));
  gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
  const texture=gl.createTexture(),vao=gl.createVertexArray();
  let width=0,height=0;
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return (renderer,changed,rect)=>{
    renderer.resetState();gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    if(rect){
      const sx=gl.drawingBufferWidth/rect.screenWidth,sy=gl.drawingBufferHeight/rect.screenHeight;
      gl.viewport(Math.round(rect.x*sx),Math.round((rect.screenHeight-rect.y-rect.h)*sy),Math.round(rect.w*sx),Math.round(rect.h*sy));
    }else gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
    gl.useProgram(prog);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    if(changed){
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      if(width!==canvas.width||height!==canvas.height){
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
        width=canvas.width;height=canvas.height;
      }else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
    }
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.SCISSOR_TEST);gl.depthMask(false);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.bindVertexArray(null);renderer.resetState();
  };
}
