'use strict';

const crypto = require('crypto');
const rules = require('./rules');
const { Game } = require('./game');

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECONNECT_GRACE_MS = 90 * 1000;
const ROOM_TTL_MS = 30 * 60 * 1000;
const CHAT_WINDOW_MS = 5000;
const CHAT_MAX = 6;
const MAX_NAME = 18;
const MAX_CHAT = 240;

function makeCode() {
  let out = '';
  const bytes = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function makeToken() {
  return crypto.randomBytes(16).toString('hex');
}

function makeId() {
  return 'p' + crypto.randomBytes(6).toString('hex');
}

function cleanName(raw) {
  const name = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  return name;
}

function cleanText(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, MAX_CHAT);
}

class Room {
  constructor(registry) {
    this.registry = registry;
    this.code = makeCode();
    this.hostId = null;
    this.settings = rules.clampSettings();
    this.players = new Map(); // id -> player
    this.sockets = new Map(); // id -> ws
    this.order = []; // player ids in join order
    this.game = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  /* ---------------- players ---------------- */

  list() {
    return this.order.map((id) => this.players.get(id)).filter(Boolean);
  }

  addPlayer(name, token, gender, avatar) {
    if (this.game && this.game.phase !== 'over' && this.list().length >= rules.LIMITS.maxPlayers) {
      return { error: 'الغرفة ممتلئة.' };
    }
    if (this.list().length >= rules.LIMITS.maxPlayers) {
      return { error: 'الغرفة ممتلئة.' };
    }
    let avatarUrl = null;
    if (typeof avatar === 'string' && avatar.startsWith('data:image/') && avatar.length < 200000) {
      avatarUrl = avatar;
    }
    const player = {
      id: makeId(),
      token: token && typeof token === 'string' && token.length >= 16 ? token.slice(0, 40) : makeToken(),
      name: name || 'لاعب',
      gender: gender === 'female' ? 'female' : 'male',
      avatar: avatarUrl,
      connected: true,
      joinedAt: Date.now(),
      chatStamps: [],
    };
    this.players.set(player.id, player);
    this.order.push(player.id);
    if (!this.hostId) this.hostId = player.id;
    return { player };
  }

  findByToken(token) {
    if (!token) return null;
    for (const p of this.players.values()) {
      if (p.token === token) return p;
    }
    return null;
  }

  removePlayer(id) {
    this.players.delete(id);
    this.sockets.delete(id);
    this.order = this.order.filter((x) => x !== id);
    if (this.hostId === id) {
      const next = this.list().find((p) => p.connected) || this.list()[0];
      this.hostId = next ? next.id : null;
      if (this.hostId) {
        this.broadcast({
          type: 'sys',
          text: 'تغيّر مضيف الغرفة بسبب انقطاع الصاحب السابق.',
        });
      }
    }
  }

  /* ---------------- io ---------------- */

  send(id, msg) {
    const ws = this.sockets.get(id);
    if (ws && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(msg));
      } catch (_) {}
    }
  }

  broadcast(msg, exceptId) {
    const raw = JSON.stringify(msg);
    for (const [id, ws] of this.sockets) {
      if (id === exceptId) continue;
      if (ws.readyState === 1) {
        try {
          ws.send(raw);
        } catch (_) {}
      }
    }
  }

  attach(id, ws) {
    this.sockets.set(id, ws);
    const p = this.players.get(id);
    if (p) p.connected = true;
    if (this.game) this.game.handleReconnect(id);
  }

  detach(id) {
    this.sockets.delete(id);
    const p = this.players.get(id);
    if (p) p.connected = false;
    if (this.game) this.game.handleDisconnect(id);
    this.touch();
    setTimeout(() => {
      if (this.destroyed) return;
      const still = this.players.get(id);
      if (still && !still.connected) {
        if (this.game && this.game.phase !== 'over') {
          // keep seat; timer will carry the game forward
          this.broadcastRoom();
        } else {
          this.removePlayer(id);
          this.broadcastRoom();
          if (this.list().length === 0) this.registry.scheduleCleanup(this.code);
        }
      }
    }, RECONNECT_GRACE_MS);
  }

  touch() {
    this.lastActivity = Date.now();
  }

  /* ---------------- state ---------------- */

  roomStateFor(id) {
    const me = this.players.get(id);
    return {
      type: 'room',
      code: this.code,
      hostId: this.hostId,
      settings: this.settings,
      phase: this.game ? this.game.phase : 'lobby',
      you: me ? { id: me.id, name: me.name, gender: me.gender, avatar: me.avatar, token: me.token } : null,
      players: this.list().map((p) => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        avatar: p.avatar,
        connected: p.connected,
        host: p.id === this.hostId,
      })),
      limits: rules.LIMITS,
    };
  }

  broadcastRoom() {
    for (const id of this.players.keys()) {
      this.send(id, this.roomStateFor(id));
    }
  }

  pushGameState() {
    if (!this.game) return;
    for (const id of this.players.keys()) {
      this.send(id, this.game.stateFor(id));
    }
  }

  /* ---------------- actions ---------------- */

  updateSettings(id, patch) {
    if (id !== this.hostId) return { ok: false, message: 'المضيف فقط يغيّر الإعدادات.' };
    if (this.game && this.game.phase !== 'over') {
      return { ok: false, message: 'لا يمكن تغيير الإعدادات أثناء اللعبة.' };
    }
    const merged = { ...this.settings };
    const allowed = ['doctor', 'detective', 'revealVotes', 'healSelf', 'nightSec', 'daySec', 'voteSec', 'dawnSec'];
    for (const key of allowed) {
      if (patch && Object.prototype.hasOwnProperty.call(patch, key)) merged[key] = patch[key];
    }
    this.settings = rules.clampSettings(merged);
    this.broadcastRoom();
    return { ok: true };
  }

  startGame(id, opts) {
    if (id !== this.hostId) return { ok: false, message: 'المضيف فقط يبدأ اللعبة.' };
    if (this.game && this.game.phase !== 'over') return { ok: false, message: 'اللعبة مستمرة بالفعل.' };

    for (const p of this.list()) {
      if (!p.connected) this.removePlayer(p.id);
    }

    const solo = opts && opts.solo === true;
    const seated = this.list();
    if (!solo && seated.length < rules.LIMITS.minPlayers) {
      return {
        ok: false,
        message: `يلزم ${rules.LIMITS.minPlayers} لاعبين على الأقل (الحالي: ${seated.length}).`,
      };
    }
    this.solo = solo;

    let gamePlayers = this.list();
    if (solo) {
      const botNames = ['كريم', 'سارة', 'فهد', 'نورة', 'خالد', 'ريم', 'ماجد', 'لينا'];
      gamePlayers = gamePlayers.slice();
      for (const bn of botNames.slice(0, 7)) {
        gamePlayers.push({ id: 'bot_' + bn, name: bn, gender: Math.random() < 0.5 ? 'female' : 'male', connected: true, bot: true });
      }
    }

    if (this.game) this.game.destroy();
    this.game = new Game(
      gamePlayers,
      this.settings,
      {
        send: (pid, msg) => this.send(pid, msg),
        broadcast: (msg) => this.broadcast(msg),
        push: () => this.pushGameState(),
      },
      { solo }
    );
    this.game.start();
    this.pushGameState();
    this.broadcastRoom();
    return { ok: true };
  }

  restartGame(id) {
    if (id !== this.hostId) return { ok: false, message: 'المضيف فقط يعيد التشغيل.' };
    if (!this.game) return { ok: false, message: 'لا توجد لعبة لإعادة تشغيلها.' };
    this.game.destroy();
    this.game = null;
    this.broadcast({ type: 'sys', text: 'عدنا إلى الغرفة. استعدوا لجولة جديدة.' });
    this.broadcastRoom();
    for (const pid of this.players.keys()) this.send(pid, { type: 'game_cleared' });
    return { ok: true };
  }

  hostAdvance(id) {
    if (id !== this.hostId) return { ok: false, message: 'المضيف فقط يتجاوز المراحل.' };
    if (!this.game) return { ok: false, message: 'لا توجد لعبة.' };
    const ok = this.game.hostAdvance();
    return { ok, message: ok ? null : 'لا يوجد ما يُتجاوز.' };
  }

  nightAction(id, kind, targetId) {
    if (!this.game) return { ok: false, message: 'لا توجد لعبة.' };
    const res = this.game.nightAction(id, kind, targetId);
    if (res.ok) this.pushGameState();
    return res;
  }

  castVote(id, targetId) {
    if (!this.game) return { ok: false, message: 'لا توجد لعبة.' };
    const res = this.game.castVote(id, targetId);
    if (res.ok) this.pushGameState();
    return res;
  }

  handleChat(id, channel, text) {
    const me = this.players.get(id);
    if (!me) return;
    const body = cleanText(text);
    if (!body) return;

    const now = Date.now();
    me.chatStamps = me.chatStamps.filter((t) => now - t < CHAT_WINDOW_MS);
    if (me.chatStamps.length >= CHAT_MAX) {
      this.send(id, { type: 'error', message: 'ببطء قليلًا... انتظر قبل إرسال المزيد.' });
      return;
    }
    me.chatStamps.push(now);

    let resolved = null;
    if (this.game && this.game.phase !== 'over') {
      resolved = this.game.resolveChatChannel(id, channel);
      if (!resolved) {
        this.send(id, {
          type: 'error',
          message:
            this.game.phase === 'night'
              ? 'القناة العامة مغلقة ليلًا. تحقّق من قناتك المتاحة.'
              : 'لا تملك إذنًا لهذه القناة الآن.',
        });
        return;
      }
    } else {
      resolved = 'public';
    }

    const msg = {
      type: 'chat',
      channel: resolved,
      from: id,
      name: me.name,
      text: body,
      ts: now,
    };

    if (!this.game || this.game.phase === 'over' || resolved === 'public') {
      this.broadcast(msg);
    } else {
      this.send(id, msg);
      for (const rid of this.game.recipientsFor(resolved, id)) this.send(rid, msg);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.game) this.game.destroy();
    for (const ws of this.sockets.values()) {
      try {
        ws.close();
      } catch (_) {}
    }
  }
}

class Registry {
  constructor() {
    this.rooms = new Map();
    this.cleanups = new Map();
  }

  create() {
    let room = new Room(this);
    let guard = 0;
    while (this.rooms.has(room.code) && guard++ < 20) room = new Room(this);
    this.rooms.set(room.code, room);
    return room;
  }

  get(code) {
    if (typeof code !== 'string') return null;
    return this.rooms.get(code.toUpperCase().trim()) || null;
  }

  scheduleCleanup(code) {
    if (this.cleanups.has(code)) return;
    const t = setTimeout(() => {
      this.cleanups.delete(code);
      const room = this.rooms.get(code);
      if (!room) return;
      const anyConnected = [...room.sockets.values()].some((ws) => ws.readyState === 1);
      const idle = Date.now() - room.lastActivity > ROOM_TTL_MS;
      if (!anyConnected && (room.list().length === 0 || idle)) {
        room.destroy();
        this.rooms.delete(code);
      }
    }, 60 * 1000);
    this.cleanups.set(code, t);
  }
}

module.exports = { Registry, Room, cleanName, cleanText };
