/* TOMAN MAFIA — websocket client */
(function () {
  'use strict';

  const Net = {
    ws: null,
    handlers: Object.create(null),
    stateHandlers: [],
    want: false,
    retry: 0,
    retryTimer: null,
    queue: [],
    state: 'off',
  };

  function endpoint() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
  }

  function setState(state) {
    if (Net.state === state) return;
    Net.state = state;
    for (const fn of Net.stateHandlers) {
      try {
        fn(state);
      } catch (_) {}
    }
  }

  function emit(type, data) {
    const list = Net.handlers[type];
    if (!list) return;
    for (const fn of list) {
      try {
        fn(data);
      } catch (err) {
        console.error('handler error', type, err);
      }
    }
  }

  Net.on = function (type, fn) {
    (Net.handlers[type] || (Net.handlers[type] = [])).push(fn);
    return Net;
  };

  Net.onState = function (fn) {
    Net.stateHandlers.push(fn);
    fn(Net.state);
    return Net;
  };

  Net.send = function (obj) {
    if (Net.ws && Net.ws.readyState === 1) {
      Net.ws.send(JSON.stringify(obj));
      return true;
    }
    Net.queue.push(obj);
    return false;
  };

  Net.connect = function () {
    Net.want = true;
    if (Net.ws && (Net.ws.readyState === 0 || Net.ws.readyState === 1)) return;
    setState('wait');
    let ws;
    try {
      ws = new WebSocket(endpoint());
    } catch (_) {
      scheduleRetry();
      return;
    }
    Net.ws = ws;

    ws.onopen = () => {
      Net.retry = 0;
      setState('on');
      const flush = Net.queue.splice(0);
      for (const msg of flush) {
        try {
          ws.send(JSON.stringify(msg));
        } catch (_) {}
      }
      emit('_open', null);
    };

    ws.onmessage = (ev) => {
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      if (!data || typeof data.type !== 'string') return;
      emit(data.type, data);
    };

    ws.onclose = () => {
      if (Net.ws === ws) Net.ws = null;
      setState(Net.want ? 'wait' : 'off');
      if (Net.want) scheduleRetry();
      emit('_close', null);
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch (_) {}
    };
  };

  function scheduleRetry() {
    if (Net.retryTimer) return;
    const delay = Math.min(8000, 700 * Math.pow(1.7, Net.retry++));
    Net.retryTimer = setTimeout(() => {
      Net.retryTimer = null;
      if (Net.want) Net.connect();
    }, delay);
  }

  Net.disconnect = function () {
    Net.want = false;
    if (Net.retryTimer) {
      clearTimeout(Net.retryTimer);
      Net.retryTimer = null;
    }
    if (Net.ws) {
      try {
        Net.ws.close();
      } catch (_) {}
      Net.ws = null;
    }
    setState('off');
  };

  setInterval(() => {
    if (Net.state === 'on') Net.send({ type: 'ping' });
  }, 20000);

  window.Net = Net;
})();
