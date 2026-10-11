'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Registry, cleanName } = require('./rooms');
const rules = require('./rules');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safe);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (urlPath.endsWith('.html')) {
        fs.readFile(path.join(ROOT, 'index.html'), (e2, home) => {
          if (e2) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404');
            return;
          }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(home);
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server, path: '/ws' });
const registry = new Registry();

const MSG_LIMIT = 80;
const MSG_WINDOW = 10000;

function fail(ws, message) {
  ws.send(JSON.stringify({ type: 'error', message }));
}

wss.on('connection', (ws) => {
  ws._roomCode = null;
  ws._pid = null;
  ws._stamps = [];
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  function currentRoom() {
    return ws._roomCode ? registry.get(ws._roomCode) : null;
  }

  function leaveRoom() {
    const room = currentRoom();
    if (room && ws._pid) {
      const stillThere = [...room.sockets.entries()].some(
        ([id, sock]) => id === ws._pid && sock !== ws
      );
      room.sockets.delete(ws._pid);
      if (!stillThere) room.detach(ws._pid);
    }
    ws._roomCode = null;
    ws._pid = null;
  }

  ws.on('message', (raw) => {
    const now = Date.now();
    ws._stamps = ws._stamps.filter((t) => now - t < MSG_WINDOW);
    if (ws._stamps.length >= MSG_LIMIT) {
      fail(ws, '太快 رفعت الصوت. انتظر قليلًا.');
      return;
    }
    ws._stamps.push(now);

    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch (_) {
      fail(ws, 'رسالة غير صالحة.');
      return;
    }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

    const room = currentRoom();

    switch (msg.type) {
      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        break;
      }

      case 'create': {
        leaveRoom();
        const name = cleanName(msg.name) || 'المضيف';
        const gender = msg.gender === 'female' ? 'female' : 'male';
        const newRoom = registry.create();
        const { player, error } = newRoom.addPlayer(name, null, gender, msg.avatar);
        if (error) {
          fail(ws, error);
          return;
        }
        newRoom.attach(player.id, ws);
        ws._roomCode = newRoom.code;
        ws._pid = player.id;
        ws.send(
          JSON.stringify({
            type: 'welcome',
            playerId: player.id,
            token: player.token,
            code: newRoom.code,
          })
        );
        newRoom.broadcastRoom();
        break;
      }

      case 'join': {
        const code = String(msg.code || '').toUpperCase().trim();
        const target = registry.get(code);
        if (!target) {
          fail(ws, 'لم أجد غرفة بهذا الرمز. تأكد من الرمز وحاول مجددًا.');
          return;
        }
        const existing = target.findByToken(msg.token);
        if (existing) {
          if (ws._roomCode === target.code && ws._pid === existing.id) break;
          leaveRoom();
          const old = target.sockets.get(existing.id);
          if (old && old !== ws) {
            try {
              old.send(JSON.stringify({ type: 'replaced', message: 'تم تسجيل دخولك من جهاز آخر.' }));
              old.close();
            } catch (_) {}
          }
          existing.name = cleanName(msg.name) || existing.name;
          target.attach(existing.id, ws);
          ws._roomCode = target.code;
          ws._pid = existing.id;
          ws.send(
            JSON.stringify({
              type: 'welcome',
              playerId: existing.id,
              token: existing.token,
              code: target.code,
              resumed: true,
            })
          );
          target.broadcastRoom();
          if (target.game) ws.send(JSON.stringify(target.game.stateFor(existing.id)));
        } else {
          if (ws._roomCode === target.code) break;
          leaveRoom();
          const name = cleanName(msg.name) || 'لاعب';
          const gender = msg.gender === 'female' ? 'female' : 'male';
          const { player, error } = target.addPlayer(name, null, gender, msg.avatar);
          if (error) {
            fail(ws, error);
            return;
          }
          target.attach(player.id, ws);
          ws._roomCode = target.code;
          ws._pid = player.id;
          ws.send(
            JSON.stringify({
              type: 'welcome',
              playerId: player.id,
              token: player.token,
              code: target.code,
            })
          );
          target.broadcastRoom();
          target.broadcast(
            { type: 'sys', text: `${player.name} انضم إلى الغرفة.` },
            player.id
          );
        }
        break;
      }

      case 'leave': {
        const r = room;
        leaveRoom();
        if (r) {
          r.broadcastRoom();
          if (r.list().length === 0) registry.scheduleCleanup(r.code);
        }
        ws.send(JSON.stringify({ type: 'left' }));
        break;
      }

      case 'settings': {
        if (!room || !ws._pid) return fail(ws, 'لست في غرفة.');
        const res = room.updateSettings(ws._pid, msg.patch || {});
        if (!res.ok) fail(ws, res.message);
        break;
      }

      case 'start': {
        if (!room || !ws._pid) return fail(ws, 'لست في غرفة.');
        const res = room.startGame(ws._pid, { solo: msg.solo === true });
        if (!res.ok) fail(ws, res.message);
        break;
      }

      case 'restart': {
        if (!room || !ws._pid) return fail(ws, 'لست في غرفة.');
        const res = room.restartGame(ws._pid);
        if (!res.ok) fail(ws, res.message);
        break;
      }

      case 'advance': {
        if (!room || !ws._pid) return fail(ws, 'لست في غرفة.');
        const res = room.hostAdvance(ws._pid);
        if (!res.ok && res.message) fail(ws, res.message);
        break;
      }

      case 'night_action': {
        if (!room || !ws._pid) return fail(ws, 'لست في غرفة.');
        const res = room.nightAction(ws._pid, msg.kind, msg.targetId);
        if (!res.ok) fail(ws, res.message);
        break;
      }

      case 'vote': {
        if (!room || !ws._pid) return fail(ws, 'لست في غرفة.');
        const res = room.castVote(ws._pid, msg.targetId);
        if (!res.ok) fail(ws, res.message);
        break;
      }

      case 'chat': {
        if (!room || !ws._pid) return fail(ws, 'لست في غرفة.');
        room.handleChat(ws._pid, msg.channel, msg.text);
        break;
      }

      default:
        fail(ws, 'نوع رسالة غير معروف.');
    }
  });

  ws.on('close', () => {
    leaveRoom();
  });

  ws.on('error', () => {
    leaveRoom();
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (_) {}
  }
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, HOST, () => {
  console.log(`TOMAN MAFIA — http://localhost:${PORT}`);
  console.log(`Rooms registry ready. Players per room: ${rules.LIMITS.minPlayers}-${rules.LIMITS.maxPlayers}`);
});
