// Dùng chung cho cả trình duyệt và server.
export const WORLD = {
  w: 1600, h: 1000,
  lake: { cx: 800, cy: 520, rx: 520, ry: 290 },
  // Cầu tàu: đi được trên mặt hồ
  walk: [{ x1: 770, y1: 760, x2: 830, y2: 840 }, { x1: 735, y1: 690, x2: 865, y2: 770 }],
};
export function inWater(x, y) {
  const { cx, cy, rx, ry } = WORLD.lake, dx = (x - cx) / rx, dy = (y - cy) / ry;
  if (dx * dx + dy * dy >= 1) return false;
  return !WORLD.walk.some(r => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2);
}
export const clampPos = (x, y) => [Math.min(WORLD.w - 20, Math.max(20, x)), Math.min(WORLD.h - 20, Math.max(50, y))];
export function evaluate(guess, answer) {
  const res = Array(guess.length).fill('no'), left = {};
  for (let i = 0; i < guess.length; i++) { if (guess[i] === answer[i]) res[i] = 'ok'; else left[answer[i]] = (left[answer[i]] || 0) + 1; }
  for (let i = 0; i < guess.length; i++) if (res[i] === 'no' && left[guess[i]] > 0) { res[i] = 'mid'; left[guess[i]]--; }
  return res;
}
export const NAME_RE = /^[\p{L}\p{N}_ ]{3,16}$/u;
export const COLORS = ['#ff7a45', '#4aa3ff', '#44c28a', '#c77dff', '#ffcc33', '#ff5d8f', '#5ad1d1', '#8d6e63'];
export const HATS = ['', '🧢', '👑', '🎀', '🎩', '🌸'];
