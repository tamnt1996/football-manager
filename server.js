import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getMeta } from './db.js';
import { syncFpl, upsert } from './providers.js';
import { seedIfEmpty } from './seed.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const SORTS = new Set(['name', 'price', 'total_points', 'form', 'selected_by', 'goals', 'assists', 'clean_sheets', 'minutes', 'position', 'team', 'nationality']);
const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD'];
const SELECT = `SELECT p.*, t.name AS team, t.short_name AS team_short, t.league, t.badge, t.country AS team_country
  FROM players p LEFT JOIN teams t ON t.id = p.team_id`;

const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((ok, fail) => {
  let s = ''; req.on('data', c => { s += c; if (s.length > 20e6) req.destroy(); });
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { fail(new Error('Invalid JSON')); } });
});

const num = (v, d = 0) => (v === '' || v == null || isNaN(+v) ? d : +v);
function cleanPlayer(b, partial = false) {
  const o = {};
  if (!partial || b.name !== undefined) { if (!b.name?.trim()) throw new Error('name is required'); o.name = b.name.trim(); o.web_name = (b.web_name || b.name).trim(); }
  if (!partial || b.position !== undefined) { if (!POSITIONS.includes(b.position)) throw new Error('position must be GKP/DEF/MID/FWD'); o.position = b.position; }
  for (const k of ['nationality', 'birth_date', 'photo', 'notes', 'news']) if (b[k] !== undefined) o[k] = b[k] || null;
  if (b.team_id !== undefined) o.team_id = b.team_id ? +b.team_id : null;
  if (b.status !== undefined) o.status = b.status || 'a';
  for (const k of ['price', 'total_points', 'form', 'selected_by', 'goals', 'assists', 'clean_sheets', 'minutes', 'yellow', 'red']) if (b[k] !== undefined) o[k] = num(b[k]);
  return o;
}

function listPlayers(q) {
  const where = [], args = [];
  if (q.q) { where.push('(p.name LIKE ? OR p.web_name LIKE ? OR t.name LIKE ? OR p.nationality LIKE ?)'); const l = `%${q.q}%`; args.push(l, l, l, l); }
  if (q.ids) { const ids = q.ids.split(',').map(Number).filter(Number.isFinite).slice(0, 50); where.push(`p.id IN (${ids.map(() => '?').join(',') || 'NULL'})`); args.push(...ids); }
  if (q.pos) { where.push('p.position = ?'); args.push(q.pos); }
  if (q.team) { where.push('p.team_id = ?'); args.push(+q.team); }
  if (q.league) { where.push('t.league = ?'); args.push(q.league); }
  if (q.nationality) { where.push('p.nationality = ?'); args.push(q.nationality); }
  if (q.min_price) { where.push('p.price >= ?'); args.push(+q.min_price); }
  if (q.max_price) { where.push('p.price <= ?'); args.push(+q.max_price); }
  if (q.status) { where.push(q.status === 'unavailable' ? "p.status != 'a'" : 'p.status = ?'); if (q.status !== 'unavailable') args.push(q.status); }
  const W = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const sort = SORTS.has(q.sort) ? q.sort : 'total_points';
  const col = sort === 'team' ? 't.name' : sort === 'name' ? 'p.web_name' : 'p.' + sort;
  const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(Math.max(+q.limit || 25, 1), 200), page = Math.max(+q.page || 1, 1);
  const total = db.prepare(`SELECT COUNT(*) c FROM players p LEFT JOIN teams t ON t.id=p.team_id${W}`).get(...args).c;
  const rows = db.prepare(`${SELECT}${W} ORDER BY ${col} ${dir}, p.id LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit);
  return { total, page, limit, pages: Math.ceil(total / limit), rows };
}

const routes = [];
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const isAdmin = req => !ADMIN_TOKEN || req.headers['x-admin-token'] === ADMIN_TOKEN;
const route = (method, pattern, fn, admin = false) => routes.push({ method, admin, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/api/meta', () => ({
  players: db.prepare('SELECT COUNT(*) c FROM players').get().c,
  teams: db.prepare('SELECT COUNT(*) c FROM teams').get().c,
  leagues: db.prepare("SELECT DISTINCT league FROM teams WHERE league IS NOT NULL ORDER BY league").all().map(r => r.league),
  nationalities: db.prepare("SELECT DISTINCT nationality FROM players WHERE nationality IS NOT NULL ORDER BY nationality").all().map(r => r.nationality),
  last_sync_fpl: getMeta('last_sync_fpl'),
}));
route('GET', '/api/players', ({ query }) => listPlayers(query));
route('GET', '/api/players/:id', ({ params }) => {
  const p = db.prepare(`${SELECT} WHERE p.id=?`).get(+params.id);
  if (!p) throw Object.assign(new Error('Not found'), { code: 404 });
  return p;
});
route('POST', '/api/players', ({ body }) => {
  const o = cleanPlayer(body);
  o.source = 'manual'; o.ext_id = `m${Date.now()}${Math.floor(Math.random() * 1e3)}`;
  const keys = Object.keys(o);
  const r = db.prepare(`INSERT INTO players(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...keys.map(k => o[k]));
  return { id: Number(r.lastInsertRowid) };
}, true);
route('PUT', '/api/players/:id', ({ params, body }) => {
  const o = cleanPlayer(body, true), keys = Object.keys(o);
  if (keys.length) db.prepare(`UPDATE players SET ${keys.map(k => k + '=?').join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...keys.map(k => o[k]), +params.id);
  return { ok: true };
}, true);
route('DELETE', '/api/players/:id', ({ params }) => { db.prepare('DELETE FROM players WHERE id=?').run(+params.id); return { ok: true }; }, true);

route('GET', '/api/teams', () => db.prepare(`SELECT t.*, COUNT(p.id) AS players FROM teams t LEFT JOIN players p ON p.team_id=t.id GROUP BY t.id ORDER BY t.league, t.name`).all());
route('POST', '/api/teams', ({ body }) => {
  if (!body.name?.trim()) throw new Error('name is required');
  const r = db.prepare('INSERT INTO teams(source,ext_id,name,short_name,league,country,badge) VALUES(?,?,?,?,?,?,?)')
    .run('manual', `m${Date.now()}`, body.name.trim(), body.short_name || null, body.league || null, body.country || null, body.badge || null);
  return { id: Number(r.lastInsertRowid) };
}, true);

route('GET', '/api/whoami', ({ admin }) => ({ admin, protected: !!ADMIN_TOKEN }));
route('POST', '/api/sync/fpl', async () => ({ ok: true, ...(await syncFpl()) }), true);
// Bulk import: { players:[{name, position, team:"Real Madrid", league, country, nationality, price, ...}] }
route('POST', '/api/import', ({ body }) => {
  const list = Array.isArray(body) ? body : body.players;
  if (!Array.isArray(list)) throw new Error('Expected an array of players');
  const teams = new Map(), players = [];
  list.forEach((p, i) => {
    if (!p.name || !POSITIONS.includes(p.position)) throw new Error(`Row ${i + 1}: name and position (GKP/DEF/MID/FWD) required`);
    let teamKey = null;
    if (p.team) {
      teamKey = `${p.team}|${p.league || ''}`;
      if (!teams.has(teamKey)) teams.set(teamKey, { ext_id: teamKey, name: p.team, short_name: p.team.slice(0, 3).toUpperCase(), league: p.league || null, country: p.country || null, badge: null });
    }
    const { team, league, country, ...rest } = p;
    players.push({ ...rest, web_name: p.web_name || p.name, ext_id: String(p.ext_id || `${p.name}|${p.birth_date || ''}`), team_ext: teamKey, price: num(p.price), position: p.position });
  });
  return { ok: true, ...upsert('import', { teams: [...teams.values()], players }) };
}, true);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        const admin = isAdmin(req);
        if (r.admin && !admin) return json(res, 403, { error: 'Cần quyền admin' });
        const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
        return json(res, 200, await r.fn({ admin, params: m.groups || {}, query: Object.fromEntries(url.searchParams), body }));
      }
      return json(res, 404, { error: 'Not found' });
    }
    let file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    json(res, e.code === 404 ? 404 : 400, { error: e.message });
  }
});

if (process.argv.includes('--sync')) {
  syncFpl().then(r => { console.log('FPL synced', r); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); });
} else {
  const seeded = seedIfEmpty();
  if (seeded) console.log('Seeded demo players (use "Sync FPL" in the Data tab for real Premier League data).');
  server.listen(PORT, HOST, () => {
    console.log(`Football Manager running at http://localhost:${PORT}`);
    // Auto-sync FPL on first start (and refresh if older than 6h)
    const last = getMeta('last_sync_fpl');
    if (!last || Date.now() - Date.parse(last) > 6 * 3600e3) syncFpl().then(r => console.log('FPL synced', r)).catch(e => console.log('FPL sync skipped:', e.message));
  });
}
