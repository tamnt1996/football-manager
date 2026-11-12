// Dùng chung cho cả trình duyệt và server.
export const WORLD = { w: 4800, h: 640, y0: 445, y1: 585 };
export const LAKE = { y0: 292, y1: 392 };
export const clampPos = (x, y) => [Math.min(WORLD.w - 30, Math.max(30, x)), Math.min(WORLD.y1, Math.max(WORLD.y0, y))];
export const clampLake = (x, y) => [Math.min(WORLD.w - 60, Math.max(60, x)), Math.min(LAKE.y1, Math.max(LAKE.y0, y))];
export function evaluate(guess, answer) {
  const res = Array(guess.length).fill('no'), left = {};
  for (let i = 0; i < guess.length; i++) { if (guess[i] === answer[i]) res[i] = 'ok'; else left[answer[i]] = (left[answer[i]] || 0) + 1; }
  for (let i = 0; i < guess.length; i++) if (res[i] === 'no' && left[guess[i]] > 0) { res[i] = 'mid'; left[guess[i]]--; }
  return res;
}
export const NAME_RE = /^[\p{L}\p{N}_ ]{3,16}$/u;
export const COLORS = ['#ff7a45', '#4aa3ff', '#44c28a', '#c77dff', '#ffcc33', '#ff5d8f', '#5ad1d1', '#8d6e63'];
export const HATS = ['', '🧢', '👑', '🎀', '🎩', '🌸'];
