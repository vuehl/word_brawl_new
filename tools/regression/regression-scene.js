(async()=>{
  const app=__glyphApp,r=app.run,e=r.enemies,g=r.glyphActors,checks=[];
  const check=(label,ok,details)=>{checks.push({label,ok:!!ok,details});if(!ok)throw Error(label+': '+JSON.stringify(details));};
  const frame=(dt=1/60)=>{r.time+=dt;r.renderWorld(dt);app.r.render(dt);};
  e.clear();
  const spawn=id=>{const i=e.spawn(id,0,-2,1,1,0);e.hp[i]=e.maxHp[i]=500;e.y[i]=r.terrain.surface(0,-2);e.vx[i]=2;e.fx[i]=1;return i;};
  const hit=(i,d)=>r.combat.hit(i,d,{type:'normal',cls:'physical',fixed:true,noReact:true,silent:true,knock:0});
  const zheng=spawn(52);frame();hit(zheng,140);frame();
  check('正 removes only 一 and remains the complete character 止',g.states.get(zheng).glyph==='止'&&g.debris.at(-1).glyph==='一'&&g.mesh.count===2,{state:g.states.get(zheng).glyph,drop:g.debris.at(-1).glyph,instances:g.mesh.count});
  for(let n=0;n<15;n++)frame();hit(zheng,180);frame();
  check('止 removes the left 丨 and becomes 上',g.states.get(zheng).glyph==='上'&&g.debris.at(-1).glyph==='丨');
  const eye=spawn(48);frame();hit(eye,140);check('目 → 日',g.states.get(eye).glyph==='日');
  for(let n=0;n<15;n++)frame();hit(eye,180);check('日 → 口',g.states.get(eye).glyph==='口');
  const needle=spawn(13);frame();hit(needle,140);check('针 → 十; only 钅 falls',g.states.get(needle).glyph==='十'&&g.debris.at(-1).glyph==='钅');
  const fire=spawn(33);frame();hit(fire,140);check('灼 → 勺; only 火 falls',g.states.get(fire).glyph==='勺'&&g.debris.at(-1).glyph==='火');
  const bug=spawn(10);frame();const pieces=g.debris.length;hit(bug,200);frame();
  check('Previously uncovered 虫 now becomes 中',g.states.get(bug).glyph==='中'&&g.debris.length===pieces+1&&g.states.get(bug).hitAt>=0);
  const paused=JSON.stringify({debris:g.debris,states:[...g.states]});r.renderWorld(0);app.r.render(0);
  check('Paused simulation freezes bodies and dropped components',paused===JSON.stringify({debris:g.debris,states:[...g.states]}));
  e.frozen[bug]=3;frame();const pose=JSON.stringify(g.states.get(bug).last.pose);for(let n=0;n<10;n++)frame();
  check('Frozen monster holds the whole pose',pose===JSON.stringify(g.states.get(bug).last.pose));
  e.kill(needle);const recycled=spawn(13);frame();
  check('Recycled slot restores the original whole glyph',recycled===needle&&g.states.get(recycled).glyph==='针'&&g.states.get(recycled).step===0);
  const hits=g.stats.hits;g.hit(recycled,0,true);check('Zero damage cannot remove a stroke',g.stats.hits===hits&&g.states.get(recycled).step===0);
  for(let n=0;n<160;n++)frame();check('Dropped components expire',g.debris.length===0,g.debris.length);
  const forms=[];
  for(let id=1;id<=9;id++){
    r.player.setSpecies(id);for(let n=0;n<100&&!r.sprites.get(id).ready;n++)await new Promise(resolve=>setTimeout(resolve,30));
    r.player.attackT=.19;r.player.speedNow=4;frame();
    forms.push({id,drawn:r.glyphHero.mesh.visible&&r.glyphHero.species===id,color:g.entry(id).color});
  }
  check('All 9 player forms use the high-resolution intact stroke rig',forms.every(f=>f.drawn>0)&&!g.states.has('player'),forms);
  check('Original color space and fragment shader are preserved',g.texture.colorSpace===r.sprites.get(1).material.uniforms.map.value.colorSpace&&g.material.fragmentShader===r.sprites.get(1).material.fragmentShader);
  e.clear();check('Zone cleanup removes damage state and dropped strokes',g.states.size===0&&g.debris.length===0);
  const mob=[];
  for(let n=0;n<400;n++){const i=e.spawn(52,(n%20-9.5)*.5,(Math.floor(n/20)-9.5)*.4-2,1,1,0);e.vx[i]=2;e.fx[i]=1;e.hp[i]=e.maxHp[i]=100;mob.push(i);}
  const start=performance.now();for(let n=0;n<10;n++)frame();
  check('400 whole monsters fit one render batch',g.mesh.count===400,{instances:g.mesh.count,cpuFrameMs:(performance.now()-start)/10});
  for(const i of mob){e.hp[i]=60;g.hit(i,40,false);}frame();
  check('Burst damage respects the debris limit',g.debris.length===240&&g.mesh.count===640,{debris:g.debris.length,instances:g.mesh.count});
  check('All transforms are finite',Object.values(g.attributes).every(a=>Array.from(a.array.subarray(0,g.mesh.count*a.itemSize)).every(Number.isFinite)));
  e.clear();r.capture.spawnEncounter(4);const capture=r.capture.index;
  check('Capture encounter spawned',capture>=0);e.hp[capture]=e.maxHp[capture]=100;hit(capture,1000);frame();
  check('Capturable monster stays visible after defeat',g.states.get(capture)?.glyph==='人'&&!g.states.get(capture)?.finished&&e.dying[capture]===0&&g.mesh.count>0,{state:r.capture.state,glyph:g.states.get(capture)?.glyph});
  const mesh=g.mesh;r.dispose();check('Disposal removes the renderer',mesh.parent===null&&g.states.size===0&&g.debris.length===0);
  return {checks,softwareGpu:app.r.softwareGpu};
})()
