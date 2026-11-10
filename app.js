const $ = s => document.querySelector(s);
const AGES = { toddler: 'Bé nhỏ', kids: 'Trẻ em', teen: 'Thiếu niên', senior: 'Ông bà' };
const MONEY = n => '₫'.repeat(n);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let places = [], favs = new Set();
try { favs = new Set(JSON.parse(localStorage.getItem('favs') || '[]')); } catch {}
const saveFavs = () => { try { localStorage.setItem('favs', JSON.stringify([...favs])); } catch {} };
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

function render() {
  const list = filtered();
  $('#count').textContent = `${list.length} địa điểm`;
  $('#grid').innerHTML = list.map(p => `
    <article class="card" data-id="${esc(p.id)}">
      <button class="fav ${favs.has(p.id) ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="Yêu thích">${favs.has(p.id) ? '♥' : '♡'}</button>
      <h3>${esc(p.name)}</h3>
      <div class="loc">📍 ${esc(p.area)}, ${esc(p.city)}</div>
      <p>${esc(p.desc)}</p>
      <div class="tags"><span class="tag">${esc(p.category)}</span><span class="tag">${esc(p.setting)}</span><span class="tag">${MONEY(p.budget)}</span><span class="tag">⏱ ${esc(p.duration)}</span></div>
    </article>`).join('') || '<p class="muted">Chưa có địa điểm phù hợp. Thử bỏ bớt bộ lọc nhé.</p>';
}

function show(p) {
  $('#dlgbody').innerHTML = `
    <h2>${esc(p.name)}</h2>
    <div class="loc">📍 ${esc(p.area)}, ${esc(p.city)}</div>
    <p>${esc(p.desc)}</p>
    <div class="tags"><span class="tag">${esc(p.category)}</span><span class="tag">${esc(p.setting)}</span><span class="tag">${MONEY(p.budget)}</span><span class="tag">⏱ ${esc(p.duration)}</span>${p.ages.map(a => `<span class="tag">👪 ${AGES[a]}</span>`).join('')}</div>
    ${p.tip ? `<div class="box">💡 ${esc(p.tip)}</div>` : ''}
    <div class="actions"><button id="d-close">Đóng</button><button id="d-fav">${favs.has(p.id) ? '♥ Bỏ yêu thích' : '♡ Yêu thích'}</button><a class="btn" target="_blank" rel="noopener" href="${mapUrl(p)}">Xem bản đồ</a></div>`;
  $('#d-close').onclick = () => $('#dlg').close();
  $('#d-fav').onclick = () => { toggleFav(p.id); show(p); };
  $('#dlg').showModal();
}
function toggleFav(id) { favs.has(id) ? favs.delete(id) : favs.add(id); saveFavs(); render(); }

$('#grid').onclick = e => {
  const fav = e.target.closest('[data-fav]');
  if (fav) return toggleFav(fav.dataset.fav);
  const card = e.target.closest('.card');
  if (card) show(places.find(p => p.id === card.dataset.id));
};
$('#btn-random').onclick = () => {
  const list = filtered();
  if (!list.length) return alert('Không có địa điểm nào khớp bộ lọc.');
  show(list[Math.floor(Math.random() * list.length)]);
};
['#f-q'].forEach(s => $(s).oninput = render);
['#f-city', '#f-cat', '#f-setting', '#f-age', '#f-budget', '#f-fav'].forEach(s => $(s).onchange = render);

fetch('data/places.json').then(r => r.json()).then(d => {
  places = d;
  const opts = (sel, vals) => vals.forEach(v => $(sel).insertAdjacentHTML('beforeend', `<option>${esc(v)}</option>`));
  opts('#f-city', [...new Set(d.map(p => p.city))]);
  opts('#f-cat', [...new Set(d.map(p => p.category))]);
  render();
}).catch(() => { $('#grid').innerHTML = '<p class="muted">Không tải được dữ liệu địa điểm.</p>'; });
