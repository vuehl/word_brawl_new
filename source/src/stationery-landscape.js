import { H as InstancedMesh, ct as ShaderMaterial, G as Matrix4, nt as Quaternion, ht as Vector3, w as Color, B as InstancedBufferAttribute, K as Mesh, v as Float32BufferAttribute, n as mergeGeometries,D as DataTexture,it as RedFormat,U as LinearFilter,E as CylinderGeometry } from '../assets/three-DmSYIDKK.js';
import {roundedBox,ringGeometry,paperMaterial} from './stationery-sanctuary.js';
import {installDesktopSurfaces,desktopPaperGLSL} from './stationery-notebooks.js';

// This module dresses the existing terrain. It does not alter the camera or height field.
export const stationeryScene = terrain => terrain.biome.artTheme === 'stationery' && !terrain.arena?.tower;
function random(seed) {
  let state=seed>>>0;
  return () => {state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function pathAt(terrain,x,z) {
  const ix=Math.max(0,Math.min(terrain.res,Math.round((x+terrain.world/2)/terrain.cell)));
  const iz=Math.max(0,Math.min(terrain.res,Math.round((z+terrain.world/2)/terrain.cell)));
  return terrain.pathMask[terrain.idx(ix,iz)];
}
function available(terrain,x,z,margin=1,allowReserved=false,spawnClearance=10) {
  if(Math.abs(x)>terrain.play-4||Math.abs(z)>terrain.play-4||!terrain.isFlatOpen(x,z))return false;
  if(Math.hypot(x-terrain.spawn.x,z-terrain.spawn.z)<spawnClearance+margin)return false;
  if(!allowReserved&&terrain.isReserved(x,z,margin))return false;
  if(terrain.inSolid(x,z))return false;
  for(const [dx,dz] of [[0,0],[margin,0],[-margin,0],[0,margin],[0,-margin]])if(pathAt(terrain,x+dx,z+dz)>.22)return false;
  return true;
}

export function placeStationery(terrain,kinds) {
  if(!terrain.arena)return placeForest(terrain);
  const rng=random(terrain.seed^0x53544154),items=[],patches=[],books=[];
  const pick=list=>list[Math.floor(rng()*list.length)];
  const all=[...kinds.trees,...kinds.big,...kinds.small,...(kinds.landmarks||[])];
  const find=name=>all.find(k=>k.name===name);
  const add=(kind,x,z,scale,palette,hero=false,allowReserved=false,collide=true)=>{
    if(!kind||!available(terrain,x,z,hero?1.4:.55,allowReserved,hero?10:2.1))return false;
    const width=kind.name.startsWith('tree')?2.5*scale:1.25*scale;
    if(items.some(p=>Math.hypot(p.x-x,p.z-z)<(p.clearance+width)*.5))return false;
    const h=terrain.height(x,z),shadow=kind.shadow||1.35;
    items.push({kind:{...kind,sway:0,shadow},x,y:h-.035,z,s:scale,flip:rng()>.5,palette,hero,clearance:width});
    if(collide&&kind.collider>0)terrain.addCollider({x,z,r:kind.collider*scale,h:h+6});
    return true;
  };
  const addBook=(patch,scale=1)=>{
    const x=patch.x,z=patch.z,w=6.6*scale,d=3.8*scale,yaw=patch.angle;
    const heights=[];
    for(const dx of [-w/2,0,w/2])for(const dz of [-d/2,0,d/2]){
      const px=x+dx*Math.cos(yaw)+dz*Math.sin(yaw),pz=z-dx*Math.sin(yaw)+dz*Math.cos(yaw);
      if(!available(terrain,px,pz,1.5))return false;
      heights.push(terrain.height(px,pz));
    }
    if(Math.max(...heights)-Math.min(...heights)>.85)return false;
    const base=Math.min(...heights)-.07,top=Math.max(...heights);
    const stackHeight=terrain.arena&&patch.featured?4.2+rng()*3.8:1.2+rng()*3.0;
    books.push({...patch,w,d,scale,y:base,plinth:top-base+.12,stackHeight,tiers:2+Math.floor(rng()*4),turn:(rng()-.5)*.10});
    const radius=d*.53;
    for(const offset of [-w*.3,0,w*.3])terrain.addCollider({x:x+Math.cos(yaw)*offset,z:z-Math.sin(yaw)*offset,r:radius,h:top+.12+(stackHeight||3.22*scale)});
    terrain.reserve(x,z,Math.hypot(w,d)*.5+.7);
    return true;
  };
  const arena=terrain.arena;
  const featured=[];
  if(arena){
    for(const side of [-1,1])for(let attempt=0;attempt<8;attempt++){
      const p={x:terrain.spawn.x+side*(13+attempt%3*3),z:terrain.spawn.z-8-Math.floor(attempt/3)*4,angle:side*.16,palette:side<0?1:0,featured:true};
      if(addBook(p,1.25)){featured.push(p);break;}
    }
  }else{
    // Four nearby landscape anchors frame the starting clearing from any camera angle.
    for(let side=0;side<4;side++){
      for(let attempt=0;attempt<10;attempt++){
        const angle=.63+side*Math.PI*.5+(attempt%3-1)*.19,radius=21+Math.floor(attempt/3)*3;
        const p={x:terrain.spawn.x+Math.cos(angle)*radius,z:terrain.spawn.z+Math.sin(angle)*radius,angle:-angle+Math.PI*.5,palette:side%3,featured:true};
        if(addBook(p,1.35)){featured.push(p);break;}
      }
    }
  }
  if(arena){
    // Keep the dais, entry, gates and reserved encounter spaces open.
    for(let i=0;i<22;i++){
      const angle=i/22*Math.PI*2+.16,radius=arena.radius-7.5+(i%2)*1.8;
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      if(available(terrain,x,z,2))patches.push({x,z,angle:angle+Math.PI/2,palette:i%3});
    }
    for(let i=0;i<12;i++){
      const angle=(i+.5)/12*Math.PI*2,radius=arena.radius*.58;
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      if(available(terrain,x,z,2.5))patches.push({x,z,angle:angle+Math.PI/2,palette:i%3,lowOnly:true});
    }
  }else{
    const spacing=25,target=Math.round(42*terrain.areaMul);
    const candidates=[];
    for(let x=-terrain.play+15;x<terrain.play-12;x+=spacing)for(let z=-terrain.play+15;z<terrain.play-12;z+=spacing){
      const px=x+(rng()-.5)*10,pz=z+(rng()-.5)*10;
      if(available(terrain,px,pz,5)&&terrain.normal(px,pz).y>.96)candidates.push({x:px,z:pz,angle:rng()*Math.PI*2,palette:Math.floor(rng()*3)});
    }
    candidates.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
    for(const candidate of candidates){
      if(patches.length>=target)break;
      if(patches.every(p=>Math.hypot(p.x-candidate.x,p.z-candidate.z)>19))patches.push(candidate);
    }
    // Preserve the original landmark identities, with a few readable companions.
    for(const [index,l] of (terrain.landmarks||[]).entries()){
      const name={grove:'oak',arch:'arch',hollow:'hollowlog',fairy:'glowshrooms',boulders:'boulder',meadow:'tree3',pond:'tree4'}[l.kind];
      add(find(name),l.x,l.z,.88,index%3,true,true);
      for(let j=0;j<4;j++){const a=j*Math.PI*.5;add(find('rocks')||kinds.small[0],l.x+Math.cos(a)*4,l.z+Math.sin(a)*4,.85,index%3,false,true,false);}
    }
  }
  patches.unshift(...featured);
  let bookCount=books.length;
  for(const [index,p] of patches.entries()){
    const addedBook=!p.featured&&index%3===0&&bookCount<(arena?6:Math.round(12*terrain.areaMul))&&addBook(p,arena ? .95 : 1);
    const hasBook=p.featured||addedBook;
    if(addedBook)bookCount++;
    // Each patch uses one tall silhouette and only two low prop designs.
    const tree=arena?kinds.trees[index%kinds.trees.length]:find(['tree0','tree4','tree1'][p.palette]);
    const front={x:Math.sin(p.angle),z:Math.cos(p.angle)};
    if(!arena||(!p.lowOnly&&!p.featured))add(tree,p.x-front.x*(p.featured?9:hasBook?6.4:1),p.z-front.z*(p.featured?9:hasBook?6.4:1),arena ? .40 : .94,p.palette,true);
    if(index%4===1&&!arena)add(find('tree2'),p.x+3.6,p.z-1.4,.85,p.palette);
    const low=arena?[kinds.big[index%5],kinds.small[(index+2)%7]]:[find(['stump','log','bush'][p.palette]),find(['rocks','mushrooms','tallgrass'][p.palette])];
    for(let j=0;j<(arena?5:9);j++){
      const angle=p.angle+(rng()-.5)*Math.PI*1.3,radius=(p.featured?7.3:hasBook?5.3:2.3)+rng()*3.4;
      add(low[j%2],p.x+Math.sin(angle)*radius,p.z+Math.cos(angle)*radius,.80+rng()*.2,p.palette,false,false,false);
    }
  }
  if(arena){
    // Foreground courtyard dressing: small readable groups beside the entrance and central lane.
    const placements=[[-4,3,2],[4,4,6],[-1,4,2],[-10,3,3],[10,3,0],[-14,0,1],[14,-1,2],[-9,1,0],[10,0,2],[-6,-4,1],[7,-5,3],[-12,-7,6],[13,-8,0],[-5,-11,2],[5,-12,1],[-11,-16,3],[11,-17,6],[-3,-20,0],[4,-21,2]];
    placements.forEach(([x,z,kind],i)=>add(kinds.small[kind],x,terrain.spawn.z+z,1.35+(i%3)*.10,i%3,false,false,false));
    const rg=random(terrain.seed^0x50415045);
    for(let z=-30;z<=34;z+=9)for(const side of [-1,1]){
      const x=side*(5.4+rg()*5),pz=z+(rg()-.5)*3;
      add(kinds.small[[0,1,2,6][Math.floor(rg()*4)]],x,pz,1.05+rg()*.2,side<0?1:0,false,false,false);
    }
    // These positions are also used by the encounter's permanent cover shapes.
    // They must retain visible props even though the layout reserves their footprints.
    for(const p of arena.bigTrees||[]){
      items.push({kind:{...kinds.trees[0],shadow:4},x:p.x,z:p.z,y:terrain.height(p.x,p.z),s:1,hero:true,nativeScale:2.8});
      terrain.addCollider({x:p.x,z:p.z,r:1.9,h:terrain.height(p.x,p.z)+10});
    }
    for(const p of arena.lanterns||[]){
      items.push({kind:{...kinds.big[0],shadow:2},x:p.x,z:p.z,y:terrain.height(p.x,p.z),s:1,hero:false,nativeScale:1.25});
      terrain.addCollider({x:p.x,z:p.z,r:.6,h:terrain.height(p.x,p.z)+2.8});
    }
    for(const book of books){book.paperStack=rng()<.55;book.spiral=!book.paperStack;}
    // Layered paper walls sit outside the playable ring, with a wide entrance gap.
    for(let i=0;i<20;i++){
      const angle=i/20*Math.PI*2,radius=52,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      if(z>35&&Math.abs(x)<36)continue;
      books.push({x,z,angle:-angle+Math.PI/2,palette:i%3,w:15.6+rng()*2.2,d:8,scale:1,y:-.10,plinth:.20,wall:true,paperStack:true,wallHeight:8.4+rng()*5.6});
    }
  }
  terrain.stationeryBookPlans=books;
  terrain.stationeryLayout={patches:patches.length,books:books.length,sprites:items.length,small:items.filter(i=>!i.hero).length,palettes:3};
  if(arena){terrain.stationeryCourtyardPlans=items;terrain.stationeryLayout.nativeGroups=items.length;return [];}
  return items;
}

function placeForest(terrain){
  const rng=random(terrain.seed^0x464f5245),books=[],props=[],clearings=[],anchors=[];
  const deck=['book','mug','tissue','stickyStack','book','lunchbox','earbuds','book'];
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  const originalReservations=terrain.clearZones.slice();
  const variant=2-(terrain.seed>>>0)%3;
  const addProp=(type,x,z,s=1,palette=0,angle=0,featured=false,besideBank=false)=>{
    const tall=type==='cup'||type==='pencils',margin=tall?.9:.4;
    if(!available(terrain,x,z,margin,besideBank,tall?9:3.2))return false;
    if(type!=='confetti'){const h=terrain.height(x,z),foot=(tall?.8:.65)*s;for(const [dx,dz] of [[foot,0],[-foot,0],[0,foot],[0,-foot]])if(Math.abs(terrain.height(x+dx,z+dz)-h)>.08)return false;}
    if(besideBank&&originalReservations.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+margin))return false;
    if(props.some(p=>p.type!=='confetti'&&type!=='confetti'&&Math.hypot(p.x-x,p.z-z)<(tall?2.3:1.1)))return false;
    props.push({type,x,z,s,palette,angle,pattern:variant===1&&props.length%2?3:variant,featured});
    if(tall)terrain.addCollider({x,z,r:.73*s,h:terrain.height(x,z)+3.6*s});
    return true;
  };
  const addBank=(center,theta,radius,index,framePass=false)=>{
    const x=center.x+Math.cos(theta)*radius,z=center.z+Math.sin(theta)*radius,angle=-theta-Math.PI/2;
    const featured=center.featured,type=deck[index%deck.length],scale=type==='book'?1:2.2+rng()*1.3;
    const dimensions={mug:[1.95,1.60,2.05],tissue:[2.2,1.45,1.85],stickyStack:[2.3,1.6,1.0],lunchbox:[2.1,1.5,.95],earbuds:[1.65,1.2,1.45]};
    const w=type==='book'?(featured?9:7)+rng()*3.2:dimensions[type][0]*scale,d=type==='book'?3.7+rng()*1.8:dimensions[type][1]*scale,heights=[];
    for(const dx of [-w/2,0,w/2])for(const dz of [-d/2,0,d/2]){
      const px=x+dx*Math.cos(angle)+dz*Math.sin(angle),pz=z-dx*Math.sin(angle)+dz*Math.cos(angle);
      if(!available(terrain,px,pz,1.1)){
        // Additional banks may cross a decorative path mask, but not encounter
        // reservations or the four broad exits from the starting clearing.
        if(!framePass||!terrain.isFlatOpen(px,pz)||terrain.isReserved(px,pz,1.1)||terrain.inSolid(px,pz)||Math.abs(px-terrain.spawn.x)<3.7||Math.abs(pz-terrain.spawn.z)<3.7)return false;
      }
      heights.push(terrain.height(px,pz));
    }
    if(Math.max(...heights)-Math.min(...heights)>.08)return false;
    const paperStack=rng()<.40,tiers=1+Math.floor(rng()*5),heightVariation=.7+rng()*.6,stackHeight=type==='book'?.65+tiers*(.48+rng()*.62):dimensions[type][2]*scale*(type==='stickyStack'?heightVariation:1);
    const y=Math.min(...heights)-.07,plinth=Math.max(...heights)-y+.12;
    const anchor={type,x,z,angle,w,d,scale,y,plinth,stackHeight,palette:index%3,featured};anchors.push(anchor);
    if(type==='book')books.push({...anchor,scale:1,paperStack,spiral:!paperStack&&rng()<.6,tiers,offset:(rng()-.5)*.45,turn:(rng()-.5)*.13});
    else props.push({type,x,z,s:scale,palette:index%5,angle,featured,anchor:true,base:y+.07,heightVariation});
    const offsets=type==='mug'?[0]:[-w*.28,0,w*.28];
    for(const offset of offsets)terrain.addCollider({x:x+Math.cos(angle)*offset,z:z-Math.sin(angle)*offset,r:d*.46,h:y+plinth+stackHeight});
    terrain.reserve(x,z,Math.hypot(w,d)*.5+.5);
    // A pen cup at one end and a small group facing the clearing form one composition.
    const inward={x:-Math.cos(theta),z:-Math.sin(theta)},along={x:Math.sin(theta),z:-Math.cos(theta)};
    for(const side of [-1,1]){
      const px=x+along.x*side*(w/2+2.1)+inward.x*.8,pz=z+along.z*side*(w/2+2.1)+inward.z*.8;
      if(type==='book'&&side<0&&index%2===0)addProp('cup',px,pz,1.1+rng()*.5,(index+5)%5,angle,featured);
    }
    for(let j=0;j<2;j++){
      const px=x+inward.x*(d/2+2.5)+along.x*(j-1)*2.6,pz=z+inward.z*(d/2+2.5)+along.z*(j-1)*2.6;
      addProp(['binder','notes','tape'][(index+j)%3],px,pz,1.15,index+j,angle+(rng()-.5)*.5,featured,true);
    }
    return true;
  };
  const addClearing=center=>{
    let count=0;
    const slots=center.featured?8:4;
    for(let i=0;i<slots;i++){
      for(let attempt=0;attempt<7;attempt++){
        const theta=.57+i*Math.PI*2/slots+(attempt%3-1)*.13,radius=(center.featured?19:18)+Math.floor(attempt/3)*2.2;
        if(addBank(center,theta,radius,i+clearings.length)){count++;break;}
      }
    }
    if(center.featured)for(const sx of [-1,1])for(const sz of [-1,1]){
      const theta=Math.atan2(sz*24,sx*13);
      for(let attempt=0;attempt<3;attempt++)if(addBank(center,theta,Math.hypot(13,24)+attempt*2.5,count,true)){count++;break;}
    }
    // Rotated notebook edges can reject some props; recover variety on nearby flat space.
    if(center.featured){
      const nearbyTypes=new Set(anchors.filter(p=>p.featured).map(p=>p.type));
      for(const type of deck){
        if(nearbyTypes.size>=4)break;
        if(nearbyTypes.has(type))continue;
        for(let attempt=0;attempt<32;attempt++){
          const theta=rng()*Math.PI*2,radius=25+rng()*11;
          if(addBank(center,theta,radius,deck.indexOf(type),true)){count++;nearbyTypes.add(type);break;}
        }
      }
    }
    if(!count)return;
    clearings.push({...center,banks:count});
    for(let i=0;i<(center.featured?10:6);i++){
      const a=i/10*Math.PI*2+.3,r=8.5+rng()*4;
      addProp(['eraser','binder','tape','notes','sharpener','dispenser','clip','earbuds','lunchbox'][i%9],center.x+Math.cos(a)*r,center.z+Math.sin(a)*r,1.0+rng()*.20,i%5,a*.15,center.featured);
    }
    for(let i=0;i<(center.featured?28:12);i++){
      const a=rng()*Math.PI*2,r=4.5+rng()*10;
      addProp('confetti',center.x+Math.cos(a)*r,center.z+Math.sin(a)*r,.85+rng()*.35,i%5,rng()*Math.PI,center.featured);
    }
  };
  addClearing({x:terrain.spawn.x,z:terrain.spawn.z,featured:true});
  const candidates=[];
  for(let x=-terrain.play+29;x<terrain.play-22;x+=59)for(let z=-terrain.play+29;z<terrain.play-22;z+=59){
    const px=x+(rng()-.5)*8,pz=z+(rng()-.5)*8;
    if(Math.hypot(px-terrain.spawn.x,pz-terrain.spawn.z)<49)continue;
    if(terrain.isFlatOpen(px,pz)&&!terrain.inSolid(px,pz))candidates.push({x:px,z:pz,featured:false});
  }
  candidates.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  for(const p of candidates)addClearing(p);
  // Landmarks keep a visible marker without filling their reserved encounter area.
  for(const [index,l] of (terrain.landmarks||[]).entries()){
    const x=l.x+l.r*.75,z=l.z;
    addProp(index%2?'cup':'pencils',x,z,2.0,index%5,0);
  }
  terrain.stationeryForestPlans=props;terrain.stationeryBookPlans=books;terrain.stationeryClearings=clearings;terrain.desktopAnchors=anchors;
  terrain.stationeryLayout={clearings:clearings.length,books:books.length,anchors:anchors.length,anchorTypes:anchors.reduce((a,p)=>(a[p.type]=(a[p.type]||0)+1,a),{}),nativeGroups:props.length,small:props.filter(p=>!p.anchor&&p.type!=='cup'&&p.type!=='pencils').length,variant};
  return [];
}

export function buildStationeryBooks(terrain) {
  installDesktopSurfaces(terrain);
  const boxes=[],plans=terrain.stationeryBookPlans||[],shadowItems=[],detailParts=[];
  const coverColors=[[0x64b8ac,0xf0c95e],[0xea8e9d,0x69b7ba],[0x65a9d0,0xf2cb63]];
  for(const [index,p] of plans.entries()){
    const palette=coverColors[p.palette],angle=p.angle,scale=p.scale;
    const box=(x,y,z,w,h,d,color,paper=0,turn=0)=>{
      boxes.push({x:p.x+x*Math.cos(angle)+z*Math.sin(angle),y:p.y+y,z:p.z-x*Math.sin(angle)+z*Math.cos(angle),w,h,d,color,paper,angle:angle+turn});
    };
    // A broad, low paper step embeds into the sampled ground, hiding no gap.
    box(0,p.plinth/2,0,p.w+.7,p.plinth,p.d+.7,0xd9cfb3,1);
    let bottom=p.plinth;
    const tiers=p.tiers??(p.spiral?3:p.wall||p.stackHeight?5:3);
    for(let tier=0;tier<tiers;tier++){
      const w=p.w*(1-tier*(p.wall||p.stackHeight?.025:.10)),d=p.d*(1-tier*(p.wall||p.stackHeight?.018:.07)),h=p.wall?p.wallHeight/5:p.stackHeight?(p.stackHeight-.22*scale*tiers)/tiers:(.75+tier*.07)*scale,turn=(tier-1)*(p.wall?.012:(p.turn??.035));
      const x=(tier%2?.20:-.12)*scale+(p.offset??0)*tier,z=-tier*.10*scale,cover=.11*scale;
      const coverColor=p.paperStack?0xe2d5b7:palette[tier%2];
      box(x,bottom+cover/2,z,w+.16,cover,d+.16,coverColor,0,turn);
      box(x,bottom+cover+h/2,z,w,h,d,p.paperStack?0xf1e8d2:0xe5dcc6,1,turn);
      box(x-w/2+.13,bottom+cover+h/2,z,.26,h,d+.12,coverColor,0,turn);
      box(x,bottom+cover+h+cover/2,z,w+.16,cover,d+.16,p.paperStack?0xf2d995:coverColor,p.paperStack?2:0,turn);
      // One restrained bookmark per book, with no tiny surface patterns.
      box(x+w*.23,bottom+cover+h+.02,z+d/2+.16,.55*scale,.05,.62*scale,palette[(tier+1)%2]);
      if(p.paperStack)box(x+w*(tier%2?.23:-.26),bottom+cover+h*.60,z+d/2+.03,p.wall?1.2:1.05,p.wall?.60:.60,.055,palette[tier%2]);
      if(p.spiral){
        const part=(geometry,color,px,py,pz)=>{
          let g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();g.deleteAttribute('uv');
          g.translate(px,py,pz);g.rotateY(turn);g.rotateY(angle);g.translate(p.x,p.y,p.z);
          const c=new Color(color),n=g.attributes.position.count,ink=new Float32Array(n*3);
          for(let i=0;i<n;i++)ink.set([c.r,c.g,c.b],i*3);
          g.setAttribute('color',new Float32BufferAttribute(ink,3));g.setAttribute('aPaper',new Float32BufferAttribute(new Float32Array(n),1));detailParts.push(g);
        };
        for(let j=0;j<Math.floor(w/.78);j++){
          const g=ringGeometry(h*.50+.18,h*.50+.09,.12);g.rotateZ(Math.PI/2);
          part(g,tier%2?0x67899d:0xa7aaa2,x-w/2+.46+j*.78,bottom+cover+h*.5,z+d/2+.06);
        }
        part(roundedBox(w*.34,.035,d*.38,.03),0xf5e9cb,x,bottom+cover+h+cover+.02,z);
        for(let k=0;k<5;k++){
          const a=k/5*Math.PI*2,g=new CylinderGeometry(.16,.16,.015,10);
          part(g,0x83baa0,x+Math.sin(a)*.20,bottom+cover+h+cover+.048,z+Math.cos(a)*.20);
        }
      }
      bottom+=h+cover*2;
    }
    // A two-tier paper ledge adds a broad step silhouette on one side.
    box(p.w*.28,.16*scale+p.plinth,p.d*.58,2.8*scale,.32*scale,1.5*scale,0xe1d8bf,1);
    box(p.w*.28,.39*scale+p.plinth,p.d*.46,2.3*scale,.18*scale,1.1*scale,0xeee6d0,1);
    shadowItems.push({x:p.x,y:p.y,z:p.z,s:1,kind:{shadow:Math.hypot(p.w,p.d)+1}});
  }
  if(!boxes.length)return shadowItems;
  const geometry=roundedBox(1,1,1,.035);
  geometry.setAttribute('iPaper',new InstancedBufferAttribute(new Float32Array(boxes.map(b=>b.paper)),1));
  const material=new ShaderMaterial({uniforms:{uFogColor:terrain.shared.uFogColor,uFogNear:terrain.shared.uFogNear,uFogFar:terrain.shared.uFogFar,uPlayer:{value:new Vector3(0,-999,0)}},vertexShader:`
    attribute float iPaper; varying vec3 vColor; varying vec3 vNormal; varying vec3 vWorld; varying float vD; varying float vPaper; varying float vFade;
    uniform vec3 uPlayer;
    void main(){vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);vec4 mv=viewMatrix*w;gl_Position=projectionMatrix*mv;
      vec3 sc=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
      vColor=instanceColor;vNormal=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*(normal/(sc*sc)));vWorld=w.xyz;vD=-mv.z;vPaper=iPaper;
      vec3 ab=uPlayer+vec3(0.,1.,0.)-cameraPosition;float t=clamp(dot(w.xyz-cameraPosition,ab)/dot(ab,ab),0.,1.);
      vFade=(1.-smoothstep(.8,2.6,length(cameraPosition+ab*t-w.xyz)))*step(t,.94)*step(.03,t);
    }`,fragmentShader:`
    uniform vec3 uFogColor,uPlayer;uniform float uFogNear,uFogFar;varying vec3 vColor;varying vec3 vNormal;varying vec3 vWorld;varying float vD,vPaper,vFade;
    void main(){
      vec3 ab=uPlayer+vec3(0.,1.,0.)-cameraPosition;float t=clamp(dot(vWorld-cameraPosition,ab)/max(dot(ab,ab),.001),0.,1.);
      float fade=(1.-smoothstep(.7,1.8,length(cameraPosition+ab*t-vWorld)))*step(t,.96)*step(.03,t);
      if(fade>.02&&mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y)*3.,4.)/4.<fade*.80)discard;
      vec3 n=normalize(vNormal);float light=.70+.30*max(0.,dot(n,normalize(vec3(-.5,1.,.35))));
      float edge=abs(fract(vWorld.y*8.)-.5);float lines=1.-smoothstep(.025,.025+max(fwidth(vWorld.y*8.),.035),edge);
      float paper=step(.5,vPaper)*(1.-step(1.5,vPaper));
      vec3 color=vColor*light*(1.-paper*(1.-abs(n.y))*.20*lines);
      float fibre=sin(vWorld.x*73.+sin(vWorld.z*47.))*sin(vWorld.z*61.+vWorld.y*53.);
      color*=1.+fibre*.012;
      if(vPaper>1.5){vec2 q=abs(fract(vWorld.xz/.65+.5)-.5)*.65;float grid=1.-smoothstep(.009,.009+max(fwidth(vWorld.x)+fwidth(vWorld.z),.01),min(q.x,q.y));color*=1.-grid*.18;}
      gl_FragColor=vec4(mix(color,uFogColor,smoothstep(uFogNear,uFogFar,vD)),1.);
      #include <colorspace_fragment>
    }`});
  const mesh=new InstancedMesh(geometry,material,boxes.length),matrix=new Matrix4(),q=new Quaternion(),v=new Vector3(),s=new Vector3(),up=new Vector3(0,1,0);
  boxes.forEach((b,i)=>{matrix.compose(v.set(b.x,b.y,b.z),q.setFromAxisAngle(up,b.angle),s.set(b.w,b.h,b.d));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new Color(b.color));});
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;mesh.name='stationery-books';
  terrain.group.add(mesh);terrain.mats.push(material);terrain.stationeryBooks=mesh;
  if(detailParts.length){
    const g=mergeGeometries(detailParts);detailParts.forEach(p=>p.dispose());
    const detailMaterial=paperMaterial(terrain),detail=new Mesh(g,detailMaterial);detail.name='stationery-book-bindings';
    terrain.group.add(detail);terrain.stationeryBookDetailMaterial=detailMaterial;
  }
  const oldPaper=terrain.terrainMat.uniforms.tPaperZones?.value;
  if(oldPaper){terrain.terrainMat.uniforms.tPaperZones.value=createPaperZoneTexture(terrain);oldPaper.dispose();}
  return shadowItems;
}

function createPaperZoneTexture(terrain){
  const size=Math.round(terrain.world*2),pixels=new Uint8Array(size*size);
  if(!terrain.arena)for(const p of terrain.stationeryBookPlans||[]){
    if(!p.paperStack)continue;
    const radius=Math.hypot(p.w/2+2.4,p.d/2+2.4),cos=Math.cos(p.angle),sin=Math.sin(p.angle);
    for(let z=Math.max(0,Math.floor((p.z-radius+terrain.world/2)*2));z<Math.min(size,Math.ceil((p.z+radius+terrain.world/2)*2));z++)
      for(let x=Math.max(0,Math.floor((p.x-radius+terrain.world/2)*2));x<Math.min(size,Math.ceil((p.x+radius+terrain.world/2)*2));x++){
        const dx=x/2-terrain.world/2-p.x,dz=z/2-terrain.world/2-p.z;
        if(Math.abs(dx*cos-dz*sin)<p.w/2+2.4&&Math.abs(dx*sin+dz*cos)<p.d/2+2.4)pixels[z*size+x]=255;
      }
  }
  const texture=new DataTexture(pixels,size,size,RedFormat);texture.minFilter=texture.magFilter=LinearFilter;texture.needsUpdate=true;
  terrain.textures.push(texture);return texture;
}

export function styleStationeryArchitecture(root,name){
  if(!name.startsWith('sanct_'))return;
  root.traverse(mesh=>{
    const material=mesh.material;
    if(!mesh.isMesh||!material?.isMeshToonMaterial||material.userData.stationeryPaper)return;
    material.userData.stationeryPaper=true;
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float paperLuma=dot(diffuseColor.rgb,vec3(.3,.59,.11));
        diffuseColor.rgb=mix(vec3(.40,.35,.25),vec3(.86,.81,.68),smoothstep(.035,.68,paperLuma));`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight=diffuseColor.rgb*clamp(dot(outgoingLight,vec3(.3,.59,.11))/max(dot(diffuseColor.rgb,vec3(.3,.59,.11)),.01),.72,1.10);
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=> 'stationery-paper-architecture-v1';
    material.needsUpdate=true;
  });
}

export const stationeryPaperGLSL=`
  ${desktopPaperGLSL}
  uniform sampler2D tPaperZones;
  vec3 stationeryPaper(vec3 world,float distanceToCamera){
#ifndef STATIONERY_ARENA
    return desktopPaper(world,distanceToCamera);
#else
    vec3 paper=vec3(.83,.815,.76);
    float fibre=(sin(world.x*73.+world.z*3.1)*sin(world.z*61.3))*.009;
    float lineDistance=abs(fract(world.z/1.5+.5)-.5)*1.5;
    float line=1.-smoothstep(.024,.024+max(fwidth(world.z),.018),lineDistance);
    float visibility=1.-smoothstep(32.,95.,distanceToCamera);
    paper=mix(paper,vec3(.42,.61,.73),line*.58*visibility);
    float marginDistance=abs(fract((world.x+8.)/32.+.5)-.5)*32.;
    float path=texture2D(tPaperZones,world.xz/uWorld+.5).r;
#ifdef STATIONERY_ARENA
    marginDistance=abs(abs(world.x)-5.5);
    float sideLane=smoothstep(5.7,5.8,abs(world.x))*(1.-smoothstep(8.7,8.8,abs(world.x)));
    float crossLane=smoothstep(23.,23.1,world.z)*(1.-smoothstep(25.8,25.9,world.z));
    path=max(sideLane,crossLane);
#endif
    vec3 yellow=vec3(.96,.80,.39);
    vec2 cellDistance=abs(fract(world.xz/1.15+.5)-.5)*1.15;
    float grid=1.-smoothstep(.012,.012+max(fwidth(world.x)+fwidth(world.z),.015),min(cellDistance.x,cellDistance.y));
    yellow=mix(yellow,vec3(.77,.56,.20),grid*.24*visibility);
    paper=mix(paper,yellow,path*.78);
    float margin=1.-smoothstep(.035,.035+max(fwidth(world.x),.02),marginDistance);
    return mix(paper+fibre,vec3(.79,.40,.39),margin*.46*visibility);
#endif
  }`;
