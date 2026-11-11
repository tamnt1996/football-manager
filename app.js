const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); };
const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
async function share(text) {
  const data = { title: 'Gia đình kết nối', text, url: location.href.split('#')[0] };
  try { if (navigator.share) return await navigator.share(data); } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text}\n${data.url}`); toast('Đã chép nội dung, hãy dán để gửi'); } catch { toast(text); }
}

/* ---------- tabs ---------- */
$('#tabs').onclick = e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'tab-' + b.dataset.tab);
  history.replaceState(null, '', '#' + b.dataset.tab);
};
const startTab = location.hash.slice(1);
if (startTab && $(`[data-tab="${startTab}"]`)) $(`[data-tab="${startTab}"]`).click();

/* ---------- daily challenge ---------- */
let challenges = [], done = load('done', {});
const streak = () => { let d = new Date(), n = 0; if (!done[key(d)]) d = addDays(d, -1); while (done[key(d)]) { n++; d = addDays(d, -1); } return n; };
function todaysChallenge() { return challenges[hash(key(new Date())) % challenges.length]; }
function renderToday() {
  if (!challenges.length) return;
  const c = todaysChallenge(), k = key(new Date());
  $('#c-date').textContent = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
  $('#c-cat').textContent = c.cat; $('#c-text').textContent = c.text;
  $('#challenge').classList.toggle('done', !!done[k]);
  $('#c-done').textContent = done[k] ? '🎉 Đã hoàn thành hôm nay' : '✅ Cả nhà đã làm xong';
  $('#c-done').disabled = !!done[k];
  $('#c-msg').textContent = done[k] ? 'Tuyệt vời! Hẹn cả nhà ngày mai.' : '';
  $('#s-streak').textContent = streak();
  $('#s-total').textContent = Object.keys(done).length;
  $('#s-min').textContent = load('minutes', 0);
  $('#week').innerHTML = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6)).map(d =>
    `<div class="${done[key(d)] ? 'ok' : ''} ${key(d) === k ? 'today' : ''}">${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]}<br>${done[key(d)] ? '✓' : '·'}</div>`).join('');
}
$('#c-done').onclick = () => { done[key(new Date())] = 1; save('done', done); renderToday(); toast(`🔥 Chuỗi ${streak()} ngày!`); };
$('#c-share').onclick = () => share(`Thử thách gia đình hôm nay: ${todaysChallenge().text}${streak() ? ` (nhà mình đang giữ chuỗi ${streak()} ngày 🔥)` : ''}`);

/* ---------- phone-free timer ---------- */
let minutes = 15, endAt = 0, tick = null;
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
$('#durs').onclick = e => {
  const b = e.target.closest('[data-m]'); if (!b || tick) return;
  minutes = +b.dataset.m; $('#clock').textContent = fmt(minutes * 60);
  document.querySelectorAll('#durs button').forEach(x => x.classList.toggle('on', x === b));
};
function stopTimer(completed) {
  clearInterval(tick); tick = null;
  $('#f-start').hidden = false; $('#f-stop').hidden = true; $('#bar-fill').style.width = '0';
  $('#clock').textContent = fmt(minutes * 60);
  if (completed) { save('minutes', load('minutes', 0) + minutes); $('#f-msg').textContent = `🎉 Hoàn thành ${minutes} phút bên nhau!`; renderToday(); }
  else $('#f-msg').textContent = '';
}
$('#f-start').onclick = () => {
  endAt = Date.now() + minutes * 60000; $('#f-start').hidden = true; $('#f-stop').hidden = false; $('#f-msg').textContent = 'Đặt điện thoại xuống và cùng làm việc khác nhé.';
  tick = setInterval(() => {
    const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    $('#clock').textContent = fmt(left); $('#bar-fill').style.width = (100 - left / (minutes * 60) * 100) + '%';
    if (left <= 0) stopTimer(true);
  }, 500);
};
$('#f-stop').onclick = () => stopTimer(false);

/* ---------- conversation cards ---------- */
let questions = {}, qcat = '';
function renderQcats() {
  const cats = ['Tất cả', ...Object.keys(questions)];
  $('#qcats').innerHTML = cats.map(c => `<button data-c="${c === 'Tất cả' ? '' : esc(c)}" class="${(c === 'Tất cả' ? '' : c) === qcat ? 'on' : ''}">${esc(c)}</button>`).join('');
}
$('#qcats').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; qcat = b.dataset.c; renderQcats(); nextQ(); };
function nextQ() {
  const pool = qcat ? questions[qcat] : Object.values(questions).flat();
  if (pool.length) $('#q-text').textContent = pool[Math.floor(Math.random() * pool.length)];
}
$('#q-next').onclick = nextQ;
$('#q-share').onclick = () => { const t = $('#q-text').textContent; if (t.includes('?')) share(`Câu hỏi cho cả nhà: ${t}`); else toast('Hãy rút một thẻ trước'); };

/* ---------- places ---------- */
const AGES = { toddler: 'Bé nhỏ', kids: 'Trẻ em', teen: 'Thiếu niên', senior: 'Ông bà' };
const MONEY = n => '₫'.repeat(n);
let places = [], favs = new Set(load('favs', []));
const mapUrl = p => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.name}, ${p.city}`);
function filtered() {
  const q = $('#f-q').value.trim().toLowerCase();
  const f = { city: $('#f-city').value, category: $('#f-cat').value, setting: $('#f-setting').value, age: $('#f-age').value, budget: $('#f-budget').value };
  return places.filter(p =>
    (!q || `${p.name} ${p.area} ${p.city} ${p.desc}`.toLowerCase().includes(q)) &&
    (!f.city || p.city === f.city) && (!f.category || p.category === f.category) &&
    (!f.setting || p.setting === f.setting) && (!f.age || p.ages.includes(f.age)) &&
    (!f.budget || p.budget === +f.budget) && (!$('#f-fav').checked || favs.has(p.id)));
}
function renderPlaces() {
  const list = filtered();
  $('#count').textContent = `${list.length} địa điểm`;
  $('#grid').innerHTML = list.map(p => `
    <article class="card" data-id="${esc(p.id)}">
      <button class="fav ${favs.has(p.id) ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="Yêu thích">${favs.has(p.id) ? '♥' : '♡'}</button>
      <h3 style="margin:0 34px 0 0">${esc(p.name)}</h3>
      <div class="loc">📍 ${esc(p.area)}, ${esc(p.city)}</div>
      <p>${esc(p.desc)}</p>
      <div class="tags"><span class="tag">${esc(p.category)}</span><span class="tag">${esc(p.setting)}</span><span class="tag">${MONEY(p.budget)}</span><span class="tag">⏱ ${esc(p.duration)}</span></div>
    </article>`).join('') || '<p class="muted">Chưa có địa điểm phù hợp. Thử bỏ bớt bộ lọc nhé.</p>';
}
function showPlace(p) {
  $('#dlgbody').innerHTML = `
    <h2>${esc(p.name)}</h2><div class="loc">📍 ${esc(p.area)}, ${esc(p.city)}</div><p>${esc(p.desc)}</p>
    <div class="tags"><span class="tag">${esc(p.category)}</span><span class="tag">${esc(p.setting)}</span><span class="tag">${MONEY(p.budget)}</span><span class="tag">⏱ ${esc(p.duration)}</span>${p.ages.map(a => `<span class="tag">👪 ${AGES[a]}</span>`).join('')}</div>
    ${p.tip ? `<div class="box">💡 ${esc(p.tip)}</div>` : ''}
    <div class="actions"><button id="d-close">Đóng</button><button id="d-fav">${favs.has(p.id) ? '♥ Bỏ yêu thích' : '♡ Yêu thích'}</button><a class="btn" target="_blank" rel="noopener" href="${mapUrl(p)}">Xem bản đồ</a></div>`;
  $('#d-close').onclick = () => $('#dlg').close();
  $('#d-fav').onclick = () => { toggleFav(p.id); showPlace(p); };
  $('#dlg').showModal();
}
function toggleFav(id) { favs.has(id) ? favs.delete(id) : favs.add(id); save('favs', [...favs]); renderPlaces(); }
$('#grid').onclick = e => {
  const fav = e.target.closest('[data-fav]'); if (fav) return toggleFav(fav.dataset.fav);
  const card = e.target.closest('.card'); if (card) showPlace(places.find(p => p.id === card.dataset.id));
};
$('#btn-random').onclick = () => { const l = filtered(); if (!l.length) return toast('Không có địa điểm nào khớp bộ lọc'); showPlace(l[Math.floor(Math.random() * l.length)]); };
$('#f-q').oninput = renderPlaces;
['#f-city', '#f-cat', '#f-setting', '#f-age', '#f-budget', '#f-fav'].forEach(s => $(s).onchange = renderPlaces);

/* ---------- boot ---------- */
const get = u => fetch(u).then(r => r.json());
get('data/challenges.json').then(d => { challenges = d; renderToday(); });
get('data/questions.json').then(d => { questions = d; renderQcats(); });
get('data/places.json').then(d => {
  places = d;
  const opts = (sel, vals) => vals.forEach(v => $(sel).insertAdjacentHTML('beforeend', `<option>${esc(v)}</option>`));
  opts('#f-city', [...new Set(d.map(p => p.city))]); opts('#f-cat', [...new Set(d.map(p => p.category))]);
  renderPlaces();
});
