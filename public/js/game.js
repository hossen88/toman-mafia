/* TOMAN MAFIA — game screen rendering */
(function () {
  'use strict';

  const { el, escapeHtml, initials, fmtClock, ROLE_BY_ID } = window.TM;

  const PHASES = {
    night: { title: 'الليل', kicker: 'NIGHT FALLS', sub: 'أغلق عينيك... هناك من يتحرك في الظلام.' },
    dawn: { title: 'الفجر', kicker: 'DAWN BREAKS', sub: 'الشمس تكشف ما فعلوه الليلة.' },
    day: { title: 'النهار', kicker: 'DAYLIGHT', sub: 'الكل يتكلم. أحدهم يكذب.' },
    voting: { title: 'التصويت', kicker: 'THE VERDICT', sub: 'حان وقت الحكم.' },
    over: { title: 'النهاية', kicker: 'FINAL VERDICT', sub: 'المدينة تعرف الآن.' },
  };

  const CHANNEL_LABELS = {
    public: 'العام',
    mafia: 'المافيا',
    dead: 'المتفرجون',
  };

  const GameUI = {
    state: null,
    room: null,
    logs: [],
    activeChannel: 'public',
    selected: null,
    seenRevealSeq: -1,
    lastPhaseSeq: -1,
    timerHandle: null,
    curtainTimer: null,
    deathCardTimer: null,
    onAction: null,
    onChat: null,
  };

  const $ = (id) => document.getElementById(id);

  /* ---------------- lifecycle ---------------- */

  function init() {
    $('players-grid').addEventListener('click', onGridClick);
    $('action-confirm').addEventListener('click', confirmAction);
    $('death-card-close').addEventListener('click', dismissDeathCard);
    $('chat-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const input = $('chat-input');
      const text = input.value.trim();
      if (!text) return;
      if (GameUI.onChat) GameUI.onChat(text, GameUI.activeChannel);
      input.value = '';
    });
    $('game-leave').addEventListener('click', () => {
      if (GameUI.onLeave) GameUI.onLeave();
    });
    $('advance-btn').addEventListener('click', () => {
      if (GameUI.onAdvance) GameUI.onAdvance();
    });
    startTimerLoop();
  }

  function setRoom(room) {
    GameUI.room = room;
    const code = $('game-code');
    if (code) code.textContent = room ? room.code : '—————';
  }

  /* ---------------- state ---------------- */

  function show(state) {
    GameUI.state = state;
    if (state.phaseSeq !== GameUI.lastPhaseSeq) {
      const isFirst = GameUI.lastPhaseSeq === -1;
      GameUI.lastPhaseSeq = state.phaseSeq;
      if (!isFirst) announce(state.phase);
      maybeRevealRole(state);
    }

    renderPhaseChrome(state);
    renderPlayers(state);
    renderDock(state);
    renderTabs(state);
    renderDeath(state);

    const host = GameUI.room && GameUI.room.you && GameUI.room.you.id === GameUI.room.hostId;
    $('advance-btn').hidden = !(host && state.phase !== 'over');

    if (state.phase === 'over') {
      $('action-confirm').disabled = true;
    }
    renderLog();
  }

  function renderPhaseChrome(state) {
    const meta = PHASES[state.phase] || PHASES.day;
    const phaseEl = $('game-phase');
    phaseEl.dataset.phase = state.phase;
    phaseEl.querySelector('span').textContent = meta.title;
    $('game-day').textContent = state.phase === 'over' ? 'END' : `DAY ${state.day}`;
    $('phase-kicker').textContent = meta.kicker;
    $('phase-title').textContent = meta.title;
    $('phase-sub').textContent = meta.sub;
  }

  function renderDeath(state) {
    const banner = $('death-banner');
    const img = $('death-img');
    const text = $('death-text');
    const dawnDeath = state._dawn;
    if (state.phase === 'night' || state.phase === 'over') {
      banner.hidden = true;
      return;
    }
    if (dawnDeath) {
      banner.hidden = false;
      banner.className = 'death-banner' + (dawnDeath.cause === 'saved' ? ' safe' : dawnDeath.cause === 'none' || dawnDeath.cause === 'tie' ? ' calm' : '');
      text.textContent = dawnDeath.text;
      if (dawnDeath.cause === 'kill' && dawnDeath.role) {
        img.src = window.TM.roleImg(dawnDeath.role, dawnDeath.gender);
        img.hidden = false;
        img.style.display = '';
      } else {
        img.hidden = true;
        img.style.display = 'none';
      }
      return;
    }
    if (state.lastDeath && (state.phase === 'day' || state.phase === 'voting')) {
      banner.hidden = false;
      banner.className = 'death-banner';
      const victim = state.players && state.players.find((p) => p.id === state.lastDeath.id);
      text.textContent = `${state.lastDeath.name} خارج اللعبة.`;
      if (victim && victim.avatar) {
        img.src = victim.avatar;
        img.hidden = false;
        img.style.display = '';
      } else {
        img.hidden = true;
        img.style.display = 'none';
      }
      return;
    }
    banner.hidden = true;
  }

  /* ---------------- players ---------------- */

  function dockConfig(state) {
    const you = state.you;
    if (!you) return { enabled: false, role: '—', hint: '' };
    if (state.phase === 'over') {
      return { enabled: false, role: 'النتيجة', hint: 'انتهت اللعبة. راجع الأدوار وابدأ جولة جديدة.' };
    }
    if (!you.alive) {
      return { enabled: false, role: 'متفرج', hint: 'أنت خارج اللعبة الآن. تابع الأحداث ولا تكشف معلوماتك.' };
    }
    if (state.phase === 'night') {
      if (you.role === 'mafia') {
        return {
          kind: 'kill',
          enabled: true,
          label: 'اختر الضحية',
          role: 'المافيا — قتل',
          hint: 'اتفقوا مع فريقكم وصوّتوا. الضحية الأكثر أصواتًا هي التي تسقط.',
        };
      }
      if (you.role === 'doctor') {
        return {
          kind: 'heal',
          enabled: true,
          label: 'تأمين الحماية',
          role: 'الطبيب — حماية',
          hint: 'اختر من تحميه الليلة. قد يحاول المافيا قتله.',
        };
      }
      if (you.role === 'detective') {
        return {
          kind: 'check',
          enabled: true,
          label: 'تنفيذ الفحص',
          role: 'المحقق — فحص',
          hint: 'اختر من تفحصه. ستصلك النتيجة عند الفجر.',
        };
      }
      return { enabled: false, role: you.roleName, hint: 'نم بسلام. لا فعل لك في هذا الليل.' };
    }
    if (state.phase === 'voting') {
      return {
        kind: 'vote',
        enabled: true,
        label: 'صوّت بالإعدام',
        role: 'التصويت',
        hint: 'اختر من تشك فيه. الأكثر أصواتًا يُعدَّم، والتعادل يعني عدم إعدام.',
      };
    }
    return {
      enabled: false,
      role: you.roleName,
      hint: state.phase === 'dawn' ? 'انتظر كشف نتيجة الليلة...' : 'ناقش واقنع. التصويت قادم.',
    };
  }

  function isValidTarget(state, target, kind) {
    if (!target.alive) return false;
    if (target.id === state.you.id) {
      if (kind === 'heal') return true;
      return false;
    }
    return true;
  }

  function renderPlayers(state) {
    const grid = $('players-grid');
    const cfg = dockConfig(state);
    const verdict = state.lastVerdict;
    const votesOn = Object.create(null);
    if (verdict && verdict.counts) {
      for (const [id, c] of Object.entries(verdict.counts)) votesOn[id] = c;
    }

    grid.textContent = '';
    for (const p of state.players) {
      const knownRole = p.role ? ROLE_BY_ID[p.role] : null;
      const selectable = cfg.enabled && isValidTarget(state, p, cfg.kind) && (state.phase !== 'voting' || p.id !== state.you.id);
      const card = el('button', {
        class: 'player-card' + (p.alive ? '' : ' dead') + (p.id === state.you.id ? ' self' : '') + (selectable ? ' selectable' : '') + (GameUI.selected === p.id ? ' selected' : ''),
        type: 'button',
        dataset: { id: p.id },
        disabled: !selectable,
        'aria-pressed': GameUI.selected === p.id ? 'true' : 'false',
        'aria-label': p.name,
      }, [
        el('div', { class: 'pc-top' }, [
          p.avatar
            ? el('img', { class: 'pc-avatar', src: p.avatar, alt: '' })
            : el('span', { class: 'pc-avatar', text: initials(p.name) }),
          knownRole ? el('span', { class: 'pc-role', text: knownRole.suit, title: knownRole.name }) : null,
        ]),
        el('div', null, [
          el('div', { class: 'pc-name', text: p.name }),
          el('div', { class: 'pc-meta' }, [
            el('i', { class: 'pc-dot' + (p.connected ? '' : ' off') }),
            el('span', { text: p.alive ? (p.connected ? 'متصل' : 'غير متصل') : 'خارج' }),
            knownRole ? el('span', { text: '· ' + knownRole.name }) : null,
          ]),
        ]),
        votesOn[p.id] ? el('span', { class: 'pc-votes', text: `${votesOn[p.id]} صوت` }) : null,
      ]);
      grid.appendChild(card);
    }
  }

  function onGridClick(ev) {
    const card = ev.target.closest('.player-card');
    if (!card || card.disabled) return;
    const id = card.dataset.id;
    GameUI.selected = GameUI.selected === id ? null : id;
    renderPlayers(GameUI.state);
    renderDock(GameUI.state);
  }

  /* ---------------- dock ---------------- */

  function renderDock(state) {
    const cfg = dockConfig(state);
    $('dock-role').textContent = cfg.role;
    $('dock-hint').textContent = cfg.hint;

    const label = $('action-confirm-label');
    const btn = $('action-confirm');
    label.textContent = cfg.label || 'تأكيد';

    const target = state.players.find((p) => p.id === GameUI.selected);
    const targetEl = $('action-target');
    if (target) {
      targetEl.textContent = `الهدف: ${target.name}`;
      targetEl.classList.add('has');
    } else {
      targetEl.textContent = 'لم تختر هدفًا';
      targetEl.classList.remove('has');
    }

    let ready = cfg.enabled && !!GameUI.selected;
    if (cfg.kind === 'vote' && state.voteProgress && state.voteProgress.mine) ready = false;
    btn.disabled = !ready;

    if (cfg.kind === 'vote' && state.voteProgress) {
      $('dock-hint').textContent = `${cfg.hint} — تم التصويت ${state.voteProgress.cast} من ${state.voteProgress.total}.`;
      if (state.voteProgress.mine) {
        const voted = state.players.find((p) => p.id === state.voteProgress.mine);
        label.textContent = 'تم تصويتك';
        $('action-target').textContent = voted ? `صوّت على ${voted.name} ✓` : 'تم التصويت ✓';
      }
    }
    if (cfg.kind === 'kill' && state.nightPending && state.nightPending.kill) {
      const t = state.players.find((p) => p.id === state.nightPending.kill);
      if (t) $('action-target').textContent = `اختيارك: ${t.name}`;
    }
    if (cfg.kind === 'heal' && state.nightPending && state.nightPending.heal) {
      const t = state.players.find((p) => p.id === state.nightPending.heal);
      if (t) $('action-target').textContent = `تحمي: ${t.name} ✓`;
    }
    if (cfg.kind === 'check' && state.nightPending && state.nightPending.check) {
      const t = state.players.find((p) => p.id === state.nightPending.check);
      if (t) $('action-target').textContent = `فحصت: ${t.name} ✓`;
    }
  }

  function confirmAction() {
    const state = GameUI.state;
    if (!state || !GameUI.selected || !GameUI.onAction) return;
    const cfg = dockConfig(state);
    if (!cfg.enabled) return;
    GameUI.onAction(cfg.kind, GameUI.selected);
    GameUI.selected = null;
    renderPlayers(state);
    renderDock(state);
  }

  /* ---------------- chat ---------------- */

  function addLog(entry) {
    GameUI.logs.push(entry);
    if (GameUI.logs.length > 300) GameUI.logs.splice(0, GameUI.logs.length - 300);
    if (entry.channel === GameUI.activeChannel || entry.channel === 'sys') {
      appendLine(entry);
    }
  }

  function addChat(msg) {
    addLog({
      channel: msg.channel || 'public',
      name: msg.name || '',
      text: msg.text || '',
      ts: msg.ts || Date.now(),
      from: msg.from,
    });
  }

  function addSys(text) {
    addLog({ channel: 'sys', name: '', text, ts: Date.now() });
  }

  function renderTabs(state) {
    const tabs = $('chat-tabs');
    const channels = state.chatChannels && state.chatChannels.length ? state.chatChannels.slice() : ['public'];
    if (state.phase === 'over' && !channels.includes('public')) channels.unshift('public');
    if (!channels.includes(GameUI.activeChannel)) {
      GameUI.activeChannel = channels.includes('public') ? 'public' : channels[0];
    }
    tabs.textContent = '';
    for (const ch of channels) {
      tabs.appendChild(
        el('button', {
          class: 'chat-tab' + (GameUI.activeChannel === ch ? ' active' : ''),
          type: 'button',
          role: 'tab',
          'aria-selected': GameUI.activeChannel === ch ? 'true' : 'false',
          dataset: { channel: ch },
          text: CHANNEL_LABELS[ch] || ch,
          onclick: () => {
            GameUI.activeChannel = ch;
            renderTabs(GameUI.state);
            renderLog();
          },
        })
      );
    }
    $('chat-state').textContent = CHANNEL_LABELS[GameUI.activeChannel] || '';
    const input = $('chat-input');
    const open = channels.includes(GameUI.activeChannel);
    input.disabled = !open;
    input.placeholder = GameUI.activeChannel === 'mafia' ? 'رسالة خاصة للمافيا…'
      : GameUI.activeChannel === 'dead' ? 'همسات المتفرجين…'
      : 'اكتب رسالة…';
  }

  function renderLog() {
    const log = $('chat-log');
    log.textContent = '';
    for (const entry of GameUI.logs) {
      if (entry.channel === GameUI.activeChannel || entry.channel === 'sys') appendLine(entry, log);
    }
    log.scrollTop = log.scrollHeight;
  }

  function appendLine(entry, container) {
    const log = container || $('chat-log');
    const time = new Date(entry.ts || Date.now());
    const stamp = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    const line = el('div', { class: 'chat-line', dataset: { channel: entry.channel } }, [
      entry.channel === 'sys'
        ? el('span', { text: entry.text })
        : el('span', null, [
            el('span', { class: 'chat-who', text: entry.name + ' ' }),
            el('span', { text: entry.text }),
            el('span', { class: 'chat-time', text: stamp }),
          ]),
    ]);
    log.appendChild(line);
    if (log.scrollHeight - log.scrollTop - log.clientHeight < 120) {
      log.scrollTop = log.scrollHeight;
    }
  }

  /* ---------------- curtain / reveal ---------------- */

  function announce(phase) {
    const meta = PHASES[phase];
    if (!meta || phase === 'over') return;
    const curtain = $('curtain');
    $('curtain-kicker').textContent = meta.kicker;
    $('curtain-title').textContent = meta.title;
    $('curtain-sub').textContent = meta.sub;
    curtain.hidden = false;
    curtain.classList.remove('is-leaving');
    void curtain.offsetWidth;
    clearTimeout(GameUI.curtainTimer);
    GameUI.curtainTimer = setTimeout(() => {
      curtain.classList.add('is-leaving');
      setTimeout(() => {
        curtain.hidden = true;
        curtain.classList.remove('is-leaving');
      }, 480);
    }, 1500);
  }

  function maybeRevealRole(state) {
    if (!state.you || state.phase !== 'night' || state.day !== 1) return;
    if (GameUI.seenRevealSeq === state.phaseSeq) return;
    GameUI.seenRevealSeq = state.phaseSeq;
    const role = ROLE_BY_ID[state.you.role];
    if (!role) return;
    const facePos = { mafia: 'center 6%', doctor: 'center 8%', detective: 'center 6%', citizen: 'center 6%' };
    const pos = facePos[role.id] || 'center 20%';
    $('role-reveal-suit').innerHTML = window.TM.roleImgTag(role.id, state.you.gender, 'object-position:' + pos);
    $('role-reveal-name').textContent = role.name;
    $('role-reveal-en').textContent = role.en;
    $('role-reveal-blurb').textContent = role.blurb;
    $('role-reveal-goal').textContent = 'هدفك: ' + role.goal;
    $('role-reveal').hidden = false;
  }

  function dismissReveal() {
    $('role-reveal').hidden = true;
  }

  /* ---------------- timer ---------------- */

  function startTimerLoop() {
    const fill = $('game-timer-fill');
    const num = $('game-timer-num');
    const box = $('game-timer');
    GameUI.timerHandle = setInterval(() => {
      const state = GameUI.state;
      if (!state || !state.endsAt) {
        fill.style.transform = 'scaleX(0)';
        num.textContent = '--';
        box.classList.remove('low');
        return;
      }
      const total = Math.max(1, state.phaseSeconds || 60);
      const left = (state.endsAt - Date.now()) / 1000;
      const ratio = Math.max(0, Math.min(1, left / total));
      fill.style.transform = `scaleX(${ratio})`;
      num.textContent = fmtClock(Math.max(0, left));
      box.classList.toggle('low', left <= 10 && left > 0);
    }, 200);
  }

  function applyDeath(msg) {
    const banner = $('death-banner');
    const img = $('death-img');
    const text = $('death-text');
    if (!GameUI.state) return;
    GameUI.state._dawn = msg;
    if (GameUI.state.phase === 'night' || GameUI.state.phase === 'over') return;

    if ((msg.cause === 'kill' || msg.cause === 'lynch') && msg.name) {
      showDeathCard(msg);
      banner.hidden = true;
      addSys(msg.text || '');
      return;
    }

    banner.hidden = false;
    banner.className =
      'death-banner' + (msg.cause === 'saved' ? ' safe' : ' calm' ? ' calm' : '');
    banner.className = 'death-banner' + (msg.cause === 'saved' ? ' safe' : ' calm');
    text.textContent = msg.text || '';
    img.hidden = true;
    img.style.display = 'none';
    addSys(msg.text || '');
  }

  function showDeathCard(msg) {
    const overlay = $('death-overlay');
    const cardImg = $('death-card-img');
    const cardInitials = $('death-card-initials');
    const cardName = $('death-card-name');
    const cardSub = $('death-card-sub');

    cardName.textContent = msg.name;
    cardSub.textContent = 'سقط في الظلام...';

    const victim = GameUI.state && GameUI.state.players && GameUI.state.players.find((p) => p.id === msg.playerId);
    if (victim && victim.avatar) {
      cardImg.src = victim.avatar;
      cardImg.hidden = false;
      cardInitials.hidden = true;
    } else {
      cardImg.hidden = true;
      cardInitials.hidden = false;
      cardInitials.textContent = window.TM.initials(msg.name || '');
    }

    overlay.hidden = false;
    const card = $('death-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';

    clearTimeout(GameUI.deathCardTimer);
    GameUI.deathCardTimer = setTimeout(() => {
      overlay.hidden = true;
    }, 5000);
  }

  function dismissDeathCard() {
    $('death-overlay').hidden = true;
    clearTimeout(GameUI.deathCardTimer);
  }

  function reset() {
    GameUI.logs = [];
    GameUI.selected = null;
    GameUI.state = null;
    GameUI.seenRevealSeq = -1;
    GameUI.lastPhaseSeq = -1;
    $('chat-log').textContent = '';
    $('players-grid').textContent = '';
    $('death-banner').hidden = true;
    dismissReveal();
  }

  GameUI.init = init;
  GameUI.show = show;
  GameUI.setRoom = setRoom;
  GameUI.addChat = addChat;
  GameUI.addSys = addSys;
  GameUI.applyDeath = applyDeath;
  GameUI.dismissReveal = dismissReveal;
  GameUI.reset = reset;

  window.GameUI = GameUI;
})();
