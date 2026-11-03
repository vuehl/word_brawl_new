// Whole-glyph poses only: no independently moving or separated body regions.
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function movementFor(glyph){
  if('虫乙八之乡巾'.includes(glyph))return 'crawl';
  if('卵甲申目由用匚井公'.includes(glyph))return 'roll';
  if('马匹穴'.includes(glyph))return 'gallop';
  if('羽飞'.includes(glyph))return 'flutter';
  if('针灼炬燃灯烁'.includes(glyph))return 'sway';
  return 'hop';
}
export function samplePose(kind,state){
  const {phase=0,time=0,moving=0,dir=1,attack=0,hurt=0,rollAngle=0}=state;
  const m=clamp(moving),wave=Math.sin(phase),hop=Math.max(0,wave);
  let angle=0,lift=0,dx=0,sx=1,sy=1,bend=0;
  if(kind==='roll'){angle=rollAngle;lift=Math.abs(Math.sin(phase*2))*.07*m;}
  else if(kind==='crawl'){sx=1+wave*.2*m;sy=1-wave*.17*m;lift=Math.max(0,-wave)*.055*m;bend=wave*.09*m;}
  else if(kind==='gallop'){lift=hop*.22*m;angle=wave*.14*m;sy=1+hop*.05*m;}
  else if(kind==='flutter'){lift=.09+Math.sin(phase*.6)*.07;angle=wave*.09;sx=1-Math.abs(wave)*.06;}
  else if(kind==='sway'){angle=wave*.13*m;lift=hop*.09*m;}
  else{lift=hop*.2*m;sx=1+(hop>0?-.07:.07)*m;sy=1+(hop>0?.11:-.08)*m;angle=wave*.06*m;}
  if(m<.05&&kind!=='roll')sy+=Math.sin(time*2.8)*.012;
  if(attack>0){const a=clamp(attack),s=a<.24?-Math.sin(a/.24*Math.PI/2)*.1:Math.sin((a-.24)/.76*Math.PI)*.18;dx+=s*dir;angle-=s*dir*.55;}
  if(hurt>0){angle+=dir*hurt*.13;sx*=1+hurt*.08;sy*=1-hurt*.1;}
  return {dx,lift,angle,sx,sy,bend};
}
