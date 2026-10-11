'use strict';

/* TOMAN MAFIA — smoke test: engine simulation + live server handshake */

const assert = require('assert');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const { Game } = require('../server/game');
const rules = require('../server/rules');

let passed = 0;
function ok(label, cond, extra) {
  if (!cond) {
    console.error('FAIL:', label, extra || '');
    process.exitCode = 1;
    throw new Error('assertion failed: ' + label);
  }
  passed++;
  console.log('  ✓', label);
}

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: 'p' + (i + 1),
    name: 'لاعب' + (i + 1),
    connected: true,
  }));
}

function silentHooks() {
  const sent = [];
  return {
    sent,
    send: (id, msg) => sent.push({ id, msg }),
    broadcast: (msg) => sent.push({ msg }),
    push: () => {},
  };
}

/* ══════════ PART 1 — engine: town wins ══════════ */

function testTownWins() {
  console.log('\n[1] المحرك — المدينة تنتصر');
  const game = new Game(
    makePlayers(7),
    { ...rules.DEFAULT_SETTINGS, nightSec: 60, daySec: 60, voteSec: 60, dawnSec: 5 },
    silentHooks()
  );
  game.start();
  ok('المرحلة الأولى هي الليل', game.phase === 'night');
  ok('توزيع 7 لاعبين', game.players.length === 7);

  const mafiaCount = game.players.filter((p) => p.role === 'mafia').length;
  ok('عدد المافيا = 1 مع 7 لاعبين', mafiaCount === 1, mafiaCount);
  ok('يوجد طبيب', game.players.some((p) => p.role === 'doctor'));
  ok('يوجد محقق', game.players.some((p) => p.role === 'detective'));

  let guard = 0;
  while (!game.winner && guard++ < 12) {
    if (game.phase === 'night') {
      const mafia = game.aliveMafia();
      const victim = game.players.find((p) => p.alive && p.role !== 'mafia');
      for (const m of mafia) game.nightAction(m.id, 'kill', victim.id);
      const doctor = game.aliveByRole('doctor')[0];
      if (doctor) game.nightAction(doctor.id, 'heal', doctor.id);
      const detective = game.aliveByRole('detective')[0];
      if (detective) game.nightAction(detective.id, 'check', mafia[0].id);
      ok('الليلة انتهت بعد أكتمال الإجراءات', game.phase === 'dawn', game.phase);
      game.resolveDawn();
    }
    if (game.phase === 'day') {
      ok('النهار يلي الفجر', true);
      game.enterVoting();
    }
    if (game.phase === 'voting') {
      const aliveMafia = game.aliveMafia().map((p) => p.id);
      for (const p of game.alive()) {
        const target = aliveMafia.includes(p.id)
          ? game.alive().find((x) => x.id !== p.id)
          : game.byId(aliveMafia[0]);
        if (target && target.id !== p.id) game.castVote(p.id, target.id);
      }
      if (game.phase === 'voting') game.resolveVoting();
    }
  }
  ok('انتهت الجولة بفائز', !!game.winner, game.phase);
  ok('المدينة هي الفائزة', game.winner === 'town', game.winner);
  ok('المرحلة النهاية هي over', game.phase === 'over');
  ok('كشف الأدوار في حالة النهاية', game.stateFor('p1').players.every((p) => typeof p.role === 'string'));
}

/* ══════════ PART 2 — engine: mafia wins ══════════ */

function testMafiaWins() {
  console.log('\n[2] المحرك — المافيا تنتصر');
  const game = new Game(
    makePlayers(5),
    { ...rules.DEFAULT_SETTINGS, doctor: false, detective: false },
    silentHooks()
  );
  game.start();
  ok('5 لاعبين = مافيا واحدة', game.aliveMafia().length === 1);

  let guard = 0;
  let ties = 0;
  while (!game.winner && guard++ < 12) {
    if (game.phase === 'night') {
      const victim = game.players.find((p) => p.alive && p.role !== 'mafia');
      for (const m of game.aliveMafia()) game.nightAction(m.id, 'kill', victim.id);
      game.resolveDawn();
    }
    if (game.phase === 'day') game.enterVoting();
    if (game.phase === 'voting') {
      // المدينة جاهلة — تصوّت تعادلًا كل جولة والمافيا تنجو من الإعدام
      const before = game.alive().length;
      const town = game.alive().filter((p) => p.role !== 'mafia');
      for (let i = 0; i + 1 < town.length; i += 2) {
        game.castVote(town[i].id, town[i + 1].id);
        game.castVote(town[i + 1].id, town[i].id);
      }
      if (game.phase === 'voting') game.resolveVoting();
      if (game.alive().length === before) ties++;
    }
  }
  ok('التصويت تعذّر — لا إعدام في التعادل', ties >= 2, ties);
  ok('المافيا هي الفائزة', game.winner === 'mafia', game.winner);
}

/* ══════════ PART 3 — engine: protections ══════════ */

function testProtections() {
  console.log('\n[3] المحرك — الحماية والتصويت والتحقق');
  const game = new Game(
    makePlayers(6),
    { ...rules.DEFAULT_SETTINGS, healSelf: false },
    silentHooks()
  );
  game.start();

  const mafia = game.aliveMafia()[0];
  const doctor = game.aliveByRole('doctor')[0];
  const citizen = game.players.find((p) => p.role === 'citizen');

  const badKill = game.nightAction(mafia.id, 'kill', mafia.id);
  ok('المafia لا يقتل نفسه', badKill.ok === false);
  const badHealSelf = game.nightAction(doctor.id, 'heal', doctor.id);
  ok('الطبيب لا يحمي نفسه عند إيقاف healSelf', badHealSelf.ok === false);
  const badCheck = game.nightAction(game.aliveByRole('detective')[0].id, 'check', game.aliveByRole('detective')[0].id);
  ok('المحقق لا يفحص نفسه', badCheck.ok === false);
  const badRole = game.nightAction(citizen.id, 'kill', mafia.id);
  ok('المواطن لا يقتل', badRole.ok === false);

  game.nightAction(mafia.id, 'kill', citizen.id);
  game.nightAction(doctor.id, 'heal', citizen.id);
  game.nightAction(game.aliveByRole('detective')[0].id, 'check', mafia.id);
  ok('محاولة قتل فاشلة — الضحية نجت', game.lastDawn && game.lastDawn.saved === true);
  ok('الضحية ما زالت حية', citizen.alive === true);

  const state = game.stateFor(game.aliveByRole('detective')[0].id);
  ok('حالة المحقق تعرض قناته', state.chatChannels.includes('public'));

  game.enterVoting();
  const selfVote = game.castVote(citizen.id, citizen.id);
  ok('لا تصويت على النفس', selfVote.ok === false);

  game.enterNight();
  const lateVote = game.castVote(citizen.id, mafia.id);
  ok('لا تصويت خارج مرحلة التصويت', lateVote.ok === false);
}

/* ══════════ PART 4 — chat channels ══════════ */

function testChatChannels() {
  console.log('\n[4] المحرك — قنوات المحادثة');
  const game = new Game(makePlayers(7), rules.DEFAULT_SETTINGS, silentHooks());
  game.start();
  const mafia = game.aliveMafia()[0];
  const citizen = game.players.find((p) => p.role === 'citizen');

  ok('ليلًا: المافيا في قناة المافيا', game.resolveChatChannel(mafia.id) === 'mafia');
  ok('ليلًا: المواطن بلا قناة عامة', game.resolveChatChannel(citizen.id) === null);

  game.enterDay();
  ok('نهارًا: المواطن في القناة العامة', game.resolveChatChannel(citizen.id) === 'public');
  ok('المافيا ترى القناة العامة نهارًا', game.resolveChatChannel(mafia.id) === 'public');

  citizen.alive = false;
  game.enterNight();
  ok('الميت له قناة خاصة', game.resolveChatChannel(citizen.id) === 'dead');
}

/* ══════════ PART 5 — live server handshake ══════════ */

function get(port, p) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: p }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

function openSocket(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const queue = [];
    const waiters = [];
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      const w = waiters.shift();
      if (w) w(msg);
      else queue.push(msg);
    });
    ws.on('open', () =>
      resolve({
        ws,
        send: (obj) => ws.send(JSON.stringify(obj)),
        next: (ms) =>
          new Promise((res, rej) => {
            const t = setTimeout(() => rej(new Error('timeout waiting message')), ms || 4000);
            const run = (m) => {
              clearTimeout(t);
              res(m);
            };
            if (queue.length) run(queue.shift());
            else waiters.push(run);
          }),
        close: () => ws.close(),
      })
    );
    ws.on('error', reject);
  });
}

async function testServer() {
  console.log('\n[5] الخادم الحي — إنشاء غرفة وانضمام');
  const PORT = 3111;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('server start timeout')), 10000);
      child.stdout.on('data', (d) => {
        if (String(d).includes('TOMAN MAFIA')) {
          clearTimeout(t);
          resolve();
        }
      });
      child.on('error', reject);
    });

    const health = await get(PORT, '/healthz');
    ok('نقطة صحية تعمل', health.status === 200 && health.body === 'ok');

    const index = await get(PORT, '/');
    ok('صفحة رئيسية تُخدَم', index.status === 200 && index.body.includes('TOMAN MAFIA'));

    const css = await get(PORT, '/css/base.css');
    ok('ملف CSS يُخدَم', css.status === 200 && css.body.includes('--accent'));

    const a = await openSocket(PORT);
    a.send({ type: 'create', name: 'نايف' });
    const welcome = await a.next();
    ok('إنشاء غرفة يعيد welcome', welcome.type === 'welcome' && !!welcome.code, JSON.stringify(welcome));
    ok('رمز من 5 محارف', welcome.code.length === 5, welcome.code);

    const roomMsg = await a.next();
    ok('حالة الغرفة تصل للمضيف', roomMsg.type === 'room' && roomMsg.players.length === 1);
    ok('المضيف هو المضيف', roomMsg.hostId === welcome.playerId);

    const b = await openSocket(PORT);
    b.send({ type: 'join', code: welcome.code, name: 'سعد' });
    const bWelcome = await b.next();
    ok('انضمام برمز ناجح', bWelcome.type === 'welcome' && bWelcome.code === welcome.code);

    let sawTwo = false;
    for (let i = 0; i < 4 && !sawTwo; i++) {
      const m = await b.next();
      if (m.type === 'room' && m.players.length === 2) sawTwo = true;
    }
    ok('المضيف يرى لاعبين', sawTwo);

    b.send({ type: 'start' });
    let gotError = null;
    for (let i = 0; i < 4 && !gotError; i++) {
      const m = await b.next();
      if (m.type === 'error') gotError = m;
    }
    ok('غير المضيف لا يبدأ', !!gotError);

    a.send({ type: 'start' });
    gotError = null;
    for (let i = 0; i < 4 && !gotError; i++) {
      const m = await a.next();
      if (m.type === 'error') gotError = m;
    }
    ok('البدء بلا 5 لاعبين مرفوض', !!gotError && /5/.test(gotError.message), gotError && gotError.message);

    a.send({ type: 'chat', text: 'أهلًا بالجميع' });
    const chat = await b.next();
    ok('الرسائل تصل بين اللاعبين', chat.type === 'chat' && chat.text === 'أهلًا بالجميع');

    a.close();
    b.close();
  } finally {
    child.kill();
  }
}

(async () => {
  try {
    testTownWins();
    testMafiaWins();
    testProtections();
    testChatChannels();
    await testServer();
    console.log(`\nتم كل الاختبارات بنجاح (${passed} تحقق) ✦`);
    process.exit(0);
  } catch (err) {
    console.error('\nالاختبار فشل:', err.message);
    process.exit(1);
  }
})();
