// SocketTask handlers are scoped to this connection, never the global wx socket.
export function wechatSocket(wx, url, events) {
  let task, closed = false, pendingBytes = 0;
  task = wx.connectSocket({url, tcpNoDelay: true, success() {}, fail() { events.error(); }});
  task.onOpen(() => { if (!closed) events.open(); });
  task.onMessage(event => { if (!closed) events.message(event.data); });
  task.onError(() => { if (!closed) events.error(); });
  task.onClose(() => { if (!closed) { closed = true; events.close(); } });
  return {
    send(data, disposable = false) {
      if (closed) return false;
      if (pendingBytes > 256 * 1024 && disposable) return false;
      if (pendingBytes > 1024 * 1024) { events.error(); return false; }
      const size = typeof data === 'string' ? data.length * 3 : data.byteLength;
      pendingBytes += size;
      task.send({data, fail() { if (!closed) events.error(); }, complete() { pendingBytes -= size; }});
      return true;
    },
    close() { if (!closed) { closed = true; task.close({code: 1000, reason: 'leave'}); } },
  };
}
