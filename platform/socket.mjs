// SocketTask handlers are scoped to this connection, never the global wx socket.
export function wechatSocket(wx, url, events) {
  let task, closed = false, failed = false, pendingBytes = 0;
  const fail = error => {
    if (closed || failed) return;
    failed = true;
    events.error(error);
  };
  try {
    task = wx.connectSocket({url, tcpNoDelay: true, success() {}, fail});
    if (!task || typeof task.onOpen !== 'function') throw Error('微信未返回 SocketTask，请更新微信后重试');
    task.onOpen(() => { if (!closed && !failed) events.open(); });
    task.onMessage(event => { if (!closed) events.message(event.data); });
    task.onError(fail);
    task.onClose(event => { if (!closed) { closed = true; events.close(event); } });
  } catch (error) { fail(error); }
  return {
    send(data, disposable = false) {
      if (closed || failed || !task) return false;
      if (pendingBytes > 256 * 1024 && disposable) return false;
      if (pendingBytes > 1024 * 1024) { fail({errMsg: '发送队列已满，连接过慢'}); return false; }
      const size = typeof data === 'string' ? data.length * 3 : data.byteLength;
      pendingBytes += size;
      try {
        task.send({data, fail, complete() { pendingBytes -= size; }});
      } catch (error) { pendingBytes -= size; fail(error); return false; }
      return true;
    },
    close() { if (!closed) { closed = true; task?.close({code: 1000, reason: 'leave'}); } },
  };
}
