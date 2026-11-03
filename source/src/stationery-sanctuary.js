import {_ as BoxGeometry,I as Group,K as Mesh,ct as ShaderMaterial,v as Float32BufferAttribute,w as Color,n as mergeGeometries,y as BufferGeometry,E as CylinderGeometry,ht as Vector3} from '../assets/three-DmSYIDKK.js';

export function roundedBox(w,h,d,r=.06){
  const g=new BoxGeometry(w,h,d,3,3,3),p=g.attributes.position;
  r=Math.min(r,w*.18,h*.18,d*.18);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),cx=Math.max(-w/2+r,Math.min(w/2-r,x)),cy=Math.max(-h/2+r,Math.min(h/2-r,y)),cz=Math.max(-d/2+r,Math.min(d/2-r,z));
    const dx=x-cx,dy=y-cy,dz=z-cz,length=Math.hypot(dx,dy,dz)||1;
    p.setXYZ(i,cx+dx/length*r,cy+dy/length*r,cz+dz/length*r);
  }
  g.computeVertexNormals();return g;
}
function batch(parts,material){
  const meshes=[];
  for(const p of parts){
    let g=roundedBox(p.w,p.h,p.d,p.round??.05).toNonIndexed();
    if(p.turn)g.rotateZ(p.turn);
    g.translate(p.x||0,p.y||0,p.z||0);
    const c=new Color(p.color),color=new Float32Array(g.attributes.position.count*3),paper=new Float32Array(g.attributes.position.count);
    for(let i=0;i<paper.length;i++){color.set([c.r,c.g,c.b],i*3);paper[i]=p.paper||0;}
    g.setAttribute('color',new Float32BufferAttribute(color,3));g.setAttribute('aPaper',new Float32BufferAttribute(paper,1));meshes.push(g);
  }
  const geometry=mergeGeometries(meshes);for(const g of meshes)g.dispose();
  return new Mesh(geometry,material);
}
export function paperMaterial(terrain){
  const m=new ShaderMaterial({vertexColors:true,uniforms:{uFogColor:terrain.shared.uFogColor,uFogNear:terrain.shared.uFogNear,uFogFar:terrain.shared.uFogFar,uPlayer:{value:new Vector3(0,-999,0)}},vertexShader:`
    attribute float aPaper;varying vec3 vInk;varying vec3 vN;varying vec3 vLocal;varying vec3 vWorld;varying vec3 vView;varying float vPaper;varying float vD;varying float vFade;uniform vec3 uPlayer;
    void main(){vec4 w=modelMatrix*vec4(position,1.);vec4 mv=viewMatrix*w;vD=-mv.z;gl_Position=projectionMatrix*mv;vInk=color;vN=normalize(mat3(modelMatrix)*normal);vLocal=position;vWorld=w.xyz;vPaper=aPaper;vView=cameraPosition-w.xyz;
      vec3 ab=uPlayer+vec3(0.,1.,0.)-cameraPosition;float t=clamp(dot(w.xyz-cameraPosition,ab)/max(dot(ab,ab),.001),0.,1.);
      vFade=(1.-smoothstep(.7,2.,length(cameraPosition+ab*t-w.xyz)))*step(t,.94)*step(.03,t);}
    `,fragmentShader:`
    uniform vec3 uFogColor,uPlayer;uniform float uFogNear,uFogFar;varying vec3 vInk;varying vec3 vN;varying vec3 vLocal;varying vec3 vWorld;varying vec3 vView;varying float vPaper,vD,vFade;
    void main(){
      vec3 ab=uPlayer+vec3(0.,1.,0.)-cameraPosition;float t=clamp(dot(vWorld-cameraPosition,ab)/max(dot(ab,ab),.001),0.,1.);
      float fade=(1.-smoothstep(.7,1.8,length(cameraPosition+ab*t-vWorld)))*step(t,.96)*step(.03,t);
      if(fade>.02&&mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y)*3.,4.)/4.<fade*.80)discard;
      vec3 n=normalize(vN);float light=.64+.36*max(0.,dot(n,normalize(vec3(-.5,1.,.7))));
      vec3 c=vInk*light;
      vec3 view=normalize(vView),sun=normalize(vec3(-.5,1.,.7));
      c*=1.-pow(1.-abs(dot(n,view)),5.)*.24;
      c+=pow(max(0.,dot(n,normalize(view+sun))),22.)*.10*(1.-step(.05,vPaper));
      float pageLine=1.-smoothstep(.015,.015+max(fwidth(vLocal.y*8.),.025),abs(fract(vLocal.y*8.)-.5));
      c*=1.-step(.5,vPaper)*pageLine*.10*(1.-abs(n.y));
      if(vPaper>.05&&vPaper<.5){
        vec2 q=abs(fract(vec2(vLocal.x+vLocal.z,vLocal.y)*2.5+.5)-.5);
        float rule=1.-smoothstep(.008,.025+fwidth(vLocal.y*2.5),min(q.x,q.y));
        c=mix(c,c*vec3(.87,.82,.69),rule*.4);
      }
      gl_FragColor=vec4(mix(c,uFogColor,smoothstep(uFogNear,uFogFar,vD)),1.);
      #include <colorspace_fragment>
    }`});terrain.mats.push(m);return m;
}

export function createStationerySanctuaryModel(name,terrain,x){
  if(name!=='sanct_gate'&&name!=='sanct_pillar')return null;
  const root=new Group(),material=paperMaterial(terrain),parts=[];
  const add=(list,w,h,d,px,py,pz,color,paper=0,turn=0,round=.06)=>list.push({w,h,d,x:px,y:py,z:pz,color,paper,turn,round});
  const cream=0xf3e5bd,pages=0xe8ddc2;
  if(name==='sanct_gate'){
    for(const side of [-1,1]){
      const px=side*2.45;
      for(let i=0;i<3;i++)add(parts,1.12-i*.10,.13,.98-i*.06,px,.065+i*.13,0,pages,1);
      add(parts,.70,3.65,.72,px,2.15,0,cream,.2);
      add(parts,.96,.22,.92,px,4.08,0,cream,.2);
    }
    add(parts,5.9,.47,1.0,0,4.43,0,cream,.2);
    add(parts,6.05,.12,1.12,0,4.73,0,0xf4dfac,.2);
    for(let i=0;i<10;i++){
      const px=-2.15+i*.48,py=3.92-.29*(1-Math.pow(px/2.4,2));
      const slope=.58*px/5.76;
      add(parts,.50,.11,.10,px,py,.57,0xe4b650,0,Math.atan(slope),.015);
    }
    root.add(batch(parts,material));root.name='PaperGateway';
  }else{
    for(let i=0;i<5;i++)add(parts,2.05-i*.06,.11,1.72-i*.04,0,.055+i*.11,0,i%2?0xede3cc:pages,1,0,.035);
    root.add(batch(parts,material));
    const column=new Group();column.name='Column';column.position.y=.54;column.rotation.z=x<0?.10:-.10;
    const rubber=[],pink=x<0?0xe58098:0x658dc4;
    add(rubber,1.30,2.55,1.10,0,1.275,0,pink,0,0,.13);
    add(rubber,1.30,.98,1.10,0,3.015,0,0xf7edda,0,0,.13);
    add(rubber,1.305,.055,1.105,0,2.55,0,0xefdfd1,0,0,.01);
    column.add(batch(rubber,material));root.add(column);
    const stub=new Group();stub.name='Stub';stub.visible=false;
    stub.add(batch([{w:1.3,h:.55,d:1.1,y:.82,color:pink,round:.1}],material));root.add(stub);
    root.name='EraserPillar';
  }
  return root;
}

export function createStationeryGoldSupply(terrain){
  const material=paperMaterial(terrain),parts=[];
  for(let i=0;i<3;i++){
    const x=(i%2?.16:-.16),y=.22+i*.44,z=(i-1)*.12;
    parts.push({w:1.5,h:.43,d:.95,x:x-.20,y,z,color:0xe8ba4b,round:.09});
    parts.push({w:.58,h:.43,d:.95,x:x+.84,y,z,color:0xf7ecd1,round:.09});
    parts.push({w:.06,h:.44,d:.96,x:x+.51,y,z,color:0xcf9937,round:.02});
  }
  const root=new Group();root.name='StationeryGoldSupply';root.add(batch(parts,material));return root;
}

// Physical courtyard props stay planted when the player rotates the camera.
// A few broad, solid shapes replace the tiny painted details of the billboards.
export function wire(points,r=.065){
  const verts=[],sides=6;
  const ring=(i,j)=>{
    const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,angle=j/sides*Math.PI*2;
    return [p[0]-dy/len*r*Math.cos(angle),p[1]+dx/len*r*Math.cos(angle),r*Math.sin(angle)];
  };
  for(let i=0;i<points.length-1;i++)for(let j=0;j<sides;j++){
    const a=ring(i,j),b=ring(i+1,j),c=ring(i+1,(j+1)%sides),d=ring(i,(j+1)%sides);
    verts.push(...a,...d,...b,...b,...d,...c);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(new Float32Array(verts),3));g.computeVertexNormals();return g;
}
export function clipGeometry(height=1.5,width=.50){
  const points=[],r=width/2;
  for(let i=0;i<=12;i++){const a=i/12*Math.PI;points.push([Math.cos(a)*r,height-r+Math.sin(a)*r]);}
  for(let i=0;i<=12;i++){const a=Math.PI+i/12*Math.PI;points.push([Math.cos(a)*r,r+.06+Math.sin(a)*r]);}
  points.push(points[0]);
  const ri=r*.52,inner=[[-ri,.40],[-ri,height-r-.20]];
  for(let i=0;i<=12;i++){const a=Math.PI-i/12*Math.PI;inner.push([Math.cos(a)*ri,height-r-.20+Math.sin(a)*ri]);}
  inner.push([ri,.28]);
  const parts=[wire(points,.06),wire(inner,.052)],g=mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;
}
export function ringGeometry(outer,inner,height){
  const parts=[new CylinderGeometry(outer,outer,height,28,1,true),new CylinderGeometry(inner,inner,height,28,1,true)];
  // Reverse the inner wall so the hole has visible inside faces.
  const inside=parts[1],indices=inside.index.array,normals=inside.attributes.normal;
  for(let i=0;i<indices.length;i+=3){const first=indices[i];indices[i]=indices[i+2];indices[i+2]=first;}
  for(let i=0;i<normals.count;i++)normals.setXYZ(i,-normals.getX(i),-normals.getY(i),-normals.getZ(i));
  const positions=[];
  for(const y of [-height/2,height/2])for(let i=0;i<28;i++){
    const a=i/28*Math.PI*2,b=(i+1)/28*Math.PI*2;
    const p=[Math.cos(a)*outer,y,Math.sin(a)*outer],q=[Math.cos(b)*outer,y,Math.sin(b)*outer],r=[Math.cos(a)*inner,y,Math.sin(a)*inner],s=[Math.cos(b)*inner,y,Math.sin(b)*inner];
    if(y>0)positions.push(...p,...r,...q,...q,...r,...s);else positions.push(...p,...q,...r,...q,...s,...r);
  }
  const ends=new BufferGeometry();ends.setAttribute('position',new Float32BufferAttribute(new Float32Array(positions),3));ends.computeVertexNormals();
  const plain=parts.map(g=>{const a=g.toNonIndexed();a.deleteAttribute('uv');g.dispose();return a;});
  plain.push(ends);const g=mergeGeometries(plain);plain.forEach(p=>p.dispose());return g;
}
export function buildSanctuaryDressing(terrain){
  const plans=terrain.stationeryCourtyardPlans;if(!plans?.length)return [];
  const material=paperMaterial(terrain),geometries=[],shadows=[];
  const colors=[0x49bdab,0xe98da6,0xf2cd57,0x5ba8d0,0x89b64d];
  for(const [index,p] of plans.entries()){
    const scale=p.nativeScale??(p.hero?1.9:p.s*.68),angle=(index%7-3)*.17;
    const append=(geometry,color,x=0,y=0,z=0,turn=0,paper=0)=>{
      let g=geometry.index?geometry.toNonIndexed():geometry;
      if(g!==geometry)geometry.dispose();
      g.deleteAttribute('uv');g.rotateZ(turn);g.translate(x,y,z);g.scale(scale,scale,scale);g.rotateY(angle);g.translate(p.x,terrain.height(p.x,p.z)-.025,p.z);
      const c=new Color(color),n=g.attributes.position.count,ink=new Float32Array(n*3);
      for(let i=0;i<n;i++)ink.set([c.r,c.g,c.b],i*3);
      g.setAttribute('color',new Float32BufferAttribute(ink,3));g.setAttribute('aPaper',new Float32BufferAttribute(new Float32Array(n).fill(paper),1));geometries.push(g);
    };
    const box=(w,h,d,x,y,z,c,r=.045)=>append(roundedBox(w,h,d,r),c,x,y,z);
    if(p.hero){
      append(ringGeometry(.68,.58,1.40),index%2?0xe9bf58:0x57c4b9,0,.70,0);
      append(new CylinderGeometry(.58,.58,.08,20),0xc9b789,0,.10,0);
      for(let k=0;k<7;k++){
        const a=k*2.4,px=Math.cos(a)*.38,pz=Math.sin(a)*.38,h=2.5+(k%3)*.28,tilt=Math.cos(a)*.09;
        append(new CylinderGeometry(.105,.105,h,6),colors[k%5],px,h/2+.35,pz,tilt);
        append(new CylinderGeometry(0,.105,.38,6),0xedd1a2,px-tilt*h/2,h+.54,pz,tilt);
        append(new CylinderGeometry(0,.034,.12,6),colors[k%5],px-tilt*h/2,h+.77,pz,tilt);
      }
      box(.52,2.4,.10,.5,1.5,-.2,0x66bfdd);
      for(let k=0;k<9;k++)box(k%3===0?.23:.12,.018,.015,.38, .52+k*.23,-.14,0x347789,.005);
    }else{
      // Each small group has three clips, one paper/eraser block, and one clear accent.
      for(let k=0;k<3;k++)append(clipGeometry(1.15+((index+k)%3)*.32,.48),colors[(index+k)%5],-.64+k*.46,.01,-.20-k*.04,(k-1)*.15);
      box(.92,.34,.70,.38,.17,.30,colors[(index+2)%5]);
      box(.94,.08,.71,.38,.38,.30,0xf5e9cc,.02);
      if(index%3===0){
        box(.70,.20,.55,.17,.52,.34,colors[(index+1)%5]);
        box(.70,.025,.55,.17,.63,.34,0xf3e9d1,.005);
      }else if(index%3===1){
        box(.52,.88,.45,-.74,.44,.28,0x4c9ec8,.075);
        box(.18,.72,.035,-.74,.46,.522,0xc8d3cd,.018);
        box(.025,.56,.014,-.75,.46,.548,0x6b8284,.005);
        append(new CylinderGeometry(.05,.05,.022,10),0xe8e7d8,-.73,.59,.55,Math.PI/2);
      }else{
        append(ringGeometry(.47,.28,.46),index%2?0x6ec7ce:0xe9c35f,-.66,.23,.42);
        for(let k=0;k<10;k++){
          const a=k/10*Math.PI*2;const dot=new CylinderGeometry(.047,.047,.018,8);dot.rotateX(Math.PI/2);dot.rotateY(a);
          append(dot,0xf8f0d8,-.66+Math.sin(a)*.476,.23,.42+Math.cos(a)*.476);
        }
      }
    }
    shadows.push({x:p.x,y:terrain.height(p.x,p.z),z:p.z,s:1,kind:{shadow:(p.hero?2.6:2.3)*scale}});
  }
  const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  const mesh=new Mesh(geometry,material);mesh.name='stationery-courtyard';terrain.group.add(mesh);terrain.stationeryCourtyard=mesh;
  return shadows;
}
