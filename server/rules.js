'use strict';

const ROLES = {
  mafia: {
    id: 'mafia',
    name: 'المافيا',
    en: 'MAFIA',
    suit: '♠',
    team: 'mafia',
    blurb: 'في الليل تختار ضحيتك، ونهارًا تخفي وجهك بينهم.',
    goal: 'اقتل حتى يصبح عددكم ≥ بقية المدينة.',
  },
  doctor: {
    id: 'doctor',
    name: 'الطبيب',
    en: 'DOCTOR',
    suit: '♥',
    team: 'town',
    blurb: 'كل ليلة تحمي شخصًا واحدًا من شر المافيا.',
    goal: 'احمِ المدينة حتى تُبيد المافيا.',
  },
  detective: {
    id: 'detective',
    name: 'المحقق',
    en: 'DETECTIVE',
    suit: '♦',
    team: 'town',
    blurb: 'في كل ليلة تفحص شخصًا وتعرف حقيقته.',
    goal: 'اكشف المافيا وسلّم المدينة حكمها.',
  },
  citizen: {
    id: 'citizen',
    name: 'المواطن',
    en: 'CITIZEN',
    suit: '♣',
    team: 'town',
    blurb: 'لا سلاح لك سوى عينيك وصوتك في النهار.',
    goal: 'اقرأ الغرفة، واصطد الخونة بالتصويت.',
  },
};

const ROLE_ORDER = ['mafia', 'doctor', 'detective', 'citizen'];

const DEFAULT_SETTINGS = {
  doctor: true,
  detective: true,
  revealVotes: true,
  healSelf: true,
  nightSec: 60,
  daySec: 90,
  voteSec: 45,
  dawnSec: 8,
};

const LIMITS = {
  minPlayers: 5,
  maxPlayers: 30,
  nightSec: [15, 300],
  daySec: [15, 600],
  voteSec: [10, 300],
  dawnSec: [3, 30],
};

function mafiaCountFor(n) {
  if (n >= 28) return 7;
  if (n >= 24) return 6;
  if (n >= 20) return 5;
  if (n >= 16) return 4;
  if (n >= 12) return 3;
  if (n >= 8) return 2;
  return 1;
}

function clampSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  s.doctor = !!s.doctor;
  s.detective = !!s.detective;
  s.revealVotes = !!s.revealVotes;
  s.healSelf = !!s.healSelf;
  for (const key of ['nightSec', 'daySec', 'voteSec', 'dawnSec']) {
    const [lo, hi] = LIMITS[key];
    let v = Number(s[key]);
    if (!Number.isFinite(v)) v = DEFAULT_SETTINGS[key];
    s[key] = Math.max(lo, Math.min(hi, Math.round(v)));
  }
  return s;
}

function buildRoleDeck(n, settings) {
  const deck = [];
  const mafia = mafiaCountFor(n);
  for (let i = 0; i < mafia; i++) deck.push('mafia');

  const specialSlots = Math.max(0, n - mafia - 1);
  let specials = 0;
  if (settings.doctor && specialSlots >= 1) {
    deck.push('doctor');
    specials++;
  }
  if (settings.detective && n - mafia - specials >= 2) {
    deck.push('detective');
    specials++;
  }
  while (deck.length < n) deck.push('citizen');
  return deck;
}

function shuffle(arr, rng) {
  const a = arr.slice();
  const rand = rng || Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assignRoles(players, settings, rng) {
  const deck = shuffle(buildRoleDeck(players.length, settings), rng);
  return players.map((p, i) => ({
    id: p.id,
    name: p.name,
    gender: p.gender || 'male',
    avatar: p.avatar || null,
    bot: !!p.bot,
    role: deck[i],
    alive: true,
    connected: p.connected !== false,
  }));
}

function winState(players) {
  const alive = players.filter((p) => p.alive);
  const mafia = alive.filter((p) => p.role === 'mafia').length;
  const town = alive.length - mafia;
  if (mafia === 0) return 'town';
  if (mafia >= town) return 'mafia';
  return null;
}

module.exports = {
  ROLES,
  ROLE_ORDER,
  DEFAULT_SETTINGS,
  LIMITS,
  mafiaCountFor,
  clampSettings,
  buildRoleDeck,
  assignRoles,
  winState,
  shuffle,
};
