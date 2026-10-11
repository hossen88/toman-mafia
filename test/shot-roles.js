'use strict';
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const SHOT = path.join(__dirname, '..', '.shots', '11-roles.png');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (r) => {
      let b = '';
      r.on('data', (c) => (b += c));
      r.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(require('os').tmpdir(), 'tm-chrome-roles')}`,
    '--window-size=1440,2400', '--no-first-run', '--disable-gpu', 'about:blank',
  ]);
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    try {
      const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      const p = list.find((t) => t.type === 'page');
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch (_) {}
    if (!wsUrl) await sleep(250);
  }
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
  let id = 0;
  const pend = new Map();
  const send = (m, p) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  ws.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await sleep(7000);
  await send('Runtime.evaluate', { expression: 'document.getElementById("roles").scrollIntoView({block:"start"})' });
  await sleep(700);
  const res = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.dirname(SHOT), { recursive: true });
  fs.writeFileSync(SHOT, Buffer.from(res.data, 'base64'));
  console.log('shot 11-roles.png');
  ws.close();
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
