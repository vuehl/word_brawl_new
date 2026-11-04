import assert from 'node:assert/strict';

// Hold native WeChat touches across rendered frames. A one-frame displacement
// can be a collision/knockback and does not establish that a joystick works.
export async function verifyTouchMovement(page) {
  const result=await page.evaluate(async()=>{
    const r=app.run,touch=app.hud.touch,screen=inspected.doc.getElementById('game').getBoundingClientRect();
    const stick=touch.stick.getBoundingClientRect();
    const x=stick.x+stick.width/2-screen.x,y=stick.y+stick.height/2-screen.y;
    const frames=async(n,check)=>{for(let i=0;i<n;i++){await new Promise(requestAnimationFrame);check?.();}};
    const samples=[];r.player.iframes=3600;
    const start=[r.player.pos.x,r.player.pos.z];
    window.tap(x,y,'down',21);window.tap(x+40,y,'move',21);
    await frames(12,()=>samples.push({x:r.input.stickX,y:r.input.stickY,touches:touch.touches}));
    const moved=Math.hypot(r.player.pos.x-start[0],r.player.pos.z-start[1]);
    // A second finger can look around without releasing movement.
    const lx=inspected.env.innerWidth*.6-screen.x,ly=inspected.env.innerHeight*.65-screen.y;
    window.tap(lx,ly,'down',22);window.tap(lx+20,ly,'move',22);
    await frames(4,()=>samples.push({x:r.input.stickX,y:r.input.stickY,touches:touch.touches}));
    window.tap(lx+20,ly,'up',22);
    await frames(4,()=>samples.push({x:r.input.stickX,y:r.input.stickY,touches:touch.touches}));
    window.tap(x+40,y,'up',21);await frames(3);
    const released=Math.hypot(r.input.stickX,r.input.stickY)===0&&touch.stickId===-1&&touch.touches===0;
    window.tap(x,y,'down',23);window.tap(x-35,y,'move',23);await frames(2);
    window.tap(x-35,y,'cancel',23);await frames(2);
    const cancelled=Math.hypot(r.input.stickX,r.input.stickY)===0&&touch.stickId===-1;
    window.tap(x,y,'down',24);window.tap(x+35,y,'move',24);await frames(2);
    window.fixtureEvent('Hide',{});window.tap(x+35,y,'cancel',24);window.fixtureEvent('Show',{query:{}});await frames(2);
    const backgroundReleased=Math.hypot(r.input.stickX,r.input.stickY)===0&&touch.stickId===-1;
    return {samples,moved,released,cancelled,backgroundReleased};
  });
  assert.ok(result.samples.every(s=>s.touches>0&&Math.hypot(s.x,s.y)>.8),'Held joystick lost its input: '+JSON.stringify(result));
  assert.ok(result.moved>.2,'Held joystick must actually move the player');
  assert.ok(result.released&&result.cancelled&&result.backgroundReleased,'Touch release/cancel/background must stop movement');
  return result;
}
