import {K as Mesh,v as BufferAttribute,w as Color,n as mergeGeometries,y as BufferGeometry} from '../assets/three-DmSYIDKK.js';
import {roundedBox,ringGeometry,paperMaterial} from './stationery-sanctuary.js';
export function desktopRandom(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function insideNotebook(p,x,z,margin=0){const dx=x-p.x,dz=z-p.z;return Math.abs(dx*p.cos-dz*p.sin)<=p.w/2-margin&&Math.abs(dx*p.sin+dz*p.cos)<=p.d/2-margin;}
function corners(p,margin=0){const points=[];for(const x of [-p.w/2-margin,p.w/2+margin])for(const z of [-p.d/2-margin,p.d/2+margin])points.push([p.x+x*p.cos+z*p.sin,p.z-x*p.sin+z*p.cos]);return points;}
export function notebooksOverlap(a,b,gap=.5){
 const ca=corners(a,gap),cb=corners(b,gap);
 for(const axis of [[a.cos,-a.sin],[a.sin,a.cos],[b.cos,-b.sin],[b.sin,b.cos]]){
  const pa=ca.map(p=>p[0]*axis[0]+p[1]*axis[1]),pb=cb.map(p=>p[0]*axis[0]+p[1]*axis[1]);
  if(Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa))return false;
 }return true;
}
export function desktopHeight(terrain,x,z){let h=terrain.desktopBase;for(const p of terrain.desktopSheets)if(insideNotebook(p,x,z))h=Math.max(h,p.bottom+p.thickness);return h;}
export function planDesktopTerrain(terrain){
 const rng=desktopRandom(terrain.seed^0x50414745),plans=[],base=1.38;
 const formats=[
  {w:[23,32],d:[31,42],h:[.25,.55],type:0,binding:'side'},
  {w:[18,28],d:[25,37],h:[.30,.85],type:1,binding:'side'},
  {w:[17,25],d:[24,34],h:[.40,.95],type:2,binding:'sewn'},
  {w:[20,28],d:[28,38],h:[.75,1.25],type:3,binding:'closed'},
  {w:[29,40],d:[20,28],h:[.25,.70],type:4,binding:'top'},
  {w:[13,21],d:[19,29],h:[.35,.90],type:5,binding:'closed'},
  {w:[29,39],d:[21,28],h:[.30,.65],type:6,binding:'sewn'},
  {w:[10,18],d:[12,21],h:[.14,.45],type:7,binding:'glued'},
 ];
 const range=a=>a[0]+rng()*(a[1]-a[0]);
 const prepare=p=>({...p,cos:Math.cos(p.angle),sin:Math.sin(p.angle)});
 const add=p=>{p=prepare(p);p.id=plans.length+1;plans.push(p);return p;};
 const draft=(type=Math.floor(rng()*formats.length))=>{const f=formats[type];return {w:range(f.w),d:range(f.d),thickness:range(f.h),type,binding:f.binding,palette:Math.floor(rng()*7),bookmark:(rng()-.5)*.65,angle:rng()*Math.PI*2,bottom:base};};
 const fits=p=>corners(p).every(([x,z])=>Math.abs(x)<terrain.play-5&&Math.abs(z)<terrain.play-5)&&!plans.some(q=>notebooksOverlap(p,q,.55));
 const stack=(parent,preferred)=>{
  for(let attempt=0;attempt<24;attempt++){
   const p=draft(preferred??Math.floor(rng()*formats.length)),factor=.55+rng()*.23;
   const maxScale=Math.min(parent.w*factor/p.w,parent.d*(factor+.05)/p.d);
   p.w*=maxScale;p.d*=maxScale;
   const localX=(rng()-.5)*parent.w*.25,localZ=(rng()-.5)*parent.d*.23;
   Object.assign(p,{x:parent.x+localX*parent.cos+localZ*parent.sin,z:parent.z-localX*parent.sin+localZ*parent.cos,angle:parent.angle+(rng()-.5)*.72,bottom:parent.bottom+parent.thickness,parent:parent.id,featured:parent.featured});
   const child=prepare(p);
   if(child.w>=7&&child.d>=9&&corners(child,.16).every(c=>insideNotebook(parent,c[0],c[1])))return add(child);
  }
  return null;
 };
 // A slanted starting notebook is surrounded by unequal gaps and mixed formats.
 const main=add({...draft(0),x:(rng()-.5)*3,z:(rng()-.5)*3,w:27+rng()*5,d:34+rng()*6,angle:(rng()<.5?-1:1)*(.20+rng()*.32),thickness:.36,featured:true});
 for(let n=0;n<4;n++)for(let attempt=0;attempt<45;attempt++){
  const theta=[-.65,-2.45,.8,2.3][n]+(rng()-.5)*.55,radius=24+rng()*18;
  const p=prepare({...draft([3,7,4,6][n]),x:Math.cos(theta)*radius,z:Math.sin(theta)*radius,featured:true});
  if(!fits(p))continue;
  const parent=add(p);if(n===0){parent.thickness=1.08;stack(parent,1);}else if(n===2&&rng()<.7)stack(parent,5);break;
 }
 // Scatter small groups and isolated books in continuous space, not grid cells.
 const pockets=[{x:0,z:0}],pocketTarget=18;
 for(let attempt=0;attempt<900&&pockets.length<pocketTarget;attempt++){
  const x=(rng()*2-1)*(terrain.play-24),z=(rng()*2-1)*(terrain.play-24),spacing=35+rng()*22;
  if(pockets.every(c=>Math.hypot(c.x-x,c.z-z)>spacing))pockets.push({x,z});
 }
 for(const pocket of pockets.slice(1)){
  const count=1+Math.floor(rng()*4);
  for(let n=0;n<count;n++)for(let attempt=0;attempt<28;attempt++){
   const theta=rng()*Math.PI*2,radius=n===0?rng()*7:14+rng()*18;
   const p=prepare({...draft(),x:pocket.x+Math.cos(theta)*radius,z:pocket.z+Math.sin(theta)*radius});
   if(!fits(p))continue;
   const parent=add(p);
   if(p.w*p.d>380&&rng()<.47){const child=stack(parent);if(child&&child.w*child.d>240&&rng()<.20)stack(child,7);}
   break;
  }
 }
 terrain.notebookLayout={groups:pockets.length,styles:new Set(plans.map(p=>p.type)).size,primary:plans.filter(p=>!p.parent).length,stacked:plans.filter(p=>p.parent).length};
 terrain.desktopSheets=plans;terrain.desktopBase=base;
 // Solid objects supply exact top heights. The underlying desk stays flat.
 terrain.heights.fill(base);terrain.minH=base;terrain.maxH=Math.max(...plans.map(p=>p.bottom+p.thickness));
 terrain.height=(x,z)=>desktopHeight(terrain,x,z);
 terrain.spawn.y=terrain.height(terrain.spawn.x,terrain.spawn.z);
 terrain.paperTerrain={generator:'solid-stacked-notebooks',paperFloor:base,sheets:plans.length,walkableRamps:false};
}
const notebookTopGLSL=`
 varying vec2 vSheetUV;varying vec4 vSheetInfo;
 vec3 notebookTop(vec2 q,vec4 info,vec3 cover,float distanceToCamera){
  vec3 paper=vec3(.91,.89,.83);float aa=max(fwidth(q.x)+fwidth(q.y),.016),vis=1.-smoothstep(45.,120.,distanceToCamera);
  float insidePage=step(-info.x*.5+1.9,q.x)*step(q.x,info.x*.5-1.0)*step(abs(q.y),info.y*.5-1.5);
  if(info.z<.5){
   float ruled=1.-smoothstep(.014,.014+aa,abs(fract(q.y/1.05+.5)-.5)*1.05);
   paper=mix(paper,vec3(.51,.67,.76),ruled*.47*vis*insidePage);
   float margin=1.-smoothstep(.022,.022+aa,abs(q.x+info.x*.5-3.1));
   paper=mix(paper,vec3(.83,.51,.51),margin*.45*vis*step(abs(q.y),info.y*.5-1.5));
  }else if(info.z<1.5){
   paper=vec3(.94,.88,.73);vec2 grid=abs(fract(q/1.05+.5)-.5)*1.05;
   float ink=1.-smoothstep(.012,.012+aa,min(grid.x,grid.y));paper*=1.-ink*.17*vis*insidePage;
  }else if(info.z<2.5){
   paper=vec3(.89,.91,.87);vec2 grid=abs(fract(q/.95+.5)-.5)*.95;
   float ink=1.-smoothstep(.025,.025+aa,length(grid));paper*=1.-ink*.23*vis*insidePage;
  }else if(info.z<3.5||abs(info.z-5.)<.1){
   paper=cover;vec2 label=abs(q-vec2(0.,-info.y*.20));
   float labelMask=(1.-smoothstep(info.x*.25,info.x*.25+.04,label.x))*(1.-smoothstep(info.y*.105,info.y*.105+.04,label.y));
   vec3 labelColor=vec3(.92,.90,.83);
   float frame=1.-smoothstep(.045,.045+aa,min(abs(label.x-info.x*.22),abs(label.y-info.y*.085)));
   labelColor=mix(labelColor,cover,frame*.40);
   float rules=1.-smoothstep(.016,.016+aa,abs(fract((q.y+info.y*.20)/1.4+.5)-.5)*1.4);
   labelColor*=1.-rules*.12*step(abs(q.x),info.x*.18);paper=mix(paper,labelColor,labelMask);
  }else if(info.z<4.5){
   paper=vec3(.94,.92,.86);
   vec2 inset=abs(q)-info.xy*.5+vec2(1.3,1.8);
   float registration=1.-smoothstep(.018,.018+aa,min(abs(inset.x),abs(inset.y)));
   paper=mix(paper,vec3(.75,.77,.73),registration*.15*vis);
  }else if(info.z<6.5){
   paper=vec3(.91,.92,.86);
   vec2 local=q+info.xy*.5-vec2(1.7,2.2),extent=info.xy-vec2(3.4,4.4);
   float content=step(0.,local.x)*step(0.,local.y)*step(local.x,extent.x)*step(local.y,extent.y);
   vec2 grid=abs(fract(local/vec2(extent.x/2.,extent.y/3.)+.5)-.5)*vec2(extent.x/2.,extent.y/3.);
   float divisions=1.-smoothstep(.022,.022+aa,min(grid.x,grid.y));
   paper=mix(paper,vec3(.61,.73,.70),divisions*.40*content*vis);
   float headers=step(mod(local.y,extent.y/3.),.75);
   paper=mix(paper,mix(cover,paper,.72),headers*content);
  }else{
   paper=mix(cover,vec3(.97,.93,.76),.68);
   float adhesive=1.-smoothstep(info.y*.5-1.5,info.y*.5-1.2,q.y);
   paper*=.97+.03*adhesive;
   if(q.x+q.y>info.x*.5+info.y*.5-1.6)paper=mix(paper,vec3(.97,.95,.86),.55);
  }
  if(info.z<2.){
   float hole=1.-smoothstep(.12,.12+aa,length(vec2(q.x+info.x*.5-.46,mod(q.y+info.y*.5-1.2,1.8)-.9)));
   paper=mix(paper,vec3(.30,.38,.39),hole*.75*vis);
  }else if(abs(info.z-4.)<.1){
   float hole=1.-smoothstep(.12,.12+aa,length(vec2(mod(q.x+info.x*.5-1.2,1.8)-.9,q.y+info.y*.5-.46)));
   paper=mix(paper,vec3(.30,.38,.39),hole*.65*vis);
  }
  return paper;
 }`;
export function installDesktopSurfaces(terrain){
 const plans=terrain.desktopSheets;if(!plans?.length)return;
 const bodies=[],tops=[],colors=[0x6dada2,0xd38f9d,0xd6b262,0x7897b6,0xa99bbb,0x9caf84,0xc49580];
 const append=(geometry,p,color,x,y,z,grain=0,top=false)=>{
  let g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();g.deleteAttribute('uv');
  const n=g.attributes.position.count,c=new Color(color),ink=new Float32Array(n*3);
  if(top){const uv=new Float32Array(n*2),info=new Float32Array(n*4),pos=g.attributes.position;for(let i=0;i<n;i++){uv.set([pos.getX(i),pos.getZ(i)],i*2);info.set([p.w,p.d,p.type,p.palette],i*4);}g.setAttribute('aSheetUV',new BufferAttribute(uv,2));g.setAttribute('aSheetInfo',new BufferAttribute(info,4));}
  g.translate(x,y,z);g.rotateY(p.angle);g.translate(p.x,p.bottom,p.z);
  for(let i=0;i<n;i++)ink.set([c.r,c.g,c.b],i*3);
  g.setAttribute('color',new BufferAttribute(ink,3));g.setAttribute('aPaper',new BufferAttribute(new Float32Array(n).fill(grain),1));(top?tops:bodies).push(g);
 };
 for(const p of plans){
  const color=p.type===5?0xb59b76:colors[p.palette],closed=p.binding==='closed',cover=Math.min(.10,p.thickness*.17),pageTop=closed?p.thickness-cover:p.thickness;
  append(roundedBox(p.w,cover,p.d,.07),p,color,0,cover/2,0);
  append(roundedBox(p.w-.32,pageTop-cover,p.d-.32,.055),p,p.type===7?0xe6d5a1:0xede6d5,0,cover+(pageTop-cover)/2,0,1);
  if(closed)append(roundedBox(p.w,cover,p.d,.075),p,color,0,p.thickness-cover/2,0);
  if(p.binding==='closed'||p.binding==='sewn')append(roundedBox(.31,p.thickness,p.d,.07),p,color,-p.w/2+.12,p.thickness/2,0);
  const w=closed?p.w-.12:p.w-.38,d=closed?p.d-.12:p.d-.38;
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array([-w/2,0,-d/2,-w/2,0,d/2,w/2,0,-d/2,w/2,0,-d/2,-w/2,0,d/2,w/2,0,d/2]),3));g.computeVertexNormals();append(g,p,color,0,p.thickness+.001,0,1,true);
  if(p.binding==='side')for(let z=-p.d/2+1.2;z<p.d/2-.8;z+=1.8){const ring=ringGeometry(.36,.28,.075);ring.rotateX(Math.PI/2);append(ring,p,0x8c9da0,-p.w/2+.10,p.thickness-.09,z);}
  if(p.binding==='top')for(let x=-p.w/2+1.2;x<p.w/2-.8;x+=1.8){const ring=ringGeometry(.36,.28,.075);ring.rotateZ(Math.PI/2);append(ring,p,0x8c9da0,x,p.thickness-.09,-p.d/2+.10);}
  if(p.type===5)append(roundedBox(.45,.045,p.d,.02),p,0x586d68,p.w*.31,p.thickness+.028,0);
  if(p.type!==7)append(roundedBox(1.0,.025,1.4,.025),p,colors[(p.palette+1)%colors.length],p.w*(p.bookmark??.27),pageTop+.015,p.d/2-.24);
 }
 const bodyMaterial=paperMaterial(terrain),topMaterial=paperMaterial(terrain);
 const cutout='if(fade>.02&&mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y)*3.,4.)/4.<fade*.80)discard;';
 for(const material of [bodyMaterial,topMaterial])material.fragmentShader=material.fragmentShader.replace(cutout,'');
 topMaterial.vertexShader='attribute vec2 aSheetUV;attribute vec4 aSheetInfo;varying vec2 vSheetUV;varying vec4 vSheetInfo;\n'+topMaterial.vertexShader.replace('vInk=color;','vInk=color;vSheetUV=aSheetUV;vSheetInfo=aSheetInfo;');
 topMaterial.uniforms.tDesktopShade=terrain.terrainMat.uniforms.tShade;topMaterial.uniforms.uDesktopWorld={value:terrain.world};
 topMaterial.fragmentShader='uniform sampler2D tDesktopShade;uniform float uDesktopWorld;\n'+notebookTopGLSL+topMaterial.fragmentShader.replace('vec3 c=vInk*light;','vec3 c=notebookTop(vSheetUV,vSheetInfo,vInk,vD)*light;c*=mix(vec3(1.),vec3(.78,.80,.82),smoothstep(.12,.85,texture2D(tDesktopShade,vWorld.xz/uDesktopWorld+.5).r));');
 for(const [parts,material,name] of [[bodies,bodyMaterial,'solid-notebook-pages'],[tops,topMaterial,'notebook-writing-surfaces']]){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());const mesh=new Mesh(geometry,material);mesh.name=name;terrain.group.add(mesh);}
 terrain.desktopMaterial=bodyMaterial;terrain.desktopTopMaterial=topMaterial;
}
export const desktopPaperGLSL=`
 vec3 desktopPaper(vec3 world,float distanceToCamera){
  float grain=sin(world.x*.75+sin(world.z*.055)*1.8)*.009+sin(world.x*8.+sin(world.z*.11))*.003;
  return vec3(.73,.665,.555)+grain;
 }`;

