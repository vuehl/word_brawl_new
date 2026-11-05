// Count genuinely slow frames too. Ignoring >=250ms frames previously locked a
// badly overloaded phone at its most expensive render resolution indefinitely.
export function adaptiveResolution(state, {seconds,workMs,now,scale,minScale,targetFPS,active,allowCpuBound=false}) {
  if (!active || !Number.isFinite(seconds) || seconds<=0 || seconds>10) {
    state.t=state.frames=state.js=0;return scale;
  }
  state.t+=seconds;state.frames++;state.js+=workMs;
  if (state.t<2) return scale;
  const fps=state.frames/state.t,cost=state.js/(state.t*1000);
  state.t=state.frames=state.js=0;
  if (fps<targetFPS*.8 && (allowCpuBound || cost<.7) && scale>minScale) {
    if(now-state.lastUp<25000)state.wait=Math.min(60,state.wait*2);
    state.good=0;
    return Math.max(minScale,scale-(fps<targetFPS*.5?.2:.1));
  }
  if (fps>=targetFPS*.95 && cost<.85 && scale<1) {
    if (++state.good*2>=state.wait) {state.good=0;state.lastUp=now;return Math.min(1,scale+.1);}
  } else state.good=0;
  return scale;
}
