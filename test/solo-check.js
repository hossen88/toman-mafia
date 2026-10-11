'use strict';
const WebSocket = require('ws');

function testSolo() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3000/ws');
    let step = 0;
    let code = '';
    let playerId = '';

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'create', name: 'لاعب تجريبي', gender: 'male' }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      console.log('→', msg.type, msg.text || msg.phase || '');

      if (msg.type === 'welcome') {
        code = msg.code;
        playerId = msg.playerId;
        console.log('  كود الغرفة:', code);
        // Start solo game
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'start', solo: true }));
        }, 200);
      }

      if (msg.type === 'game' && msg.phase === 'night' && msg.day === 1) {
        console.log('  ✓ بدأت اللعبة! الدور:', msg.you?.roleName);
        // Advance through phases
        setTimeout(() => ws.send(JSON.stringify({ type: 'advance' })), 300);
      }

      if (msg.type === 'game' && msg.phase === 'dawn') {
        console.log('  ✓ مرحلة الفجر');
        setTimeout(() => ws.send(JSON.stringify({ type: 'advance' })), 300);
      }

      if (msg.type === 'game' && msg.phase === 'day') {
        console.log('  ✓ مرحلة النهار');
        setTimeout(() => ws.send(JSON.stringify({ type: 'advance' })), 300);
      }

      if (msg.type === 'game' && msg.phase === 'voting') {
        console.log('  ✓ مرحلة التصويت');
        // Vote for self (only option in solo)
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'vote', targetId: playerId }));
        }, 300);
      }

      if (msg.type === 'error') {
        console.log('  ✗ خطأ:', msg.message);
      }

      step++;
      if (step > 20) {
        console.log('\n✓ اختبار الوضع الفردي اكتمل');
        ws.close();
        resolve();
      }
    });

    ws.on('error', reject);
    setTimeout(() => { ws.close(); resolve(); }, 8000);
  });
}

testSolo().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
