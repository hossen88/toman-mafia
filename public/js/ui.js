/* TOMAN MAFIA — shared helpers & role data */
(function () {
  'use strict';

  const ROLES = [
    {
      id: 'mafia',
      name: 'المافيا',
      en: 'MAFIA',
      suit: '♠',
      kicker: 'LIVE IN THE SHADOWS',
      blurb: 'في الليل تختار ضحيتك، ونهارًا تخفي وجهك بينهم وتصوّت بذكاء.',
      goal: 'اجعل عدد المافيا ≥ بقية المدينة.',
    },
    {
      id: 'doctor',
      name: 'الطبيب',
      en: 'DOCTOR',
      suit: '♥',
      kicker: 'EVERY LIFE COUNTS',
      blurb: 'كل ليلة تحمي شخصًا واحدًا من شرّ المافيا — قد تكون أنت.',
      goal: 'احمِ المدينة حتى تُبيد المافيا.',
    },
    {
      id: 'detective',
      name: 'المحقق',
      en: 'DETECTIVE',
      suit: '♦',
      kicker: 'FOLLOW THE EVIDENCE',
      blurb: 'في كل ليلة تفحص شخصًا واحدًا وتعرف حقيقته قبل الجميع.',
      goal: 'اكشف المافيا وسلّم المدينة حكمها.',
    },
    {
      id: 'citizen',
      name: 'المواطن',
      en: 'CITIZEN',
      suit: '♣',
      kicker: 'ONE VOICE, ONE VOTE',
      blurb: 'لا سلاح لك سوى عينيك وصوتك في النهار. استخدمهما.',
      goal: 'اقرأ الغرفة واصطد الخونة بالتصويت.',
    },
  ];

  const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));

  const ARCH = 'M14 320V124a106 106 0 0 1 212 0v196z';

  const INK = '#0d0d0f';

  function comicPortrait(bgA, bgB, accent, body) {
    return (
      '<svg viewBox="0 0 240 320" aria-hidden="true" stroke-linejoin="round" stroke-linecap="round">' +
      '<defs>' +
      '<linearGradient id="bg" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="' + bgA + '"/><stop offset="1" stop-color="' + bgB + '"/></linearGradient>' +
      '<radialGradient id="glow" cx=".5" cy=".68" r=".8"><stop offset="0" stop-color="' + accent + '" stop-opacity=".28"/><stop offset="1" stop-color="' + accent + '" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="vig" cx=".5" cy=".4" r=".9"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>' +
      '<clipPath id="arch"><path d="' + ARCH + '"/></clipPath>' +
      '<pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0v22" fill="none" stroke="#fff" stroke-opacity=".045" stroke-width="1"/></pattern>' +
      '</defs>' +
      '<g clip-path="url(#arch)">' +
      '<rect width="240" height="320" fill="url(#bg)"/>' +
      '<rect width="240" height="320" fill="url(#grid)"/>' +
      '<rect width="240" height="320" fill="url(#glow)"/>' +
      body +
      '<rect width="240" height="320" fill="url(#vig)"/>' +
      '</g>' +
      '<path d="' + ARCH + '" fill="none" stroke="rgba(238,234,226,.2)" stroke-width="1.6"/>' +
      '</svg>'
    );
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  const ROLE_ART = {
    mafia: comicPortrait('#1c0f14', '#080608', '#a51538',
      // suit body
      '<path d="M8 320c2-88 30-128 74-138l38 24 38-24c44 10 72 50 74 138z" fill="#141418" stroke="' + INK + '" stroke-width="3.5"/>' +
      // jacket left
      '<path d="M56 196c-14 16-24 50-26 124h58l-18-96z" fill="#1a1a20" stroke="' + INK + '" stroke-width="3"/>' +
      // jacket right
      '<path d="M184 196c14 16 24 50 26 124h-58l18-96z" fill="#1a1a20" stroke="' + INK + '" stroke-width="3"/>' +
      // lapels
      '<path d="M88 194l32 36 32-36-14-8h-36z" fill="#22222a" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M88 194l-8 60 40 28v-72z" fill="#101014" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M152 194l8 60-40 28v-72z" fill="#101014" stroke="' + INK + '" stroke-width="2.5"/>' +
      // shirt
      '<path d="M98 200l22 26 22-26-8-6h-28z" fill="#d8d4cc" stroke="' + INK + '" stroke-width="2"/>' +
      // tie
      '<path d="M120 224l-10 8 10 10 10-10z" fill="#7a1028" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M110 238l-5 78 15 16 15-16-5-78-10-6z" fill="#8a1230" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M125 238l5 78-15 16v-94z" fill="#6a0e24" stroke="' + INK + '" stroke-width="2"/>' +
      // pocket square
      '<path d="M64 240l12-4 4 12-14 2z" fill="#8a1230" stroke="' + INK + '" stroke-width="1.5"/>' +
      // neck
      '<path d="M102 180h36v30c0 10-36 10-36 0z" fill="#b8845e" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M102 180h36v12c-10 8-26 8-36 0z" fill="#8a5c3c" stroke="none"/>' +
      // head
      '<ellipse cx="120" cy="146" rx="46" ry="52" fill="#c99870" stroke="' + INK + '" stroke-width="3.5"/>' +
      // jaw shadow
      '<path d="M148 112c10 16 14 38 12 58-3 24-14 42-30 50 20-4 34-24 38-50 3-22-3-42-20-58z" fill="#000" opacity=".18"/>' +
      // stubble beard
      '<path d="M82 158c2 36 18 54 38 58 20-4 36-22 38-58-6 18-20 30-38 30s-32-12-38-30z" fill="#2a1e14" opacity=".85"/>' +
      '<path d="M90 172c4 22 14 34 30 38 16-4 26-16 30-38-8 12-18 18-30 18s-22-6-30-18z" fill="#1a120c"/>' +
      // mustache
      '<path d="M102 174c5-5 12-6 18-3 6-3 13-2 18 3-5 4-12 5-18 2-6 3-13 2-18-2z" fill="' + INK + '"/>' +
      // ears
      '<ellipse cx="74" cy="148" rx="8" ry="14" fill="#c99870" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<ellipse cx="166" cy="148" rx="8" ry="14" fill="#c99870" stroke="' + INK + '" stroke-width="2.5"/>' +
      // nose
      '<path d="M120 148v16" stroke="#8a5c3c" stroke-width="2.5"/>' +
      '<path d="M112 166c2 2 5 3 8 3s6-1 8-3" stroke="' + INK + '" stroke-width="2.5" fill="none"/>' +
      // mouth
      '<path d="M110 182c6 3 14 3 20 0" stroke="' + INK + '" stroke-width="2.5" fill="none"/>' +
      // sunglasses
      '<path d="M80 138h34a5 5 0 0 1 5 5v11a11 11 0 0 1-11 11h-19a11 11 0 0 1-11-11v-11a5 5 0 0 1 5-5z" fill="' + INK + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M126 138h34a5 5 0 0 1 5 5v11a11 11 0 0 1-11 11h-19a11 11 0 0 1-11-11v-11a5 5 0 0 1 5-5z" fill="' + INK + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M114 145h12" stroke="' + INK + '" stroke-width="4.5"/>' +
      '<path d="M80 142l-10-3M160 142l10-3" stroke="' + INK + '" stroke-width="3"/>' +
      '<path d="M86 143c3-4 9-6 13-5" stroke="#6a7684" stroke-width="2" opacity=".5"/>' +
      '<path d="M132 143c3-4 9-6 13-5" stroke="#6a7684" stroke-width="2" opacity=".5"/>' +
      // fedora shadow
      '<path d="M76 118h88v18c-12 9-28 11-44 11s-32-2-44-11z" fill="#000" opacity=".4"/>' +
      // fedora brim
      '<ellipse cx="120" cy="116" rx="80" ry="13" fill="' + INK + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<ellipse cx="120" cy="112" rx="80" ry="11" fill="#22222a" stroke="' + INK + '" stroke-width="2.5"/>' +
      // fedora crown
      '<path d="M72 111c2-42 18-60 48-60s46 18 48 60z" fill="#2a2a34" stroke="' + INK + '" stroke-width="3"/>' +
      '<path d="M90 62c-4 12-6 30-4 48 8-2 16-3 24-3s16 1 24 3c2-18 0-36-4-48-8-4-16-6-20-6s-12 2-20 6z" fill="#1e1e26" stroke="none"/>' +
      // band
      '<path d="M72 96h96v14H72z" fill="#7a1028" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M72 96h96v4H72z" fill="#94183c" stroke="none"/>'
    ),
    doctor: comicPortrait('#0e1e22', '#060c0e', '#1d8a96',
      // scrubs body
      '<path d="M10 320c3-82 34-118 98-130 64 12 95 48 98 130z" fill="#1a6a76" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M10 320c3-82 34-118 98-130v130z" fill="#155860" stroke="' + INK + '" stroke-width="2.5"/>' +
      // collar
      '<path d="M90 198l30 34 30-34-12-8h-36z" fill="#22808c" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M90 198l-10 8 8 44 28-18z" fill="#12525a" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M150 198l10 8-8 44-28-18z" fill="#12525a" stroke="' + INK + '" stroke-width="2"/>' +
      // zipper
      '<path d="M120 232v88" stroke="' + INK + '" stroke-width="4"/>' +
      '<path d="M120 232v88" stroke="#2aa0ac" stroke-width="1.5"/>' +
      // pockets
      '<rect x="46" y="256" width="36" height="30" fill="#155860" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M46 256h36v7H46z" fill="#0e444c" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<rect x="158" y="256" width="36" height="30" fill="#155860" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M158 256h36v7h-36z" fill="#0e444c" stroke="' + INK + '" stroke-width="1.5"/>' +
      // pen
      '<rect x="52" y="250" width="4" height="12" fill="#e8e4da" stroke="' + INK + '" stroke-width="1"/>' +
      // name tag
      '<rect x="150" y="220" width="32" height="10" rx="1" fill="#e8e4da" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<path d="M153 223h26M153 227h18" stroke="#1a6a76" stroke-width="1.2"/>' +
      // radio
      '<rect x="48" y="196" width="14" height="22" rx="2" fill="' + INK + '" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="50" y="199" width="10" height="5" fill="#3a4046" stroke="none"/>' +
      '<path d="M55 196v-8" stroke="' + INK + '" stroke-width="2.5"/>' +
      // stethoscope
      '<path d="M96 200c-14 32-4 60 22 70" stroke="' + INK + '" stroke-width="7" fill="none"/>' +
      '<path d="M96 200c-14 32-4 60 22 70" stroke="#3a444c" stroke-width="3" fill="none"/>' +
      '<path d="M144 200c2 20 0 38-8 50" stroke="' + INK + '" stroke-width="7" fill="none"/>' +
      '<circle cx="136" cy="268" r="11" fill="#b8bec6" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<circle cx="136" cy="268" r="5.5" fill="#8a929a" stroke="none"/>' +
      // neck
      '<path d="M102 178h36v30c0 10-36 10-36 0z" fill="#b8845e" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M102 178h36v12c-10 8-26 8-36 0z" fill="#8a5c3c" stroke="none"/>' +
      // head
      '<ellipse cx="120" cy="144" rx="44" ry="50" fill="#c99870" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M146 110c8 16 12 36 10 54-2 22-12 38-26 46 17-4 30-22 34-46 3-20-2-38-18-54z" fill="#000" opacity=".15"/>' +
      // ears
      '<ellipse cx="76" cy="146" rx="8" ry="13" fill="#c99870" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<ellipse cx="164" cy="146" rx="8" ry="13" fill="#c99870" stroke="' + INK + '" stroke-width="2.5"/>' +
      // brows
      '<path d="M94 130c6-5 14-5 18 2" stroke="' + INK + '" stroke-width="4" fill="none"/>' +
      '<path d="M128 132c6-6 14-6 18-1" stroke="' + INK + '" stroke-width="4" fill="none"/>' +
      // eyes
      '<path d="M96 144c4-5 13-5 17 0-4 5-13 5-17 0z" fill="#f0ece4" stroke="' + INK + '" stroke-width="2"/>' +
      '<ellipse cx="104" cy="144" rx="3.8" ry="4.2" fill="#3a2a1c" stroke="none"/>' +
      '<circle cx="104" cy="144" r="1.7" fill="' + INK + '"/>' +
      '<path d="M127 144c4-5 13-5 17 0-4 5-13 5-17 0z" fill="#f0ece4" stroke="' + INK + '" stroke-width="2"/>' +
      '<ellipse cx="136" cy="144" rx="3.8" ry="4.2" fill="#3a2a1c" stroke="none"/>' +
      '<circle cx="136" cy="144" r="1.7" fill="' + INK + '"/>' +
      // nose
      '<path d="M120 148v14" stroke="#8a5c3c" stroke-width="2.5"/>' +
      '<path d="M112 164c2 2 5 3 8 3s6-1 8-3" stroke="' + INK + '" stroke-width="2.5" fill="none"/>' +
      // mouth
      '<path d="M110 178c6 4 14 4 20 0" stroke="' + INK + '" stroke-width="2.5" fill="none"/>' +
      // surgical cap
      '<path d="M74 116c2-38 16-58 46-58s44 20 46 58z" fill="#22808c" stroke="' + INK + '" stroke-width="3"/>' +
      '<path d="M74 110h92v10H74z" fill="#1a6a76" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M74 110h92v3H74z" fill="#2aa0ac" stroke="none"/>' +
      // cross on cap
      '<path d="M100 80h14v-8h12v8h14v12h-14v8h-12v-8h-14z" fill="#e8e4da" stroke="' + INK + '" stroke-width="2"/>' +
      // cap fold
      '<path d="M88 74c8-6 20-9 32-9" stroke="#155860" stroke-width="2" fill="none" opacity=".7"/>'
    ),
    detective: comicPortrait('#1e1c14', '#0a0a06', '#6b5f46',
      // trench body
      '<path d="M6 320c4-86 36-124 98-136 62 12 94 50 98 136z" fill="#6b5f46" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M6 320c4-86 36-124 98-136v136z" fill="#5a5040" stroke="' + INK + '" stroke-width="2.5"/>' +
      // storm flap
      '<path d="M52 226c12-16 28-24 48-26v34c-18 2-34 12-44 26z" fill="#7d7154" stroke="' + INK + '" stroke-width="2.5"/>' +
      // collar
      '<path d="M86 198l34 30 34-30-12-10h-44z" fill="#4a4334" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M86 198l-12 54 50 26-30-76z" fill="#83765a" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M154 198l12 6-8 50-26-24z" fill="#83765a" stroke="' + INK + '" stroke-width="2.5"/>' +
      // shirt+tie
      '<path d="M98 204l22 24 22-24-8-6h-28z" fill="#26262c" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M120 226l-8 6 8 44 8-44z" fill="#6a1420" stroke="' + INK + '" stroke-width="2"/>' +
      // belt
      '<path d="M30 290h180v18H30z" fill="#2e2820" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<rect x="106" y="287" width="28" height="24" rx="3" fill="#8a8478" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<rect x="112" y="293" width="16" height="12" fill="#2e2820" stroke="' + INK + '" stroke-width="1.5"/>' +
      // epaulets
      '<path d="M44 218l26 8-4 10-26-8z" fill="#5d5340" stroke="' + INK + '" stroke-width="2"/>' +
      '<circle cx="54" cy="225" r="3.5" fill="' + INK + '" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<path d="M196 218l-26 8 4 10 26-8z" fill="#5d5340" stroke="' + INK + '" stroke-width="2"/>' +
      // neck
      '<path d="M102 178h36v30c0 10-36 10-36 0z" fill="#b8845e" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M102 178h36v12c-10 8-26 8-36 0z" fill="#8a5c3c" stroke="none"/>' +
      // head
      '<ellipse cx="120" cy="144" rx="44" ry="50" fill="#c99870" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M146 108c9 16 12 38 10 58-2 22-12 40-26 48 17-4 30-24 34-48 3-22-3-42-18-58z" fill="#000" opacity=".18"/>' +
      // stubble + mustache
      '<path d="M82 156c2 36 18 54 38 58 20-4 36-22 38-58-6 18-20 30-38 30s-32-12-38-30z" fill="#2a1e14" opacity=".8"/>' +
      '<path d="M98 174c6-7 14-8 22-4 8-4 16-3 22 4-6 6-14 7-22 3-8 4-16 3-22-3z" fill="' + INK + '"/>' +
      // ears
      '<ellipse cx="76" cy="146" rx="8" ry="13" fill="#c99870" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<ellipse cx="164" cy="146" rx="8" ry="13" fill="#c99870" stroke="' + INK + '" stroke-width="2.5"/>' +
      // brim shadow
      '<path d="M76 116h88v26c-12 10-28 12-44 12s-32-2-44-12z" fill="#000" opacity=".45"/>' +
      // brows angry
      '<path d="M92 134l20 6M148 134l-20 6" stroke="' + INK + '" stroke-width="4.5" stroke-linecap="round"/>' +
      // eyes
      '<path d="M96 148c4-4 13-4 17 1-4 4-13 3-17-1z" fill="#e8e2d6" stroke="' + INK + '" stroke-width="2"/>' +
      '<ellipse cx="104" cy="149" rx="3.6" ry="4" fill="#241a10" stroke="none"/>' +
      '<path d="M127 148c4-4 13-4 17 1-4 4-13 3-17-1z" fill="#e8e2d6" stroke="' + INK + '" stroke-width="2"/>' +
      '<ellipse cx="136" cy="149" rx="3.6" ry="4" fill="#241a10" stroke="none"/>' +
      // nose
      '<path d="M120 148v16l-8 5" stroke="' + INK + '" stroke-width="2.5" fill="none"/>' +
      '<circle cx="112" cy="170" r="1.5" fill="' + INK + '"/>' +
      // mouth
      '<path d="M108 188c8 4 16 4 24 0" stroke="' + INK + '" stroke-width="2.5" fill="none"/>' +
      // cigarette
      '<rect x="140" y="185.5" width="18" height="5" fill="#e8e4da" stroke="' + INK + '" stroke-width="1.2"/>' +
      '<path d="M158 188h6" stroke="#c44a28" stroke-width="4.5"/>' +
      '<path d="M164 183c7-9-4-13 3-22s-2-16 5-22" stroke="#cfd2d6" stroke-width="1.8" fill="none" opacity=".5"/>' +
      // fedora brim
      '<ellipse cx="120" cy="114" rx="76" ry="12" fill="' + INK + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<ellipse cx="120" cy="110" rx="76" ry="10" fill="#4a4434" stroke="' + INK + '" stroke-width="2.5"/>' +
      // crown
      '<path d="M72 109c2-40 18-56 48-56s44 16 46 56z" fill="#57503e" stroke="' + INK + '" stroke-width="3"/>' +
      '<path d="M92 62c-4 12-6 28-4 46 8-2 16-3 24-3s16 1 24 3c2-18 0-34-4-46-8-4-14-6-20-6s-12 2-20 6z" fill="#4a4434" stroke="none"/>' +
      // band
      '<path d="M72 94h96v14H72z" fill="#24221a" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M72 94h96v4H72z" fill="#14130e" stroke="none"/>'
    ),
    citizen: comicPortrait('#161a20', '#080a0e', '#3d4c5c',
      // jacket body
      '<path d="M12 320c3-78 34-112 96-124 62 12 93 46 96 124z" fill="#2c3540" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M12 320c3-78 34-112 96-124v124z" fill="#242c36" stroke="' + INK + '" stroke-width="2.5"/>' +
      // fold lines
      '<path d="M62 246c8 24 12 50 12 74" stroke="' + INK + '" stroke-width="2" fill="none" opacity=".5"/>' +
      '<path d="M178 246c-8 24-12 50-12 74" stroke="' + INK + '" stroke-width="2" fill="none" opacity=".5"/>' +
      // open collar
      '<path d="M88 198l32 34 32-34-12-8h-40z" fill="#242c36" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M88 198l-12 6 8 46 32-20z" fill="#38434f" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M152 198l12 6-8 46-32-20z" fill="#38434f" stroke="' + INK + '" stroke-width="2.5"/>' +
      // undershirt
      '<path d="M102 230l18 24 18-24-6 46h-24z" fill="#d8d2c8" stroke="' + INK + '" stroke-width="2"/>' +
      // button
      '<circle cx="120" cy="282" r="4" fill="' + INK + '" stroke="' + INK + '" stroke-width="1.5"/>' +
      // neck
      '<path d="M102 178h36v30c0 10-36 10-36 0z" fill="#b8845e" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M102 178h36v12c-10 8-26 8-36 0z" fill="#8a5c3c" stroke="none"/>' +
      // head
      '<ellipse cx="120" cy="144" rx="43" ry="49" fill="#c99870" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M145 110c8 14 11 32 9 50-2 22-11 36-25 44 16-4 29-20 33-44 3-20-2-36-17-50z" fill="#000" opacity=".14"/>' +
      // ears
      '<ellipse cx="77" cy="146" rx="8" ry="13" fill="#c99870" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<ellipse cx="163" cy="146" rx="8" ry="13" fill="#c99870" stroke="' + INK + '" stroke-width="2.5"/>' +
      // hair layered
      '<path d="M76 144c-4-42 16-66 44-66s48 24 44 66c-4-18-9-30-15-38-4 6-15 10-29 10s-25-4-29-10c-6 8-11 20-15 38z" fill="' + INK + '" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M86 114c8-12 22-18 36-16 12 2 22 10 27 20-10-8-22-12-35-11-10 1-20 3-28 7z" fill="#2a221a" stroke="none"/>' +
      // brows
      '<path d="M94 132c6-4 14-4 18 2" stroke="' + INK + '" stroke-width="3.8" fill="none"/>' +
      '<path d="M128 134c6-5 14-5 18-1" stroke="' + INK + '" stroke-width="3.8" fill="none"/>' +
      // eyes
      '<path d="M96 146c4-5 13-5 17 0-4 5-13 5-17 0z" fill="#f0ece4" stroke="' + INK + '" stroke-width="2"/>' +
      '<ellipse cx="104" cy="146" rx="3.8" ry="4.2" fill="#2e2014" stroke="none"/>' +
      '<circle cx="104" cy="146" r="1.6" fill="' + INK + '"/>' +
      '<path d="M127 146c4-5 13-5 17 0-4 5-13 5-17 0z" fill="#f0ece4" stroke="' + INK + '" stroke-width="2"/>' +
      '<ellipse cx="136" cy="146" rx="3.8" ry="4.2" fill="#2e2014" stroke="none"/>' +
      '<circle cx="136" cy="146" r="1.6" fill="' + INK + '"/>' +
      // light stubble
      '<path d="M88 168c4 26 16 38 32 42 16-4 28-16 32-42-8 14-18 20-32 20s-24-6-32-20z" fill="#2a1e14" opacity=".2"/>' +
      // nose
      '<path d="M120 148v14" stroke="#8a5c3c" stroke-width="2.5"/>' +
      '<path d="M113 164c2 2 4 3 7 3s5-1 7-3" stroke="' + INK + '" stroke-width="2.5" fill="none"/>' +
      // smile
      '<path d="M108 180c6 5 18 5 24 0" stroke="' + INK + '" stroke-width="2.8" fill="none"/>'
    ),
  };

  function roleArt(id) {
    return ROLE_ART[id] || '';
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c === null || c === undefined || c === false) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0] || '').join('') || '?';
  }

  let toastTimer = null;
  function toast(message, ms) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      node.hidden = true;
    }, ms || 3600);
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback(text));
    }
    return Promise.resolve(fallback(text));
  }

  function fallback(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  function fmtClock(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '--';
    const s = Math.ceil(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : String(r);
  }

  function pad3(n) {
    return String(n).padStart(3, '0');
  }

  function shareLink(code) {
    const url = new URL(location.href);
    url.hash = '';
    url.searchParams.set('room', code);
    return url.toString();
  }

  function readRoomFromUrl() {
    const fromQuery = new URLSearchParams(location.search).get('room');
    if (fromQuery) return fromQuery.toUpperCase().trim();
    return null;
  }

  function roleImg(roleId, gender) {
    const base = 'assets/roles/' + roleId;
    return gender === 'female' ? base + '-f.png' : base + '.png';
  }

  function roleImgTag(roleId, gender, extraStyle) {
    const src = roleImg(roleId, gender);
    const fallback = roleImg(roleId, 'male');
    const style = extraStyle ? ' style="' + extraStyle + '"' : '';
    const onerr = gender === 'female' ? ' onerror="this.onerror=null;this.src=\'' + fallback + '\'"' : '';
    return '<img src="' + src + '" alt="" loading="eager"' + style + onerr + '>';
  }

  window.TM = { ROLES, ROLE_BY_ID, ROLE_ART, roleArt, roleImg, roleImgTag, el, escapeHtml, initials, toast, copy, fmtClock, pad3, shareLink, readRoomFromUrl };
})();
