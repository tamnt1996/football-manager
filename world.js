import { WORLD, inWater, clampPos, evaluate, NAME_RE, COLORS, HATS } from './shared.js';
import { createNet } from './net.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };

/* ================= Vẽ nhân vật ================= */
function drawAvatar(ctx, x, y, look, moving, t) {
  const bob = moving ? Math.sin(t * 14) * 2 : 0, step = moving ? Math.sin(t * 14) * 3 : 0;
  ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(x, y, 13, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a3b33'; // chân
  ctx.fillRect(x - 7 + step, y - 8, 5, 8); ctx.fillRect(x + 2 - step, y - 8, 5, 8);
  ctx.fillStyle = COLORS[look.c] || COLORS[0]; // thân
  ctx.beginPath(); ctx.roundRect(x - 11, y - 30 + bob, 22, 24, 7); ctx.fill();
  ctx.fillStyle = '#ffe0c2'; ctx.beginPath(); ctx.arc(x, y - 38 + bob, 11, 0, 7); ctx.fill(); // đầu
  ctx.fillStyle = '#3b2b25'; ctx.beginPath(); ctx.arc(x - 4, y - 39 + bob, 1.6, 0, 7); ctx.arc(x + 4, y - 39 + bob, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#c0735a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y - 35 + bob, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  const hat = HATS[look.a];
  if (hat) { ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(hat, x, y - 44 + bob); }
}

/* ================= Đăng nhập / nhân vật ================= */
const profile = load('ht-profile', { name: '', token: '', look: { c: 0, a: 0 } });
const look = { ...profile.look };
function drawPreview() {
  const c = $('#preview'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.save(); g.scale(1.6, 1.6); drawAvatar(g, 30, 62, look, false, 0); g.restore();
}
function buildPickers() {
  $('#l-colors').innerHTML = COLORS.map((c, i) => `<button data-c="${i}" style="background:${c}" class="${look.c === i ? 'on' : ''}" aria-label="Màu ${i + 1}"></button>`).join('');
  $('#l-hats').innerHTML = HATS.map((h, i) => `<button data-a="${i}" class="${look.a === i ? 'on' : ''}">${h || '∅'}</button>`).join('');
  drawPreview();
}
$('#l-colors').onclick = e => { const b = e.target.closest('[data-c]'); if (b) { look.c = +b.dataset.c; buildPickers(); } };
$('#l-hats').onclick = e => { const b = e.target.closest('[data-a]'); if (b) { look.a = +b.dataset.a; buildPickers(); } };
$('#l-name').value = profile.name; buildPickers();

/* ================= Mạng P2P ================= */
let net = null, me = null, joined = false, words = [];
const others = new Map(); // peerId -> {id,name,shown,look,x,y,tx,ty,bubble}
const ROOM = (() => { const p = new URLSearchParams(location.search).get('phong') || ''; return /^[a-zA-Z0-9-]{3,24}$/.test(p) ? p.toLowerCase() : 'cong-dong'; })();
const send = (m, to) => { if (net) net.send(m, to); };
const cleanLook = l => ({ c: Number.isInteger(l?.c) && l.c >= 0 && l.c < COLORS.length ? l.c : 0, a: Number.isInteger(l?.a) && l.a >= 0 && l.a < HATS.length ? l.a : 0 });
const hi = () => ({ t: 'hi', name: me.name, look: me.look, x: Math.round(me.x), y: Math.round(me.y) });
function recomputeNames() {
  const all = [me, ...others.values()].filter(Boolean), cnt = {};
  all.forEach(p => { const k = p.name.toLowerCase(); cnt[k] = (cnt[k] || 0) + 1; });
  all.forEach(p => { p.shown = cnt[p.name.toLowerCase()] > 1 ? `${p.name}·${p.id.slice(0, 3)}` : p.name; });
}
function setConn() {
  const n = others.size + 1;
  $('#conn').textContent = net.kind === 'local' ? `⚠ Chỉ chơi giữa các tab trên máy này (không tải được P2P) · ${n} người` : `🟢 Phòng "${ROOM}" · ${n} người`;
}

$('#l-go').onclick = async () => {
  const name = $('#l-name').value.trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(name)) return fail('Tên 3–16 ký tự, chỉ gồm chữ, số, khoảng trắng hoặc _');
  $('#l-go').disabled = true; $('#l-err').textContent = 'Đang kết nối…';
  try { net = await createNet('ht-' + ROOM); } catch (e) { return fail('Không kết nối được: ' + e.message); }
  fetch('data/words.json?v=4').then(r => r.json()).then(d => { words = d; }).catch(() => {});
  const [x, y] = [800 + Math.round(Math.random() * 200 - 100), 900];
  me = { id: net.selfId, name, look: { ...look }, x, y, tx: x, ty: y, target: null, bubble: null };
  Object.assign(profile, { name, look: me.look }); save('ht-profile', profile);
  net.on('join', id => send(hi(), id));
  net.on('leave', onLeave);
  net.on('msg', onMsg);
  joined = true; $('#login').hidden = true; $('#hud').hidden = false; $('#l-go').disabled = false;
  recomputeNames(); renderList(); setConn();
  log('', `Chào mừng ${me.name}! Bấm vào bản đồ để đi, bấm vào người khác để làm quen. Gửi link này cho bạn bè để cùng vào phòng.`);
  setTimeout(() => { if (!others.size) log('', 'Chưa thấy ai khác. Hãy gửi link cho bạn bè (nút "🔗 Mời bạn bè") rồi chờ vài giây nhé.'); }, 6000);
};
function fail(msg) { $('#l-err').textContent = msg; $('#l-go').disabled = false; }
$('#l-name').onkeydown = e => { if (e.key === 'Enter') $('#l-go').click(); };

function onLeave(id) {
  const o = others.get(id); if (!o) return;
  others.delete(id); recomputeNames(); renderList(); setConn(); log('', `${o.shown} đã rời hồ`);
  if (cardId === id) closeCard();
  if (duel && duel.peer === id && !duel.over) duelEnd(true, 'Đối thủ đã rời ván, bạn thắng!');
}
function onMsg(m, id) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hi') {
    const name = String(m.name || '').trim().replace(/\s+/g, ' ');
    if (!NAME_RE.test(name)) return;
    const [x, y] = clampPos(+m.x || 800, +m.y || 900), fresh = !others.has(id);
    const o = { id, name, look: cleanLook(m.look), x, y, tx: x, ty: y, bubble: null }; if (!fresh) Object.assign(o, { x: others.get(id).x, y: others.get(id).y });
    others.set(id, o); recomputeNames(); renderList(); setConn(); if (fresh) log('', `${o.shown} vừa đến hồ`); return;
  }
  const o = others.get(id); if (!o) return;
  switch (m.t) {
    case 'p': { const [x, y] = clampPos(+m.x || 0, +m.y || 0); if (!inWater(x, y)) { o.tx = x; o.ty = y; } break; }
    case 'c': { const text = String(m.text || '').slice(0, 120); if (text) { o.bubble = { text, until: performance.now() + 6000 }; log(o.shown, text); } break; }
    case 'e': if (['👋', '😂', '❤️', '👍', '🎉'].includes(m.e)) o.bubble = { text: m.e, until: performance.now() + 2500, emoji: true }; break;
    case 'inv': if (duel) { send({ t: 'rep', accept: false, busy: true }, id); } else showInvite(o); break;
    case 'rep': if (outInvite === id) { outInvite = null; if (m.accept) { /* chờ gs từ người mời */ startDuelAsHost(o); } else toast(m.busy ? `${o.shown} đang bận` : `${o.shown} chưa muốn chơi lúc này`); } break;
    case 'gs': if (acceptedFrom === id && !duel) { acceptedFrom = null; const w = words[+m.wi]; if (w) startDuel(o, w); } break;
    case 'gc': if (duel && duel.peer === id && Array.isArray(m.colors) && m.colors.length === duel.len) { duel.oppRows.push(m.colors.map(c => (['ok', 'mid', 'no'].includes(c) ? c : 'no'))); renderDuel(); } break;
    case 'gd': if (duel && duel.peer === id && !duel.over) { if (m.solved) duelEnd(false, `${o.shown} đoán đúng trước.`); else { duel.oppDone = true; if (duel.myDone) duelEnd(null, 'Cả hai đều hết lượt.'); } } break;
    case 'gl': if (duel && duel.peer === id && !duel.over) duelEnd(true, 'Đối thủ đã rời ván, bạn thắng!'); break;
  }
}

/* ================= HUD ================= */
function log(name, text) {
  const d = document.createElement('div');
  if (name) { const b = document.createElement('b'); b.textContent = name + ': '; d.append(b); }
  d.append(document.createTextNode(text)); $('#chatlog').append(d);
  while ($('#chatlog').children.length > 6) $('#chatlog').firstChild.remove();
  setTimeout(() => d.remove(), 20000);
}
function renderList() {
  const all = [me, ...others.values()].filter(Boolean);
  $('#n-online').textContent = all.length;
  $('#plist').innerHTML = all.map(p => `<div data-id="${esc(p.id)}">${p.id === me.id ? '⭐ ' : '• '}${esc(p.shown || p.name)}</div>`).join('');
}
$('#plist').onclick = e => { const d = e.target.closest('[data-id]'); if (d && d.dataset.id !== me.id) openCard(d.dataset.id); };
$('#chatform').onsubmit = e => { e.preventDefault(); const t = $('#chat').value.trim(); if (t) { me.bubble = { text: t, until: performance.now() + 6000 }; log(me.shown || me.name, t); send({ t: 'c', text: t }); } $('#chat').value = ''; $('#chat').blur(); };
$('#emotes').onclick = e => { const b = e.target.closest('button'); if (b) { me.bubble = { text: b.textContent, until: performance.now() + 2500, emoji: true }; send({ t: 'e', e: b.textContent }); } };
$('#b-share').onclick = async () => {
  const url = location.origin + location.pathname + (ROOM === 'cong-dong' ? '' : '?phong=' + ROOM);
  try { if (navigator.share) return await navigator.share({ title: 'Hồ Tây Online', text: 'Vào Hồ Tây chơi cùng mình nhé!', url }); } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Đã chép link, hãy gửi cho bạn bè'); } catch { toast(url); }
};
$('#b-room').onclick = () => { const code = Math.random().toString(36).slice(2, 8); location.href = location.pathname + '?phong=' + code; };

let cardId = null;
function openCard(id) {
  const p = others.get(id); if (!p) return; cardId = id;
  const c = $('#card'); c.hidden = false;
  c.innerHTML = `<b>${esc(p.shown)}</b><button class="primary" id="c-play">🔤 Mời chơi Đoán Từ</button><button id="c-close">Đóng</button>`;
  $('#c-play').onclick = () => { closeCard(); if (duel) return toast('Bạn đang trong ván chơi'); if (!words.length) return toast('Đang tải kho từ, thử lại sau giây lát'); outInvite = id; send({ t: 'inv' }, id); toast(`Đã gửi lời mời cho ${p.shown}`); setTimeout(() => { if (outInvite === id) { outInvite = null; } }, 30000); };
  $('#c-close').onclick = closeCard;
}
function closeCard() { cardId = null; $('#card').hidden = true; }
let inviteTimer = null, outInvite = null, acceptedFrom = null;
function showInvite(o) {
  const box = $('#invite'); box.hidden = false;
  box.innerHTML = `<div><b>${esc(o.shown)}</b> mời bạn chơi <b>Đoán Từ</b>!</div><div><button class="primary" id="i-yes">Chấp nhận</button> <button id="i-no">Từ chối</button></div>`;
  const done = acc => { clearTimeout(inviteTimer); box.hidden = true; if (acc && (duel || !words.length)) { send({ t: 'rep', accept: false, busy: true }, o.id); return; } if (acc) acceptedFrom = o.id; send({ t: 'rep', accept: acc }, o.id); };
  $('#i-yes').onclick = () => done(true); $('#i-no').onclick = () => done(false);
  clearTimeout(inviteTimer); inviteTimer = setTimeout(() => { box.hidden = true; }, 30000);
}

/* ================= Đấu Đoán Từ ================= */
const KEYROWS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];
let duel = null;
function startDuelAsHost(o) {
  if (duel || !words.length) return;
  const wi = Math.floor(Math.random() * words.length);
  send({ t: 'gs', wi }, o.id); startDuel(o, words[wi]);
}
function startDuel(o, w) {
  $('#invite').hidden = true; closeCard();
  duel = { peer: o.id, name: o.shown, word: w, len: w.k.length, max: 6, mine: [], cur: '', over: false, oppRows: [], myDone: false, oppDone: false };
  $('#duel').hidden = false; $('#d-title').textContent = `Đoán Từ: bạn vs ${o.shown}`;
  $('#d-hint').textContent = `Gợi ý: ${w.h} (${w.k.length} chữ cái, không dấu). Ai đoán đúng trước sẽ thắng!`;
  $('#d-me').textContent = 'Bạn'; $('#d-opp').textContent = o.shown; $('#d-msg').textContent = ''; $('#d-leave').textContent = 'Rời ván';
  const rows = '<div class="drow" style="grid-template-columns:repeat(' + duel.len + ',auto)">' + '<div class="tile"></div>'.repeat(duel.len) + '</div>';
  $('#d-board').innerHTML = rows.repeat(duel.max); $('#d-oppboard').innerHTML = rows.repeat(duel.max);
  $('#d-kb').innerHTML = KEYROWS.map(r => `<div class="krow">${[...r].map(c => c === '+' ? '<button class="key wide" data-k="Enter">Enter</button>' : c === '-' ? '<button class="key wide" data-k="Back">⌫</button>' : `<button class="key" data-k="${c}">${c}</button>`).join('')}</div>`).join('');
  renderDuel();
}
function renderDuel() {
  const rows = $('#d-board').children, orows = $('#d-oppboard').children;
  for (let r = 0; r < duel.max; r++) {
    const g = duel.mine[r], typing = r === duel.mine.length && !duel.over ? duel.cur : '';
    [...rows[r].children].forEach((t, i) => { t.textContent = g ? g.guess[i] : typing[i] || ''; t.className = 'tile' + (g ? ' ' + g.colors[i] : typing[i] ? ' fill' : ''); });
    [...orows[r].children].forEach((t, i) => { t.className = 'tile' + (duel.oppRows[r] ? ' ' + duel.oppRows[r][i] : ''); });
  }
  const best = {}, rank = { no: 1, mid: 2, ok: 3 };
  duel.mine.forEach(g => [...g.guess].forEach((L, i) => { if (!best[L] || rank[g.colors[i]] > rank[best[L]]) best[L] = g.colors[i]; }));
  document.querySelectorAll('#d-kb .key[data-k]').forEach(k => { k.classList.remove('ok', 'mid', 'no'); if (best[k.dataset.k]) k.classList.add(best[k.dataset.k]); });
}
function duelKey(k) {
  if (!duel || duel.over || duel.myDone || $('#duel').hidden) return;
  if (k === 'Back') duel.cur = duel.cur.slice(0, -1);
  else if (k === 'Enter') {
    if (duel.cur.length !== duel.len) { $('#d-msg').textContent = `Cần đủ ${duel.len} chữ cái`; return; }
    $('#d-msg').textContent = '';
    const guess = duel.cur, colors = evaluate(guess, duel.word.k); duel.cur = '';
    duel.mine.push({ guess, colors }); send({ t: 'gc', colors }, duel.peer);
    if (guess === duel.word.k) { duel.myDone = true; send({ t: 'gd', solved: true, tries: duel.mine.length }, duel.peer); duelEnd(true, 'Bạn đoán đúng trước!'); }
    else if (duel.mine.length >= duel.max) { duel.myDone = true; send({ t: 'gd', solved: false }, duel.peer); if (duel.oppDone) duelEnd(null, 'Cả hai đều hết lượt.'); else $('#d-msg').textContent = 'Hết lượt, đợi đối thủ…'; }
  } else if (/^[a-z]$/.test(k) && duel.cur.length < duel.len) duel.cur += k;
  renderDuel();
}
function duelEnd(won, why) {
  if (!duel || duel.over) return; duel.over = true; renderDuel();
  $('#d-msg').textContent = (won === null ? '🤝 Hòa! ' : won ? '🎉 ' : '😅 ') + why + ` Từ đúng: ${duel.word.w}`;
  $('#d-leave').textContent = 'Đóng';
}
$('#d-leave').onclick = () => { if (duel && !duel.over) send({ t: 'gl' }, duel.peer); duel = null; $('#duel').hidden = true; };
$('#d-kb').onclick = e => { const b = e.target.closest('[data-k]'); if (b) duelKey(b.dataset.k); };

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (duel && !$('#duel').hidden) { if (e.key === 'Enter') duelKey('Enter'); else if (e.key === 'Backspace') duelKey('Back'); else if (/^[a-zA-Z]$/.test(e.key)) duelKey(e.key.toLowerCase()); return; }
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  if (typing) return;
  if (e.key === 'Enter' && joined) { e.preventDefault(); $('#chat').focus(); return; }
  keys.add(e.key.toLowerCase());
});
document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
const keys = new Set();

/* ================= Thế giới ================= */
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, dpr = 1, zoom = 1;
function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; zoom = Math.min(1.15, Math.max(0.7, W / 1100)); }
addEventListener('resize', resize); resize();

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const L = WORLD.lake;
const norm = (x, y, ex = 0) => ((x - L.cx) / (L.rx + ex)) ** 2 + ((y - L.cy) / (L.ry + ex)) ** 2;

// Lớp nền tĩnh
const bg = document.createElement('canvas'); bg.width = WORLD.w; bg.height = WORLD.h;
(function buildBg() {
  const g = bg.getContext('2d'), r = rng(11);
  g.fillStyle = '#86c97c'; g.fillRect(0, 0, WORLD.w, WORLD.h);
  for (let i = 0; i < 260; i++) { g.fillStyle = r() > 0.5 ? '#7bbf72' : '#93d28a'; g.beginPath(); g.ellipse(r() * WORLD.w, r() * WORLD.h, 20 + r() * 40, 8 + r() * 16, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 140; i++) { g.fillStyle = ['#fff', '#ffd6e0', '#fff3a8'][Math.floor(r() * 3)]; g.beginPath(); g.arc(r() * WORLD.w, r() * WORLD.h, 2, 0, 7); g.fill(); }
  g.strokeStyle = '#eadcb8'; g.lineWidth = 66; g.beginPath(); g.ellipse(L.cx, L.cy, L.rx + 55, L.ry + 55, 0, 0, 7); g.stroke();
  g.strokeStyle = '#d8c79c'; g.lineWidth = 2; for (const d of [22, 88]) { g.beginPath(); g.ellipse(L.cx, L.cy, L.rx + d, L.ry + d, 0, 0, 7); g.stroke(); }
  g.fillStyle = '#c8e8f2'; g.beginPath(); g.ellipse(L.cx, L.cy, L.rx + 8, L.ry + 8, 0, 0, 7); g.fill();
  const grad = g.createRadialGradient(L.cx, L.cy - 40, 40, L.cx, L.cy, L.rx);
  grad.addColorStop(0, '#6cc4ea'); grad.addColorStop(1, '#3b8fc4');
  g.fillStyle = grad; g.beginPath(); g.ellipse(L.cx, L.cy, L.rx, L.ry, 0, 0, 7); g.fill();
  for (const w of WORLD.walk) { g.fillStyle = '#a8794c'; g.fillRect(w.x1, w.y1, w.x2 - w.x1, w.y2 - w.y1); g.strokeStyle = '#7d5834'; g.lineWidth = 1; for (let y = w.y1; y < w.y2; y += 10) { g.beginPath(); g.moveTo(w.x1, y); g.lineTo(w.x2, y); g.stroke(); } }
})();

// Vật thể (sắp xếp theo y cùng nhân vật)
const objs = [];
(function buildObjs() {
  const r = rng(7);
  const reserved = [[1290, 830, 150], [400, 850, 110], [800, 900, 90]];
  for (let i = 0; i < 90; i++) {
    const x = 30 + r() * 1540, y = 90 + r() * 890;
    if (norm(x, y, 118) < 1 || reserved.some(([a, b, d]) => (x - a) ** 2 + (y - b) ** 2 < d * d)) continue;
    const s = 0.8 + r() * 0.6, k = r() > 0.35 ? 0 : 1;
    objs.push({ y, draw: g => drawTree(g, x, y, s, k) });
  }
  objs.push({ y: 870, draw: g => drawTemple(g, 1290, 870) });
  objs.push({ y: 860, draw: g => drawCafe(g, 400, 860) });
  for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, x = L.cx + Math.cos(a) * (L.rx + 108), y = L.cy + Math.sin(a) * (L.ry + 108); if (y < 40 || y > 975) continue; objs.push({ y, lamp: [x, y], draw: g => drawLamp(g, x, y) }); }
  for (const a of [0.3, 1.1, 2.0, 3.6, 4.4, 5.3]) { const x = L.cx + Math.cos(a) * (L.rx + 40), y = L.cy + Math.sin(a) * (L.ry + 40); objs.push({ y, draw: g => drawBench(g, x, y) }); }
})();
function drawTree(g, x, y, s, k) {
  g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y, 22 * s, 7 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#7a5230'; g.fillRect(x - 4 * s, y - 28 * s, 8 * s, 28 * s);
  g.fillStyle = k ? '#ff9db6' : '#2f9e55'; g.beginPath(); g.arc(x, y - 44 * s, 24 * s, 0, 7); g.fill();
  g.fillStyle = k ? '#ffb7cb' : '#3db368'; g.beginPath(); g.arc(x - 8 * s, y - 52 * s, 14 * s, 0, 7); g.fill();
}
function drawLamp(g, x, y) { g.fillStyle = '#4a4a55'; g.fillRect(x - 2, y - 38, 4, 38); g.fillStyle = '#ffe9a6'; g.beginPath(); g.arc(x, y - 42, 6, 0, 7); g.fill(); }
function drawBench(g, x, y) { g.fillStyle = '#8a5a34'; g.fillRect(x - 16, y - 12, 32, 6); g.fillRect(x - 14, y - 6, 4, 8); g.fillRect(x + 10, y - 6, 4, 8); g.fillStyle = '#a87445'; g.fillRect(x - 16, y - 20, 32, 5); }
function label(g, text, x, y) { g.font = 'bold 13px system-ui'; g.textAlign = 'center'; const w = g.measureText(text).width + 12; g.fillStyle = '#000a'; g.beginPath(); g.roundRect(x - w / 2, y - 14, w, 20, 8); g.fill(); g.fillStyle = '#fff'; g.fillText(text, x, y + 1); }
function drawTemple(g, x, y) {
  g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y, 90, 16, 0, 0, 7); g.fill();
  g.fillStyle = '#d9d2c3'; g.fillRect(x - 80, y - 26, 160, 26);
  g.fillStyle = '#f3e3b8'; g.fillRect(x - 70, y - 80, 80, 54); // chính điện
  g.fillStyle = '#b03a2e'; g.beginPath(); g.moveTo(x - 82, y - 78); g.lineTo(x - 30, y - 108); g.lineTo(x + 22, y - 78); g.closePath(); g.fill();
  g.fillStyle = '#7a1f17'; g.fillRect(x - 40, y - 58, 20, 32);
  for (let i = 0; i < 6; i++) { const w = 36 - i * 4, yy = y - 28 - i * 22; g.fillStyle = '#efe6cf'; g.fillRect(x + 50 - w / 2, yy - 20, w, 20); g.fillStyle = '#b03a2e'; g.beginPath(); g.moveTo(x + 50 - w / 2 - 4, yy - 20); g.lineTo(x + 50, yy - 28); g.lineTo(x + 50 + w / 2 + 4, yy - 20); g.fill(); }
  g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(x + 50, y - 170, 4, 0, 7); g.fill();
  label(g, 'Chùa Trấn Quốc', x, y + 24);
}
function drawCafe(g, x, y) {
  g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y, 70, 12, 0, 0, 7); g.fill();
  g.fillStyle = '#f4e4c8'; g.fillRect(x - 50, y - 60, 100, 60);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#e4572e'; g.fillRect(x - 54 + i * 18, y - 78, 18, 22); }
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 10, y - 38, 20, 38);
  for (const dx of [-80, 78]) { g.fillStyle = '#ffd166'; g.beginPath(); g.arc(x + dx, y - 22, 20, Math.PI, 0); g.fill(); g.fillStyle = '#6b4a2f'; g.fillRect(x + dx - 2, y - 22, 4, 22); }
  label(g, 'Cà phê Hồ Tây', x, y + 22);
}
const swans = Array.from({ length: 5 }, (_, i) => ({ a: i * 1.25, sp: 0.05 + i * 0.01, k: 0.62 + (i % 3) * 0.09 }));
function drawSwan(g, x, y, dir) {
  g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y + 6, 18, 6, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, 17, 10, 0, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + dir * 10, y - 4); g.quadraticCurveTo(x + dir * 18, y - 22, x + dir * 12, y - 24); g.stroke();
  g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(x + dir * 12, y - 25); g.lineTo(x + dir * 20, y - 22); g.lineTo(x + dir * 12, y - 21); g.fill();
  g.fillStyle = '#ffb3c6'; g.fillRect(x - 6, y - 4, 12, 4);
}

/* ---- Di chuyển & nhập liệu ---- */
const SPEED = 190;
function stepMe(dt) {
  if (!me) return false;
  let vx = 0, vy = 0;
  if (keys.has('arrowleft') || keys.has('a')) vx -= 1; if (keys.has('arrowright') || keys.has('d')) vx += 1;
  if (keys.has('arrowup') || keys.has('w')) vy -= 1; if (keys.has('arrowdown') || keys.has('s')) vy += 1;
  if (vx || vy) me.target = null;
  else if (me.target) { const dx = me.target.x - me.x, dy = me.target.y - me.y, d = Math.hypot(dx, dy); if (d < 4) me.target = null; else { vx = dx / d; vy = dy / d; } }
  if (!vx && !vy) return false;
  const l = Math.hypot(vx, vy); vx /= l; vy /= l;
  const nx = me.x + vx * SPEED * dt, ny = me.y + vy * SPEED * dt;
  const tries = [[nx, ny], [nx, me.y], [me.x, ny]]; let moved = false;
  for (const [x, y] of tries) { const [cx, cy] = clampPos(x, y); if (!inWater(cx, cy)) { me.x = cx; me.y = cy; moved = true; break; } }
  if (!moved) me.target = null;
  return moved;
}
let camX = 0, camY = 0;
function toWorld(sx, sy) { return [sx / zoom + camX, sy / zoom + camY]; }
cv.addEventListener('pointerdown', e => {
  if (!me || !joined) return; closeCard();
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  for (const p of others.values()) if (Math.abs(wx - p.x) < 20 && wy > p.y - 56 && wy < p.y + 6) return openCard(p.id);
  const [x, y] = clampPos(wx, wy);
  if (inWater(x, y)) { toast('Chỗ đó là nước, đi bộ quanh hồ nhé 😄'); return; }
  me.target = { x, y };
});

/* ---- Vòng lặp ---- */
let last = performance.now(), sendAt = 0, lastSent = '';
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  const moving = stepMe(dt);
  if (me) { me.moving = moving; if (now - sendAt > 100) { sendAt = now; const s = Math.round(me.x) + ',' + Math.round(me.y); if (s !== lastSent) { lastSent = s; send({ t: 'p', x: Math.round(me.x), y: Math.round(me.y) }); } } }
  for (const o of others.values()) { const dx = o.tx - o.x, dy = o.ty - o.y; o.moving = Math.hypot(dx, dy) > 2; o.x += dx * Math.min(1, dt * 10); o.y += dy * Math.min(1, dt * 10); }
  render(t, now); requestAnimationFrame(frame);
}
function render(t, now) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#10202a'; ctx.fillRect(0, 0, cv.width, cv.height);
  const vw = W / zoom, vh = H / zoom, fx = me ? me.x : WORLD.w / 2, fy = me ? me.y - 30 : WORLD.h / 2;
  camX = vw >= WORLD.w ? (WORLD.w - vw) / 2 : Math.min(WORLD.w - vw, Math.max(0, fx - vw / 2));
  camY = vh >= WORLD.h ? (WORLD.h - vh) / 2 : Math.min(WORLD.h - vh, Math.max(0, fy - vh / 2));
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom);
  ctx.drawImage(bg, 0, 0);
  // sóng nước
  ctx.save(); ctx.beginPath(); ctx.ellipse(L.cx, L.cy, L.rx - 6, L.ry - 6, 0, 0, 7); ctx.clip();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) { const a = i * 2.399, rr = 0.25 + (i % 7) / 9, x = L.cx + Math.cos(a) * L.rx * rr, y = L.cy + Math.sin(a) * L.ry * rr; ctx.globalAlpha = 0.18 + 0.16 * Math.sin(t * 1.4 + i); ctx.beginPath(); ctx.ellipse(x, y, 16 + 5 * Math.sin(t + i), 4, 0, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const s of swans) { const a = s.a + t * s.sp, x = L.cx + Math.cos(a) * L.rx * s.k, y = L.cy + Math.sin(a) * L.ry * s.k; drawSwan(ctx, x, y, -Math.sin(a) >= 0 ? 1 : -1); }
  ctx.restore();
  ctx.textAlign = 'center'; ctx.font = 'bold 13px system-ui';
  label(ctx, 'Hồ Tây', L.cx, L.cy - 10); label(ctx, 'Bến thuyền vịt', 905, 800);
  // vật thể + nhân vật theo chiều sâu
  const list = objs.map(o => ({ y: o.y, draw: o.draw }));
  const all = [me, ...others.values()].filter(Boolean);
  for (const p of all) list.push({ y: p.y, draw: g => { drawAvatar(g, p.x, p.y, p.look, p.moving, t); } });
  list.sort((a, b) => a.y - b.y); for (const o of list) o.draw(ctx);
  // tên + bong bóng chat
  for (const p of all) {
    ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; const nm = p.shown || p.name, w = ctx.measureText(nm).width + 12, ny = p.y - (HATS[p.look.a] ? 70 : 58);
    ctx.fillStyle = p === me ? '#ff7a45dd' : '#000a'; ctx.beginPath(); ctx.roundRect(p.x - w / 2, ny - 13, w, 18, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(nm, p.x, ny);
    if (p.bubble && p.bubble.until > now) bubble(ctx, p.x, ny - 22, p.bubble);
  }
  // ánh sáng theo giờ
  const h = new Date().getHours(), night = h >= 19 || h < 5, dusk = h >= 17 && h < 19;
  if (night || dusk) {
    ctx.fillStyle = night ? 'rgba(10,20,60,0.38)' : 'rgba(255,140,60,0.16)'; ctx.fillRect(camX, camY, vw, vh);
    if (night) for (const o of objs) if (o.lamp) { const [x, y] = o.lamp, gr = ctx.createRadialGradient(x, y - 42, 2, x, y - 42, 60); gr.addColorStop(0, 'rgba(255,230,150,0.75)'); gr.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 60, y - 102, 120, 120); }
  }
}
function bubble(g, x, y, b) {
  g.font = (b.emoji ? '26px' : '13px') + ' system-ui'; g.textAlign = 'center';
  const lines = b.emoji ? [b.text] : wrap(b.text, 18);
  const w = Math.max(...lines.map(s => g.measureText(s).width)) + 16, h = lines.length * (b.emoji ? 30 : 17) + 8;
  g.fillStyle = '#fff'; g.strokeStyle = '#0003'; g.lineWidth = 1; g.beginPath(); g.roundRect(x - w / 2, y - h, w, h, 10); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x, y + 6); g.lineTo(x + 5, y); g.fill();
  g.fillStyle = '#23222a'; lines.forEach((s, i) => g.fillText(s, x, y - h + 17 + i * (b.emoji ? 30 : 17) + (b.emoji ? 6 : 0)));
}
function wrap(text, n) { const out = []; let cur = ''; for (const w of text.split(' ')) { if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out.slice(0, 4); }
requestAnimationFrame(frame);
