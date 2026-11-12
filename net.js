// Lớp mạng ngang hàng (P2P) chạy trên trình duyệt, không cần server riêng.
// 1) Ưu tiên Trystero (WebRTC, tìm nhau qua relay công cộng).
// 2) Nếu không tải được, dùng BroadcastChannel (chỉ giữa các tab trên cùng máy) để vẫn thử được.
const CDNS = [
  'https://cdn.jsdelivr.net/npm/trystero@0.21.5/+esm',
  'https://esm.sh/trystero@0.21.5',
  'https://cdn.jsdelivr.net/npm/trystero/+esm',
];
const APP_ID = 'ho-tay-online-gia-dinh';

export async function createNet(room) {
  const handlers = { msg: [], join: [], leave: [] };
  const emit = (k, ...a) => handlers[k].forEach(f => { try { f(...a); } catch (e) { console.error(e); } });
  const api = { kind: 'p2p', selfId: '', send() {}, on: (k, f) => handlers[k].push(f) };

  let lib = null;
  for (const url of CDNS) { try { lib = await Promise.race([import(url), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000))]); if (lib.joinRoom) break; lib = null; } catch (e) { console.warn('Không tải được', url, e.message); } }

  if (lib) {
    const r = lib.joinRoom({ appId: APP_ID }, room);
    const [sendAct, getAct] = r.makeAction('m');
    api.selfId = lib.selfId;
    api.send = (msg, to) => { try { sendAct(msg, to); } catch (e) { console.warn(e); } };
    getAct((data, id) => emit('msg', data, id));
    r.onPeerJoin(id => emit('join', id));
    r.onPeerLeave(id => emit('leave', id));
    return api;
  }

  // Phương án dự phòng: chỉ các tab cùng trình duyệt
  api.kind = 'local';
  api.selfId = 'l' + Math.random().toString(36).slice(2, 10);
  const bc = new BroadcastChannel('ht-' + room), known = new Set();
  const post = o => bc.postMessage({ ...o, from: api.selfId });
  bc.onmessage = ev => {
    const m = ev.data; if (!m || m.from === api.selfId) return;
    if (m.k === 'hi') { if (!known.has(m.from)) { known.add(m.from); emit('join', m.from); } if (!m.reply) post({ k: 'hi', reply: true }); }
    else if (m.k === 'bye') { if (known.delete(m.from)) emit('leave', m.from); }
    else if (m.k === 'd' && (!m.to || m.to === api.selfId)) emit('msg', m.data, m.from);
  };
  api.send = (msg, to) => post({ k: 'd', to, data: msg });
  addEventListener('pagehide', () => post({ k: 'bye' }));
  setTimeout(() => post({ k: 'hi' }), 0);
  return api;
}
