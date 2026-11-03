(async()=>{
  const app=__glyphApp,r=app.run,p=r.player,e=r.enemies,h=r.glyphHero;
  app.halted=true;r.state='play';r.ui.hideModal();e.clear();
  p.pos.set(0,r.terrain.surface(0,0),0);p.speedNow=0;p.attackT=0;
  app.r.camera.position.set(0,7,11);app.r.camera.lookAt(0,1,-1);app.r.camera.updateMatrixWorld();app.r.camera.fov=30;app.r.camera.updateProjectionMatrix();
  const target=e.spawn(52,0,-5,1,1,0);e.y[target]=r.terrain.surface(0,-5);e.hp[target]=e.maxHp[target]=10000;e.scale[target]=1.1;
  for(let n=0;n<100&&!h.ready;n++)await new Promise(res=>setTimeout(res,30));
  if(!h.ready)throw Error('Hero high-resolution atlas not ready');
  const frame=(dt=1/30)=>{
    r.time+=dt;p.animT+=dt*(.6+p.speedNow/7);p.attackT=Math.max(0,p.attackT-dt);
    e.flash[target]=Math.max(0,e.flash[target]-dt*6);
    e.grid.build(e.n,e.x,e.z,e.alive,e.radius,e.dying);
    r.projectiles.update(dt);r.vfx.update(dt);r.renderWorld(dt);app.r.render(dt);
  };
  const select=async id=>{
    r.projectiles.clear();r.vfx.clear();p.setSpecies(id);p.attackT=0;p.hurtT=0;p.dead=false;
    for(let n=0;n<100&&!r.sprites.get(id).ready;n++)await new Promise(res=>setTimeout(res,30));
    h.select(id);h.release=[-100,-100];h.gestureAt=-100;frame(0);
  };
  // These use the game's real projectile pool, travel and collision/damage.
  const shot=()=>{
    const family=Math.floor((p.speciesId-1)/3),type=['grass','fire','water'][family];
    p.attackAnim();
    return r.projectiles.fire({x:p.pos.x,y:p.pos.y+.9,z:p.pos.z,dx:0,dy:0,dz:-1,
      speed:9,life:2,radius:.4,dmg:10,type,cls:'special',slot:0,pierce:0,
      color:[0x80B86D,0xEB6B52,0x62BBD0][family],shape:[4,5,6][family],size:.55,target,trail:1});
  };
  const checks=[],check=(label,ok,detail)=>{checks.push({label,ok:!!ok,detail});if(!ok)throw Error(label+': '+JSON.stringify(detail));};
  for(let id=1;id<=9;id++){
    await select(id);const resting=h.canvas.toDataURL();
    const count=r.projectiles.used,index=shot();frame(0);
    const shotInfo=h.lastShot;
    check('Form '+id+' high-resolution and independently animated strokes',h.mesh.visible&&h.art.height>350&&resting!==h.canvas.toDataURL(),{glyph:h.art.glyph,bones:h.bones.length});
    check('Form '+id+' one actual projectile at the casting stroke',index>=0&&r.projectiles.used===count+1&&Math.hypot(r.projectiles.x[index]-shotInfo.origin.x,r.projectiles.y[index]-shotInfo.origin.y,r.projectiles.z[index]-shotInfo.origin.z)<1e-5);
    const side=shotInfo.side;frame(.1);shot();check('Form '+id+' alternates both stroke hands',h.lastShot.side===-side);
    for(let n=0;n<20;n++)frame();
    check('Form '+id+' finite mesh',h.path.points.every(([,x,y])=>h.deform(x,y,h.pose).every(Number.isFinite)));
  }
  check('Actual projectiles damage their target',e.hp[target]<10000,{hp:e.hp[target]});
  await select(4);const realMove=p.moves[0],before=h.shots;
  realMove.timer=0;r.castMove(0,realMove,1/60);frame(0);
  check('Unmodified Ember weapon casts through the animated hand',realMove.def.key==='ember'&&h.shots>before&&h.lastShot.type==='fire',{key:realMove.def.key,shots:h.shots-before});
  await select(4);frame();const paused=h.canvas.toDataURL();r.renderWorld(0);app.r.render(0);
  check('Pause holds exact player pose',paused===h.canvas.toDataURL());
  p.pstat.frozen=1;const frozen=h.canvas.toDataURL();frame(.1);frame(.1);
  check('Frozen player holds all strokes',frozen===h.canvas.toDataURL());p.pstat.frozen=0;
  const debris=r.glyphActors.debris.length;p.hurtT=.3;p.flash=.3;frame();
  check('Player hurt does not shed strokes',r.glyphActors.debris.length===debris&&h.bones.length===2&&h.mesh.visible);
  p.hurtT=0;p.flash=0;
  const oldLook=r.skinGl;r.skinGl=35;r.renderWorld(0);
  check('Existing player skin style and palette reach the new renderer',h.material.uniforms.uLook.value[0]===3&&h.material.uniforms.uLook.value[1]===2);r.skinGl=oldLook;
  p.invisT=1;r.renderWorld(0);check('Invisibility remains supported',h.material.uniforms.uFx.value[1]===.5);p.invisT=0;
  const enemyShot={x:0,y:p.pos.y+.9,z:0,dx:0,dz:-1,flags:1,slot:0};
  check('Hostile and remote origins remain unchanged',h.launch(enemyShot)===enemyShot&&h.launch({...enemyShot,flags:0,from:5}).from===5);
  const arc={...enemyShot,flags:8};const arcResult=h.launch(arc);
  check('Ballistic trajectories preserved',arcResult.x===arc.x&&arcResult.y===arc.y&&arcResult.dx===arc.dx);
  check('Same lighting and sRGB palette as monsters, with antialiased edges',h.material.uniforms.uLight===r.glyphActors.material.uniforms.uLight&&h.texture.colorSpace===r.glyphActors.texture.colorSpace);
  await select(4);for(let n=0;n<90;n++)frame();
  window.__heroFrame=frame;window.__heroSelect=select;window.__heroShot=shot;
  const caption=document.createElement('div');caption.id='hero-caption';
  caption.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:99999;background:#f9f5e8ee;color:#293728;padding:12px 26px;border:1px solid #b5c4a5;border-radius:12px;font:600 22px sans-serif;white-space:nowrap;pointer-events:none';
  caption.textContent='火 · 原有两侧点画交替投掷火球';document.body.append(caption);
  return {checks,moves:p.moves.map(m=>m&&{key:m.def.key,arch:m.def.arch}),shots:h.shots};
})()
