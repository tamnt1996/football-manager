const $ = s => document.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const MAX = 6, EPOCH = Date.UTC(2026, 10, 1);
const KEYS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const dayNum = () => { const n = new Date(); return Math.floor((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - EPOCH) / 864e5) + 1; };

let words = [], g = null; // g = current game {mode, word, guesses, cur, over, won}

function evaluate(guess, answer) {
  const res = Array(guess.length).fill('no'), left = {};
  for (let i = 0; i < guess.length; i++) { if (guess[i] === answer[i]) res[i] = 'ok'; else left[answer[i]] = (left[answer[i]] || 0) + 1; }
  for (let i = 0; i < guess.length; i++) if (res[i] === 'no' && left[guess[i]] > 0) { res[i] = 'mid'; left[guess[i]]--; }
  return res;
}

function newGame(mode) {
  let w;
  if (mode === 'daily') {
    w = words[((dayNum() * 2654435761) >>> 0) % words.length];
    const saved = load('daily-' + dayKey(new Date()), null);
    g = { mode, word: w, guesses: saved?.guesses || [], cur: '', over: false, won: false };
    g.won = g.guesses.includes(w.k); g.over = g.won || g.guesses.length >= MAX;
  } else {
    w = words[Math.floor(Math.random() * words.length)];
    g = { mode, word: w, guesses: [], cur: '', over: false, won: false };
  }
  $('#m-daily').classList.toggle('on', mode === 'daily'); $('#m-free').classList.toggle('on', mode === 'free');
  $('#hint').textContent = `Gợi ý: ${w.h} (${w.k.length} chữ cái, không dấu)`;
  buildBoard(); render(); $('#msg').textContent = '';
  if (g.over) finish(true);
}

function buildBoard() {
  const n = g.word.k.length, b = $('#board');
  b.innerHTML = Array.from({ length: MAX }, () => `<div class="row" style="grid-template-columns:repeat(${n},auto)">${'<div class="tile"></div>'.repeat(n)}</div>`).join('');
}
function render() {
  const rows = document.querySelectorAll('.row'), n = g.word.k.length, kstate = {};
  rows.forEach((row, r) => {
    const guess = g.guesses[r], typing = r === g.guesses.length && !g.over ? g.cur : '';
    const res = guess ? evaluate(guess, g.word.k) : null;
    [...row.children].forEach((t, i) => {
      t.textContent = guess ? guess[i] : typing[i] || '';
      t.className = 'tile' + (res ? ' ' + res[i] : typing[i] ? ' fill' : '');
      if (res) { const L = guess[i], rank = { no: 1, mid: 2, ok: 3 }; if (!kstate[L] || rank[res[i]] > rank[kstate[L]]) kstate[L] = res[i]; }
    });
  });
  document.querySelectorAll('.key[data-k]').forEach(k => { k.classList.remove('ok', 'mid', 'no'); if (kstate[k.dataset.k]) k.classList.add(kstate[k.dataset.k]); });
}
function buildKb() {
  $('#kb').innerHTML = KEYS.map(r => `<div class="krow">${[...r].map(c => c === '+' ? '<button class="key wide" data-k="Enter">Enter</button>' : c === '-' ? '<button class="key wide" data-k="Back">⌫</button>' : `<button class="key" data-k="${c}">${c}</button>`).join('')}</div>`).join('');
}
const say = (t, ms = 1800) => { $('#msg').textContent = t; if (ms) setTimeout(() => { if ($('#msg').textContent === t) $('#msg').textContent = ''; }, ms); };

function press(k) {
  if (!g || g.over || $('#dlg').open) return;
  const n = g.word.k.length;
  if (k === 'Back') g.cur = g.cur.slice(0, -1);
  else if (k === 'Enter') {
    if (g.cur.length < n) { const row = document.querySelectorAll('.row')[g.guesses.length]; row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); return say(`Cần đủ ${n} chữ cái`); }
    g.guesses.push(g.cur); g.cur = '';
    g.won = g.guesses[g.guesses.length - 1] === g.word.k; g.over = g.won || g.guesses.length >= MAX;
    if (g.mode === 'daily') save('daily-' + dayKey(new Date()), { guesses: g.guesses });
    render();
    if (g.over) { if (g.mode === 'daily') recordStats(); setTimeout(() => finish(false), 450); }
    return;
  } else if (/^[a-z]$/.test(k) && g.cur.length < n) g.cur += k;
  render();
}
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter') press('Enter'); else if (e.key === 'Backspace') press('Back'); else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
});
$('#kb').onclick = e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };

/* ---- stats ---- */
function recordStats() {
  const s = load('stats', { played: 0, wins: 0, streak: 0, best: 0, last: '', dist: [0, 0, 0, 0, 0, 0] });
  if (s.last === dayKey(new Date())) return;
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  s.played++; s.last = dayKey(new Date());
  if (g.won) { s.wins++; s.streak = (s.lastWin === dayKey(yest) ? s.streak : 0) + 1; s.best = Math.max(s.best, s.streak); s.dist[g.guesses.length - 1]++; s.lastWin = dayKey(new Date()); }
  else s.streak = 0;
  save('stats', s);
}
function shareText() {
  const grid = g.guesses.map(x => evaluate(x, g.word.k).map(r => ({ ok: '🟩', mid: '🟨', no: '⬛' }[r])).join('')).join('\n');
  return `Đoán Từ #${dayNum()} ${g.won ? g.guesses.length : 'X'}/${MAX}\n${grid}`;
}
async function share() {
  const text = shareText(), url = location.href.split('#')[0];
  try { if (navigator.share) return await navigator.share({ text, url }); } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); say('Đã chép kết quả, hãy dán để gửi bạn bè', 2500); } catch { say(text, 4000); }
}
function statsHtml() {
  const s = load('stats', { played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] }), mx = Math.max(1, ...s.dist);
  return `<div class="statrow"><div><b>${s.played}</b><span>Đã chơi</span></div><div><b>${s.played ? Math.round(s.wins / s.played * 100) : 0}%</b><span>Thắng</span></div><div><b>${s.streak}</b><span>Chuỗi thắng 🔥</span></div><div><b>${s.best}</b><span>Chuỗi dài nhất</span></div></div>
  ${s.dist.map((n, i) => `<div class="dist">${i + 1}<i class="${g?.won && g.mode === 'daily' && g.guesses.length === i + 1 ? 'hi' : ''}" style="width:${Math.max(8, n / mx * 100)}%">${n}</i></div>`).join('')}`;
}
function countdown() { const n = new Date(), t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const s = Math.floor((t - n) / 1000); return `${Math.floor(s / 3600)} giờ ${Math.floor(s % 3600 / 60)} phút`; }
function finish(silent) {
  const d = $('#dlgbody');
  d.innerHTML = `<h2>${g.won ? '🎉 Chính xác!' : '😅 Hết lượt rồi'}</h2><div class="reveal">${g.word.w}</div><p style="margin:0;text-align:center" class="hint">${g.word.h}</p>
  ${g.mode === 'daily' ? statsHtml() + `<p class="hint">Từ mới sau ${countdown()} nữa</p>` : ''}
  <div class="actions">${g.mode === 'daily' ? '<button id="x-share" class="primary">Chia sẻ</button>' : ''}<button id="x-free">Chơi tự do</button><button id="x-close">Đóng</button></div>`;
  if (g.mode === 'daily') $('#x-share').onclick = share;
  $('#x-free').onclick = () => { $('#dlg').close(); newGame('free'); };
  $('#x-close').onclick = () => $('#dlg').close();
  $('#dlg').showModal();
}
$('#b-stats').onclick = () => {
  $('#dlgbody').innerHTML = `<h2>Thống kê</h2>${statsHtml()}<div class="actions"><button id="x-close">Đóng</button></div>`;
  $('#x-close').onclick = () => $('#dlg').close(); $('#dlg').showModal();
};
$('#b-help').onclick = () => {
  $('#dlgbody').innerHTML = `<h2>Cách chơi</h2><p style="margin:0">Đoán từ tiếng Việt <b>không dấu</b> trong ${MAX} lượt. Có gợi ý ở trên bảng. Gõ đủ số chữ rồi bấm Enter.</p>
  <div class="legend"><div class="tile ok">a</div> Đúng chữ, đúng vị trí</div>
  <div class="legend"><div class="tile mid">b</div> Có trong từ nhưng sai vị trí</div>
  <div class="legend"><div class="tile no">c</div> Không có trong từ</div>
  <p style="margin:0" class="hint">Ví dụ: "gia đình" nhập là <b>giadinh</b> (bỏ dấu, bỏ khoảng trắng). Mỗi ngày có một từ mới.</p>
  <div class="actions"><button id="x-close" class="primary">Chơi thôi!</button></div>`;
  $('#x-close').onclick = () => { $('#dlg').close(); save('seenHelp', 1); }; $('#dlg').showModal();
};
$('#m-daily').onclick = () => newGame('daily');
$('#m-free').onclick = () => newGame('free');

buildKb();
fetch('data/words.json?v=3').then(r => r.json()).then(d => { words = d; newGame('daily'); if (!load('seenHelp', 0)) $('#b-help').click(); })
  .catch(() => { $('#msg').textContent = 'Không tải được dữ liệu từ.'; });
