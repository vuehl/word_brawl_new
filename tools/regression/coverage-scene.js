(async()=>{
  const {GLYPHS}=await import('/src/glyph-catalog.js');
  const {damageChain,SINGLE_STROKES}=await import('/src/glyph-rules.js');
  const app=__glyphApp,r=app.run,e=r.enemies,g=r.glyphActors,results=[];
  const frame=(dt=.05)=>{r.time+=dt;r.renderWorld(dt);app.r.render(dt);};
  const hit=(i,n)=>r.combat.hit(i,n,{type:'normal',cls:'physical',fixed:true,noReact:true,silent:true,knock:0});
  for(const id of Object.keys(GLYPHS))r.sprites.get(+id);
  for(let retry=0;retry<500&&Object.keys(GLYPHS).some(id=>!r.sprites.get(+id).ready);retry++)await new Promise(resolve=>setTimeout(resolve,40));
  for(const [id,spec]of Object.entries(GLYPHS)){
    e.clear();const i=e.spawn(+id,0,-2,1,1,0);e.hp[i]=e.maxHp[i]=1000;e.y[i]=r.terrain.surface(0,-2);frame();
    if(g.mesh.count!==1||g.states.get(i)?.glyph!==spec.glyph)throw Error('Intact render missing: '+id);
    const chain=damageChain(spec.glyph),changes=[];
    for(const [step,rule]of chain.entries()){
      frame(.1);frame(.1);e.hp[i]=[700,300,100,40,15,5,2][Math.min(step,6)]+1;
      hit(i,1);frame();
      const state=g.states.get(i),d=g.debris.at(-1);
      if(state.glyph!==rule.to||d?.glyph!==rule.removed||state.finished)throw Error('Damage chain failed: '+id+' '+rule.from+' → '+rule.to);
      if(!g.art(state.glyph,spec.color)||!g.art(d.glyph,spec.color))throw Error('Missing original-color art: '+id);
      changes.push({from:rule.from,to:state.glyph,removed:d.glyph});
    }
    if(!chain.length){
      if(!SINGLE_STROKES.includes(spec.glyph))throw Error('Uncovered species: '+id);
      hit(i,300);frame();if(g.states.get(i).finished||g.debris.length)throw Error('Single stroke vanished before defeat: '+id);
    }
    frame(.1);frame(.1);e.hp[i]=1;hit(i,10);frame();
    if(!g.states.get(i)?.finished||!g.debris.length)throw Error('Final glyph did not detach: '+id);
    if(g.mesh.count!==g.debris.length)throw Error('Dead glyph was drawn twice: '+id);
    results.push({id:+id,glyph:spec.glyph,changes,finalStroke:chain.at(-1)?.to||spec.glyph,ok:true});
  }
  // Damage over time can enter dying without passing through the hit hook.
  for(const id of [19,20,66,67,68]){
    e.clear();const i=e.spawn(id,0,-2,1,1,0);frame();e.dying[i]=.3;frame();
    if(!g.states.get(i)?.finished||!g.debris.length)throw Error('DOT death failed: '+id);
  }
  e.clear();r.player.setSpecies(1);frame();
  if(g.states.has('player'))throw Error('Player was included in decomposition');
  return {ok:true,testedSpecies:results.length,normalEnemies:results.filter(s=>s.id>=10).length,uniqueGlyphs:new Set(results.map(s=>s.glyph)).size,results};
})()
