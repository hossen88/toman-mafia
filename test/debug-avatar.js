'use strict';
const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9336',
  '--user-data-dir=' + process.env.TEMP + '/tm-chrome-test2',
  '--window-size=1400,900', '--no-first-run', 'about:blank'
]);

function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej);
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

setTimeout(async () => {
  let wsUrl = null;
  for (let i = 0; i < 20 && !wsUrl; i++) {
    try { const l = await getJson('http://127.0.0.1:9336/json/list'); const p = l.find(t => t.type === 'page'); if (p) wsUrl = p.webSocketDebuggerUrl; } catch (_) { }
    if (!wsUrl) await sleep(200);
  }
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  let mid = 0; const pending = new Map();
  ws.on('message', d => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise(res => { const id = ++mid; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await sleep(1500);

  await send('Runtime.evaluate', { expression: "document.querySelector('[data-gate=create]').click(); true" });
  await sleep(500);

  const check = await send('Runtime.evaluate', {
    expression: `(function(){
      const pick = document.getElementById('avatar-pick');
      const fileIn = document.getElementById('avatar-file');
      return JSON.stringify({
        pickExists: !!pick,
        fileInExists: !!fileIn,
        fileInHidden: fileIn ? fileIn.hidden : null,
        pickCursor: pick ? getComputedStyle(pick).cursor : null,
        pickWidth: pick ? pick.offsetWidth : null,
        pickHeight: pick ? pick.offsetHeight : null
      });
    })()`,
    returnByValue: true
  });
  console.log('CHECK:', check.result?.result?.value);

  const clickResult = await send('Runtime.evaluate', {
    expression: `(function(){
      const pick = document.getElementById('avatar-pick');
      const fileIn = document.getElementById('avatar-file');
      let clicked = false;
      const origClick = fileIn.click;
      fileIn.click = function() { clicked = true; return origClick.call(this); };
      pick.click();
      fileIn.click = origClick;
      return JSON.stringify({ clicked });
    })()`,
    returnByValue: true
  });
  console.log('CLICK:', clickResult.result?.result?.value);

  ws.close(); chrome.kill(); process.exit(0);
}, 1200);
