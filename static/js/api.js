
// ============================================================
// API CLIENT - connects frontend to Flask backend
// Replaces localStorage-based storage with real HTTP calls
// ============================================================

const API = {
  async req(method, path, body) {
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch('/api' + path, opts);
      if (res.status === 401) { window.location.href = '/'; return null; }
      return await res.json();
    } catch (e) { console.error('API error:', e); return null; }
  },
  get: (path) => API.req('GET', path),
  post: (path, body) => API.req('POST', path, body),
  put: (path, body) => API.req('PUT', path, body),
  del: (path) => API.req('DELETE', path),
};

// Upload file (multipart)
async function apiUpload(findingId, file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/findings/${findingId}/images/upload`, {
    method: 'POST', body: fd, credentials: 'include'
  });
  return res.ok ? await res.json() : null;
}

// ============================================================
// STATE CACHE (in-memory, refreshed from API)
// ============================================================
let _findings = [];     // raw audit data merged with updates
let _users = [];        // all users
let _settings = {};     // app settings
let _sentLog = {};      // sent notification log
let _currentUser = null;

async function loadAllData() {
  const [findings, users, settings, sentKeys] = await Promise.all([
    API.get('/findings'),
    API.get('/users'),
    API.get('/settings'),
    API.get('/notif/sent'),
  ]);
  _findings = findings || [];
  _users = users || [];
  _settings = settings || {};
  window._findings = _findings; // expose for core.js
  if (sentKeys) sentKeys.forEach(k => _sentLog[k] = true);
  return true;
}

// ============================================================
// OVERRIDE: Storage functions → API calls
// ============================================================
function getUsers() { return _users; }
function saveUsers() { /* handled by API PUT /users/:id */ }

function getEffData() {
  // _findings already merged with latest updates from backend
  return _findings;
}
function getUpdates() {
  // _findings already has server-merged updates, return empty so getEffData
  // just returns _findings as-is without double-applying
  return {};
}
function saveUpdates() { /* handled by API */ }

function getSentLog() { return _sentLog; }
function saveSentLog(s) {
  const newKeys = Object.keys(s).filter(k => !_sentLog[k]);
  _sentLog = { ..._sentLog, ...s };
  if (newKeys.length) API.post('/notif/sent', { keys: newKeys });
}

function getAutoLog() { return JSON.parse(localStorage.getItem('pge_autoLog') || '[]'); }
function saveAutoLog(l) { localStorage.setItem('pge_autoLog', JSON.stringify(l.slice(-200))); }

function getAutoOn() { return _settings.auto_notif !== '0'; }
function setAutoOn(v) {
  _settings.auto_notif = v ? '1' : '0';
  API.put('/settings', { auto_notif: v ? '1' : '0' });
}

function getWaCfg() {
  return {
    phoneId: _settings.wa_phone_id || '',
    token: _settings.wa_token || '',
    sender: _settings.wa_sender || '',
    testNum: _settings.wa_test_num || '',
    mode: _settings.wa_mode || 'link',
    autoSend: _settings.wa_auto_send === '1',
  };
}
function saveWaCfg(cfg) {
  _settings = { ..._settings, wa_phone_id: cfg.phoneId, wa_token: cfg.token,
    wa_sender: cfg.sender, wa_test_num: cfg.testNum, wa_mode: cfg.mode,
    wa_auto_send: cfg.autoSend ? '1' : '0' };
  API.put('/settings', { wa_phone_id: cfg.phoneId, wa_token: cfg.token,
    wa_sender: cfg.sender, wa_mode: cfg.mode, wa_auto_send: cfg.autoSend ? '1' : '0' });
}

function getWaLog() { return JSON.parse(localStorage.getItem('pge_waApiLog') || '[]'); }
function saveWaLog(l) { localStorage.setItem('pge_waApiLog', JSON.stringify(l.slice(-300))); }

function getTpls() {
  return Object.assign({}, DEFAULT_TPLS, JSON.parse(localStorage.getItem('pge_tpls') || '{}'));
}
function saveTpls(t) { localStorage.setItem('pge_tpls', JSON.stringify(t)); }

function getActiveIntervals() {
  try { return JSON.parse(_settings.active_intervals || '[10,7,5,3]'); } catch { return [10,7,5,3]; }
}
function saveActiveIntervals(arr) {
  _settings.active_intervals = JSON.stringify(arr);
  API.put('/settings', { active_intervals: arr });
}

// ============================================================
// OVERRIDE: Auth functions → API
// ============================================================
async function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginErr');
  err.textContent = '';
  const res = await API.post('/auth/login', { username: u, password: p });
  if (!res || res.error) { err.textContent = res?.error || 'Login gagal'; return; }
  await loadAllData();
  window._findings = _findings;
  startApp(res);
}

async function doSelfRegister() {
  const name = document.getElementById('srName').value.trim();
  const user = document.getElementById('srUser').value.trim().toLowerCase();
  const pass = document.getElementById('srPass').value;
  const wa = document.getElementById('srWa').value.trim();
  const dept = document.getElementById('srDept').value.trim();
  const code = document.getElementById('srCode').value;
  const err = document.getElementById('regErr');
  if (!name || !user || !pass) { err.textContent = 'Field wajib belum diisi.'; return; }
  const res = await API.post('/auth/register', { name, username: user, password: pass, wa, dept, code });
  if (res?.error) { err.textContent = res.error; return; }
  toast('Akun berhasil! Silakan masuk.', 'g');
  switchAuth('login');
}

async function doLogout() {
  await API.post('/auth/logout', {});
  clearInterval(autoInterval);
  _findings = []; _users = []; _settings = {};
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
}

// ============================================================
// OVERRIDE: submitUpdate → API
// ============================================================
async function submitUpdate() {
  if (!updTarget) { toast('Pilih temuan dahulu', 'r'); return; }
  const note = document.getElementById('updNote').value.trim();
  const deliv = document.getElementById('updDeliv').value.trim();
  const res = await API.post(`/findings/${updTarget.id}/update`, { pct: updPct, note, deliverables: deliv });
  if (!res || res.error) { toast('Gagal menyimpan', 'r'); return; }
  // Upload pending images
  const pending = window._pendingTlImgs || [];
  for (const file of pending) {
    if (file instanceof File) await apiUpload(updTarget.id, file);
  }
  window._pendingTlImgs = [];
  renderUpdTlPreview();
  // Refresh data
  const newFindings = await API.get('/findings');
  if (newFindings) { _findings = newFindings; window._findings = _findings; }
  toast(`${updTarget.id} → ${updPct}% disimpan`, 'g');
  updTarget = null;
  document.getElementById('updForm').style.display = 'none';
  renderDashboard(); renderTemuan(); renderNotif(); renderUpdate();
}

// ============================================================
// OVERRIDE: User management → API
// ============================================================
function doAddUser() {
  const name = document.getElementById('nrName').value.trim();
  const user = document.getElementById('nrUser').value.trim().toLowerCase();
  const pass = document.getElementById('nrPass').value;
  const wa = document.getElementById('nrWa').value.trim();
  const email = document.getElementById('nrEmail').value.trim();
  const dept = document.getElementById('nrDept').value;
  const role = document.getElementById('nrRole').value;
  const err = document.getElementById('nrErr');
  if (!name || !user || !pass) { err.textContent = 'Nama, username, password wajib.'; return; }
  const AVT = ['#4d8ef7','#2ecc8e','#f0a030','#9b7af5','#26c6da','#e85252'];
  const color = AVT[_users.length % AVT.length];
  API.post('/auth/register', { name, username: user, password: pass, wa, email, dept, role,
    code: _settings.admin_code || 'PGEADMIN2025', color })
    .then(async res => {
      if (res?.error) { err.textContent = res.error; return; }
      err.textContent = '';
      ['nrName','nrUser','nrPass','nrWa','nrEmail'].forEach(id => document.getElementById(id).value = '');
      _users = await API.get('/users') || _users;
      toast(`✅ Akun ${name} (${dept}) berhasil dibuat!`, 'g');
      switchUM('list'); renderUMList();
    });
}

function saveEditUser() {
  if (!selUser) return;
  const u = _users.find(x => x.username === selUser); if (!u) return;
  const data = {
    name: document.getElementById('euName').value.trim() || u.name,
    wa: document.getElementById('euWa').value.trim(),
    email: document.getElementById('euEmail').value.trim(),
    dept: document.getElementById('euDept').value,
  };
  const np = document.getElementById('euPass').value;
  if (np && np.length >= 6) data.password = np;
  API.put(`/users/${u.id}`, data).then(async res => {
    if (res?.error) { toast(res.error, 'r'); return; }
    _users = await API.get('/users') || _users;
    renderUMList(); showUserDetail(selUser);
    closeModal('editUserModal');
    toast('Pengguna diperbarui', 'g');
  });
}

function delUser() {
  if (!selUser || selUser === 'admin') return;
  const u = _users.find(x => x.username === selUser); if (!u) return;
  if (!confirm(`Hapus akun "${u.name}"?`)) return;
  API.del(`/users/${u.id}`).then(async res => {
    if (res?.error) { toast(res.error, 'r'); return; }
    selUser = null;
    _users = await API.get('/users') || _users;
    document.getElementById('umEmpty').style.display = 'flex';
    document.getElementById('umDetailBody').style.display = 'none';
    renderUMList(); toast('Akun dihapus', 'r');
  });
}

// ============================================================
// OVERRIDE: TL Image upload → API
// ============================================================
function handleFileInput(event, rid) {
  const files = Array.from(event.target.files).filter(validateFile);
  files.forEach(async file => {
    const res = await apiUpload(rid, file);
    if (res?.url) {
      // Refresh gallery
      const gallery = document.getElementById('tlGallery_' + rid);
      if (gallery) {
        const imgs = await getImgsFromAPI(rid);
        gallery.innerHTML = buildTlGallery(imgs.tl, rid);
      }
      toast('Foto tindak lanjut berhasil diupload!', 'g');
    } else toast('Upload gagal', 'r');
  });
  event.target.value = '';
}

function handleDrop(event, rid) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag');
  handleFileInput({ target: { files: event.dataTransfer.files, value: '' } }, rid);
}

async function delTlImg(rid, filename) {
  if (!confirm('Hapus foto ini?')) return;
  const res = await API.del(`/findings/${rid}/images/${filename}`);
  if (!res?.ok) { toast('Gagal menghapus', 'r'); return; }
  const gallery = document.getElementById('tlGallery_' + rid);
  if (gallery) {
    const imgs = await getImgsFromAPI(rid);
    gallery.innerHTML = buildTlGallery(imgs.tl, rid);
  }
  toast('Foto dihapus', 'r');
}

async function getImgsFromAPI(rid) {
  const r = _findings.find(x => x.id === rid);
  if (!r) return { temuan: [], tl: [] };
  if (r.sheet !== 'SPT' && r.sheet !== 'SBT') return { temuan: [], tl: [] };
  const data = await API.get(`/findings/${rid}/images`);
  if (!data) return { temuan: [], tl: [] };
  const tlImgs = [
    ...(data.static?.tl || []),
    ...(data.uploaded || []).map(u => u.url)
  ];
  return { temuan: data.static?.temuan || [], tl: tlImgs };
}

// Override getImgs to use API version (async)
function getImgs(r) {
  // Return empty synchronously; detail panel uses async version
  return { temuan: [], tl: [] };
}

// Override toggleDetail to use async images
const _origToggleDetail = toggleDetail;
window.toggleDetail = async function(id) {
  const data = getEffData();
  const r = data.find(x => x.id === id); if (!r) return;
  const panel = document.getElementById('detailPanel');
  if (expandedId === id) { panel.style.display = 'none'; expandedId = null; return; }
  expandedId = id; panel.style.display = 'block';
  document.getElementById('detailTitle').textContent = `${r.id} – ${r.no_rekomendasi || r.id}`;
  const rows = [
    ['Sheet', r.sheet], ['No. Rekomendasi', r.no_rekomendasi || '-'],
    ['Proses/Lokasi', r.proses || r.lokasi || '-'],
    ['Referensi', r.referensi || r.klasifikasi || '-'],
    ['Uraian', r.uraian_rekomendasi || r.rekomendasi || '-'],
    ['Rencana TL', r.rencana_tindak_lanjut || '-'],
    ['Deliverables', r.deliverables || '-'],
    ['PIC', r.pic || '-'], ['Due Date', fmtDate(r.due_date)],
    ['Realisasi', r.pct_realisasi + '%'], ['Status', getStatus(r)],
    ['Catatan', r.catatan_update || r.catatan || '-'],
    ['Diupdate oleh', r.updated_by ? r.updated_by + ' (' + (r.updated_at || '') + ')' : '-'],
  ];
  const hasSptSbt = r.sheet === 'SPT' || r.sheet === 'SBT';
  // Show loading first
  let imgHtml = '';
  if (hasSptSbt) {
    imgHtml = `<div class="img-section"><div style="color:var(--text3);font-size:11px;padding:8px 0">⏳ Memuat foto...</div></div>`;
  }
  document.getElementById('detailContent').innerHTML =
    `<div class="detail-panel">${rows.map(([l,v])=>`<div class="dp-row"><span class="dp-lbl">${l}</span><span class="dp-val">${v}</span></div>`).join('')}${imgHtml}</div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Load images async
  if (hasSptSbt) {
    const imgs = await getImgsFromAPI(r.id);
    const imgSection = document.querySelector('.img-section');
    if (imgSection) {
      imgSection.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div class="img-section-title"><span style="color:var(--red)">📸</span> Foto Temuan (${imgs.temuan.length})</div>
            <div class="img-gallery">${buildImgGallery(imgs.temuan, 'Foto Temuan', 'red', r.id + '_t')}</div>
          </div>
          <div>
            <div class="img-section-title"><span style="color:var(--green)">✅</span> Foto Tindak Lanjut (${imgs.tl.length})</div>
            <div class="img-gallery" id="tlGallery_${r.id}">${buildTlGalleryAPI(imgs.tl, r.id)}</div>
            <div style="margin-top:10px">
              <div class="img-upload-area" onclick="triggerUpload('${r.id}')" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="handleDrop(event,'${r.id}')">
                <div class="upload-ico">📤</div>
                <div class="upload-label">Upload Foto Bukti TL</div>
                <div class="upload-hint">Klik atau drag foto · JPG/PNG · maks 5MB/foto</div>
              </div>
              <input type="file" id="fileInput_${r.id}" accept="image/*" multiple style="display:none" onchange="handleFileInput(event,'${r.id}')">
            </div>
          </div>
        </div>`;
    }
  }
};

function buildTlGalleryAPI(urls, rid) {
  if (!urls.length) return '<div class="no-img">Belum ada foto tindak lanjut</div>';
  return urls.map((src, i) => {
    const filename = src.split('/').pop();
    const isUploaded = src.startsWith('/static/uploads/');
    return `<div class="tl-img-wrap"><img class="tl-img-thumb" src="${src}" onclick="openLB(${JSON.stringify(urls)},${i},'Tindak Lanjut')" loading="lazy">${isUploaded ? `<button class="tl-img-del" onclick="event.stopPropagation();delTlImg('${rid}','${filename}')">✕</button>` : ''}</div>`;
  }).join('');
}

// Override update page upload (collect as files, upload on save)
function handleUpdFileInput(event) {
  const files = Array.from(event.target.files).filter(validateFile);
  if (!window._pendingTlImgs) window._pendingTlImgs = [];
  // Store as File objects for API upload
  window._pendingTlImgs.push(...files);
  renderUpdTlPreview();
  toast(`${files.length} foto siap · klik Simpan`, 'g');
  event.target.value = '';
}

function handleUpdDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag');
  handleUpdFileInput({ target: { files: event.dataTransfer.files, value: '' } });
}

function renderUpdTlPreview() {
  const el = document.getElementById('updTlPreview'); if (!el) return;
  const pending = window._pendingTlImgs || [];
  if (!pending.length) { el.innerHTML = ''; return; }
  el.innerHTML = pending.map((f, i) => {
    const name = f instanceof File ? f.name : '(foto)';
    const url = f instanceof File ? URL.createObjectURL(f) : f;
    return `<div class="tl-img-wrap">
      <img class="tl-img-thumb" src="${url}" loading="lazy">
      <button class="tl-img-del" style="position:absolute;top:-5px;right:-5px" onclick="delPendingImg(${i})">✕</button>
    </div>`;
  }).join('');
}

function delPendingImg(idx) {
  if (window._pendingTlImgs) window._pendingTlImgs.splice(idx, 1);
  renderUpdTlPreview();
}

// ============================================================
// OVERRIDE: Settings save → API
// ============================================================
function saveWaConfig() {
  const cfg = {
    phoneId: document.getElementById('waPhoneId').value.trim(),
    token: document.getElementById('waToken').value.trim(),
    sender: document.getElementById('waSender').value.trim(),
    testNum: document.getElementById('waTestNum').value.trim(),
    mode: document.getElementById('waMode').value,
    autoSend: document.getElementById('waAutoSend').checked,
  };
  saveWaCfg(cfg);
  _settings.wa_phone_id = cfg.phoneId;
  toast('Konfigurasi WA API disimpan', 'g');
  updateWaStatus();
}

// ============================================================
// INIT: Load data from API then start app
// ============================================================
async function initApp() {
  const user = await API.get('/auth/me');
  if (!user || user.error) {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
    return;
  }
  await loadAllData();
  startApp(user);
  // Handle URL auto-open update
  const params = new URLSearchParams(window.location.search);
  const upd = params.get('upd');
  if (upd) setTimeout(() => goUpd(upd), 600);
}

// Override initAdmin (no-op, server handles it)
function initAdmin() {}

// Override getCurrent to use session
function getCurrent() { return null; } // not used in API mode

// Run
document.addEventListener('DOMContentLoaded', initApp);
document.getElementById('loginPass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
