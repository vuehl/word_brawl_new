import { H as InstancedMesh, ct as ShaderMaterial, et as PlaneGeometry, b as CanvasTexture, ot as SRGBColorSpace, mt as Vector2 } from '../assets/three-DmSYIDKK.js';
import { HERO_ART } from './glyph-hero-art.js';
import { HERO_PATHS } from './glyph-hero-paths.js';

const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const smooth = v => {v=clamp(v);return v*v*(3-2*v);};
// Each rig moves the actual Bézier outline points of the supplied font.
// Refill and stroke the complete path every pose, avoiding stretched texture
// triangles, cropped pieces or seams through connected strokes.
// Coordinates run left→right, bottom→top in the glyph's ink bounds.
const bone=(box,pivot,tip,side,soft=.035)=>({box,pivot,tip,side,soft});
const firePair=(x,y,w,h)=>[
  bone([x-.01*w,y+.40*h,x+.33*w,y+.84*h],[x+.17*w,y+.48*h],[x+.17*w,y+.68*h],-1,.018*Math.min(w,h)),
  bone([x+.65*w,y+.40*h,x+1.03*w,y+.84*h],[x+.80*w,y+.48*h],[x+.84*w,y+.68*h],1,.018*Math.min(w,h)),
];
const woodPair=(x,y,w,h)=>[
  bone([x-.15*w,y-.15*h,x+.41*w,y+.65*h],[x+.46*w,y+.63*h],[x+.12*w,y+.21*h],-1,.10*w),
  bone([x+.64*w,y-.15*h,x+1.15*w,y+.65*h],[x+.54*w,y+.63*h],[x+.88*w,y+.21*h],1,.10*w),
];
const waterPair=(x,y,w,h)=>[
  bone([x-.10*w,y+.04*h,x+.41*w,y+.84*h],[x+.32*w,y+.61*h],[x+.14*w,y+.31*h],-1,.065*w),
  bone([x+.70*w,y-.12*h,x+1.1*w,y+.94*h],[x+.58*w,y+.49*h],[x+.84*w,y+.63*h],1,.12*w),
];
export const HERO_RIGS={
  1:woodPair(0,0,1,1),
  2:[...woodPair(0,0,.49,1),...woodPair(.46,0,.54,1)],
  3:[...woodPair(.02,.50,.94,.50),...woodPair(0,0,.49,.56),...woodPair(.44,0,.56,.56)],
  4:firePair(0,0,1,1),
  5:[...firePair(.03,.48,.94,.52),...firePair(0,0,1,.53)],
  6:[...firePair(.02,.49,.96,.51),...firePair(0,0,.50,.52),...firePair(.45,0,.55,.52)],
  7:waterPair(0,0,1,1),
  8:[...waterPair(0,0,.49,1),...waterPair(.45,0,.55,1)],
  9:[...waterPair(.03,.51,.91,.49),...waterPair(0,0,.49,.54),...waterPair(.44,0,.56,.54)],
};
function weight(b,x,y){
  const [l,d,r,t]=b.box,s=b.soft;
  return smooth((x-l)/s)*smooth((r-x)/s)*smooth((y-d)/s)*smooth((t-y)/s);
}

export class GlyphHero {
  constructor(run,shaders){
    this.run=run;this.ready=false;this.disposed=false;this.species=0;
    this.shots=0;this.side=1;this.release=[-100,-100];this.gestureAt=-100;
    this.lastShot=null;this.pose=null;
    this.poseInterval=1/(window.mobileGraphics?.heroFPS||Infinity);
    this.drawAt=-Infinity;this.textureUpdates=0;this.poseRevision=0;this.drawRevision=-1;
    this.geometry=new PlaneGeometry(1.28,1.28);
    this.geometry.translate(0,.5,0);
    this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=window.mobileGraphics?.heroTextureSize||512;
    this.ctx=this.canvas.getContext('2d');
    this.texture=new CanvasTexture(this.canvas);this.ready=true;
    this.texture.colorSpace=SRGBColorSpace;
    if(window.mobileGraphics?.heroTextureSize){
      this.texture.generateMipmaps=false;this.texture.minFilter=this.texture.magFilter;
    }
    // Keep smooth font edges; the iOS profile avoids regenerating mipmaps for
    // this frequently updated, small on-screen character.
    const s=run.r.shared;
    this.material=new ShaderMaterial({uniforms:{
      map:{value:this.texture},uTexel:{value:new Vector2(1/this.canvas.width,1/this.canvas.height)},
      uPos:{value:new Float32Array(3)},uSize:{value:new Float32Array(2)},
      uRegion:{value:new Float32Array(4)},uFx:{value:new Float32Array(4)},
      uTint:{value:new Float32Array([1,1,1,0])},uLook:{value:new Float32Array(2)},
      uLookPal:shaders.lookPal,uLight:s.uLight,uTime:s.uTime,
      uFogColor:s.uFogColor,uFogNear:s.uFogNear,uFogFar:s.uFogFar,
    },transparent:true,vertexShader:`
      uniform vec3 uPos;uniform vec2 uSize;uniform vec4 uRegion,uFx,uTint;uniform vec2 uLook;
      varying vec2 vUv,vLocal,vLook;varying vec4 vRect,vFx,vTint;varying float vFogDepth;
      void main(){
        vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
        vec3 camUp=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
        vec3 up=normalize(mix(vec3(0.,1.,0.),camUp,.35));
        vec4 mv=viewMatrix*vec4(uPos+right*position.x*uSize.x+up*position.y*uSize.y,1.);
        mv.z+=.25+uSize.y*.05;gl_Position=projectionMatrix*mv;
        vUv=mix(uRegion.xy,uRegion.zw,uv);vRect=uRegion;vLocal=uv;
        vFx=uFx;vTint=uTint;vLook=uLook;vFogDepth=-mv.z;
      }`,fragmentShader:shaders.fragmentShader
        // Retain the game's colors, fog, lighting and skin recipes; only the
        // alpha edge changes from a hard pixel cutout to a smooth font edge.
        .replace('if (a < 0.5) {','if (a < 0.015) {')
        .replace('gl_FragColor = vec4(col, 1.);','gl_FragColor = vec4(col, smoothstep(0.015, 0.95, a));')});
    this.mesh=new InstancedMesh(this.geometry,this.material,1);
    this.mesh.name='字灵 · 高清主角笔画动作';this.mesh.frustumCulled=false;
    this.mesh.renderOrder=1;this.mesh.visible=false;run.r.scene.add(this.mesh);
  }
  select(id){
    if(!HERO_ART[id])return false;
    if(this.species===id)return true;
    this.species=id;this.art=HERO_ART[id];this.bones=HERO_RIGS[id];
    this.path=HERO_PATHS[id];this.drawKey='';
    let contour=-1;
    this.contours=this.path.points.map(p=>{if((p[0]&7)===0)contour++;return contour;});
    this.release=[-100,-100];this.gestureAt=-100;this.pose=null;
    return true;
  }
  attack(){this.gestureAt=this.run.time;this.poseRevision++;}
  sample(){
    const p=this.run.player,t=this.run.time,family=Math.floor((p.speciesId-1)/3);
    const moving=clamp(p.speedNow/6),phase=p.animT*Math.PI*2;
    const frozen=p.dead||p.pstat?.frozen>0||p.pstat?.sleep>0;
    if(frozen&&this.pose)return this.pose;
    // Anticipate the existing weapon cooldown, without delaying a shot or
    // changing its damage/rate. The next hand draws back before release.
    const next=Math.min(...p.moves.filter(Boolean).map(m=>m.timer>0?m.timer:100),100);
    const hasTarget=this.run.enemies.nearest(p.pos.x,p.pos.z,16)>=0;
    const wind=hasTarget?smooth((.22-next)/.22):0;
    const pose={sx:1+p.squash*.20,sy:1-p.squash*.18,
      lift:Math.abs(Math.sin(phase))*moving*.055+Math.sin(t*2.8)*.008,
      tilt:Math.sin(phase)*moving*.035,motions:[]};
    if(p.hurtT>0){pose.sx*=.95;pose.sy*=.97;pose.tilt+=Math.sin(p.hurtT*38)*.05;}
    if(p.dead){pose.tilt=-.32;pose.sy*=.80;}
    for(let i=0;i<this.bones.length;i++){
      const b=this.bones[i],side=b.side,j=side<0?0:1,age=t-this.release[j];
      const throwPose=age>=0&&age<.34?(1-smooth(age/.34)):0;
      const nonShot=t-this.gestureAt<.3&&t-Math.max(...this.release)>.35?Math.sin(clamp((t-this.gestureAt)/.3)*Math.PI):0;
      const gather=this.side===side?wind:wind*.22;
      const idle=Math.sin(t*(family===1?4.2:2.5)+i*.85)*.08;
      const walk=Math.sin(phase+i*1.5)*moving*.18;
      const cast=throwPose+nonShot*.7;
      // Fire flicks its dots; wood swings its anchored branches; water paddles.
      let angle=family===1?side*(idle+walk+gather*.32-cast*.75):
        family===0?side*(idle*.45+walk*.65-gather*.10+cast*.42):
        side*(idle+walk-gather*.16+cast*.28);
      // 焱's two inner dots sit very close together; keep their secondary
      // follow-through small so the compound character stays legible.
      if(p.speciesId===6&&(i===3||i===4))angle*=.2;
      pose.motions.push({angle,dx:family===1?side*cast*.035:0,
        dy:family===1?cast*.055+gather*.035:0});
    }
    return pose;
  }
  deform(x,y,pose,contour){
    let dx=0,dy=0;
    const fireMap={4:[1,0,-1],5:[1,0,-1,3,2,-1],6:[1,0,-1,4,3,2,-1,-2]};
    const rigid=contour===undefined?undefined:fireMap[this.species]?.[contour];
    for(let i=0;i<this.bones.length;i++){
      const b=this.bones[i],m=pose.motions[i];let w=weight(b,x,y);
      if(rigid!==undefined)w=rigid===i?1:rigid===-2&&i===5?smooth((x-.79)/.13)*smooth((y-.22)/.08)*.4:0;
      else if(contour!==undefined&&this.species<=3&&Math.floor(i/2)!==contour)w=0;
      else if(contour!==undefined&&this.species===7)w=contour===0?(i===0?1:0):(i===1?w:0);
      else if(contour!==undefined&&this.species===9){
        if(contour===0)w=i===1?w:0;
        if(contour===1)w=i===0?1:0;
        if(contour===2&&i<2)w=0;
      }
      if(w===0)continue;
      const rx=x-b.pivot[0],ry=y-b.pivot[1],c=Math.cos(m.angle),s=Math.sin(m.angle);
      dx+=(rx*c-ry*s-rx+m.dx)*w;dy+=(rx*s+ry*c-ry+m.dy)*w;
    }
    x=(x+dx-.5)*pose.sx;y=(y+dy)*pose.sy;
    const c=Math.cos(pose.tilt),s=Math.sin(pose.tilt);
    return [x*c-y*s,x*s+y*c+pose.lift];
  }
  size(){
    const p=this.run.player;
    const height=Math.max(.75,this.run.sprites.get(p.speciesId).bodyHeight(p.renderScale));
    return [height*this.path.aspect,height];
  }
  hand(side,pose=this.sample()){
    // Outer hands remain the primary emitters on the evolved compound glyphs.
    const candidates=this.bones.filter(b=>b.side===side);
    const b=candidates.reduce((a,b)=>side<0?(a.tip[0]<b.tip[0]?a:b):(a.tip[0]>b.tip[0]?a:b));
    const [x,y]=this.deform(...b.tip,pose),[width,height]=this.size();
    const p=this.run.player.pos,me=this.run.r.camera.matrixWorld.elements;
    const ux=me[4]*.35,uy=.65+me[5]*.35,uz=me[6]*.35,len=Math.hypot(ux,uy,uz)||1;
    return {x:p.x+me[0]*x*width+ux/len*y*height,
      y:p.y+me[1]*x*width+uy/len*y*height,
      z:p.z+me[2]*x*width+uz/len*y*height};
  }
  launch(shot){
    const p=this.run.player;
    // Only player-owned shots born at the player. Enemy, ally, remote,
    // ricochet and world-origin attacks retain their existing spawn points.
    if(!this.ready||!this.select(p.speciesId)||p.dead||(shot.flags&1)||shot.from>=0||
      !(shot.slot>=0)||Math.hypot(shot.x-p.pos.x,shot.z-p.pos.z)>.35||Math.abs(shot.y-p.pos.y)>1.8)return shot;
    const side=this.side;this.release[side<0?0:1]=this.run.time;this.side=-side;this.poseRevision++;
    const origin=this.hand(side),result={...shot};
    // Arcing shots already solve a ballistic landing position: animate their
    // cast but leave that trajectory intact.
    if(!(shot.flags&8)){
      const length=Math.hypot(shot.dx,shot.dz)||1,e=this.run.enemies,target=shot.target;
      const aimed=target>=0&&e.alive[target];
      const distance=aimed?Math.max(1,Math.hypot(e.x[target]-shot.x,e.z[target]-shot.z)):8;
      result.dx=shot.x+shot.dx/length*distance-origin.x;
      result.dz=shot.z+shot.dz/length*distance-origin.z;
      result.dy=shot.y+(shot.dy||0)/length*distance-origin.y;
      Object.assign(result,origin);
    }
    this.shots++;this.lastShot={side,time:this.run.time,origin:{x:result.x,y:result.y,z:result.z},type:shot.type};
    return result;
  }
  render(sprite,flash,fade,outline,squash,tint,look){
    const p=this.run.player;
    if(!this.ready||!this.select(p.speciesId)){this.mesh.visible=false;return false;}
    const due=!this.drawKey||this.drawRevision!==this.poseRevision||this.run.time-this.drawAt>=this.poseInterval-1e-6||this.run.time<this.drawAt;
    if(due){
      this.pose=this.sample();const pose=this.pose;
      const key=JSON.stringify(pose);
      if(key!==this.drawKey){
        this.drawKey=key;const ctx=this.ctx,points=this.path.points;
        const at=i=>{const [,x,y]=points[i],[px,py]=this.deform(x,y,pose,this.contours[i]);return [(px+.5)*400+56,512-(py*400+56)];};
        const scale=this.canvas.width/512;
        ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.save();ctx.scale(scale,scale);ctx.beginPath();
        for(let i=0;i<points.length;i++){
          const type=points[i][0]&7;
          if(type===0)ctx.moveTo(...at(i));
          else if(type===1)ctx.lineTo(...at(i));
          else if(type===3){ctx.bezierCurveTo(...at(i),...at(i+1),...at(i+2));i+=2;}
          if(points[i][0]&128)ctx.closePath();
        }
        ctx.lineWidth=12.5;ctx.lineJoin='round';ctx.lineCap='round';
        ctx.strokeStyle='#121d22';ctx.stroke();ctx.fillStyle=this.art.color;ctx.fill();
        ctx.restore();this.texture.needsUpdate=true;this.textureUpdates++;
      }
      this.drawAt=this.run.time;this.drawRevision=this.poseRevision;
    }
    this.mesh.visible=true;
    const u=this.material.uniforms;
    u.uPos.value.set([p.pos.x,p.pos.y,p.pos.z]);u.uSize.value.set(this.size());
    u.uRegion.value.set([0,0,1,1]);u.uFx.value.set([flash,fade,outline,0]);
    u.uTint.value.set(tint);u.uLook.value.set([look&15,look>>4]);
    return true;
  }
  dispose(){this.disposed=true;this.mesh.parent?.remove(this.mesh);this.mesh.dispose();this.geometry.dispose();this.material.dispose();this.texture.dispose();}
}
