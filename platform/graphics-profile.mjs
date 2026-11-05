export function graphicsProfile(device, highPerformance) {
  const ordinaryIOS = device.platform === 'ios' && !highPerformance;
  return ordinaryIOS ? {
    name:'ios-compatible',maxRatio:1.5,balancedRatio:1.25,maxPixels:800000,minRatio:1,
    uiMaxRatio:2,uiMaxPixels:1500000,bloom:false,outline:false,
    defaultFPS:30,menuFPS:20,uiInterval:120,menuRefresh:500,
    hudInterval:100,minimapInterval:200,heroTextureSize:384,heroFPS:15,
  } : {
    name:device.platform === 'ios'?'ios-high-performance':'standard',
    maxRatio:2.5,balancedRatio:2,maxPixels:2600000,minRatio:1.5,
    uiMaxRatio:3,uiMaxPixels:3500000,bloom:true,outline:true,
    defaultFPS:0,menuFPS:30,uiInterval:80,menuRefresh:250,
  };
}

export function uiScale(view, profile) {
  return Math.min(view.dpr,profile.uiMaxRatio,Math.sqrt(profile.uiMaxPixels/(view.width*view.height)));
}

// DOM mutations cover labels/buttons; a bounded refresh also catches animated
// canvas previews, which do not mutate DOM. The moving stick has its own layer.
export function uiSchedule(profile) {
  let pending=true,urgent=true,last=-Infinity,lastState;
  return {
    invalidate(immediate=false) { pending=true;urgent ||= immediate; },
    shouldPaint(now,state) {
      const changed=state!==lastState,interval=state==='play'||pending?profile.uiInterval:profile.menuRefresh;
      if (!urgent && !changed && now-last<interval) return false;
      last=now;lastState=state;pending=urgent=false;
      return true;
    },
  };
}
