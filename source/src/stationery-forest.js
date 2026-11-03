import {K as Mesh,v as BufferAttribute,w as Color,n as mergeGeometries,y as BufferGeometry,E as CylinderGeometry} from '../assets/three-DmSYIDKK.js';
import {roundedBox,ringGeometry,wire,clipGeometry,paperMaterial} from './stationery-sanctuary.js';

// Readable stationery silhouettes, grouped by space rather than scattered per tile.
export function buildStationeryForest(terrain){
  const plans=terrain.stationeryForestPlans;if(!plans?.length)return [];
  const material=paperMaterial(terrain),chunks=new Map(),shadows=[];
  terrain.stationeryPropMaterial=material;
  const inks=[0x5cbdb0,0xed8da6,0xf0ca55,0x5cadd5,0x9bbf70],paper=0xf5e9d0,metal=0xadb9b9;
  let triangles=0;
  for(const [index,p] of plans.entries()){
    const palette=p.palette??index%5,main=inks[palette%5],second=inks[(palette+2)%5],scale=p.s??1,yaw=p.angle??0;
    const id=`${Math.floor(p.x/40)},${Math.floor(p.z/40)}`;if(!chunks.has(id))chunks.set(id,[]);const geometries=chunks.get(id);
    const base=p.base??terrain.height(p.x,p.z);
    const put=(geometry,color,x=0,y=0,z=0,turn=0,grain=0)=>{
      let g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();g.deleteAttribute('uv');
      g.rotateZ(turn);g.translate(x,y,z);g.scale(scale,scale,scale);g.rotateY(yaw);g.translate(p.x,base-.025,p.z);
      const c=new Color(color),count=g.attributes.position.count,ink=new Float32Array(count*3);
      for(let i=0;i<count;i++)ink.set([c.r,c.g,c.b],i*3);
      g.setAttribute('color',new BufferAttribute(ink,3));g.setAttribute('aPaper',new BufferAttribute(new Float32Array(count).fill(grain),1));geometries.push(g);triangles+=count/3;
    };
    const box=(w,h,d,x,y,z,color,round=.06,grain=0)=>put(roundedBox(w,h,d,round),color,x,y,z,0,grain);
    const disk=(radius,x,y,z,color,depth=.018)=>{const g=new CylinderGeometry(radius,radius,depth,12);g.rotateX(Math.PI/2);put(g,color,x,y,z);};
    const eraser=(x=0,z=0)=>{
      box(1.02,.55,.77,x-.24,.275,z,main,.10);box(.46,.55,.77,x+.50,.275,z,paper,.10);
      box(.028,.54,.78,x+.265,.275,z,0xd8cfc3,.01);
    };
    const notes=(x=0,z=0)=>{
      box(1.12,.21,.85,x,.105,z,second,.04,1);box(1.12,.04,.85,x,.23,z,0xffdc70,.02);
      box(.87,.16,.70,x+.10,.34,z-.03,main,.035,1);box(.87,.025,.70,x+.10,.43,z-.03,0xf7e4af,.01);
    };
    const binder=(x=0,z=0)=>{
      const body=roundedBox(.85,.58,.52,.055),positions=body.attributes.position;
      for(let i=0;i<positions.count;i++)positions.setX(i,positions.getX(i)*(1.-(positions.getY(i)/.58+.5)*.22));body.computeVertexNormals();
      put(body,main,x,.29,z);box(.92,.10,.60,x,.05,z,main,.025);
      for(const front of [-1,1]){
        const path=[[-.19,.56],[-.30,.93],[-.30,1.08]];
        for(let j=0;j<=10;j++){const a=Math.PI-j/10*Math.PI;path.push([Math.cos(a)*.30,1.08+Math.sin(a)*.22]);}
        path.push([.30,.93],[.19,.56]);put(wire(path,.047),metal,x,0,z+front*.28);
      }
    };
    const tape=(x=0,z=0)=>{
      put(ringGeometry(.55,.33,.48),main,x,.24,z);
      put(ringGeometry(.332,.30,.49),paper,x,.245,z);
      for(let k=0;k<14;k++){
        const a=k/14*Math.PI*2,shape=new CylinderGeometry(.044,.044,.016,8);shape.rotateX(Math.PI/2);shape.rotateY(a);
        put(shape,paper,x+Math.sin(a)*.556,.24,z+Math.cos(a)*.556);
      }
    };
    const sharpener=()=>{
      box(.77,.88,.63,0,.44,0,0x569bc7,.09);box(.20,.76,.045,-.18,.46,.34,metal,.02);
      box(.023,.63,.015,-.18,.47,.37,0x596f7a,.005);disk(.055,-.18,.67,.39,0xf5ead7);
      disk(.13,.15,.56,.338,0x3c638b,.024);disk(.095,.15,.56,.354,0x294e71,.016);
      disk(.085,.15,.28,.338,0x3c638b,.024);
    };
    const cup=()=>{
      put(ringGeometry(.72,.63,1.32),p.pattern===0?paper:main,0,.66,0);put(new CylinderGeometry(.63,.63,.06,20),0xb8a781,0,.045,0);
      put(ringGeometry(.74,.62,.075),p.pattern===0?main:paper,0,1.29,0);
      if(p.pattern===1){for(let band=0;band<3;band++)put(ringGeometry(.725,.71,.10),paper,0,.25+band*.34,0);}
      if(p.pattern===0){
        for(let k=0;k<16;k++){
          const a=k/16*Math.PI*2;
          for(let j=0;j<5;j++){
            const diamond=wire([[-.09,0],[0,.13],[.09,0],[0,-.13],[-.09,0]],.014);diamond.rotateY(a);
            put(diamond,0x718b9d,Math.sin(a)*.731,.20+j*.21,Math.cos(a)*.731);
          }
        }
      }else if(p.pattern===2){
        disk(.20,0,.65,.729,paper);box(.105,.34,.025,-.09,.93,.732,paper,.045);box(.105,.34,.025,.09,.93,.732,paper,.045);
        disk(.018,-.065,.68,.75,0x765d60);disk(.018,.065,.68,.75,0x765d60);disk(.024,0,.61,.753,0xd89091);
      }else{
        for(let k=0;k<5;k++){const a=k/5*Math.PI*2;disk(.105,Math.sin(a)*.14,.69+Math.cos(a)*.14,.733,paper);}disk(.06,0,.69,.754,0xe4b652);
      }
      for(let k=0;k<7;k++){
        const a=k*2.4,x=Math.cos(a)*.38,z=Math.sin(a)*.38,h=2.20+(k%3)*.22,tilt=Math.cos(a)*.15;
        put(new CylinderGeometry(.115,.115,h,6),inks[k%5],x,h/2+.25,z,tilt);
        put(new CylinderGeometry(0,.115,.40,6),0xe4c396,x-tilt*h/2,h+.45,z,tilt);
        put(new CylinderGeometry(0,.038,.13,6),inks[k%5],x-tilt*h/2,h+.71,z,tilt);
      }
    };
    switch(p.type){
      case 'stickyStack':{
        const tiers=3+(index%4),unit=(p.heightVariation??1)/tiers;
        for(let j=0;j<tiers;j++){
          const c=inks[(palette+j)%5],x=j%2?.09:-.06,z=-j*.035;
          box(2.25-j*.04,unit,1.55-j*.025,x,(j+.5)*unit,z,c,.045,1);
          box(2.25-j*.04,.025,1.55-j*.025,x,(j+1)*unit+.015,z,j===tiers-1?0xffe591:c,.018);
        }
        const flap=roundedBox(.6,.025,.48,.015);flap.rotateX(-.13);put(flap,0xffe9ad,.48,(p.heightVariation??1)+.04,.68);break;
      }
      case 'mug':{
        put(ringGeometry(.70,.57,1.62),main,0,.84,0);put(new CylinderGeometry(.63,.63,.10,24),main,0,.07,0);
        put(ringGeometry(.72,.57,.10),paper,0,1.63,0);put(new CylinderGeometry(.57,.57,.035,24),0x735142,0,1.46,0);
        const points=[];for(let i=0;i<=20;i++){const a=Math.PI*.58-i/20*Math.PI*1.16;points.push([.68+Math.cos(a)*.48,.86+Math.sin(a)*.55]);}
        put(wire(points,.11),main);
        disk(.24,0,.86,.706,paper,.025);disk(.12,0,.86,.726,second,.018);
        if(index%2===0){const straw=new CylinderGeometry(.045,.045,1.0,8);put(straw,0xeac47d,-.24,1.58,.08,-.20);}break;
      }
      case 'tissue':{
        box(2.20,.95,1.45,0,.475,0,main,.16);box(2.22,.11,1.47,0,.98,0,paper,.09);
        box(.95,.025,.27,0,1.05,0,0xa1a5a2,.10);
        for(const x of [-.76,0,.76])disk(.12,x,.48,.73,second,.016);
        const vertices=[-.40,1.04,-.08,.40,1.04,-.08,-.49,1.64,.09,.40,1.04,-.08,.44,1.67,.10,-.49,1.64,.09,-.49,1.64,.09,.44,1.67,.10,-.24,1.82,.38,.44,1.67,.10,.57,1.78,.35,-.24,1.82,.38];
        const back=[];for(let i=0;i<vertices.length;i+=9)back.push(...vertices.slice(i,i+3),...vertices.slice(i+6,i+9),...vertices.slice(i+3,i+6));
        const tissue=new BufferGeometry();tissue.setAttribute('position',new BufferAttribute(new Float32Array([...vertices,...back]),3));tissue.computeVertexNormals();put(tissue,0xfff5df,0,0,0,0,1);break;
      }
      case 'lunchbox':{
        box(2.1,.68,1.5,0,.34,0,main,.20);box(2.16,.19,1.55,0,.76,0,paper,.16);
        box(1.70,.04,1.18,0,.87,0,second,.12);box(.32,.055,1.57,0,.905,0,main,.025);
        for(const z of [-.78,.78])box(.47,.25,.09,0,.60,z,second,.035);
        box(.38,.09,.43,.60,.93,-.20,paper,.055);break;
      }
      case 'earbuds':{
        box(1.65,.62,1.10,0,.31,0,0xf4f0e3,.23);box(1.40,.045,.86,0,.64,0,0xc9d1cc,.18);
        for(const x of [-.37,.37]){
          box(.35,.05,.60,x,.68,0,0x9faead,.13);
          put(new CylinderGeometry(.095,.095,.49,12),0xfff8e9,x,.86,.08,-.10);
          const head=roundedBox(.29,.30,.30,.10);put(head,0xfff8e9,x,1.10,.02);
          disk(.065,x,1.11,.182,0x4e5d61,.012);
        }
        const lid=roundedBox(1.65,.20,.98,.16);lid.rotateX(-1.08);put(lid,0xf6f1e4,0,1.02,-.60);
        disk(.026,0,.35,.565,0x84b78d,.012);break;
      }
      case 'cup':cup();break;
      case 'binder':binder();break;
      case 'eraser':eraser();break;
      case 'tape':tape();break;
      case 'notes':notes();break;
      case 'sharpener':sharpener();break;
      case 'clip':{const g=clipGeometry(1.55,.50);g.rotateX(-Math.PI/2);put(g,main,0,.09,.6);break;}
      case 'dispenser':{
        box(1.45,.27,.66,.12,.135,0,main);box(.46,.55,.66,.61,.43,0,main);
        const roll=ringGeometry(.43,.25,.42);roll.rotateX(Math.PI/2);put(roll,main,-.25,.63,0);
        box(.65,.065,.38,.25,.56,0,0xeee3ba,.015);box(.12,.10,.60,.79,.61,0,metal,.01);break;
      }
      case 'pencils':{
        for(let k=0;k<5;k++){
          const h=3.3+(k%3)*.45,x=(k-2)*.32;
          put(new CylinderGeometry(.14,.14,h,6),inks[k%5],x,h/2,0);
          put(new CylinderGeometry(0,.14,.5,6),0xe1c397,x,h+.25,0);put(new CylinderGeometry(0,.045,.15,6),inks[k%5],x,h+.48,0);
        }break;
      }
      case 'confetti':{
        if(index%3===0){
          const verts=[];for(let k=0;k<10;k++){const a=k/10*Math.PI*2,b=(k+1)/10*Math.PI*2,r=k%2?.15:.30,s=(k+1)%2?.15:.30;verts.push(0,.04,0,Math.sin(a)*r,.04,Math.cos(a)*r,Math.sin(b)*s,.04,Math.cos(b)*s);}
          const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(verts),3));g.computeVertexNormals();put(g,main);
        }else box(.45,.035,.29,0,.025,0,main,.015);
        break;
      }
    }
    if(p.type!=='confetti')shadows.push({x:p.x,z:p.z,y:base,s:scale,kind:{shadow:p.anchor?2.5:p.type==='cup'||p.type==='pencils'?2.0:1.45}});
  }
  const meshes=[];
  for(const [id,parts] of chunks){
    const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());g.computeBoundingSphere();
    const mesh=new Mesh(g,material);mesh.name=`stationery-forest-${id}`;terrain.group.add(mesh);meshes.push(mesh);
  }
  terrain.stationeryForestMeshes=meshes;terrain.stationeryForestTriangles=triangles;
  return shadows;
}
