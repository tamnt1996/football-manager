const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = async (url, opts = {}) => {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken() }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Lỗi');
  return d;
};
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); };

const adminToken = () => { try { return localStorage.getItem('adminToken') || ''; } catch { return ''; } };
const state = { admin: false, page: 1, sort: 'total_points', dir: 'desc', squad: [], teams: [], meta: {} };
const LIMITS = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };

// ---------- tabs ----------
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'tab-' + b.dataset.tab);
  if (b.dataset.tab === 'teams') loadTeams();
  if (b.dataset.tab === 'squad') renderSquad();
});

// ---------- meta / filters ----------
async function loadMeta() {
  const m = state.meta = await api('/api/meta');
  $('#stats').textContent = `${m.players} cầu thủ · ${m.teams} đội`;
  $('#lastsync').textContent = m.last_sync_fpl ? new Date(m.last_sync_fpl).toLocaleString() : 'chưa đồng bộ';
  const fill = (sel, items, first) => { const cur = $(sel).value; $(sel).innerHTML = `<option value="">${first}</option>` + items.map(i => `<option value="${esc(i.v)}">${esc(i.t)}</option>`).join(''); $(sel).value = cur; };
  fill('#f-league', m.leagues.map(v => ({ v, t: v })), 'Mọi giải đấu');
  fill('#f-nat', m.nationalities.map(v => ({ v, t: v })), 'Mọi quốc tịch');
  state.teams = await api('/api/teams');
  fill('#f-team', state.teams.map(t => ({ v: t.id, t: t.name })), 'Mọi đội');
}

// ---------- players table ----------
function avatar(p) {
  return p.photo ? `<img src="${esc(p.photo)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'avatar',textContent:'${esc(p.web_name?.[0] || '?')}'}))">`
                 : `<span class="avatar">${esc(p.web_name?.[0] || '?')}</span>`;
}
const posTag = p => `<span class="pos ${p}">${p}</span>`;

async function loadPlayers() {
  const q = new URLSearchParams({ page: state.page, sort: state.sort, dir: state.dir, limit: 25 });
  const f = { q: '#f-q', pos: '#f-pos', league: '#f-league', team: '#f-team', nationality: '#f-nat', status: '#f-status', max_price: '#f-maxp' };
  for (const [k, s] of Object.entries(f)) if ($(s).value) q.set(k, $(s).value);
  const d = await api('/api/players?' + q);
  const inSquad = new Set(state.squad.map(p => p.id));
  $('#ptable tbody').innerHTML = d.rows.map(p => `<tr>
    <td><div class="pl" data-id="${p.id}">${avatar(p)}<div><b>${esc(p.web_name)}</b>${p.status !== 'a' ? ` <span class="flag" title="${esc(p.news || '')}">⚠ ${esc(p.news || 'Vắng mặt')}</span>` : ''}<small>${esc(p.name)}</small></div></div></td>
    <td>${posTag(p.position)}</td>
    <td>${p.badge ? `<img class="badge" src="${esc(p.badge)}" alt="">` : ''}${esc(p.team || '—')}<small class="muted"> ${esc(p.league || '')}</small></td>
    <td>${esc(p.nationality || '')}</td>
    <td class="r">£${p.price.toFixed(1)}</td><td class="r"><b>${p.total_points}</b></td><td class="r">${p.form}</td>
    <td class="r">${p.selected_by}%</td><td class="r">${p.goals}</td><td class="r">${p.assists}</td><td class="r">${p.minutes}</td>
    <td><button data-add="${p.id}" ${inSquad.has(p.id) ? 'disabled' : ''} title="Thêm vào đội hình">＋</button></td></tr>`).join('')
    || '<tr><td colspan="12" class="muted">Không có kết quả.</td></tr>';
  $('#pageinfo').textContent = `Trang ${d.page}/${d.pages || 1} · ${d.total} cầu thủ`;
  $('#prev').disabled = d.page <= 1; $('#next').disabled = d.page >= d.pages;
  document.querySelectorAll('th[data-sort]').forEach(th => { th.classList.toggle('sorted', th.dataset.sort === state.sort); th.classList.toggle('asc', state.dir === 'asc'); });
}
document.querySelectorAll('th[data-sort]').forEach(th => th.onclick = () => {
  const s = th.dataset.sort;
  state.dir = state.sort === s && state.dir === 'desc' ? 'asc' : (['name', 'team', 'nationality', 'position'].includes(s) ? 'asc' : 'desc');
  state.sort = s; state.page = 1; loadPlayers();
});
let timer; const reload = () => { clearTimeout(timer); timer = setTimeout(() => { state.page = 1; loadPlayers(); }, 250); };
['#f-q', '#f-maxp'].forEach(s => $(s).oninput = reload);
['#f-pos', '#f-league', '#f-team', '#f-nat', '#f-status'].forEach(s => $(s).onchange = reload);
$('#prev').onclick = () => { state.page--; loadPlayers(); };
$('#next').onclick = () => { state.page++; loadPlayers(); };
$('#ptable tbody').onclick = async e => {
  const add = e.target.closest('[data-add]');
  if (add) return addToSquad(+add.dataset.add);
  const pl = e.target.closest('.pl');
  if (pl) showPlayer(+pl.dataset.id);
};

// ---------- player dialog ----------
const dlg = $('#dlg'), dform = $('#dlgform');
async function showPlayer(id) {
  const p = await api('/api/players/' + id);
  dform.innerHTML = `<div style="display:flex;gap:14px;align-items:center">${avatar(p).replace('<img', '<img style="width:80px;height:100px"')}
    <div><h2 style="margin:0">${esc(p.name)}</h2>${posTag(p.position)} ${p.badge ? `<img class="badge" src="${esc(p.badge)}">` : ''}${esc(p.team || 'Tự do')} <span class="muted">${esc(p.league || '')}</span>
    <div class="muted">${esc(p.nationality || '')} ${p.birth_date ? '· ' + esc(p.birth_date) : ''}</div></div></div>
    ${p.news ? `<p class="flag">⚠ ${esc(p.news)}</p>` : ''}
    <div class="statgrid">${[['Giá', '£' + p.price.toFixed(1) + 'm'], ['Điểm', p.total_points], ['Phong độ', p.form], ['%Chọn', p.selected_by + '%'], ['Bàn thắng', p.goals], ['Kiến tạo', p.assists], ['Giữ sạch lưới', p.clean_sheets], ['Phút', p.minutes], ['Thẻ vàng', p.yellow], ['Thẻ đỏ', p.red]].map(([k, v]) => `<div><b>${v}</b><small class="muted">${k}</small></div>`).join('')}</div>
    ${p.notes ? `<p>${esc(p.notes)}</p>` : ''}
    <div class="actions">${state.admin ? '<button type="button" class="danger" id="d-del">Xoá</button><button type="button" id="d-edit">Sửa</button>' : ''}<button type="submit">Đóng</button></div>`;
  if (state.admin) $('#d-edit').onclick = () => editPlayer(p);
  if (state.admin) $('#d-del').onclick = async () => { if (confirm(`Xoá ${p.name}?`)) { await api('/api/players/' + id, { method: 'DELETE' }); dlg.close(); await refreshAll(); toast('Đã xoá'); } };
  dlg.showModal();
}
function editPlayer(p = {}) {
  const isNew = !p.id;
  const teams = state.teams.map(t => `<option value="${t.id}" ${t.id === p.team_id ? 'selected' : ''}>${esc(t.name)}${t.league ? ' (' + esc(t.league) + ')' : ''}</option>`).join('');
  const inp = (k, label, type = 'text', extra = '') => `<label>${label}<input name="${k}" type="${type}" ${extra} value="${esc(p[k] ?? '')}"></label>`;
  dform.innerHTML = `<h3 style="margin-top:0">${isNew ? 'Thêm cầu thủ' : 'Sửa ' + esc(p.name)}</h3><div class="grid2">
    ${inp('name', 'Họ tên *', 'text', 'required')}${inp('web_name', 'Tên hiển thị')}
    <label>Vị trí<select name="position">${['GKP', 'DEF', 'MID', 'FWD'].map(x => `<option ${x === p.position ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label>Đội<select name="team_id"><option value="">— Tự do —</option>${teams}</select></label>
    ${inp('nationality', 'Quốc tịch')}${inp('birth_date', 'Ngày sinh', 'date')}
    ${inp('price', 'Giá (£m)', 'number', 'step="0.1"')}${inp('total_points', 'Tổng điểm', 'number')}
    ${inp('goals', 'Bàn thắng', 'number')}${inp('assists', 'Kiến tạo', 'number')}
    ${inp('minutes', 'Số phút', 'number')}${inp('clean_sheets', 'Giữ sạch lưới', 'number')}
    <label class="full">Ảnh (URL)<input name="photo" value="${esc(p.photo ?? '')}"></label>
    <label class="full">Ghi chú<textarea name="notes" rows="2">${esc(p.notes ?? '')}</textarea></label></div>
    <div class="actions"><button type="button" id="d-cancel">Huỷ</button><button class="primary" type="submit">Lưu</button></div>`;
  $('#d-cancel').onclick = () => dlg.close();
  dform.onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(dform));
    try {
      await api(isNew ? '/api/players' : '/api/players/' + p.id, { method: isNew ? 'POST' : 'PUT', body });
      dlg.close(); await refreshAll(); toast('Đã lưu');
    } catch (err) { toast(err.message); }
  };
  if (!dlg.open) dlg.showModal();
}
$('#btn-add').onclick = () => editPlayer();
dform.onsubmit = null;

// ---------- teams ----------
async function loadTeams() {
  state.teams = await api('/api/teams');
  $('#teamgrid').innerHTML = state.teams.map(t => `<div class="card" data-team="${t.id}">${t.badge ? `<img src="${esc(t.badge)}" alt="">` : '🛡️'}<h4>${esc(t.name)}</h4><div class="muted">${esc(t.league || '')}${t.country ? ' · ' + esc(t.country) : ''}</div><div>${t.players} cầu thủ</div></div>`).join('');
}
$('#teamgrid').onclick = e => {
  const c = e.target.closest('[data-team]'); if (!c) return;
  document.querySelector('[data-tab=players]').click();
  $('#f-team').value = c.dataset.team; state.page = 1; loadPlayers();
};

// ---------- squad ----------
const squadIds = () => { try { return JSON.parse(localStorage.getItem('squad') || '[]'); } catch { return []; } };
const saveIds = () => { try { localStorage.setItem('squad', JSON.stringify(state.squad.map(p => p.id))); } catch {} };
async function loadSquad() {
  const ids = squadIds();
  state.squad = ids.length ? (await api('/api/players?limit=50&ids=' + ids.join(','))).rows : [];
}
function renderSquad() {
  const cost = state.squad.reduce((s, p) => s + p.price, 0);
  $('#squadinfo').innerHTML = `${state.squad.length}/15 cầu thủ · Chi tiêu £${cost.toFixed(1)}m · <span class="${cost > 100 ? 'over' : ''}">Còn lại £${(100 - cost).toFixed(1)}m</span> · Điểm: ${state.squad.reduce((s, p) => s + p.total_points, 0)}`;
  $('#pitch').innerHTML = ['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
    const have = state.squad.filter(p => p.position === pos);
    const slots = Array.from({ length: LIMITS[pos] }, (_, i) => have[i]);
    return `<div class="row">${slots.map(p => p ? `<div class="slot filled"><div class="shirt">${p.photo ? `<img src="${esc(p.photo)}" onerror="this.remove()">` : posTag(pos)}</div><div class="nm">${esc(p.web_name)}</div><div class="pr">£${p.price.toFixed(1)} · ${p.total_points}đ</div><button data-rm="${p.id}">Bỏ</button></div>`
      : `<div class="slot"><div class="shirt">${posTag(pos)}</div><div class="nm">&nbsp;</div></div>`).join('')}</div>`;
  }).join('');
}
$('#pitch').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { state.squad = state.squad.filter(p => p.id !== +b.dataset.rm); saveIds(); renderSquad(); loadPlayers(); } };
$('#btn-clearsquad').onclick = () => { state.squad = []; saveIds(); renderSquad(); loadPlayers(); };
$('#btn-savesquad').onclick = async () => {
  const cost = state.squad.reduce((s, p) => s + p.price, 0);
  if (cost > 100.0001) return toast('Vượt ngân sách £100m');
  saveIds(); toast('Đã lưu đội hình (trong trình duyệt này)');
};

// ---------- data tab ----------
$('#btn-sync').onclick = async () => {
  $('#syncmsg').textContent = 'Đang đồng bộ…'; $('#btn-sync').disabled = true;
  try { const r = await api('/api/sync/fpl', { method: 'POST' }); $('#syncmsg').textContent = `Xong: ${r.teams} đội, ${r.players} cầu thủ`; await refreshAll(); }
  catch (e) { $('#syncmsg').textContent = 'Lỗi: ' + e.message; }
  $('#btn-sync').disabled = false;
};
function parseCsv(t) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  const [h, ...rest] = rows; const keys = h.map(x => x.trim());
  return rest.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
$('#importfile').onchange = async e => { $('#importtext').value = await e.target.files[0].text(); };
$('#btn-import').onclick = async () => {
  const t = $('#importtext').value.trim(); if (!t) return;
  try {
    const players = t.startsWith('[') || t.startsWith('{') ? JSON.parse(t) : parseCsv(t);
    const r = await api('/api/import', { method: 'POST', body: players });
    $('#importmsg').textContent = `Đã nhập ${r.players} cầu thủ, ${r.teams} đội`; await applyAuth().then(refreshAll);
  } catch (e) { $('#importmsg').textContent = 'Lỗi: ' + e.message; }
};

async function applyAuth() {
  const w = await api('/api/whoami'); state.admin = w.admin;
  document.querySelectorAll('[data-tab=data], #btn-add').forEach(e => e.style.display = w.admin ? '' : 'none');
  const b = $('#btn-login'); b.textContent = !w.protected ? '' : w.admin ? 'Thoát admin' : 'Admin';
  b.style.display = w.protected ? '' : 'none';
  b.onclick = async () => {
    if (w.admin) localStorage.removeItem('adminToken');
    else { const t = prompt('Nhập mã admin'); if (!t) return; localStorage.setItem('adminToken', t); }
    await applyAuth(); await applyAuth().then(refreshAll);
  };
}
async function refreshAll() { await Promise.all([loadMeta(), loadSquad()]); await loadPlayers(); renderSquad(); }
applyAuth().then(refreshAll);
