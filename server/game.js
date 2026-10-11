'use strict';

const rules = require('./rules');

let seq = 0;

class Game {
  constructor(players, settings, hooks, opts) {
    this.id = `g${++seq}`;
    this.settings = rules.clampSettings(settings);
    this.hooks = hooks; // { send(id,msg), broadcast(msg), log(msg) }
    this.solo = !!(opts && opts.solo);
    this.players = rules.assignRoles(players, this.settings);
    if (this.solo) {
      const human = this.players.find((p) => !p.bot);
      if (human) human.role = 'citizen';
    }
    this.phase = 'night';
    this.day = 0;
    this.winner = null;
    this.lastDeath = null;
    this.lastDawn = null;
    this.lastVerdict = null;
    this.night = null;
    this.votes = null;
    this.deadChat = new Set();
    this.phaseTimer = null;
    this.endsAt = 0;
    this.phaseSeq = 0;
  }

  /* ---------------- helpers ---------------- */

  byId(id) {
    return this.players.find((p) => p.id === id) || null;
  }

  alive() {
    return this.players.filter((p) => p.alive);
  }

  aliveMafia() {
    return this.alive().filter((p) => p.role === 'mafia');
  }

  aliveByRole(role) {
    return this.alive().filter((p) => p.role === role);
  }

  setPhase(phase, seconds) {
    this.phase = phase;
    this.phaseSeq++;
    const seq = this.phaseSeq;
    this.phaseSeconds = seconds;
    this.endsAt = seconds > 0 ? Date.now() + seconds * 1000 : 0;
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
    if (seconds > 0) {
      this.phaseTimer = setTimeout(() => {
        if (this.destroyed || this.phaseSeq !== seq) return;
        this.onPhaseTimeout();
      }, seconds * 1000 + 60);
    }
    this.hooks.broadcast({ type: 'phase', ...this.publicPhase() });
    this.sync();
  }

  sync() {
    if (this.hooks.push) this.hooks.push();
  }

  publicPhase() {
    return {
      phase: this.phase,
      day: this.day,
      endsAt: this.endsAt,
      phaseSeq: this.phaseSeq,
      phaseSeconds: this.phaseSeconds || 0,
    };
  }

  onPhaseTimeout() {
    switch (this.phase) {
      case 'night':
        this.resolveNight();
        break;
      case 'dawn':
        this.resolveDawn();
        break;
      case 'day':
        this.enterVoting();
        break;
      case 'voting':
        this.resolveVoting();
        break;
      default:
        break;
    }
  }

  hostAdvance() {
    if (this.phase === 'over' || this.phase === 'lobby') return false;
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
    this.onPhaseTimeout();
    return true;
  }

  /* ---------------- flow ---------------- */

  start() {
    this.hooks.broadcast({
      type: 'sys',
      text: 'انطلقت اللعبة. توزعت الأدوار في الظلام...',
    });
    this.enterNight();
  }

  enterNight() {
    this.day += 1;
    this.night = { kills: Object.create(null), heal: null, check: null };
    this.lastVerdict = null;
    this.setPhase('night', this.settings.nightSec);
    this.hooks.broadcast({
      type: 'sys',
      text: `اليوم ${this.day} — الليل يهبط على المدينة. أنواعٌ تتحرك في الظلام.`,
    });
    for (const p of this.aliveMafia()) {
      this.hooks.send(p.id, {
        type: 'role_ping',
        text: 'أنت من المافيا. اتفقوا على ضحيتكم في القناة الخاصة.',
      });
    }
    if (this.solo) this.botNightActions();
    this.maybeAdvanceNight();
  }

  botNightActions() {
    const alive = this.alive();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    for (const p of alive) {
      if (!p.bot) continue;
      const targets = alive.filter((t) => t.id !== p.id);
      if (targets.length === 0) continue;
      if (p.role === 'mafia') {
        this.night.kills[p.id] = pick(targets).id;
      } else if (p.role === 'doctor') {
        const pool = targets.concat([p]);
        this.night.heal = pick(pool).id;
      } else if (p.role === 'detective') {
        this.night.check = pick(targets).id;
      }
    }
  }

  nightAction(playerId, kind, targetId) {
    if (this.phase !== 'night') return { ok: false, message: 'الليلة انتهت.' };
    const me = this.byId(playerId);
    if (!me || !me.alive) return { ok: false, message: 'أنت خارج اللعبة.' };
    const target = this.byId(targetId);
    if (!target || !target.alive) return { ok: false, message: 'الهدف غير صالح.' };
    if (target.id === me.id) {
      if (kind === 'kill') return { ok: false, message: 'لا يمكنك قتل نفسك.' };
      if (kind === 'check') return { ok: false, message: 'لا يمكنك فحص نفسك.' };
      if (kind === 'heal' && !this.settings.healSelf)
        return { ok: false, message: 'القوانين تمنعك من حماية نفسك.' };
    }

    if (kind === 'kill') {
      if (me.role !== 'mafia') return { ok: false, message: 'ليس لك هذا الدور.' };
      this.night.kills[playerId] = target.id;
      this.hooks.send(playerId, {
        type: 'action_ack',
        kind,
        targetId: target.id,
        text: `تم اختيار ${target.name}. انتظروا بقية الفريق.`,
      });
    } else if (kind === 'heal') {
      if (me.role !== 'doctor') return { ok: false, message: 'ليس لك هذا الدور.' };
      this.night.heal = target.id;
      this.hooks.send(playerId, {
        type: 'action_ack',
        kind,
        targetId: target.id,
        text: `${target.name} تحت حمايتك الليلة.`,
      });
    } else if (kind === 'check') {
      if (me.role !== 'detective') return { ok: false, message: 'ليس لك هذا الدور.' };
      this.night.check = target.id;
      this.hooks.send(playerId, {
        type: 'action_ack',
        kind,
        targetId: target.id,
        text: `فحصت ${target.name}. النتيجة تنتظرك عند الفجر.`,
      });
    } else {
      return { ok: false, message: 'إجراء غير معروف.' };
    }

    this.maybeAdvanceNight();
    return { ok: true };
  }

  maybeAdvanceNight() {
    if (this.phase !== 'night') return;
    const mafiaDone = this.aliveMafia().every((p) => this.night.kills[p.id]);
    const docAlive = this.aliveByRole('doctor').length > 0;
    const detAlive = this.aliveByRole('detective').length > 0;
    const doctorDone = !docAlive || this.night.heal;
    const detectiveDone = !detAlive || this.night.check;
    if (mafiaDone && doctorDone && detectiveDone) this.resolveNight();
  }

  resolveNight() {
    if (this.phase !== 'night') return;
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;

    const counts = Object.create(null);
    for (const id of Object.values(this.night.kills)) {
      counts[id] = (counts[id] || 0) + 1;
    }
    let victimId = null;
    let top = [];
    let best = 0;
    for (const [id, c] of Object.entries(counts)) {
      if (c > best) {
        best = c;
        top = [id];
      } else if (c === best) {
        top.push(id);
      }
    }
    if (top.length) victimId = top[Math.floor(Math.random() * top.length)];

    const saved = this.night.heal && this.night.heal === victimId;
    let death = null;
    if (victimId && !saved) {
      const victim = this.byId(victimId);
      if (victim && victim.alive) {
        victim.alive = false;
        this.deadChat.add(victim.id);
        death = {
          id: victim.id,
          name: victim.name,
          role: victim.role,
          cause: 'kill',
        };
      }
    }
    this.lastDeath = death;
    this.lastDawn = {
      saved: !!saved,
      death,
      attempted: victimId ? this.byId(victimId) : null,
    };

    const det = this.aliveByRole('detective')[0];
    if (det && this.night.check) {
      const target = this.byId(this.night.check);
      if (target) {
        this.hooks.send(det.id, {
          type: 'check_result',
          targetId: target.id,
          targetName: target.name,
          isMafia: target.role === 'mafia',
          text:
            target.role === 'mafia'
              ? `نتيجة الفحص: ${target.name} — من المافيا.`
              : `نتيجة الفحص: ${target.name} — بريء.`,
        });
      }
    }

    this.enterDawn();
  }

  enterDawn() {
    this.setPhase('dawn', this.settings.dawnSec);
    const d = this.lastDawn;
    if (!d) return;
    if (d.death) {
      const victim = this.byId(d.death.id);
      this.hooks.broadcast({
        type: 'death',
        cause: 'kill',
        playerId: d.death.id,
        name: d.death.name,
        avatar: victim ? victim.avatar || null : null,
        text: `${d.death.name} لم يعشَ الليلة.`,
      });
    } else if (d.saved) {
      this.hooks.broadcast({
        type: 'death',
        cause: 'saved',
        text: 'محاولة قتل فاشلة! الطبيب أنقذ ضحية الليلة.',
      });
    } else {
      this.hooks.broadcast({
        type: 'death',
        cause: 'none',
        text: 'ليلة هادئة. لم يمت أحد.',
      });
    }
  }

  resolveDawn() {
    if (this.phase !== 'dawn') return;
    if (this.checkWin()) return;
    this.enterDay();
  }

  enterDay() {
    this.setPhase('day', this.settings.daySec);
    this.hooks.broadcast({
      type: 'sys',
      text: `اليوم ${this.day} — النقاش مفتوح. اتهم، دافع، واضبط فخّك.`,
    });
  }

  enterVoting() {
    this.votes = Object.create(null);
    this.setPhase('voting', this.settings.voteSec);
    this.hooks.broadcast({
      type: 'sys',
      text: 'جلسة التصويت — اخوا من تشنّ عليه حكم الإعدام.',
    });
    if (this.solo) this.botVotes();
    this.maybeAdvanceVoting();
  }

  botVotes() {
    const alive = this.alive().filter((p) => p.bot);
    const targets = this.alive();
    for (const voter of alive) {
      const options = targets.filter((t) => t.id !== voter.id);
      if (options.length === 0) continue;
      this.votes[voter.id] = options[Math.floor(Math.random() * options.length)].id;
    }
  }

  castVote(playerId, targetId) {
    if (this.phase !== 'voting') return { ok: false, message: 'التصويت مغلق الآن.' };
    const me = this.byId(playerId);
    if (!me || !me.alive) return { ok: false, message: 'المتوفون لا يصوّتون.' };
    const target = this.byId(targetId);
    if (!target || !target.alive) return { ok: false, message: 'الهدف غير صالح.' };
    if (target.id === me.id) return { ok: false, message: 'لا يمكنك التصويت على نفسك.' };
    this.votes[playerId] = target.id;
    this.hooks.broadcast({
      type: 'vote_tick',
      cast: Object.keys(this.votes).length,
      total: this.alive().length,
    });
    this.maybeAdvanceVoting();
    return { ok: true };
  }

  maybeAdvanceVoting() {
    if (this.phase !== 'voting') return;
    const all = this.alive().every((p) => this.votes[p.id]);
    if (all) this.resolveVoting();
  }

  resolveVoting() {
    if (this.phase !== 'voting') return;
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;

    const counts = Object.create(null);
    const detail = [];
    for (const [voter, target] of Object.entries(this.votes)) {
      counts[target] = (counts[target] || 0) + 1;
      detail.push({ from: voter, to: target });
    }
    let best = 0;
    let top = [];
    for (const [id, c] of Object.entries(counts)) {
      if (c > best) {
        best = c;
        top = [id];
      } else if (c === best) {
        top.push(id);
      }
    }

    const verdict = {
      lynched: null,
      votes: this.settings.revealVotes ? detail : null,
      counts: this.settings.revealVotes ? counts : null,
    };

    if (top.length === 1) {
      const victim = this.byId(top[0]);
      if (victim && victim.alive) {
        victim.alive = false;
        this.deadChat.add(victim.id);
        verdict.lynched = {
          id: victim.id,
          name: victim.name,
          role: victim.role,
        };
        this.lastDeath = verdict.lynched;
        this.hooks.broadcast({
          type: 'death',
          cause: 'lynch',
          playerId: victim.id,
          name: victim.name,
          avatar: victim.avatar || null,
          text: `أعدَمَت المدينة ${victim.name}.`,
        });
      }
    } else {
      this.hooks.broadcast({
        type: 'death',
        cause: 'tie',
        text: 'تعادل الأصوات — لا إعدام اليوم.',
      });
    }
    this.lastVerdict = verdict;
    this.hooks.broadcast({ type: 'verdict', ...verdict });

    if (this.checkWin()) return;
    this.enterNight();
  }

  checkWin() {
    if (this.solo) return false;
    const w = rules.winState(this.players);
    if (!w) return false;
    this.gameOver(w);
    return true;
  }

  gameOver(winner) {
    this.winner = winner;
    this.setPhase('over', 0);
    this.hooks.broadcast({
      type: 'game_over',
      winner,
      winnerName: winner === 'mafia' ? 'المافيا' : 'المدينة',
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        roleName: rules.ROLES[p.role].name,
        suit: rules.ROLES[p.role].suit,
        alive: p.alive,
      })),
    });
    this.hooks.broadcast({
      type: 'sys',
      text:
        winner === 'mafia'
          ? 'انتصرت المافيا. المدينة غاصت في الظلام.'
          : 'انتهت المافيا. المدينة استيقظت على شارع نظيف.',
    });
  }

  /* ---------------- chat ---------------- */

  chatTargetsFor(playerId) {
    const me = this.byId(playerId);
    if (!me) return null;
    if (this.phase === 'over') return ['public', 'dead'];
    const channels = [];
    if (!me.alive) channels.push('dead');
    if (this.phase === 'lobby') channels.push('public');

    if (me.alive) {
      if (['day', 'dawn', 'voting'].includes(this.phase)) channels.push('public');
      if (me.role === 'mafia' && (this.phase === 'night' || this.phase === 'dawn')) {
        channels.push('mafia');
      }
    }
    return channels;
  }

  resolveChatChannel(playerId, requested) {
    const allowed = this.chatTargetsFor(playerId) || [];
    if (requested && allowed.includes(requested)) return requested;
    if (this.phase === 'night') {
      if (allowed.includes('mafia')) return 'mafia';
      if (allowed.includes('dead')) return 'dead';
      return null;
    }
    if (allowed.includes('public')) return 'public';
    if (allowed.includes('dead')) return 'dead';
    return null;
  }

  recipientsFor(channel, exceptId) {
    const out = [];
    for (const p of this.players) {
      if (p.id === exceptId) continue;
      if (channel === 'public') {
        if (this.phase === 'over') out.push(p.id);
        else if (p.alive && ['day', 'dawn', 'voting', 'lobby'].includes(this.phase)) out.push(p.id);
      } else if (channel === 'mafia') {
        if (p.alive && p.role === 'mafia') out.push(p.id);
      } else if (channel === 'dead') {
        if (!p.alive) out.push(p.id);
      }
    }
    return out;
  }

  /* ---------------- personalised state ---------------- */

  stateFor(playerId) {
    const me = this.byId(playerId);
    const isOver = this.phase === 'over';
    const players = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      gender: p.gender || 'male',
      avatar: p.avatar || null,
      alive: p.alive,
      connected: p.connected,
      host: false,
      role: !me
        ? null
        : isOver || !p.alive || p.id === me.id
          ? p.role
          : me.role === 'mafia' && p.role === 'mafia'
            ? p.role
            : null,
    }));

    const out = {
      type: 'game',
      phase: this.phase,
      day: this.day,
      endsAt: this.endsAt,
      phaseSeq: this.phaseSeq,
      phaseSeconds: this.phaseSeconds || 0,
      winner: this.winner,
      players,
      lastDeath: this.lastDeath
        ? {
            id: this.lastDeath.id,
            name: this.lastDeath.name,
            role: this.lastDeath.role,
            roleName: rules.ROLES[this.lastDeath.role].name,
          }
        : null,
      lastVerdict: this.lastVerdict,
      you: me
        ? {
            id: me.id,
            gender: me.gender || 'male',
            role: me.role,
            alive: me.alive,
            roleName: rules.ROLES[me.role].name,
            roleEn: rules.ROLES[me.role].en,
            suit: rules.ROLES[me.role].suit,
            team: rules.ROLES[me.role].team,
            goal: rules.ROLES[me.role].goal,
            blurb: rules.ROLES[me.role].blurb,
          }
        : null,
      chatChannels: this.chatTargetsFor(playerId) || [],
      counts: {
        alive: this.alive().length,
        total: this.players.length,
      },
    };

    if (this.phase === 'voting' && this.votes) {
      out.voteProgress = {
        cast: Object.keys(this.votes).length,
        total: this.alive().length,
        mine: this.votes[playerId] || null,
      };
    }
    if (this.phase === 'night' && this.night && me && me.alive) {
      const pending = {};
      if (me.role === 'mafia') pending.kill = this.night.kills[playerId] || null;
      if (me.role === 'doctor') pending.heal = this.night.heal;
      if (me.role === 'detective') pending.check = this.night.check;
      out.nightPending = pending;
    }
    if (isOver) {
      out.verdictCounts = this.lastVerdict ? this.lastVerdict.counts : null;
    }
    return out;
  }

  handleDisconnect(playerId) {
    const p = this.byId(playerId);
    if (p) p.connected = false;
  }

  handleReconnect(playerId) {
    const p = this.byId(playerId);
    if (p) p.connected = true;
  }

  destroy() {
    this.destroyed = true;
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
  }
}

module.exports = { Game };
