// Measure completed game frames, not the platform debug panel's FPS counter.
export function framePerformance(now, report) {
  let began=now(),frames=0,sim=0,draw=0,ui=0;
  const reset=()=>{began=now();frames=sim=draw=ui=0;};
  return {
    reset,
    record(simMs,drawMs,uiMs,details) {
      frames++;sim+=simMs;draw+=drawMs;ui+=uiMs;
      const end=now(),elapsed=end-began;
      if(elapsed<1000)return;
      report({...details(),fps:Math.round(frames*10000/elapsed)/10,
        frameMs:Math.round(elapsed/frames),simulationMs:Math.round(sim/frames),
        worldMs:Math.round(Math.max(0,draw-ui)/frames),uiMs:Math.round(ui/frames)});
      reset();
    },
  };
}
