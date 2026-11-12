import { WORLD, clampPos, evaluate, NAME_RE, COLORS, HATS } from './shared.js?v=5';
import { createNet } from './net.js?v=5';
import { startChess } from './chess.js?v=5';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };

/* ================= Vẽ nhân vật ================= */
function drawAvatar(ctx, x, y, look, moving, t) {
  const bob = moving ? Math.sin(t * 14) * 2 : 0, step = moving ? Math.sin(t * 14) * 3 : 0;
  ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(x, y, 13, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a3b33';
  ctx.fillRect(x - 7 + step, y - 8, 5, 8); ctx.fillRect(x + 2 - step, y - 8, 5, 8);
  ctx.fillStyle = COLORS[look.c] || COLORS[0];
  ctx.beginPath(); ctx.roundRect(x - 11, y - 30 + bob, 22, 24, 7); ctx.fill();
  ctx.fillStyle = '#ffe0c2'; ctx.beginPath(); ctx.arc(x, y - 38 + bob, 11, 0, 7); ctx.fill();
  ctx.fillStyle = '#3b2b25'; ctx.beginPath(); ctx.arc(x - 4, y - 39 + bob, 1.6, 0, 7); ctx.arc(x + 4, y - 39 + bob, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#c0735a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y - 35 + bob, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  const hat = HATS[look.a];
  if (hat) { ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(hat, x, y - 44 + bob); }
}

/* ================= Đăng nhập / nhân vật ================= */
const profile = load('ht-profile', { name: '', look: { c: 0, a: 0 } });
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
const GAMES = { doantu: 'Đoán Từ', cotuong: 'Cờ tướng', coup: 'Cờ úp' };
function recomputeNames() {
  const all = [me, ...others.values()].filter(Boolean), cnt = {};
  all.forEach(p => { const k = p.name.toLowerCase(); cnt[k] = (cnt[k] || 0) + 1; });
  all.forEach(p => { p.shown = cnt[p.name.toLowerCase()] > 1 ? `${p.name}·${p.id.slice(0, 3)}` : p.name; });
}
function setConn() {
  const n = others.size + 1;
  $('#conn').textContent = net.kind === 'local' ? `⚠ Chỉ chơi giữa các tab trên máy này (không tải được P2P) · ${n} người` : `🟢 Phòng "${ROOM}" · ${n} người`;
}
const busy = () => !!(duel || chessCtl);

$('#l-go').onclick = async () => {
  const name = $('#l-name').value.trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(name)) return fail('Tên 3–16 ký tự, chỉ gồm chữ, số, khoảng trắng hoặc _');
  $('#l-go').disabled = true; $('#l-err').textContent = 'Đang kết nối…';
  try { net = await createNet('ht-' + ROOM); } catch (e) { return fail('Không kết nối được: ' + e.message); }
  fetch('data/words.json?v=5').then(r => r.json()).then(d => { words = d; }).catch(() => {});
  const x = 700 + Math.round(Math.random() * 300), y = WORLD.y0 + 40 + Math.round(Math.random() * 100);
  me = { id: net.selfId, name, look: { ...look }, x, y, tx: x, ty: y, target: null, bubble: null };
  Object.assign(profile, { name, look: me.look }); save('ht-profile', profile);
  net.on('join', id => send(hi(), id));
  net.on('leave', onLeave);
  net.on('msg', onMsg);
  joined = true; $('#login').hidden = true; $('#hud').hidden = false; $('#l-go').disabled = false;
  recomputeNames(); renderList(); setConn();
  log('', `Chào mừng ${me.name} đến Hồ Tây! Bấm vào đường dạo để đi, bấm vào người khác để làm quen. Gửi link này cho bạn bè để cùng vào phòng.`);
  setTimeout(() => { if (!others.size) log('', 'Chưa thấy ai khác. Hãy gửi link cho bạn bè (nút "🔗 Mời bạn bè") rồi chờ vài giây nhé.'); }, 6000);
};
function fail(msg) { $('#l-err').textContent = msg; $('#l-go').disabled = false; }
$('#l-name').onkeydown = e => { if (e.key === 'Enter') $('#l-go').click(); };

function onLeave(id) {
  const o = others.get(id); if (!o) return;
  others.delete(id); recomputeNames(); renderList(); setConn(); log('', `${o.shown} đã rời hồ`);
  if (cardId === id) closeCard();
  if (duel && duel.peer === id && !duel.over) duelEnd(true, 'Đối thủ đã rời ván, bạn thắng!');
  if (chessCtl && chessPeer === id) chessCtl.opponentGone('đối thủ đã rời ván');
}
function onMsg(m, id) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hi') {
    const name = String(m.name || '').trim().replace(/\s+/g, ' ');
    if (!NAME_RE.test(name)) return;
    const [x, y] = clampPos(+m.x || 800, +m.y || 500), fresh = !others.has(id);
    const o = { id, name, look: cleanLook(m.look), x, y, tx: x, ty: y, bubble: null }; if (!fresh) Object.assign(o, { x: others.get(id).x, y: others.get(id).y });
    others.set(id, o); recomputeNames(); renderList(); setConn(); if (fresh) log('', `${o.shown} vừa đến hồ`); return;
  }
  const o = others.get(id); if (!o) return;
  switch (m.t) {
    case 'p': { const [x, y] = clampPos(+m.x || 0, +m.y || 0); o.tx = x; o.ty = y; break; }
    case 'c': { const text = String(m.text || '').slice(0, 120); if (text) { o.bubble = { text, until: performance.now() + 6000 }; log(o.shown, text); } break; }
    case 'e': if (['👋', '😂', '❤️', '👍', '🎉'].includes(m.e)) o.bubble = { text: m.e, until: performance.now() + 2500, emoji: true }; break;
    case 'inv': if (!GAMES[m.g]) break; if (busy()) send({ t: 'rep', accept: false, busy: true }, id); else showInvite(o, m.g); break;
    case 'rep': if (outInvite && outInvite.id === id) { const g = outInvite.g; outInvite = null; if (m.accept) startAsHost(o, g); else toast(m.busy ? `${o.shown} đang bận` : `${o.shown} chưa muốn chơi lúc này`); } break;
    case 'gs': if (acceptedFrom && acceptedFrom.id === id && acceptedFrom.g === 'doantu' && !busy()) { acceptedFrom = null; const w = words[+m.wi]; if (w) startDuel(o, w); } break;
    case 'cs': if (acceptedFrom && acceptedFrom.id === id && acceptedFrom.g === m.g && !busy() && (m.g === 'cotuong' || m.g === 'coup')) { acceptedFrom = null; beginChess(o, m.g, +m.seed || 1, m.hostRed ? 'b' : 'r'); } break;
    case 'cm': if (chessCtl && chessPeer === id) chessCtl.recv(m); break;
    case 'cr': if (chessCtl && chessPeer === id) chessCtl.opponentGone('đối thủ đã đầu hàng'); break;
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

let cardId = null, inviteTimer = null, outInvite = null, acceptedFrom = null;
function openCard(id) {
  const p = others.get(id); if (!p) return; cardId = id;
  const c = $('#card'); c.hidden = false;
  c.innerHTML = `<b>${esc(p.shown)}</b><div class="muted small">Mời chơi:</div><button class="primary" data-g="doantu">🔤 Đoán Từ</button><button class="primary" data-g="cotuong">♟ Cờ tướng</button><button class="primary" data-g="coup">🎴 Cờ úp</button><button id="c-close">Đóng</button>`;
  c.onclick = e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const g = b.dataset.g; closeCard();
    if (busy()) return toast('Bạn đang trong một ván chơi');
    if (g === 'doantu' && !words.length) return toast('Đang tải kho từ, thử lại sau giây lát');
    outInvite = { id, g }; send({ t: 'inv', g }, id); toast(`Đã gửi lời mời ${GAMES[g]} cho ${p.shown}`);
    setTimeout(() => { if (outInvite && outInvite.id === id) outInvite = null; }, 30000);
  };
  $('#c-close').onclick = closeCard;
}
function closeCard() { cardId = null; $('#card').hidden = true; }
function showInvite(o, g) {
  const box = $('#invite'); box.hidden = false;
  box.innerHTML = `<div><b>${esc(o.shown)}</b> mời bạn chơi <b>${GAMES[g]}</b>!</div><div><button class="primary" id="i-yes">Chấp nhận</button> <button id="i-no">Từ chối</button></div>`;
  const done = acc => {
    clearTimeout(inviteTimer); box.hidden = true;
    if (acc && (busy() || (g === 'doantu' && !words.length))) { send({ t: 'rep', accept: false, busy: true }, o.id); return; }
    if (acc) acceptedFrom = { id: o.id, g };
    send({ t: 'rep', accept: acc }, o.id);
  };
  $('#i-yes').onclick = () => done(true); $('#i-no').onclick = () => done(false);
  clearTimeout(inviteTimer); inviteTimer = setTimeout(() => { box.hidden = true; }, 30000);
}
function startAsHost(o, g) {
  if (busy()) return;
  if (g === 'doantu') { if (!words.length) return; const wi = Math.floor(Math.random() * words.length); send({ t: 'gs', wi }, o.id); startDuel(o, words[wi]); return; }
  const seed = 1 + Math.floor(Math.random() * 1e9), hostRed = Math.random() < 0.5;
  send({ t: 'cs', g, seed, hostRed }, o.id); beginChess(o, g, seed, hostRed ? 'r' : 'b');
}

/* ================= Cờ tướng / Cờ úp ================= */
let chessCtl = null, chessPeer = null;
function beginChess(o, g, seed, mySide) {
  $('#invite').hidden = true; closeCard(); chessPeer = o.id;
  chessCtl = startChess({ kind: g === 'coup' ? 'up' : 'tuong', seed, mySide, peerName: o.shown, send: m => send(m, o.id), onClose: () => { chessCtl = null; chessPeer = null; } });
}
$('#ch-leave').onclick = () => { if (chessCtl) { if (chessCtl.over) chessCtl.close(); else if (confirm('Đầu hàng và rời ván?')) chessCtl.leave(); } };

/* ================= Đấu Đoán Từ ================= */
const KEYROWS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];
let duel = null;
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

const keys = new Set();
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (duel && !$('#duel').hidden) { if (e.key === 'Enter') duelKey('Enter'); else if (e.key === 'Backspace') duelKey('Back'); else if (/^[a-zA-Z]$/.test(e.key)) duelKey(e.key.toLowerCase()); return; }
  if (chessCtl) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.key === 'Enter' && joined) { e.preventDefault(); $('#chat').focus(); return; }
  keys.add(e.key.toLowerCase());
});
document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

/* ================= Khung cảnh Hồ Tây (nhìn ngang, hồ ở phía sau) ================= */
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, dpr = 1, zoom = 1, camX = 0, camY = 0, T = 0;
function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; zoom = Math.max(0.6, Math.min(1.6, H / WORLD.h)); }
addEventListener('resize', resize); resize();

const HORIZON = 250, WALL = 405, PATH_TOP = 436;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function palette() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 17) return { k: 'day', sky: ['#6fc3f0', '#dff3fc'], water: ['#5fb8e6', '#3d8fc4'], far: '#a9bfd0', ground: '#d9ccb2', dark: 0 };
  if ((h >= 17 && h < 19.5) || (h >= 5 && h < 7)) return { k: 'dusk', sky: ['#4a6fb5', '#ffb26b'], water: ['#e39a78', '#7d6a9c'], far: '#8d7ba0', ground: '#c9b090', dark: 0.14 };
  return { k: 'night', sky: ['#0a1230', '#1f3260'], water: ['#21406c', '#0f2038'], far: '#1c2a47', ground: '#8f8776', dark: 0.34 };
}

/* --- dữ liệu cố định, sinh một lần --- */
const R1 = rng(21);
const skyline = []; for (let x = 0; x < 1800;) { const w = 18 + R1() * 34, h = 24 + R1() * (R1() > 0.9 ? 120 : 62); skyline.push({ x, w, h, tone: R1() }); x += w + R1() * 6; }
const farTrees = Array.from({ length: 60 }, () => ({ x: R1() * 1800, r: 7 + R1() * 8 }));
const stars = Array.from({ length: 70 }, () => ({ x: R1() * 1600, y: -300 + R1() * 540, s: 0.6 + R1() * 1.4, p: R1() * 6 }));
const glints = Array.from({ length: 70 }, () => ({ x: R1() * 1400, y: HORIZON + 14 + R1() * 128, w: 8 + R1() * 22, p: R1() * 6 }));
const boats = Array.from({ length: 9 }, (_, i) => ({ x: 200 + i * 230 + R1() * 80, y: 300 + R1() * 90, p: R1() * 6, sp: 0.15 + R1() * 0.2 }));
const birds = Array.from({ length: 6 }, (_, i) => ({ x: R1() * 2000, y: 40 + R1() * 130, sp: 18 + R1() * 14, p: R1() * 6 }));

function drawFarLayer(g, p, vw) {
  const f = 0.3, P = 1800, ox = camX * (1 - f), left = camX * f;
  g.save(); g.translate(ox, 0);
  const k0 = Math.floor(left / P) - 1, k1 = Math.ceil((left + vw) / P);
  for (let k = k0; k <= k1; k++) for (const b of skyline) {
    const x = k * P + b.x, lit = p.k === 'night';
    g.fillStyle = p.far; g.globalAlpha = 0.85 + b.tone * 0.15; g.fillRect(x, HORIZON - b.h, b.w, b.h + 2); g.globalAlpha = 1;
    if (lit) { g.fillStyle = '#ffd98a'; for (let yy = HORIZON - b.h + 6; yy < HORIZON - 4; yy += 9) for (let xx = x + 4; xx < x + b.w - 4; xx += 8) if (((xx * 7 + yy * 13) | 0) % 5 === 0) g.fillRect(xx, yy, 3, 4); }
  }
  g.fillStyle = p.k === 'day' ? '#7fa889' : p.k === 'dusk' ? '#6b6f86' : '#16243a';
  for (let k = k0; k <= k1; k++) for (const t of farTrees) { g.beginPath(); g.arc(k * P + t.x, HORIZON + 1, t.r, Math.PI, 0); g.fill(); }
  g.restore();
}
function drawChua(g, p, vw) { // Chùa Trấn Quốc trên bán đảo phía xa
  const f = 0.4, lx = 1700, ox = camX * (1 - f);
  g.save(); g.translate(ox, 0);
  g.fillStyle = p.k === 'night' ? '#14301f' : '#5d9a63'; g.beginPath(); g.ellipse(lx, HORIZON + 6, 150, 14, 0, Math.PI, 0); g.fill();
  const body = p.k === 'night' ? '#6b6258' : '#efe6d2', roof = p.k === 'night' ? '#4a2220' : '#b03a2e';
  for (let i = 0; i < 11; i++) { const w = 36 - i * 2.4, yy = HORIZON - 4 - i * 9; g.fillStyle = body; g.fillRect(lx - w / 2, yy - 9, w, 9); g.fillStyle = roof; g.fillRect(lx - w / 2 - 2, yy - 10, w + 4, 2); }
  g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(lx, HORIZON - 4 - 11 * 9 - 4, 3, 0, 7); g.fill();
  g.fillStyle = body; g.fillRect(lx - 85, HORIZON - 24, 46, 24); g.fillStyle = roof; g.beginPath(); g.moveTo(lx - 92, HORIZON - 24); g.lineTo(lx - 62, HORIZON - 42); g.lineTo(lx - 32, HORIZON - 24); g.fill();
  g.fillStyle = '#2d6a3e'; for (const dx of [-120, -105, 45, 70, 100]) { g.beginPath(); g.arc(lx + dx, HORIZON - 6, 11, 0, 7); g.fill(); }
  g.font = 'bold 13px system-ui'; g.textAlign = 'center'; const tw = g.measureText('Chùa Trấn Quốc').width + 12; g.fillStyle = '#000a'; g.beginPath(); g.roundRect(lx - tw / 2, HORIZON + 14, tw, 20, 8); g.fill(); g.fillStyle = '#fff'; g.fillText('Chùa Trấn Quốc', lx, HORIZON + 28);
  g.restore();
}
function drawSwanBoat(g, x, y, s, dark) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#0003'; g.beginPath(); g.ellipse(0, 8, 24, 5, 0, 0, 7); g.fill();
  g.fillStyle = dark ? '#c9c9d6' : '#fff'; g.beginPath(); g.ellipse(0, 0, 22, 12, 0, 0, 7); g.fill();
  g.strokeStyle = dark ? '#c9c9d6' : '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(12, -4); g.quadraticCurveTo(26, -26, 17, -30); g.stroke();
  g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(17, -31); g.lineTo(28, -27); g.lineTo(17, -24); g.fill();
  g.fillStyle = '#ff9db8'; g.fillRect(-9, -6, 18, 5); g.restore();
}
function drawLake(g, p, vw) {
  const gr = g.createLinearGradient(0, HORIZON, 0, WALL); gr.addColorStop(0, p.water[0]); gr.addColorStop(1, p.water[1]);
  g.fillStyle = gr; g.fillRect(camX - 10, HORIZON, vw + 20, WALL - HORIZON + 4);
  // ánh sáng lấp lánh (thị sai 0.6)
  const f = 0.6, P = 1400, ox = camX * (1 - f), left = camX * f; g.save(); g.translate(ox, 0);
  g.strokeStyle = p.k === 'night' ? '#cfe3ff' : '#ffffff'; g.lineWidth = 1.5;
  for (let k = Math.floor(left / P) - 1; k <= Math.ceil((left + vw) / P); k++) for (const q of glints) { g.globalAlpha = Math.max(0, 0.14 + 0.22 * Math.sin(T * 1.6 + q.p)); g.beginPath(); g.moveTo(k * P + q.x, q.y); g.lineTo(k * P + q.x + q.w, q.y); g.stroke(); }
  g.globalAlpha = 1;
  // thuyền vịt (thị sai 0.75)
  g.restore(); const f2 = 0.75, ox2 = camX * (1 - f2); g.save(); g.translate(ox2, 0);
  for (const b of boats) { const x = b.x + Math.sin(T * b.sp + b.p) * 30, y = b.y + Math.sin(T * 0.8 + b.p) * 1.5, s = 0.45 + (y - HORIZON) / 150 * 0.7; drawSwanBoat(g, x, y, s, p.k === 'night'); }
  g.restore();
}
function drawSky(g, p, vw) {
  const top = camY - 20, gr = g.createLinearGradient(0, top, 0, HORIZON); gr.addColorStop(0, p.sky[0]); gr.addColorStop(1, p.sky[1]);
  g.fillStyle = gr; g.fillRect(camX - 10, top, vw + 20, HORIZON - top + 2);
  const f = 0.06, ox = camX * (1 - f);
  g.save(); g.translate(ox, 0);
  if (p.k === 'night') {
    for (const s of stars) { g.globalAlpha = 0.5 + 0.5 * Math.sin(T * 1.5 + s.p); g.fillStyle = '#fff'; for (let k = Math.floor((camX * f) / 1600); k <= Math.ceil((camX * f + vw) / 1600); k++) g.fillRect(k * 1600 + s.x, s.y, s.s, s.s); }
    g.globalAlpha = 1; g.fillStyle = '#f3f0d8'; g.beginPath(); g.arc(camX * f + vw * 0.75, 90, 26, 0, 7); g.fill(); g.fillStyle = '#0a1230'; g.beginPath(); g.arc(camX * f + vw * 0.75 + 10, 84, 22, 0, 7); g.fill();
  } else {
    const sx = camX * f + vw * 0.7, sy = p.k === 'day' ? 90 : 190, rad = ctx.createRadialGradient(sx, sy, 5, sx, sy, 90);
    rad.addColorStop(0, p.k === 'day' ? '#fff8c8' : '#ffd9a0'); rad.addColorStop(0.25, p.k === 'day' ? '#ffe98a' : '#ffb067'); rad.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = rad; g.fillRect(sx - 100, sy - 100, 200, 200);
    g.fillStyle = p.k === 'day' ? '#fff2a6' : '#ff9e5e'; g.beginPath(); g.arc(sx, sy, 24, 0, 7); g.fill();
    // mây
    g.fillStyle = p.k === 'day' ? '#ffffffcc' : '#ffd0a899';
    for (const [cx, cy, w] of [[200, 70, 90], [700, 120, 120], [1200, 60, 100], [1700, 110, 80]]) for (let k = Math.floor((camX * f) / 2000); k <= Math.ceil((camX * f + vw) / 2000); k++) { const x = k * 2000 + cx + T * 2; g.beginPath(); g.ellipse(x % 2000 + k * 2000 - (k * 2000 % 2000), cy, w, 18, 0, 0, 7); g.ellipse(x % 2000 + k * 2000 - (k * 2000 % 2000) + 30, cy - 10, w * 0.6, 16, 0, 0, 7); g.fill(); }
  }
  g.restore();
  g.strokeStyle = p.k === 'night' ? '#cfd6ee' : '#3b4660'; g.lineWidth = 1.6; const fb = camX * 0.15;
  for (const b of birds) { const x = ((b.x + T * b.sp) % 2400) - 200 + fb * 0, y = b.y + Math.sin(T * 2 + b.p) * 4, w = 5 + Math.sin(T * 8 + b.p) * 2.5; g.beginPath(); g.moveTo(camX + x - 8, y + w * 0.3); g.quadraticCurveTo(camX + x - 4, y - w, camX + x, y); g.quadraticCurveTo(camX + x + 4, y - w, camX + x + 8, y + w * 0.3); g.stroke(); }
}
function drawGround(g, p, vw) {
  // bờ hồ: lan can đá, dải cỏ, đường dạo
  g.fillStyle = '#6fae62'; g.fillRect(camX - 10, WALL + 4, vw + 20, PATH_TOP - WALL - 4); // cỏ
  g.fillStyle = p.k === 'night' ? '#3a3f4b' : '#c8c2b4'; g.fillRect(camX - 10, WALL - 20, vw + 20, 24); // lan can
  g.fillStyle = p.k === 'night' ? '#2b2f39' : '#aaa497'; g.fillRect(camX - 10, WALL - 2, vw + 20, 6);
  for (let x = Math.floor((camX - 10) / 70) * 70; x < camX + vw + 80; x += 70) { g.fillStyle = p.k === 'night' ? '#454b58' : '#dad5c8'; g.fillRect(x, WALL - 30, 12, 34); }
  g.fillStyle = p.ground; g.fillRect(camX - 10, PATH_TOP, vw + 20, WORLD.h - PATH_TOP + 400);
  g.strokeStyle = p.k === 'night' ? '#6f6858' : '#c2b496'; g.lineWidth = 1;
  for (let x = Math.floor((camX - 10) / 120) * 120; x < camX + vw + 130; x += 120) { g.beginPath(); g.moveTo(x, PATH_TOP); g.lineTo(x - 60, WORLD.h + 400); g.stroke(); }
  for (const y of [500, 560, 620]) { g.beginPath(); g.moveTo(camX - 10, y); g.lineTo(camX + vw + 10, y); g.stroke(); }
  g.fillStyle = p.k === 'night' ? '#56503f' : '#b9a98a'; g.fillRect(camX - 10, PATH_TOP, vw + 20, 4);
}

/* --- vật thể trên bờ hồ (xếp theo độ sâu y cùng nhân vật) --- */
function label(g, text, x, y) { g.font = 'bold 13px system-ui'; g.textAlign = 'center'; const w = g.measureText(text).width + 12; g.fillStyle = '#000a'; g.beginPath(); g.roundRect(x - w / 2, y - 14, w, 20, 8); g.fill(); g.fillStyle = '#fff'; g.fillText(text, x, y + 1); }
function drawWillow(g, x, y, s) {
  g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y, 30 * s, 8 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#6e4c2c'; g.beginPath(); g.moveTo(x - 7 * s, y); g.quadraticCurveTo(x - 3 * s, y - 60 * s, x - 5 * s, y - 120 * s); g.lineTo(x + 5 * s, y - 120 * s); g.quadraticCurveTo(x + 4 * s, y - 60 * s, x + 7 * s, y); g.fill();
  g.fillStyle = '#4f9a4f'; g.beginPath(); g.ellipse(x, y - 130 * s, 52 * s, 30 * s, 0, 0, 7); g.fill();
  g.strokeStyle = '#5fae5f'; g.lineWidth = 3 * s; g.lineCap = 'round';
  for (let i = -6; i <= 6; i++) { const sx = x + i * 8.5 * s, sw = Math.sin(T * 1.2 + i * 0.7 + x) * 4 * s; g.beginPath(); g.moveTo(sx, y - 124 * s); g.quadraticCurveTo(sx + sw, y - 85 * s, sx + sw * 1.4, y - (45 + (i % 3) * 8) * s); g.stroke(); }
}
function drawHoaSua(g, x, y, s) {
  g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y, 28 * s, 8 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#5e4129'; g.fillRect(x - 6 * s, y - 95 * s, 12 * s, 95 * s);
  for (const [dx, dy, r, c] of [[0, -125, 40, '#2c7a45'], [-26, -108, 30, '#34894e'], [26, -108, 30, '#34894e'], [0, -150, 28, '#3b9657']]) { g.fillStyle = c; g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fill(); }
  g.fillStyle = '#f6f2d6'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(x + Math.sin(i * 2.1 + x) * 36 * s, y - (110 + Math.cos(i * 3.3) * 34) * s, 1.8 * s, 0, 7); g.fill(); }
}
function drawBench(g, x, y) { g.fillStyle = '#0002'; g.fillRect(x - 28, y - 1, 56, 5); g.fillStyle = '#7a4f2b'; g.fillRect(x - 26, y - 34, 52, 7); g.fillRect(x - 26, y - 26, 52, 4); g.fillRect(x - 24, y - 24, 5, 24); g.fillRect(x + 19, y - 24, 5, 24); g.fillStyle = '#9a6a3c'; g.fillRect(x - 26, y - 16, 52, 6); }
function drawLamp(g, x, y, night) {
  g.fillStyle = '#3d3f4a'; g.fillRect(x - 3, y - 118, 6, 118); g.fillRect(x - 9, y - 4, 18, 4);
  g.fillStyle = night ? '#fff0b0' : '#f7e6a0'; g.beginPath(); g.arc(x, y - 124, 9, 0, 7); g.fill();
  if (night) { const gr = ctx.createRadialGradient(x, y - 124, 2, x, y - 124, 110); gr.addColorStop(0, 'rgba(255,230,150,0.55)'); gr.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = gr; g.fillRect(x - 110, y - 234, 220, 240); }
}
function drawCafe(g, x, y) {
  g.fillStyle = '#0002'; g.fillRect(x - 118, y - 2, 236, 6);
  g.fillStyle = '#f2e2c0'; g.fillRect(x - 110, y - 150, 220, 150);
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 24, y - 90, 48, 90); g.fillStyle = '#a7d5e8'; g.fillRect(x - 96, y - 100, 56, 54); g.fillRect(x + 40, y - 100, 56, 54);
  for (let i = 0; i < 11; i++) { g.fillStyle = i % 2 ? '#fff0c4' : '#f2a516'; g.beginPath(); g.moveTo(x - 120 + i * 22, y - 150); g.lineTo(x - 98 + i * 22, y - 150); g.lineTo(x - 98 + i * 22, y - 126); g.arc(x - 109 + i * 22, y - 126, 11, 0, Math.PI); g.lineTo(x - 120 + i * 22, y - 150); g.fill(); }
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 70, y - 190, 140, 38); g.fillStyle = '#ffd166'; g.font = 'bold 20px system-ui'; g.textAlign = 'center'; g.fillText('Cà phê trứng', x, y - 163);
}
function drawStool(g, x, y, c) { g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y, 11, 3, 0, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(x, y - 16, 11, 4, 0, 0, 7); g.fill(); g.fillRect(x - 11, y - 16, 22, 4); g.fillStyle = '#0003'; g.fillRect(x - 8, y - 12, 3, 12); g.fillRect(x + 5, y - 12, 3, 12); }
function drawTable(g, x, y) { g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y, 24, 5, 0, 0, 7); g.fill(); g.fillStyle = '#e6d7b8'; g.fillRect(x - 22, y - 34, 44, 5); g.fillStyle = '#8a6a44'; g.fillRect(x - 3, y - 29, 6, 29); }
function drawPier(g, x) { // bến thuyền vịt: cầu gỗ ăn ra hồ
  g.fillStyle = '#9a6a3c'; g.fillRect(x - 70, WALL - 70, 140, 74); g.strokeStyle = '#6e4a28'; g.lineWidth = 1; for (let yy = WALL - 70; yy < WALL + 4; yy += 9) { g.beginPath(); g.moveTo(x - 70, yy); g.lineTo(x + 70, yy); g.stroke(); }
  g.fillStyle = '#6e4a28'; for (const dx of [-70, 66]) g.fillRect(x + dx, WALL - 76, 5, 82);
  drawSwanBoat(g, x - 118, WALL - 40, 0.85, false); drawSwanBoat(g, x + 118, WALL - 36, 0.85, false);
}
function drawKiosk(g, x, y) {
  g.fillStyle = '#0002'; g.fillRect(x - 60, y - 2, 120, 5); g.fillStyle = '#f6efe0'; g.fillRect(x - 55, y - 95, 110, 95); g.fillStyle = '#2f7de1'; g.fillRect(x - 62, y - 112, 124, 20);
  g.fillStyle = '#243b55'; g.fillRect(x - 28, y - 70, 56, 36); g.fillStyle = '#fff'; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.fillText('Thuyền vịt', x, y - 98);
}
function drawBanhTom(g, x, y) {
  g.fillStyle = '#0002'; g.fillRect(x - 60, y - 2, 120, 5);
  g.fillStyle = '#e4572e'; g.beginPath(); g.arc(x, y - 112, 66, Math.PI, 0); g.fill(); for (let i = -2; i <= 2; i++) { g.fillStyle = i % 2 ? '#fff' : '#e4572e'; g.beginPath(); g.moveTo(x, y - 112); g.arc(x, y - 112, 66, Math.PI + (i + 2) * 0.628, Math.PI + (i + 3) * 0.628); g.fill(); }
  g.fillStyle = '#6b4a2f'; g.fillRect(x - 2, y - 112, 4, 70);
  g.fillStyle = '#9a6a3c'; g.fillRect(x - 48, y - 52, 96, 36); g.fillStyle = '#7a4f2b'; g.fillRect(x - 48, y - 52, 96, 5); g.fillStyle = '#222'; g.beginPath(); g.arc(x - 30, y, 11, 0, 7); g.arc(x + 30, y, 11, 0, 7); g.fill();
  g.fillStyle = '#d6892e'; g.beginPath(); g.ellipse(x - 12, y - 56, 16, 5, 0, 0, 7); g.ellipse(x + 14, y - 57, 14, 4, 0, 0, 7); g.fill();
  g.strokeStyle = '#ffffff88'; g.lineWidth = 3; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 14 + i * 14, y - 62); g.quadraticCurveTo(x - 20 + i * 14 + Math.sin(T * 2 + i) * 5, y - 78, x - 14 + i * 14 + Math.sin(T * 2 + i) * 6, y - 94); g.stroke(); }
  label(g, 'Bánh tôm Hồ Tây', x, y + 22);
}
function drawTraDa(g, x, y) {
  g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y, 60, 8, 0, 0, 7); g.fill();
  g.fillStyle = '#cfd8dc'; g.fillRect(x - 28, y - 40, 56, 40); g.fillStyle = '#5a7480'; g.fillRect(x - 28, y - 40, 56, 5); g.fillStyle = '#2b9a56'; g.fillRect(x - 40, y - 28, 10, 28);
  label(g, 'Trà đá vỉa hè', x, y + 22);
}
function drawPhu(g, x, y) {
  g.fillStyle = '#0002'; g.fillRect(x - 100, y - 2, 200, 6);
  g.fillStyle = '#a6322a'; g.fillRect(x - 80, y - 130, 22, 130); g.fillRect(x + 58, y - 130, 22, 130); g.fillStyle = '#7b231e'; g.fillRect(x - 58, y - 100, 116, 100);
  g.fillStyle = '#d9a441'; g.fillRect(x - 52, y - 94, 52, 94); g.fillRect(x + 0, y - 94, 52, 94); g.strokeStyle = '#7b231e'; g.lineWidth = 2; g.strokeRect(x - 52, y - 94, 104, 94); g.beginPath(); g.moveTo(x, y - 94); g.lineTo(x, y); g.stroke();
  g.fillStyle = '#3d4a56'; g.beginPath(); g.moveTo(x - 110, y - 128); g.quadraticCurveTo(x - 80, y - 138, x, y - 170); g.quadraticCurveTo(x + 80, y - 138, x + 110, y - 128); g.lineTo(x + 88, y - 118); g.lineTo(x - 88, y - 118); g.fill();
  g.fillStyle = '#d9a441'; g.fillRect(x - 36, y - 118, 72, 14); g.fillStyle = '#7b231e'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.fillText('Phủ Tây Hồ', x, y - 107);
}
function drawMoto(g, x, y, c) {
  g.fillStyle = '#0002'; g.beginPath(); g.ellipse(x, y, 34, 5, 0, 0, 7); g.fill();
  g.fillStyle = '#222'; g.beginPath(); g.arc(x - 24, y - 12, 12, 0, 7); g.arc(x + 24, y - 12, 12, 0, 7); g.fill(); g.fillStyle = '#888'; g.beginPath(); g.arc(x - 24, y - 12, 5, 0, 7); g.arc(x + 24, y - 12, 5, 0, 7); g.fill();
  g.fillStyle = c; g.beginPath(); g.roundRect(x - 16, y - 40, 40, 20, 8); g.fill(); g.fillRect(x + 10, y - 56, 6, 34); g.fillStyle = '#333'; g.fillRect(x - 22, y - 42, 24, 6); g.fillRect(x + 6, y - 60, 16, 4);
}
function drawBanner(g, x, y) {
  g.fillStyle = '#3d3f4a'; g.fillRect(x - 130, y - 150, 5, 150); g.fillRect(x + 125, y - 150, 5, 150);
  g.fillStyle = '#d6293e'; g.beginPath(); g.roundRect(x - 135, y - 168, 270, 44, 6); g.fill();
  g.fillStyle = '#ffe066'; g.font = 'bold 19px system-ui'; g.textAlign = 'center'; g.fillText('Chào mừng đến Hồ Tây', x, y - 139);
}

const objs = [];
(function buildObjs() {
  const r = rng(5), add = (y, draw, lamp) => objs.push({ y, draw, lamp });
  for (let x = 90; x < WORLD.w - 60; x += 130 + r() * 90) { const s = 0.85 + r() * 0.35, willow = r() > 0.4; add(432 + r() * 8, g => (willow ? drawWillow(g, x, 432, s) : drawHoaSua(g, x, 432, s))); }
  for (let x = 160; x < WORLD.w - 100; x += 330 + r() * 120) add(436, g => drawBench(g, x, 438));
  for (let x = 330; x < WORLD.w - 100; x += 410) add(436, (g, night) => drawLamp(g, x, 440, night), x);
  add(436, g => drawBanner(g, 850, 442));
  add(442, g => drawCafe(g, 470, 446)); drawCafeStools(add);
  add(436, g => drawPier(g, 1250)); add(442, g => drawKiosk(g, 1250, 446));
  add(442, g => drawBanhTom(g, 2350, 480)); add(442, g => drawTraDa(g, 3000, 470)); for (const dx of [-45, 45]) add(472 + dx * 0, g => drawStool(g, 3000 + dx, 480, dx < 0 ? '#2f7de1' : '#e63950'));
  add(442, g => drawPhu(g, 3900, 446));
  for (const [x, c] of [[1750, '#b03a2e'], [2750, '#2c6fb5'], [4250, '#2e8b57'], [620, '#d4a017']]) add(498, g => drawMoto(g, x, 500, c));
})();
function drawCafeStools(add) { for (const dx of [-70, 20, 90]) { add(486, g => drawTable(g, 470 + dx, 490)); add(492, g => drawStool(g, 470 + dx - 24, 496, '#e63950')); add(492, g => drawStool(g, 470 + dx + 26, 497, '#2f7de1')); } }

/* ---- Di chuyển & nhập liệu ---- */
const SPEED = 240;
function stepMe(dt) {
  if (!me || chessCtl) return false;
  let vx = 0, vy = 0;
  if (keys.has('arrowleft') || keys.has('a')) vx -= 1; if (keys.has('arrowright') || keys.has('d')) vx += 1;
  if (keys.has('arrowup') || keys.has('w')) vy -= 1; if (keys.has('arrowdown') || keys.has('s')) vy += 1;
  if (vx || vy) me.target = null;
  else if (me.target) { const dx = me.target.x - me.x, dy = me.target.y - me.y, d = Math.hypot(dx, dy); if (d < 4) me.target = null; else { vx = dx / d; vy = dy / d; } }
  if (!vx && !vy) return false;
  const l = Math.hypot(vx, vy); vx /= l; vy /= l;
  [me.x, me.y] = clampPos(me.x + vx * SPEED * dt, me.y + vy * SPEED * 0.6 * dt);
  if (vx) me.face = vx > 0 ? 1 : -1;
  return true;
}
const toWorld = (sx, sy) => [sx / zoom + camX, sy / zoom + camY];
cv.addEventListener('pointerdown', e => {
  if (!me || !joined) return; closeCard();
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  for (const p of others.values()) { const s = depthScale(p.y); if (Math.abs(wx - p.x) < 22 * s && wy > p.y - 62 * s && wy < p.y + 8) return openCard(p.id); }
  const [x, y] = clampPos(wx, wy); me.target = { x, y };
});
const depthScale = y => 0.85 + (y - WORLD.y0) / (WORLD.y1 - WORLD.y0) * 0.35;

/* ---- Vòng lặp ---- */
let last = performance.now(), sendAt = 0, lastSent = '';
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T = now / 1000;
  const moving = stepMe(dt);
  if (me) { me.moving = moving; if (now - sendAt > 100) { sendAt = now; const s = Math.round(me.x) + ',' + Math.round(me.y); if (s !== lastSent) { lastSent = s; send({ t: 'p', x: Math.round(me.x), y: Math.round(me.y) }); } } }
  for (const o of others.values()) { const dx = o.tx - o.x, dy = o.ty - o.y; o.moving = Math.hypot(dx, dy) > 2; o.x += dx * Math.min(1, dt * 10); o.y += dy * Math.min(1, dt * 10); }
  try { render(now); } catch (e) { if (!frame.err) { frame.err = 1; console.error('render:', e); } }
  requestAnimationFrame(frame);
}
function render(now) {
  const p = palette(), vw = W / zoom, vh = H / zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = p.sky[0]; ctx.fillRect(0, 0, cv.width, cv.height);
  const fx = me ? me.x : 800;
  camX = vw >= WORLD.w ? (WORLD.w - vw) / 2 : Math.min(WORLD.w - vw, Math.max(0, fx - vw / 2));
  camY = (WORLD.h - vh) / 2;
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom);
  drawSky(ctx, p, vw); drawFarLayer(ctx, p, vw); drawChua(ctx, p, vw); drawLake(ctx, p, vw); drawGround(ctx, p, vw);
  const night = p.k === 'night', list = [], x0 = camX - 260, x1 = camX + vw + 260;
  for (const o of objs) list.push({ y: o.y, draw: g => o.draw(g, night), lamp: o.lamp });
  const all = [me, ...others.values()].filter(Boolean);
  for (const q of all) list.push({ y: q.y, draw: g => { const s = depthScale(q.y); g.save(); g.translate(q.x, q.y); g.scale(s, s); drawAvatar(g, 0, 0, q.look, q.moving, T); g.restore(); } });
  list.sort((a, b) => a.y - b.y);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, camY - 50, x1 - x0, vh + 100); ctx.clip(); for (const o of list) o.draw(ctx); ctx.restore();
  ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
  for (const q of all) {
    const s = depthScale(q.y), nm = q.shown || q.name, w = ctx.measureText(nm).width + 12, ny = q.y - (HATS[q.look.a] ? 72 : 60) * s;
    ctx.fillStyle = q === me ? '#ff7a45dd' : '#000a'; ctx.beginPath(); ctx.roundRect(q.x - w / 2, ny - 13, w, 18, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(nm, q.x, ny);
    if (q.bubble && q.bubble.until > now) bubble(ctx, q.x, ny - 22, q.bubble);
  }
  if (p.dark) { ctx.fillStyle = `rgba(10,20,60,${p.dark})`; ctx.fillRect(camX - 10, camY - 10, vw + 20, vh + 20); }
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
