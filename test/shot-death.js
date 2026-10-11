'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9335;
const SHOT_DIR = path.join(__dirname, '..', '.shots');
const USER_DATA = path.join(require('os').tmpdir(), 'tm-chrome-death');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`, '--window-size=1400,900',
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank',
  ]);

  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    try {
      const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      const page = list.find((t) => t.type === 'page');
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch (_) {}
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) { console.error('no ws'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  let mid = 0;
  const pending = new Map();
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++mid;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) console.error('JS ERR:', r.result.exceptionDetails.text);
    return r.result && r.result.result && r.result.result.value;
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(r.result.data, 'base64'));
    console.log('shot:', name);
  };

  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await sleep(1600);

  // Skip curtain
  await evalJs("document.getElementById('curtain') && (document.getElementById('curtain').hidden = true); true");
  await sleep(300);

  // Open create gate via UI button
  await evalJs("document.querySelector('[data-gate=create]').click(); true");
  await sleep(400);
  await evalJs("document.getElementById('gate-name').value = 'تجربة'; true");
  await evalJs("document.getElementById('gate-form').requestSubmit(); true");
  await sleep(800);

  // Wait for lobby, click solo test
  await evalJs("document.getElementById('solo-test-btn').click(); true");
  await sleep(1500);

  // Close role reveal
  await evalJs("document.getElementById('role-reveal-close') && document.getElementById('role-reveal-close').click(); true");
  await sleep(500);

  // Advance night → dawn (death announcement appears)
  await evalJs("document.getElementById('advance-btn').click(); true");
  await sleep(2500);
  // Force-hide curtain if still visible
  await evalJs("const c=document.getElementById('curtain'); if(c){c.hidden=true;c.classList.remove('is-entering','is-leaving');} true");
  await sleep(400);
  await shot('15-death-banner.png');

  // Also advance to day to show death banner during day
  await evalJs("document.getElementById('advance-btn').click(); true");
  await sleep(2500);
  await evalJs("const c=document.getElementById('curtain'); if(c){c.hidden=true;c.classList.remove('is-entering','is-leaving');} true");
  await sleep(400);
  await shot('16-death-day.png');

  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
