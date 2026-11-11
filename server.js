// Server trò chơi trực tuyến Hồ Tây: HTTP tĩnh + WebSocket tự viết, không cần thư viện ngoài.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WORLD, inWater, clampPos, evaluate, NAME_RE, COLORS, HATS } from './shared.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(process.env.DATA_DIR || ROOT, 'users.json');
const WORDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words.json'), 'utf8'));
const MAX_TRIES = 6, MAX_PLAYERS = 200;

/* ---------- tài khoản (tên + mã bí mật lưu trong trình duyệt) ---------- */
const users = new Map();
try { for (const u of JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))) users.set(u.name.toLowerCase(), u); } catch {}
let saveTimer = null;
const saveUsers = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { fs.writeFileSync(USERS_FILE, JSON.stringify([...users.values()])); } catch {} }, 500); };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

/* ---------- HTTP tĩnh ---------- */
const ALLOW = /^\/(index\.html|doantu\.html|doantu\.js|world\.js|world\.css|style\.css|shared\.js|config\.js|data\/words\.json)?$/;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/health') { res.end('ok'); return; }
  if (!ALLOW.test(p)) { res.writeHead(404); res.end('Not found'); return; }
  const file = path.join(ROOT, p === '/' ? 'index.html' : p);
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

/* ---------- WebSocket tối giản ---------- */
function frame(op, data) {
  const len = data.length; let h;
  if (len < 126) h = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([h, data]);
}
const send = (p, obj) => { if (p.socket.writable) p.socket.write(frame(1, Buffer.from(JSON.stringify(obj)))); };

server.on('upgrade', (req, socket) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws' || !req.headers['sec-websocket-key']) return socket.destroy();
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const p = { socket, buf: Buffer.alloc(0), frag: [], id: null, alive: true, lastMsg: 0 };
  socket.on('data', chunk => {
    p.buf = Buffer.concat([p.buf, chunk]);
    for (;;) {
      if (p.buf.length < 2) return;
      const fin = !!(p.buf[0] & 0x80), op = p.buf[0] & 0x0f, masked = !!(p.buf[1] & 0x80);
      let len = p.buf[1] & 0x7f, off = 2;
      if (len === 126) { if (p.buf.length < 4) return; len = p.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (p.buf.length < 10) return; len = Number(p.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 16384) return socket.destroy();
      const total = off + (masked ? 4 : 0) + len;
      if (p.buf.length < total) return;
      let payload = Buffer.from(p.buf.subarray(off + (masked ? 4 : 0), total));
      if (masked) { const m = p.buf.subarray(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i % 4]; }
      p.buf = p.buf.subarray(total);
      if (op === 8) return socket.end(frame(8, Buffer.alloc(0)));
      if (op === 9) { socket.write(frame(10, payload)); continue; }
      if (op === 10) { p.alive = true; continue; }
      if (op === 1 || op === 0) {
        p.frag.push(payload);
        if (fin) { const text = Buffer.concat(p.frag).toString('utf8'); p.frag = []; try { onMessage(p, JSON.parse(text)); } catch (e) { /* bỏ qua tin hỏng */ } }
      }
    }
  });
  const drop = () => onClose(p);
  socket.on('close', drop); socket.on('error', drop);
});

/* ---------- logic thế giới ---------- */
const players = new Map(); // id -> p
let nextId = 1;
const dirty = new Set();
const pub = p => ({ id: p.id, name: p.name, look: p.look, x: p.x, y: p.y });
const broadcast = (obj, except) => { for (const q of players.values()) if (q !== except) send(q, obj); };

function sanitizeLook(l) {
  const c = Number.isInteger(l?.c) && l.c >= 0 && l.c < COLORS.length ? l.c : 0;
  const a = Number.isInteger(l?.a) && l.a >= 0 && l.a < HATS.length ? l.a : 0;
  return { c, a };
}

function onMessage(p, m) {
  if (typeof m !== 'object' || !m) return;
  if (!p.id) {
    if (m.t !== 'join') return;
    const name = String(m.name || '').trim().replace(/\s+/g, ' ');
    if (!NAME_RE.test(name)) return send(p, { t: 'error', msg: 'Tên 3–16 ký tự, chỉ gồm chữ, số, khoảng trắng hoặc _' });
    if (players.size >= MAX_PLAYERS) return send(p, { t: 'error', msg: 'Hồ Tây đang đông quá, thử lại sau nhé' });
    const key = name.toLowerCase(), look = sanitizeLook(m.look);
    let acct = users.get(key), token = String(m.token || '');
    if (acct) {
      if (!token || sha(token) !== acct.h) return send(p, { t: 'error', msg: 'Tên này đã có người đăng ký, hãy chọn tên khác' });
      acct.look = look;
    } else {
      token = crypto.randomBytes(18).toString('hex');
      acct = { name, h: sha(token), look }; users.set(key, acct);
    }
    saveUsers();
    for (const q of players.values()) if (q.name.toLowerCase() === key) return send(p, { t: 'error', msg: 'Tên này đang online ở nơi khác' });
    p.id = nextId++; p.name = acct.name; p.look = look; p.game = null;
    p.x = 800 + Math.round(Math.random() * 200 - 100); p.y = 900; p.lastChat = 0; p.invites = new Map();
    players.set(p.id, p);
    send(p, { t: 'welcome', id: p.id, token, you: pub(p), players: [...players.values()].map(pub) });
    broadcast({ t: 'join', p: pub(p) }, p);
    return;
  }
  const now = Date.now();
  switch (m.t) {
    case 'm': {
      const [x, y] = clampPos(+m.x || 0, +m.y || 0);
      if (!inWater(x, y)) { p.x = x; p.y = y; dirty.add(p.id); }
      break;
    }
    case 'chat': {
      if (now - p.lastChat < 700) return;
      const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!text) return;
      p.lastChat = now; broadcast({ t: 'chat', id: p.id, text });
      break;
    }
    case 'emote': if (now - p.lastChat >= 400 && ['👋', '😂', '❤️', '👍', '🎉'].includes(m.e)) { p.lastChat = now; broadcast({ t: 'emote', id: p.id, e: m.e }); } break;
    case 'invite': {
      const q = players.get(+m.to);
      if (!q || q === p) return;
      if (p.game || q.game) return send(p, { t: 'notice', msg: 'Một trong hai người đang trong ván chơi' });
      if (q.invites.has(p.id) && now - q.invites.get(p.id) < 20000) return send(p, { t: 'notice', msg: 'Bạn vừa mời rồi, đợi một chút nhé' });
      q.invites.set(p.id, now);
      send(q, { t: 'invite', from: p.id, name: p.name });
      send(p, { t: 'notice', msg: `Đã gửi lời mời cho ${q.name}` });
      break;
    }
    case 'reply': {
      const q = players.get(+m.to);
      if (!q || !p.invites.has(q.id) || now - p.invites.get(q.id) > 30000) return;
      p.invites.delete(q.id);
      if (!m.accept) return send(q, { t: 'notice', msg: `${p.name} chưa muốn chơi lúc này` });
      if (p.game || q.game) return send(p, { t: 'notice', msg: 'Ván chơi không còn khả dụng' });
      startDuel(q, p);
      break;
    }
    case 'guess': {
      const g = p.game; if (!g || g.over) return;
      const guess = String(m.guess || '').toLowerCase();
      const mine = g.tries.get(p.id);
      if (guess.length !== g.word.k.length || !/^[a-z]+$/.test(guess) || mine.length >= MAX_TRIES) return;
      const colors = evaluate(guess, g.word.k);
      mine.push(guess);
      const opp = players.get(g.otherOf(p.id));
      send(p, { t: 'gres', guess, colors, tries: mine.length });
      if (opp) send(opp, { t: 'gopp', colors, tries: mine.length });
      if (guess === g.word.k) return endDuel(g, p.id);
      if ([...g.tries.values()].every(a => a.length >= MAX_TRIES)) endDuel(g, null);
      break;
    }
    case 'gleave': if (p.game && !p.game.over) endDuel(p.game, p.game.otherOf(p.id), true); break;
  }
}

function startDuel(a, b) {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const g = { word, over: false, ids: [a.id, b.id], tries: new Map([[a.id, []], [b.id, []]]), otherOf: id => (id === a.id ? b.id : a.id) };
  a.game = b.game = g;
  for (const [me, op] of [[a, b], [b, a]]) send(me, { t: 'gstart', opp: { id: op.id, name: op.name }, len: word.k.length, hint: word.h, max: MAX_TRIES });
}
function endDuel(g, winnerId, forfeit = false) {
  if (g.over) return; g.over = true;
  for (const id of g.ids) { const q = players.get(id); if (q) { q.game = null; send(q, { t: 'gend', winner: winnerId, word: g.word.w, forfeit }); } }
}

function onClose(p) {
  if (p.closed) return; p.closed = true;
  if (p.id && players.has(p.id)) {
    if (p.game && !p.game.over) endDuel(p.game, p.game.otherOf(p.id), true);
    players.delete(p.id); dirty.delete(p.id);
    broadcast({ t: 'leave', id: p.id });
  }
  p.socket.destroy();
}

setInterval(() => {
  if (!dirty.size) return;
  const list = [...dirty].map(id => players.get(id)).filter(Boolean).map(q => [q.id, Math.round(q.x), Math.round(q.y)]);
  dirty.clear();
  broadcast({ t: 's', p: list });
}, 100);
setInterval(() => { for (const p of players.values()) { if (!p.alive) { onClose(p); continue; } p.alive = false; p.socket.write(frame(9, Buffer.alloc(0))); } }, 25000);

server.listen(PORT, () => console.log(`Hồ Tây Online chạy tại http://localhost:${PORT}`));
