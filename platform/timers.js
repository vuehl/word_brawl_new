'use strict';

// Capture the main package's native APIs once. A single-file gameplay package
// and its callbacks may not have the same ambient globals on every device.
const roots = [];
if (typeof GameGlobal === 'object') roots.push(GameGlobal);
if (typeof globalThis === 'object') roots.push(globalThis);
const ambient = {
  setTimeout: typeof setTimeout === 'function' ? setTimeout : null,
  clearTimeout: typeof clearTimeout === 'function' ? clearTimeout : null,
  setInterval: typeof setInterval === 'function' ? setInterval : null,
  clearInterval: typeof clearInterval === 'function' ? clearInterval : null,
  requestAnimationFrame: typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null,
  cancelAnimationFrame: typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null,
};
function find(name) {
  for (const root of roots) {
    if (typeof root[name] === 'function') return root[name].bind(root);
  }
  const fn = ambient[name];
  return fn ? (...args) => fn(...args) : null;
}
const timers = {};
for (const name of ['setTimeout','clearTimeout','setInterval','clearInterval']) {
  const fn = find(name);
  if (!fn) throw Error('当前微信未提供 ' + name + '，请更新微信并重新进入小游戏。');
  timers[name] = fn;
}
const frame = find('requestAnimationFrame'), cancelFrame = find('cancelAnimationFrame');
// A fallback request and cancellation must use the same kind of timer ID.
timers.requestAnimationFrame = frame && cancelFrame ? frame : callback => timers.setTimeout(() => callback(Date.now()),16);
timers.cancelAnimationFrame = frame && cancelFrame ? cancelFrame : timers.clearTimeout;
module.exports = Object.freeze(timers);
