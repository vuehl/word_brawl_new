// Let the native loading indicator and a game frame be presented before doing
// synchronous scene construction. A hidden/background RAF cannot hold startup.
export function installRunLoading(env, runtime, timers) {
  let waitingForFrame = null;
  env.showRunLoading = title => {
    runtime.stage(title); runtime.loading(title);
    return new Promise(resolve => {
      let frame, timeout, done = false;
      const finish = () => {
        if (done) return;
        done = true;
        timers.clearTimeout(timeout);
        if (frame !== undefined) timers.cancelAnimationFrame(frame);
        resolve();
      };
      timeout = timers.setTimeout(finish,250);
      frame = timers.requestAnimationFrame(() => {
        frame = timers.requestAnimationFrame(finish);
      });
    });
  };
  env.waitForRunFrame = run => {
    runtime.stage('正在绘制战斗画面'); runtime.loading('正在绘制战斗画面');
    return new Promise((resolve,reject) => {
      const timeout = timers.setTimeout(() => finish(Error('战斗画面未能显示，请返回大厅重试')),20000);
      const finish = error => {
        timers.clearTimeout(timeout); waitingForFrame = null;
        if (error) reject(error);
        else { runtime.stage(run.coop?.loading?'本机画面已准备':'战斗已显示'); resolve(); }
      };
      waitingForFrame = {run,finish};
    });
  };
  env.didRenderRunFrame = run => {
    if (waitingForFrame && waitingForFrame.run === run) {
      if(run.coop?.loading&&(run.glyphActors?.ready===false||run.glyphHero?.ready===false))return;
      waitingForFrame.finish();
    }
  };
  env.onRunRenderError = error => {
    if (waitingForFrame) waitingForFrame.finish(error);
  };
  env.hideRunLoading = () => runtime.hideLoading();
  env.updateRunLoading = title => {runtime.stage(title);runtime.loading(title);};
  env.finishCoopLoading = () => runtime.stage('战斗已显示');
  env.recordRunError = error => runtime.record(error,'进入森林');
  env.getRuntimeInfo = () => runtime.snapshot();
  env.showRuntimeInfo = () => runtime.showDetails();
}
