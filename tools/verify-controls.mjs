import assert from 'node:assert/strict';

// Measure the rendered control, not just the movement vector: the old adapter
// could move the player correctly while painting the knob far from the finger.
export async function verifyTouchControls(page, {baseline=false}={}) {
  const result=await page.evaluate(async()=>{
    const touch=app.hud.touch,layout=inspected.layout,screen=inspected.doc.getElementById('game').getBoundingClientRect();
    const frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
    const saved={fixed:touch.fixed,scale:touch.k},samples=[];
    const refresh=layout.refresh,realNow=performance.now.bind(performance);
    let layouts=0,rebuilds=0,layoutMs=0,rootNode=layout.box(inspected.doc.body)?.node;
    layout.refresh=function(...args){
      const t=realNow(),boxes=refresh.apply(this,args),next=layout.box(inspected.doc.body)?.node;
      if(next!==rootNode)rebuilds++;rootNode=next;
      layouts++;layoutMs+=realNow()-t;return boxes;
    };
    const sample=(x,y,label)=>{
      const b=touch.stick.getBoundingClientRect(),k=touch.knob.getBoundingClientRect();
      samples.push({label,scale:touch.k,fixed:touch.fixed,
        knobError:Math.hypot(k.x+k.width/2-x,k.y+k.height/2-y),
        baseError:Math.hypot(b.x+b.width/2-touch.sx,b.y+b.height/2-touch.sy),
        reach:Math.hypot(x-touch.sx,y-touch.sy),input:[app.input.stickX,app.input.stickY]});
    };
    try {
      touch.fixed=false;
      for(const scale of [.7,1,1.5]){
        touch.setScale(scale);await frames(3);
        const x=120,y=inspected.env.innerHeight*.65;
        window.tap(x-screen.x,y-screen.y,'down',31);await frames(2);sample(x,y,'press');
        for(const [dx,dy,label] of [[0,-90,'up'],[-65,-65,'diagonal'],[60,20,'reverse'],[0,55,'down']]){
          window.tap(x+dx-screen.x,y+dy-screen.y,'move',31);await frames(2);sample(x+dx,y+dy,label);
        }
        window.tap(x-screen.x,y-screen.y,'up',31);await frames(2);
      }
      touch.setScale(1);await frames(3);
      const x=120,y=inspected.env.innerHeight*.65;
      window.tap(x-screen.x,y-screen.y,'down',32);await frames(2);
      // Drive the UI at 60 Hz independently of Chrome's software GPU speed.
      // This checks actual layout work, without asserting a desktop FPS number.
      const nowProperty=Object.getOwnPropertyDescriptor(performance,'now');
      let clock=realNow()+100;
      Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
      let perf;
      try {
        inspected.env.drawUI(app.r.renderer);layouts=0;rebuilds=0;layoutMs=0;
        const began=realNow();
        for(let i=0;i<24;i++){
          clock+=1000/60;
          window.tap(x+25*Math.sin(i/4)-screen.x,y-50-i-screen.y,'move',32);
          inspected.env.drawUI(app.r.renderer);
        }
        perf={frames:24,layouts,rebuilds,layoutMs,elapsedMs:realNow()-began};
      } finally {
        if(nowProperty)Object.defineProperty(performance,'now',nowProperty);else delete performance.now;
      }
      window.tap(x-screen.x,y-screen.y,'up',32);await frames(2);
      touch.fixed=true;await frames(2);
      const b=touch.stick.getBoundingClientRect(),fx=b.x+b.width/2,fy=b.y+b.height/2;
      window.tap(fx-screen.x,fy-screen.y,'down',33);
      window.tap(fx-screen.x,fy-24-screen.y,'move',33);await frames(2);sample(fx,fy-24,'fixed');
      window.tap(fx-screen.x,fy-screen.y,'cancel',33);await frames(2);
      return {samples,perf,released:touch.stickId===-1&&app.input.stickX===0&&app.input.stickY===0};
    } finally {
      for(const id of [31,32,33])window.tap(120-screen.x,150-screen.y,'cancel',id);
      touch.fixed=saved.fixed;touch.setScale(saved.scale);layout.refresh=refresh;
    }
  });
  console.log('Touch control geometry/performance',JSON.stringify(result));
  if(!baseline){
    assert.ok(result.samples.every(s=>s.baseError<2),'Joystick base must match the input origin');
    assert.ok(result.samples.every(s=>s.knobError<2),'Joystick knob must stay under the finger');
    assert.ok(result.samples.filter(s=>!s.fixed).every(s=>s.reach<=36*s.scale+.1),'Floating joystick must follow long drags');
    assert.ok(result.perf.layouts<=6,'Dragging must not rebuild the full HUD every frame');
    assert.equal(result.perf.rebuilds,0,'Joystick motion must reuse the unchanged HUD geometry');
    assert.ok(result.released,'Cancelling the fixed joystick must stop movement');
  }
  return result;
}
