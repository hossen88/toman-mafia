'use strict';

/* Dev-only browser check via Chrome DevTools Protocol (no dependencies). */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const TARGET = process.env.TARGET || 'http://localhost:3000/';
const SHOT_DIR = path.join(__dirname, '..', '.shots');
const USER_DATA = path.join(require('os').tmpdir(), 'tm-chrome-profile');

function getJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? require('https') : http;
    mod
      .get(url, (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    '--window-size=1440,900',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank',
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
  if (!wsUrl) {
    console.error('تعذر الوصول إلى Chrome CDP');
    chrome.kill();
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
  let id = 0;
  const pending = new Map();
  const errors = [];

  function send(method, params) {
    return new Promise((resolve) => {
      const msgId = ++id;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params: params || {} }));
    });
  }

  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception ? d.exception.description || d.text : d.text);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push(msg.params.entry.text);
    }
  });

  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Page.navigate', { url: TARGET });
  await sleep(6800);

  async function shot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(res.data, 'base64'));
    console.log('  shot →', name);
  }

  async function evalJs(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result ? res.result.value : undefined;
  }

  await shot('01-home.png');

  const introHidden = await evalJs('document.getElementById("intro").hidden');
  console.log('  intro hidden after wait:', introHidden);

  // join gate
  await evalJs('document.querySelector("[data-gate=join]").click()');
  await sleep(600);
  await shot('02-gate.png');
  const gateOpen = await evalJs('document.getElementById("gate").open');
  console.log('  gate dialog open:', gateOpen);
  await evalJs('document.getElementById("gate-close").click()');
  await sleep(300);

  // create room via real websocket
  await evalJs('document.querySelector("[data-gate=create]").click()');
  await sleep(400);
  await evalJs('document.getElementById("gate-name").value="تجربة"');
  await evalJs('document.getElementById("gate-form").requestSubmit()');
  await sleep(1500);
  const inLobby = await evalJs('!document.getElementById("lobby").hidden');
  const code = await evalJs('document.getElementById("room-code").textContent');
  console.log('  in lobby:', inLobby, 'code:', code);
  await shot('03-lobby.png');

  // simulate 4 more players joining from other tabs via raw ws
  const wsMod = require('ws');
  const url = 'ws://localhost:3000/ws';
  const extras = [];
  for (let i = 0; i < 4; i++) {
    const s = new wsMod(url);
    extras.push(
      new Promise((resolve) => {
        s.on('open', () => s.send(JSON.stringify({ type: 'join', code, name: 'ضيف' + (i + 1) })));
        s.on('message', (raw) => {
          const m = JSON.parse(String(raw));
          if (m.type === 'room' && m.players.length === 5) resolve(s);
        });
      })
    );
  }
  await Promise.all(extras);
  await sleep(900);
  const rosterCount = await evalJs('document.querySelectorAll("#lobby-roster .roster-card").length');
  console.log('  roster cards:', rosterCount);
  await shot('04-lobby-full.png');

  // speed up phase timers for the walkthrough
  await evalJs(`
    (() => {
      const ranges = document.querySelectorAll('.settings-list input[type=range]');
      const mins = [15, 15, 10, 3];
      ranges.forEach((inp, i) => {
        inp.value = mins[i];
        inp.dispatchEvent(new Event('input'));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      });
    })()
  `);
  await sleep(600);

  // start game
  await evalJs('document.getElementById("start-btn").click()');
  await sleep(2200);
  const inGame = await evalJs('!document.getElementById("game").hidden');
  const roleShown = await evalJs('!document.getElementById("role-reveal").hidden');
  const roleName = await evalJs('document.getElementById("role-reveal-name").textContent');
  const dayLabel = await evalJs('document.getElementById("game-day").textContent');
  console.log('  in game:', inGame, 'role modal:', roleShown, roleName, 'day:', dayLabel);
  await shot('05-role-reveal.png');
  await evalJs('document.getElementById("role-reveal-close").click()');
  await sleep(600);
  await shot('06-game-night.png');

  const playerCards = await evalJs('document.querySelectorAll("#players-grid .player-card").length');
  const phase = await evalJs('document.getElementById("game-phase").textContent.trim()');
  console.log('  player cards:', playerCards, 'phase:', phase);

  // chat
  await evalJs('document.getElementById("chat-input").value="مساء الخير"');
  await evalJs('document.getElementById("chat-form").requestSubmit()');
  await sleep(500);
  const logLines = await evalJs('document.querySelectorAll("#chat-log .chat-line").length');
  console.log('  chat lines:', logLines);
  await shot('07-game-chat.png');

  // walk the phases with the host skip button
  await evalJs('document.getElementById("role-reveal-close").click()');
  await evalJs('document.getElementById("advance-btn").click()'); // night → dawn
  await sleep(1400);
  await shot('08-dawn.png');
  await evalJs('document.getElementById("advance-btn").click()'); // dawn → day
  await sleep(1400);
  await shot('09-day.png');
  await evalJs('document.getElementById("advance-btn").click()'); // day → voting
  await sleep(1400);
  await shot('10-voting.png');
  const votingPhase = await evalJs('document.getElementById("game-phase").textContent.trim()');
  console.log('  voting phase label:', votingPhase);

  console.log('\nconsole errors:', errors.length);
  for (const e of errors) console.log('  !', e);

  ws.close();
  chrome.kill();
  process.exit(errors.length ? 2 : 0);
})().catch((err) => {
  console.error('browser check failed:', err);
  process.exit(1);
});
