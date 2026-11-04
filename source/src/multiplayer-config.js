// 部署后若更换服务器，只改这里，再运行 node tools/build.mjs 并重新预览。
export const multiplayerConfig = Object.freeze({
  url: 'ws://192.168.8.55:8787/ws',
  protocol: 1,
  build: 'ziling-coop-1',
});
