// Luật cờ tướng và cờ úp (cờ tướng úp). Hàng 0 ở trên (quân Đen), hàng 9 ở dưới (quân Đỏ).
// Quân: {s:'r'|'b', t:'K'|'A'|'E'|'R'|'H'|'C'|'P', h:ẩn?, slot:vai trò theo vị trí khi còn úp}
// K tướng, A sĩ, E tượng, R xe, H mã, C pháo, P tốt.
const BACK = ['R', 'H', 'E', 'A', 'K', 'A', 'E', 'H', 'R'];
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function createGame(kind = 'tuong', seed = 1) {
  const board = Array.from({ length: 10 }, () => Array(9).fill(null));
  const layout = [];
  for (const [s, back, cann, pawn] of [['b', 0, 2, 3], ['r', 9, 7, 6]]) {
    BACK.forEach((t, c) => layout.push([s, back, c, t]));
    for (const c of [1, 7]) layout.push([s, cann, c, 'C']);
    for (const c of [0, 2, 4, 6, 8]) layout.push([s, pawn, c, 'P']);
  }
  for (const [s, r, c, t] of layout) board[r][c] = { s, t, h: false, slot: t };
  if (kind === 'up') {
    const rand = rng(seed);
    for (const s of ['r', 'b']) {
      const cells = layout.filter(x => x[0] === s && x[3] !== 'K').map(x => [x[1], x[2]]);
      const types = cells.map(([r, c]) => board[r][c].t);
      for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
      cells.forEach(([r, c], i) => { const p = board[r][c]; p.slot = p.t; p.t = types[i]; p.h = true; });
    }
  }
  return { kind, board, turn: 'r', over: null, moves: 0 };
}

const eff = p => (p.h ? p.slot : p.t);
const inB = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
const inPalace = (s, r, c) => c >= 3 && c <= 5 && (s === 'b' ? r <= 2 : r >= 7);
const ownSide = (s, r) => (s === 'b' ? r <= 4 : r >= 5);
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KN = [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]];

// Các nước đi "thô" của quân tại (r,c) (chưa xét tự chiếu)
export function pseudo(board, r, c) {
  const p = board[r][c]; if (!p) return [];
  const out = [], e = eff(p), s = p.s;
  const add = (rr, cc) => { if (!inB(rr, cc)) return false; const q = board[rr][cc]; if (!q) { out.push([rr, cc]); return true; } if (q.s !== s) out.push([rr, cc]); return false; };
  if (e === 'K') { for (const [dr, dc] of ORTH) { const rr = r + dr, cc = c + dc; if (inB(rr, cc) && inPalace(s, rr, cc)) add(rr, cc); } }
  else if (e === 'A') { for (const dr of [-1, 1]) for (const dc of [-1, 1]) { const rr = r + dr, cc = c + dc; if (inB(rr, cc) && inPalace(s, rr, cc)) add(rr, cc); } }
  else if (e === 'E') { for (const dr of [-2, 2]) for (const dc of [-2, 2]) { const rr = r + dr, cc = c + dc; if (inB(rr, cc) && ownSide(s, rr) && !board[r + dr / 2][c + dc / 2]) add(rr, cc); } }
  else if (e === 'R') { for (const [dr, dc] of ORTH) { let rr = r + dr, cc = c + dc; while (inB(rr, cc)) { if (!add(rr, cc)) break; rr += dr; cc += dc; } } }
  else if (e === 'H') { for (const [dr, dc] of KN) { const leg = Math.abs(dr) === 2 ? [r + dr / 2, c] : [r, c + dc / 2]; const rr = r + dr, cc = c + dc; if (inB(rr, cc) && !board[leg[0]][leg[1]]) add(rr, cc); } }
  else if (e === 'C') {
    for (const [dr, dc] of ORTH) {
      let rr = r + dr, cc = c + dc;
      while (inB(rr, cc) && !board[rr][cc]) { out.push([rr, cc]); rr += dr; cc += dc; }
      rr += dr; cc += dc; // bỏ qua quân làm ngòi
      while (inB(rr, cc)) { const q = board[rr][cc]; if (q) { if (q.s !== s) out.push([rr, cc]); break; } rr += dr; cc += dc; }
    }
  } else if (e === 'P') {
    const fwd = s === 'r' ? -1 : 1; add(r + fwd, c);
    if (!ownSide(s, r)) { add(r, c - 1); add(r, c + 1); }
  }
  return out;
}

function findK(board, s) { for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const p = board[r][c]; if (p && p.t === 'K' && p.s === s) return [r, c]; } return null; }
function kingsFacing(board) {
  const a = findK(board, 'b'), b = findK(board, 'r'); if (!a || !b || a[1] !== b[1]) return false;
  for (let r = a[0] + 1; r < b[0]; r++) if (board[r][a[1]]) return false;
  return true;
}
function attacked(board, pos, by) {
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const p = board[r][c]; if (p && p.s === by && pseudo(board, r, c).some(([rr, cc]) => rr === pos[0] && cc === pos[1])) return true; }
  return false;
}
export const isCheck = (game, side) => { const k = findK(game.board, side); return !!k && attacked(game.board, k, side === 'r' ? 'b' : 'r'); };

export function movesFrom(game, r, c) {
  const b = game.board, p = b[r][c]; if (!p || p.s !== game.turn) return [];
  const res = [];
  for (const [rr, cc] of pseudo(b, r, c)) {
    const cap = b[rr][cc]; b[rr][cc] = p; b[r][c] = null;
    const k = findK(b, p.s);
    const ok = k && !kingsFacing(b) && !attacked(b, k, p.s === 'r' ? 'b' : 'r');
    b[r][c] = p; b[rr][cc] = cap;
    if (ok) res.push([rr, cc]);
  }
  return res;
}
export function allMoves(game) {
  const out = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) if (game.board[r][c]?.s === game.turn) for (const to of movesFrom(game, r, c)) out.push({ from: [r, c], to });
  return out;
}
export function isLegal(game, from, to) { return !game.over && movesFrom(game, from[0], from[1]).some(([r, c]) => r === to[0] && c === to[1]); }

// Thực hiện nước đi (đã kiểm tra hợp lệ). Quân úp được lật sau khi đi.
export function play(game, from, to) {
  const b = game.board, p = b[from[0]][from[1]], captured = b[to[0]][to[1]];
  let flipped = false; if (p.h) { p.h = false; flipped = true; }
  b[to[0]][to[1]] = p; b[from[0]][from[1]] = null;
  const mover = game.turn; game.turn = mover === 'r' ? 'b' : 'r'; game.moves++;
  game.last = { from, to, captured, flipped, piece: p };
  if (!allMoves(game).length) game.over = { winner: mover, reason: isCheck(game, game.turn) ? 'chiếu bí' : 'hết nước đi' };
  return game.last;
}
export function perft(game, depth) {
  if (!depth) return 1;
  let n = 0;
  for (const m of allMoves(game)) {
    const b = game.board, p = b[m.from[0]][m.from[1]], cap = b[m.to[0]][m.to[1]], t = game.turn, wasH = p.h;
    p.h = false; b[m.to[0]][m.to[1]] = p; b[m.from[0]][m.from[1]] = null; game.turn = t === 'r' ? 'b' : 'r';
    n += perft(game, depth - 1);
    game.turn = t; b[m.from[0]][m.from[1]] = p; b[m.to[0]][m.to[1]] = cap; p.h = wasH;
  }
  return n;
}
export const GLYPH = { r: { K: '帥', A: '仕', E: '相', R: '俥', H: '傌', C: '炮', P: '兵' }, b: { K: '將', A: '士', E: '象', R: '車', H: '馬', C: '砲', P: '卒' } };
