// Giao diện bàn cờ tướng / cờ úp (vẽ bằng canvas), nối với mạng qua send().
import { createGame, movesFrom, isLegal, play, isCheck, GLYPH } from './xiangqi.js?v=5';

const $ = s => document.querySelector(s);

export function startChess({ kind, seed, mySide, peerName, send, onClose }) {
  const game = createGame(kind, seed);
  const cv = $('#ch-cv'), g = cv.getContext('2d');
  let sel = null, legal = [], cell = 40, dpr = 1, closed = false, ended = false;
  const peerSide = mySide === 'r' ? 'b' : 'r';
  const name = s => (s === 'r' ? 'Đỏ' : 'Đen');
  const toDisp = (r, c) => (mySide === 'r' ? [r, c] : [9 - r, 8 - c]);
  const fromDisp = (r, c) => (mySide === 'r' ? [r, c] : [9 - r, 8 - c]);

  $('#chess').hidden = false;
  $('#ch-title').textContent = `${kind === 'up' ? 'Cờ úp' : 'Cờ tướng'}: bạn (${name(mySide)}) vs ${peerName} (${name(peerSide)})`;
  $('#ch-leave').textContent = 'Đầu hàng';
  $('#ch-msg').textContent = kind === 'up' ? 'Cờ úp: quân úp đi theo vị trí đang đứng, đi xong mới lật ra.' : '';

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const avail = Math.min(innerWidth - 28, 460, (innerHeight - 230) * 0.9);
    cell = Math.max(28, Math.floor(avail / 9));
    cv.style.width = cell * 9 + 'px'; cv.style.height = cell * 10 + 'px';
    cv.width = cell * 9 * dpr; cv.height = cell * 10 * dpr;
  }
  const px = (r, c) => { const [dr, dc] = toDisp(r, c); return [cell / 2 + dc * cell, cell / 2 + dr * cell]; };

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#e9c98f'; g.fillRect(0, 0, cell * 9, cell * 10);
    g.strokeStyle = '#5a3d22'; g.lineWidth = 1.4;
    const x0 = cell / 2, y0 = cell / 2;
    for (let r = 0; r < 10; r++) { g.beginPath(); g.moveTo(x0, y0 + r * cell); g.lineTo(x0 + 8 * cell, y0 + r * cell); g.stroke(); }
    for (let c = 0; c < 9; c++) {
      g.beginPath();
      if (c === 0 || c === 8) { g.moveTo(x0 + c * cell, y0); g.lineTo(x0 + c * cell, y0 + 9 * cell); }
      else { g.moveTo(x0 + c * cell, y0); g.lineTo(x0 + c * cell, y0 + 4 * cell); g.moveTo(x0 + c * cell, y0 + 5 * cell); g.lineTo(x0 + c * cell, y0 + 9 * cell); }
      g.stroke();
    }
    for (const r0 of [0, 7]) { // cung tướng
      g.beginPath(); g.moveTo(x0 + 3 * cell, y0 + r0 * cell); g.lineTo(x0 + 5 * cell, y0 + (r0 + 2) * cell); g.moveTo(x0 + 5 * cell, y0 + r0 * cell); g.lineTo(x0 + 3 * cell, y0 + (r0 + 2) * cell); g.stroke();
    }
    g.lineWidth = 2.4; g.strokeRect(x0 - 4, y0 - 4, 8 * cell + 8, 9 * cell + 8); g.lineWidth = 1;
    g.fillStyle = '#7b5a36'; g.font = `bold ${cell * 0.42}px "KaiTi","STKaiti","SimSun",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const flip = mySide === 'b';
    g.fillText(flip ? '漢界' : '楚河', x0 + 2 * cell, y0 + 4.5 * cell); g.fillText(flip ? '楚河' : '漢界', x0 + 6 * cell, y0 + 4.5 * cell);
    // nước đi cuối
    if (game.last) for (const [r, c] of [game.last.from, game.last.to]) { const [x, y] = px(r, c); g.strokeStyle = '#2f7de1'; g.lineWidth = 2.5; g.strokeRect(x - cell * 0.47, y - cell * 0.47, cell * 0.94, cell * 0.94); }
    // quân cờ
    const inCk = isCheck(game, game.turn);
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
      const p = game.board[r][c]; if (!p) continue; const [x, y] = px(r, c), R = cell * 0.43;
      const color = p.s === 'r' ? '#c1272d' : '#1d1d1d';
      g.fillStyle = '#0003'; g.beginPath(); g.arc(x + 1.5, y + 2.5, R, 0, 7); g.fill();
      g.fillStyle = p.h ? '#9a6a3c' : '#f7e6bf'; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
      g.strokeStyle = p.h ? '#5d3b1e' : color; g.lineWidth = 2; g.beginPath(); g.arc(x, y, R - 3, 0, 7); g.stroke();
      if (p.h) { g.fillStyle = '#5d3b1e'; g.font = `bold ${cell * 0.42}px system-ui`; g.fillText('?', x, y + 1); g.strokeStyle = p.s === 'r' ? '#c1272d' : '#1d1d1d'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, R + 0.5, 0, 7); g.stroke(); }
      else { g.fillStyle = color; g.font = `bold ${cell * 0.5}px "KaiTi","STKaiti","SimSun",serif`; g.fillText(GLYPH[p.s][p.t], x, y + 1); }
      if (inCk && p.t === 'K' && p.s === game.turn) { g.strokeStyle = '#ff2d2d'; g.lineWidth = 3.5; g.beginPath(); g.arc(x, y, R + 3, 0, 7); g.stroke(); }
    }
    if (sel) { const [x, y] = px(sel[0], sel[1]); g.strokeStyle = '#1fa34a'; g.lineWidth = 3.5; g.beginPath(); g.arc(x, y, cell * 0.46, 0, 7); g.stroke(); }
    for (const [r, c] of legal) { const [x, y] = px(r, c), cap = game.board[r][c]; g.fillStyle = cap ? '#e0332a99' : '#1fa34a99'; g.beginPath(); g.arc(x, y, cap ? cell * 0.2 : cell * 0.14, 0, 7); g.fill(); }
  }

  function status() {
    if (game.over) {
      const won = game.over.winner === mySide;
      $('#ch-status').textContent = `${won ? '🎉 Bạn thắng' : '😅 Bạn thua'} (${game.over.reason})`;
    } else {
      const mine = game.turn === mySide;
      $('#ch-status').textContent = (mine ? '👉 Lượt của bạn' : `⏳ Lượt của ${peerName}`) + ` (${name(game.turn)})` + (isCheck(game, game.turn) ? ' · ⚠ Chiếu tướng!' : '');
    }
  }
  function finish() { if (ended) return; ended = true; $('#ch-leave').textContent = 'Đóng'; }

  function afterMove(res, byMe) {
    sel = null; legal = [];
    let note = '';
    if (res.flipped) note += `${byMe ? 'Bạn' : peerName} lật quân ${GLYPH[res.piece.s][res.piece.t]}. `;
    if (res.captured) note += `Ăn ${res.captured.h ? 'một quân úp' : GLYPH[res.captured.s][res.captured.t]}. `;
    if (note) $('#ch-msg').textContent = note.trim();
    if (game.over) finish();
    status(); draw();
  }

  cv.onpointerdown = e => {
    if (closed || game.over || game.turn !== mySide) return;
    const rect = cv.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
    const dc = Math.round((x - cell / 2) / cell), dr = Math.round((y - cell / 2) / cell);
    if (dr < 0 || dr > 9 || dc < 0 || dc > 8) return;
    const [r, c] = fromDisp(dr, dc), p = game.board[r][c];
    if (sel && legal.some(([lr, lc]) => lr === r && lc === c)) {
      const from = sel, res = play(game, from, [r, c]); send({ t: 'cm', from, to: [r, c] }); afterMove(res, true); return;
    }
    if (p && p.s === mySide) { sel = [r, c]; legal = movesFrom(game, r, c); } else { sel = null; legal = []; }
    draw();
  };

  size(); const onResize = () => { size(); draw(); }; addEventListener('resize', onResize);
  status(); draw();

  const api = {
    recv(m) {
      if (closed || game.over || game.turn !== peerSide) return;
      const ok = (a) => Array.isArray(a) && a.length === 2 && a.every(Number.isInteger);
      if (!ok(m.from) || !ok(m.to) || !game.board[m.from[0]]?.[m.from[1]] || !isLegal(game, m.from, m.to)) return;
      afterMove(play(game, m.from, m.to), false);
    },
    opponentGone(text) { if (game.over || closed) return; game.over = { winner: mySide, reason: text }; finish(); status(); draw(); },
    leave() { if (!game.over && !closed) send({ t: 'cr' }); api.close(); },
    close() { closed = true; removeEventListener('resize', onResize); cv.onpointerdown = null; $('#chess').hidden = true; onClose && onClose(); },
    get over() { return !!game.over; },
  };
  return api;
}
