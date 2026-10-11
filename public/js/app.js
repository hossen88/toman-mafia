/* TOMAN MAFIA — application controller */
(function () {
  'use strict';

  const { ROLES, ROLE_BY_ID, roleArt, el, toast, copy, shareLink, readRoomFromUrl, pad3, initials } = window.TM;
  const $ = (id) => document.getElementById(id);

  const App = {
    me: null, // { playerId, token, name }
    room: null,
    overShown: false,
    lastDawn: null,
  };

  const SESSION_KEY = 'tm-session-v1';
  const NAME_KEY = 'tm-name-v1';

  /* ================= storage ================= */

  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function saveSession() {
    if (!App.me || !App.room) return;
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ code: App.room.code, token: App.me.token, playerId: App.me.playerId, name: App.me.name })
      );
    } catch (_) {}
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  function savedName() {
    try {
      return localStorage.getItem(NAME_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function rememberName(name) {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch (_) {}
  }

  function savedGender() {
    try {
      return localStorage.getItem('tm_gender') || 'male';
    } catch (_) {
      return 'male';
    }
  }

  function rememberGender(gender) {
    try {
      localStorage.setItem('tm_gender', gender);
    } catch (_) {}
  }

  let pendingAvatar = null;

  function compressImage(file, maxW) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  function setupAvatarPick() {
    const pick = $('avatar-pick');
    const fileIn = $('avatar-file');
    const preview = $('avatar-preview');
    const empty = $('avatar-empty');
    const clear = $('avatar-clear');
    if (!pick) return;
    pick.addEventListener('click', (e) => {
      if (e.target === clear) return;
      fileIn.click();
    });
    pick.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      try {
        pendingAvatar = await compressImage(f, 160);
        preview.src = pendingAvatar;
        preview.hidden = false;
        empty.hidden = true;
        clear.hidden = false;
        try { localStorage.setItem('tm_avatar', pendingAvatar); } catch (_) {}
      } catch (_) {}
      fileIn.value = '';
    });
    clear.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingAvatar = null;
      preview.hidden = true;
      preview.src = '';
      empty.hidden = false;
      clear.hidden = true;
      try { localStorage.removeItem('tm_avatar'); } catch (_) {}
    });
    try {
      const saved = localStorage.getItem('tm_avatar');
      if (saved) {
        pendingAvatar = saved;
        preview.src = saved;
        preview.hidden = false;
        empty.hidden = true;
        clear.hidden = false;
      }
    } catch (_) {}
  }

  /* ================= screens ================= */

  function showScreen(name) {
    const appMode = name !== 'home';
    document.body.classList.toggle('app-mode', appMode);
    $('site-header').hidden = appMode;
    document.querySelector('main').hidden = appMode;
    document.querySelector('.site-footer').hidden = appMode;
    $('lobby').hidden = name !== 'lobby';
    $('game').hidden = name !== 'game';
    $('over').hidden = name !== 'over';
    if (name !== 'game') $('curtain').hidden = true;
  }

  /* ================= home build ================= */

  let activeRole = 0;

  function buildHome() {
    const selectors = $('role-selectors');
    const stage = $('stage-cards');
    const hand = $('role-cards');
    selectors.textContent = '';
    stage.textContent = '';
    hand.textContent = '';

    ROLES.forEach((role, i) => {
      selectors.appendChild(
        el('button', {
          class: 'role-selector' + (i === 0 ? ' active' : ''),
          type: 'button',
          'aria-pressed': i === 0 ? 'true' : 'false',
          'aria-label': role.name,
          dataset: { index: String(i) },
          onclick: () => setRole(i),
        }, [
          el('span', { class: 'sel-no', text: pad3(i + 1) }),
          el('span', { class: 'sel-suit', text: role.suit, 'aria-hidden': 'true' }),
          el('span', { class: 'sel-name' }, [role.name, el('small', { text: role.en })]),
        ])
      );

      stage.appendChild(
        el('div', { class: 'stage-card', dataset: { index: String(i) } }, [
          el('div', { class: 'sc-corner' }, [el('span', { text: pad3(i + 1) }), el('span', { text: role.suit })]),
          el('div', { class: 'sc-art', html: '<img src="assets/roles/' + role.id + '.png" alt="">' }),
          el('div', { class: 'sc-foot' }, [
            el('span', { class: 'sc-name', text: role.name }),
            el('span', { class: 'sc-en', text: role.en }),
          ]),
        ])
      );

      hand.appendChild(
        el('button', {
          class: 'story-card',
          type: 'button',
          'aria-label': 'اعرض دور ' + role.name,
          onclick: () => {
            setRole(i);
            document.getElementById('home').scrollIntoView({ behavior: 'smooth' });
            toast(`دور ${role.name}: ${role.goal}`, 4200);
          },
        }, [
          el('span', { class: 'story-corner' }, [pad3(i + 1), el('span', { text: role.suit })]),
          el('span', { class: 'story-art', html: '<img src="assets/roles/' + role.id + '.png" alt="">', 'aria-hidden': 'true' }),
          el('span', { class: 'story-kicker', text: role.kicker }),
          el('h3', { class: 'story-title' }, [role.name, el('small', { text: role.en })]),
          el('p', { class: 'story-blurb', text: role.blurb }),
          el('span', { class: 'story-action' }, ['GOAL', el('b', { text: '+' })]),
        ])
      );
    });

    const rules = [
      { n: '01', t: 'التوزيع', d: 'عند بدء اللعبة يوزّع الخادم الأدوار عشوائيًا. لا تعرف أحدًا، ولا يعرفك أحد.' },
      { n: '02', t: 'الليل', d: 'المافيا تختار ضحيتها في سرّ، الطبيب يحمي، والمحقق يفحص. البقية تنام.' },
      { n: '03', t: 'النهار', d: 'يكشف من مات، ثم يبدأ النقاش. اتهم، دافع، واضبط فخّك بلغة تحفظ ماء وجهك.' },
      { n: '04', t: 'الحكم', d: 'تصوّت المدينة على من تشنّ عليه الإعدام. الأكثر أصواتًا يُعدَّم، والتعادل يُفلته.' },
    ];
    const grid = $('rules-grid');
    grid.textContent = '';
    for (const r of rules) {
      grid.appendChild(
        el('div', null, [
          el('span', { text: r.n }),
          el('h3', { text: r.t }),
          el('p', { text: r.d }),
        ])
      );
    }

    setRole(0);
  }

  function setRole(index) {
    activeRole = index;
    document.querySelectorAll('.role-selector').forEach((node, i) => {
      node.classList.toggle('active', i === index);
      node.setAttribute('aria-pressed', i === index ? 'true' : 'false');
    });
    document.querySelectorAll('.stage-card').forEach((node, i) => {
      const rel = i - index;
      const wrapped = rel > ROLES.length / 2 ? rel - ROLES.length : rel < -ROLES.length / 2 ? rel + ROLES.length : rel;
      node.style.setProperty('--x', `${wrapped * 42}%`);
      node.style.setProperty('--y', `${Math.abs(wrapped) * 4}%`);
      node.style.setProperty('--r', `${wrapped * 7}deg`);
      node.style.setProperty('--s', String(1 - Math.abs(wrapped) * 0.08));
      node.style.setProperty('--o', String(Math.max(0.15, 1 - Math.abs(wrapped) * 0.45)));
      node.classList.toggle('active', i === index);
    });
    const prog = document.querySelector('.chapter-progress span');
    if (prog) prog.style.transform = `scaleX(${(index + 1) / ROLES.length})`;
    const cur = document.querySelector('.chapter-current');
    if (cur) cur.textContent = String(index + 1).padStart(2, '0');
    const num = document.querySelector('.scene-number');
    if (num) num.textContent = pad3(index + 1);
    const ghost = document.querySelector('.ghost-word');
    if (ghost) ghost.textContent = ROLE_BY_ID[ROLES[index].id].en;
  }

  /* ================= intro ================= */

  function runIntro(skipAll) {
    const intro = $('intro');
    const percent = $('intro-percent');
    const bar = $('intro-bar');
    const loader = $('intro-loader');
    const cues = [...document.querySelectorAll('.intro-title')];
    let raf = null;
    let done = false;

    function end() {
      if (done) return;
      done = true;
      if (raf) cancelAnimationFrame(raf);
      intro.classList.add('is-ending');
      setTimeout(() => {
        intro.hidden = true;
        document.body.classList.remove('intro-active');
      }, 620);
    }

    $('intro-skip').addEventListener('click', end);

    if (skipAll) {
      intro.hidden = true;
      document.body.classList.remove('intro-active');
      return;
    }

    const DURATION = 1600;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 2.2);
      const pct = Math.round(eased * 100);
      percent.textContent = pad3(pct);
      bar.setAttribute('aria-valuenow', String(pct));
      bar.style.setProperty('--load-progress', pct + '%');
      intro.style.setProperty('--load-progress', pct + '%');
      if (t < 1) raf = requestAnimationFrame(frame);
      else playTitles();
    }
    raf = requestAnimationFrame(frame);

    function playTitles() {
      intro.classList.add('is-playing');
      loader.classList.add('is-away');
      let i = 0;
      function next() {
        if (done) return;
        if (i > 0) cues[i - 1].classList.remove('is-visible');
        if (i >= cues.length) {
          setTimeout(end, 500);
          return;
        }
        cues[i].classList.add('is-visible');
        i++;
        setTimeout(next, 760);
      }
      next();
    }
  }

  /* ================= gate ================= */

  let gateMode = 'create';

  function openGate(mode, presetCode) {
    gateMode = mode;
    const dialog = $('gate');
    $('gate-code-field').hidden = mode !== 'join';
    $('gate-title').innerHTML = mode === 'create' ? 'أنشئ <em>غرفة</em>' : 'انضم بـ<em>رمز</em>';
    $('gate-sub').textContent =
      mode === 'create'
        ? 'اختر اسمًا يخيف أصدقاءك، وسنفتح غرفة خاصة برمز قصير.'
        : 'أدخل رمز الغرفة التي أرسلها لك صاحب اللعبة.';
    $('gate-submit-label').textContent = mode === 'create' ? 'إنشاء الغرفة' : 'دخول الغرفة';
    $('gate-error').hidden = true;
    $('gate-name').value = savedName();
    $('gate-code').value = presetCode || '';
    const savedG = savedGender();
    const gInput = document.querySelector('input[name="gender"][value="' + savedG + '"]');
    if (gInput) gInput.checked = true;
    $('gate-hint').textContent =
      mode === 'create'
        ? 'الحد الأدنى 5 لاعبين. شارك الرمز أو الرابط بعد إنشاء الغرفة.'
        : 'الرموز تتكون من 5 أحرف. تأكد من كتابتها بشكل صحيح.';
    if (!dialog.open) dialog.showModal();
    setTimeout(() => (mode === 'join' && !presetCode ? $('gate-code') : $('gate-name')).focus(), 60);
  }

  function closeGate() {
    const dialog = $('gate');
    if (dialog.open) dialog.close();
  }

  function submitGate(ev) {
    ev.preventDefault();
    const name = $('gate-name').value.trim();
    const code = $('gate-code').value.trim().toUpperCase();
    const genderInput = document.querySelector('input[name="gender"]:checked');
    const gender = genderInput ? genderInput.value : 'male';
    const avatar = pendingAvatar || undefined;
    if (!name) return;
    rememberName(name);
    rememberGender(gender);
    App.me = Object.assign(App.me || {}, { name, gender, avatar });
    if (gateMode === 'create') {
      Net.send({ type: 'create', name, gender, avatar });
    } else {
      if (code.length < 4) {
        showGateError('الرمز قصير جدًا. الرمز 5 أحرف.');
        return;
      }
      const session = loadSession();
      Net.send({ type: 'join', code, name, gender, avatar, token: session && session.code === code ? session.token : undefined });
    }
  }

  function showGateError(message) {
    const node = $('gate-error');
    node.textContent = message;
    node.hidden = false;
  }

  /* ================= lobby ================= */

  function renderLobby() {
    const room = App.room;
    if (!room) return;
    $('room-code').textContent = room.code;
    $('lobby-count').textContent = `${room.players.length} / 15`;

    const roster = $('lobby-roster');
    roster.textContent = '';
    room.players.forEach((p, i) => {
      const isYou = room.you && p.id === room.you.id;
      roster.appendChild(
        el('div', { class: 'roster-card' + (p.host ? ' host' : '') + (p.connected ? '' : ' off') }, [
          el('span', { class: 'roster-no', text: pad3(i + 1) }),
          el('div', null, [
            p.avatar
              ? el('img', { class: 'roster-avatar', src: p.avatar, alt: '' })
              : el('span', { class: 'roster-avatar', text: initials(p.name) }),
            el('div', { class: 'roster-name', text: p.name }),
            el('div', { class: 'roster-tags' }, [
              p.host ? el('span', { class: 'tag host-tag', text: 'المضيف' }) : null,
              isYou ? el('span', { class: 'tag you-tag', text: 'أنت' }) : null,
              p.connected ? null : el('span', { class: 'tag off-tag', text: 'غير متصل' }),
            ]),
          ]),
        ])
      );
    });

    const isHost = room.you && room.you.id === room.hostId;
    $('start-btn').hidden = !isHost;
    $('solo-test-btn').hidden = !isHost;
    const connected = room.players.filter((p) => p.connected).length;
    const note = $('lobby-note');
    if (isHost) {
      note.textContent =
        connected < 5
          ? `يلزم 5 لاعبين على الأقل لبدء اللعبة. الآن متصلون: ${connected}. انسخ الرابط وأرسله لاصدقائك.`
          : `الجميع جاهز (${connected} لاعبًا). اضغط «ابدأ اللعبة» لتوزيع الأدوار.`;
    } else {
      note.textContent = `بانتظار المضيف لبدء اللعبة... اللاعبون المتصلون: ${connected}.`;
    }

    renderSettings(room, isHost);
    renderDeckPreview(room.players.length);
  }

  const SETTING_DEFS = [
    { key: 'doctor', label: 'الطبيب', hint: 'حماية واحدة كل ليلة', type: 'toggle' },
    { key: 'detective', label: 'المحقق', hint: 'فحص كل ليلة', type: 'toggle' },
    { key: 'revealVotes', label: 'كشف الأصوات', hint: 'يظهر من صوّت على من بعد الحكم', type: 'toggle' },
    { key: 'healSelf', label: 'حماية الذات', hint: 'يسمح للطبيب باختيار نفسه', type: 'toggle' },
    { key: 'nightSec', label: 'مدة الليل', hint: 'ثوانٍ', type: 'range', min: 15, max: 180, step: 5 },
    { key: 'daySec', label: 'مدة النقاش', hint: 'ثوانٍ', type: 'range', min: 15, max: 300, step: 5 },
    { key: 'voteSec', label: 'مدة التصويت', hint: 'ثوانٍ', type: 'range', min: 10, max: 180, step: 5 },
    { key: 'dawnSec', label: 'مدة الفجر', hint: 'ثوانٍ', type: 'range', min: 3, max: 20, step: 1 },
  ];

  function renderSettings(room, isHost) {
    const list = $('settings-list');
    list.textContent = '';
    for (const def of SETTING_DEFS) {
      const value = room.settings[def.key];
      if (def.type === 'toggle') {
        const btn = el('button', {
          class: 'toggle',
          type: 'button',
          role: 'switch',
          'aria-checked': value ? 'true' : 'false',
          'aria-label': def.label,
          disabled: !isHost,
          onclick: () => {
            Net.send({ type: 'settings', patch: { [def.key]: !App.room.settings[def.key] } });
          },
        });
        list.appendChild(
          el('div', { class: 'setting-row' }, [
            el('span', { class: 'setting-label' }, [def.label, el('small', { text: def.hint })]),
            btn,
          ])
        );
      } else {
        const val = el('span', { class: 'range-val', text: value + 'ث' });
        const input = el('input', {
          type: 'range',
          min: String(def.min),
          max: String(def.max),
          step: String(def.step),
          value: String(value),
          disabled: !isHost,
          'aria-label': def.label,
          oninput: (ev) => {
            val.textContent = ev.target.value + 'ث';
          },
          onchange: (ev) => {
            Net.send({ type: 'settings', patch: { [def.key]: Number(ev.target.value) } });
          },
        });
        list.appendChild(
          el('div', { class: 'setting-row' }, [
            el('span', { class: 'setting-label' }, [def.label, el('small', { text: def.hint })]),
            el('div', { class: 'range-row' }, [input, val]),
          ])
        );
      }
    }
  }

  function mafiaCountFor(n) {
    if (n >= 12) return 3;
    if (n >= 8) return 2;
    return 1;
  }

  function renderDeckPreview(n) {
    const box = $('deck-preview');
    box.textContent = '';
    if (n < 5) {
      box.appendChild(el('p', { class: 'side-hint', text: 'يُبنى التوزيع تلقائيًا عند دخول 5 لاعبين.' }));
      return;
    }
    const mafia = mafiaCountFor(n);
    const specials = (App.room.settings.doctor ? 1 : 0) + (App.room.settings.detective && n - mafia >= 3 ? 1 : 0);
    const citizens = n - mafia - (App.room.settings.doctor ? 1 : 0) - (App.room.settings.detective && n - mafia >= 3 ? 1 : 0);
    const rows = [
      { suit: '♠', name: 'المافيا', count: mafia },
      App.room.settings.doctor ? { suit: '♥', name: 'الطبيب', count: 1 } : null,
      App.room.settings.detective && n - mafia >= 3 ? { suit: '♦', name: 'المحقق', count: 1 } : null,
      { suit: '♣', name: 'المواطنون', count: Math.max(0, citizens) },
    ].filter(Boolean);
    for (const r of rows) {
      box.appendChild(
        el('div', { class: 'deck-row' }, [
          el('span', { class: 'deck-suit', text: r.suit }),
          el('span', { text: r.name }),
          el('b', { text: '×' + r.count }),
        ])
      );
    }
  }

  /* ================= over ================= */

  function renderOver(msg) {
    App.overShown = true;
    const town = msg.winner === 'town';
    const title = $('over-title');
    title.textContent = town ? 'المدينة فازت.' : 'انتصرت المافيا.';
    title.className = 'over-title ' + (town ? 'win-town' : 'win-mafia');
    $('over-eyebrow').textContent = town ? 'THE CITY WOKE UP' : 'THE CITY WENT DARK';
    $('over-sub').textContent = town
      ? 'أُبيدت المافيا، وعاد الشارع إلى أهله. دورك كان: راجع من كان حولك.'
      : 'سيطرت المافيا على المدينة. من كان أذكى ليلًا — وآخر ضحكة نهارًا.';

    const grid = $('reveal-grid');
    grid.textContent = '';
    for (const p of msg.players || []) {
      grid.appendChild(
        el('div', { class: 'reveal-card' + (p.role === 'mafia' ? ' mafia' : '') + (p.alive ? '' : ' dead') }, [
          el('span', { class: 'reveal-suit', text: p.suit }),
          el('span', { class: 'reveal-name', text: p.name }),
          el('span', { class: 'reveal-role', text: p.roleName }),
          el('span', { class: 'reveal-state', text: p.alive ? 'ناجٍ' : 'سقط' }),
        ])
      );
    }
    const isHost = App.room && App.room.you && App.room.you.id === App.room.hostId;
    $('rematch-btn').hidden = !isHost;
    showScreen('over');
  }

  /* ================= network wiring ================= */

  function wireNet() {
    Net.onState((state) => {
      const pill = $('conn-pill');
      pill.dataset.state = state === 'on' ? 'on' : state === 'wait' ? 'wait' : 'off';
      pill.querySelector('span').textContent = state === 'on' ? 'متصل' : state === 'wait' ? 'جاري الاتصال…' : 'غير متصل';
    });

    Net.on('welcome', (msg) => {
      App.me = { playerId: msg.playerId, token: msg.token, name: (App.me && App.me.name) || savedName() || 'لاعب' };
      App.overShown = false;
      App.lastDawn = null;
      saveSession();
      closeGate();
      GameUI.reset();
      if (msg.code) {
        const url = new URL(location.href);
        url.searchParams.set('room', msg.code);
        history.replaceState(null, '', url.toString());
      }
      showScreen('lobby');
      if (msg.resumed) toast('تمت إعادة اتصالك بالغرفة.');
    });

    Net.on('room', (msg) => {
      App.room = msg;
      if (msg.you) App.me = { playerId: msg.you.id, token: msg.you.token, name: msg.you.name };
      saveSession();
      GameUI.setRoom(msg);
      renderLobby();
      if (msg.phase === 'lobby') {
        if (!App.overShown) showScreen('lobby');
      } else if (!App.overShown) {
        showScreen('game');
      }
    });

    Net.on('game', (msg) => {
      msg._dawn = App.lastDawn;
      if (msg.phase === 'night') App.lastDawn = null;
      GameUI.show(msg);
      if (msg.phase === 'over') {
        // game_over message carries the reveal; wait for it
      } else if (!App.overShown) {
        showScreen('game');
      }
    });

    Net.on('phase', () => {});

    Net.on('chat', (msg) => GameUI.addChat(msg));
    Net.on('sys', (msg) => GameUI.addSys(msg.text));
    Net.on('death', (msg) => {
      App.lastDawn = msg;
      if (GameUI.state) {
        GameUI.state._dawn = msg;
      }
      GameUI.applyDeath(msg);
    });

    Net.on('action_ack', (msg) => toast(msg.text, 2600));
    Net.on('check_result', (msg) => toast(msg.text, 6000));
    Net.on('role_ping', (msg) => toast(msg.text, 4200));
    Net.on('vote_tick', () => {});

    Net.on('game_over', (msg) => {
      App.overShown = true;
      renderOver(msg);
      GameUI.dismissReveal();
    });

    Net.on('game_cleared', () => {
      App.overShown = false;
      App.lastDawn = null;
      GameUI.reset();
      showScreen('lobby');
    });

    Net.on('error', (msg) => {
      const inGate = $('gate').open;
      if (inGate) showGateError(msg.message || 'حدث خطأ.');
      else toast(msg.message || 'حدث خطأ.');
    });

    Net.on('replaced', (msg) => {
      toast(msg.message || 'تم تسجيل دخولك من جهاز آخر.');
      clearSession();
    });

    Net.on('left', () => {
      App.room = null;
      App.me = null;
      App.overShown = false;
      clearSession();
      GameUI.reset();
      showScreen('home');
      const url = new URL(location.href);
      url.searchParams.delete('room');
      history.replaceState(null, '', url.toString());
    });

    Net.on('_close', () => {});
  }

  /* ================= actions ================= */

  function leaveRoom() {
    Net.send({ type: 'leave' });
  }

  function initActions() {
    document.querySelectorAll('[data-gate]').forEach((btn) => {
      btn.addEventListener('click', () => openGate(btn.dataset.gate));
    });
    $('gate-close').addEventListener('click', closeGate);
    $('gate-form').addEventListener('submit', submitGate);
    $('gate-code').addEventListener('input', (ev) => {
      ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    });
    setupAvatarPick();

    $('copy-code').addEventListener('click', async () => {
      if (!App.room) return;
      const ok = await copy(App.room.code);
      toast(ok ? 'تم نسخ الرمز.' : 'تعذّر النسخ. الرمز: ' + App.room.code);
    });
    $('copy-link').addEventListener('click', async () => {
      if (!App.room) return;
      const ok = await copy(shareLink(App.room.code));
      toast(ok ? 'تم نسخ الرابط. أرسله لاصدقائك.' : 'تعذّر النسخ.');
    });
    $('room-code').addEventListener('click', async () => {
      if (!App.room) return;
      const ok = await copy(App.room.code);
      toast(ok ? 'تم نسخ الرمز.' : 'تعذّر النسخ.');
    });

    $('lobby-leave').addEventListener('click', leaveRoom);
    $('over-leave').addEventListener('click', leaveRoom);
    $('start-btn').addEventListener('click', () => Net.send({ type: 'start' }));
    $('solo-test-btn').addEventListener('click', () => Net.send({ type: 'start', solo: true }));
    $('rematch-btn').addEventListener('click', () => Net.send({ type: 'restart' }));

    GameUI.onLeave = leaveRoom;
    GameUI.onAdvance = () => Net.send({ type: 'advance' });
    GameUI.onAction = (kind, targetId) => {
      if (kind === 'vote') Net.send({ type: 'vote', targetId });
      else Net.send({ type: 'night_action', kind, targetId });
    };
    GameUI.onChat = (text, channel) => Net.send({ type: 'chat', text, channel });

    $('role-reveal-close').addEventListener('click', () => GameUI.dismissReveal());

    window.addEventListener('scroll', () => {
      document.getElementById('site-header').classList.toggle('is-scrolled', window.scrollY > 12);
    }, { passive: true });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !$('role-reveal').hidden) GameUI.dismissReveal();
    });

    const hero = document.querySelector('.hero');
    if (hero && window.matchMedia('(pointer:fine)').matches) {
      hero.addEventListener('pointermove', (ev) => {
        const r = hero.getBoundingClientRect();
        const x = ((ev.clientX - r.left) / r.width - 0.5) * 26;
        const y = ((ev.clientY - r.top) / r.height - 0.5) * 18;
        hero.style.setProperty('--pointer-x', x.toFixed(1) + 'px');
        hero.style.setProperty('--pointer-y', y.toFixed(1) + 'px');
      });
    }
  }

  /* ================= boot ================= */

  function boot() {
    $('year').textContent = String(new Date().getFullYear());
    buildHome();
    GameUI.init();
    wireNet();
    initActions();

    const session = loadSession();
    const urlRoom = readRoomFromUrl();
    const resuming = !!(session && session.token && session.code);

    Net.connect();

    if (resuming) {
      App.me = { name: session.name, token: session.token, playerId: session.playerId };
      Net.send({ type: 'join', code: session.code, name: session.name, token: session.token });
      runIntro(false);
      setTimeout(() => {
        if (!App.room) toast('جاري استئناف جلستك...');
      }, 2500);
    } else {
      runIntro(false);
      if (urlRoom) {
        setTimeout(() => openGate('join', urlRoom), 1200);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
