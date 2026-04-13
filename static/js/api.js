// ============================================================
// PGE Audit Monitor - API Client v2
// Handles: auth, findings, evidence, validation, notifications
// ============================================================

const API = {
  async req(method, path, body) {
    try {
      const opts = { method, headers: {'Content-Type':'application/json'}, credentials:'include' };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch('/api' + path, opts);
      if (res.status === 401) {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('appScreen').style.display = 'none';
        return null;
      }
      return await res.json();
    } catch(e) { console.error('API', path, e); return null; }
  },
  get:  (p)    => API.req('GET', p),
  post: (p, b) => API.req('POST', p, b),
  put:  (p, b) => API.req('PUT', p, b),
  del:  (p)    => API.req('DELETE', p),
};

async function apiUpload(path, formData) {
  try {
    const res = await fetch('/api' + path, { method:'POST', body:formData, credentials:'include' });
    return res.ok ? await res.json() : null;
  } catch(e) { return null; }
}

// ── In-memory state ──────────────────────────────────────────
let _findings = [], _users = [], _settings = {}, _sentLog = {};

async function loadAllData() {
  const [findings, users, settings, sentKeys] = await Promise.all([
    API.get('/findings'), API.get('/users'),
    API.get('/settings'), API.get('/notif/sent'),
  ]);
  _findings = findings || []; _users = users || []; _settings = settings || {};
  window._findings = _findings;
  if (Array.isArray(sentKeys)) sentKeys.forEach(k => _sentLog[k] = true);
  console.log('Loaded:', _findings.length, 'findings,', _users.length, 'users');
}

// ── Storage overrides (replace localStorage versions in core.js) ──
function getUsers()   { return _users; }
function saveUsers()  {}
function getEffData() { return window._findings || []; }
function getUpdates() { return {}; }
function saveUpdates() {}
function getSentLog() { return _sentLog; }
function saveSentLog(s) {
  const newKeys = Object.keys(s).filter(k => !_sentLog[k]);
  Object.assign(_sentLog, s);
  if (newKeys.length) API.post('/notif/sent', { keys: newKeys });
}
function getAutoLog() { return JSON.parse(localStorage.getItem('pge_autoLog')||'[]'); }
function saveAutoLog(l) { localStorage.setItem('pge_autoLog', JSON.stringify(l.slice(-200))); }
function getAutoOn()  { return _settings.auto_notif !== '0'; }
function setAutoOn(v) { _settings.auto_notif = v?'1':'0'; API.put('/settings',{auto_notif:v?'1':'0'}); }
function getWaCfg()   {
  return { phoneId:_settings.wa_phone_id||'', token:_settings.wa_token||'',
           sender:_settings.wa_sender||'', testNum:_settings.wa_test_num||'',
           mode:_settings.wa_mode||'link', autoSend:_settings.wa_auto_send==='1' };
}
function saveWaCfg(cfg) {
  Object.assign(_settings, { wa_phone_id:cfg.phoneId, wa_token:cfg.token,
    wa_sender:cfg.sender, wa_test_num:cfg.testNum, wa_mode:cfg.mode,
    wa_auto_send:cfg.autoSend?'1':'0' });
  API.put('/settings', { wa_phone_id:cfg.phoneId, wa_token:cfg.token,
    wa_sender:cfg.sender, wa_mode:cfg.mode, wa_auto_send:cfg.autoSend?'1':'0' });
}
function getWaLog()   { return JSON.parse(localStorage.getItem('pge_waApiLog')||'[]'); }
function saveWaLog(l) { localStorage.setItem('pge_waApiLog', JSON.stringify(l.slice(-300))); }
function getTpls()    { return Object.assign({}, DEFAULT_TPLS, JSON.parse(localStorage.getItem('pge_tpls')||'{}')); }
function saveTpls(t)  { localStorage.setItem('pge_tpls', JSON.stringify(t)); }
function getActiveIntervals() {
  try { return JSON.parse(_settings.active_intervals||'[10,7,5,3]'); } catch { return [10,7,5,3]; }
}
function saveActiveIntervals(arr) {
  _settings.active_intervals = JSON.stringify(arr);
  API.put('/settings', { active_intervals: arr });
}
function getCurrent() { return null; }
function setCurrent() {}
function initAdmin()  {}
function getUpdateLink(rid) {
  return window.location.href.split('?')[0].split('#')[0] + '?upd=' + encodeURIComponent(rid) + '#update';
}

// ── Auth ─────────────────────────────────────────────────────
async function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginErr');
  err.textContent = 'Memproses...';
  const res = await API.post('/auth/login', { username:u, password:p });
  if (!res||res.error) { err.textContent = res?.error||'Login gagal'; return; }
  err.textContent = '';
  await loadAllData();
  startApp(res);
}

async function doSelfRegister() {
  const name = document.getElementById('srName').value.trim();
  const user = document.getElementById('srUser').value.trim().toLowerCase();
  const pass = document.getElementById('srPass').value;
  const wa   = document.getElementById('srWa').value.trim();
  const dept = document.getElementById('srDept').value.trim();
  const code = document.getElementById('srCode').value;
  const err  = document.getElementById('regErr');
  if (!name||!user||!pass) { err.textContent='Field wajib belum diisi.'; return; }
  const res = await API.post('/auth/register',{name,username:user,password:pass,wa,dept,code});
  if (res?.error) { err.textContent=res.error; return; }
  toast('Akun berhasil! Silakan masuk.','g'); switchAuth('login');
}

async function doLogout() {
  await API.post('/auth/logout',{});
  clearInterval(autoInterval);
  _findings=[]; _users=[]; _settings={}; window._findings=[];
  document.getElementById('appScreen').style.display='none';
  document.getElementById('authScreen').style.display='flex';
}

// ── Update Progress ───────────────────────────────────────────
async function submitUpdate() {
  if (!updTarget) { toast('Pilih temuan dahulu','r'); return; }
  const note  = document.getElementById('updNote').value.trim();
  const deliv = document.getElementById('updDeliv').value.trim();
  const res = await API.post(`/findings/${updTarget.id}/update`, {pct:updPct,note,deliverables:deliv});
  if (!res||res.error) { toast('Gagal menyimpan','r'); return; }
  const updateId = res.update_id;
  // Upload pending evidence files
  const pending = window._pendingEvidence || [];
  for (const file of pending) {
    const fd = new FormData(); fd.append('file',file); fd.append('update_id',updateId);
    await apiUpload(`/findings/${updTarget.id}/evidence/upload`, fd);
  }
  window._pendingEvidence = []; renderEvidencePreview();
  const fresh = await API.get('/findings');
  if (fresh) { _findings=fresh; window._findings=fresh; }
  toast(`${updTarget.id} → ${updPct}% disimpan!`,'g');
  updTarget=null; document.getElementById('updForm').style.display='none';
  renderDashboard(); renderTemuan(); renderNotif(); renderUpdate();
  loadInboxNotifs();
}

// ── User management ───────────────────────────────────────────
async function doAddUser() {
  const name=document.getElementById('nrName').value.trim();
  const user=document.getElementById('nrUser').value.trim().toLowerCase();
  const pass=document.getElementById('nrPass').value;
  const wa=document.getElementById('nrWa').value.trim();
  const email=document.getElementById('nrEmail').value.trim();
  const dept=document.getElementById('nrDept').value;
  const role=document.getElementById('nrRole').value;
  const err=document.getElementById('nrErr');
  if (!name||!user||!pass) { err.textContent='Nama, username, password wajib.'; return; }
  const ACODE=_settings.admin_code||'PGEADMIN2025';
  const res=await API.post('/auth/register',{name,username:user,password:pass,wa,email,dept,role,code:ACODE});
  if (res?.error) { err.textContent=res.error; return; }
  err.textContent='';
  ['nrName','nrUser','nrPass','nrWa','nrEmail'].forEach(id=>document.getElementById(id).value='');
  _users=await API.get('/users')||_users;
  toast(`Akun ${name} (${dept}) berhasil!`,'g');
  switchUM('list'); renderUMList();
}

async function saveEditUser() {
  if (!selUser) return;
  const u=_users.find(x=>x.username===selUser); if (!u) return;
  const data={name:document.getElementById('euName').value.trim()||u.name,
    wa:document.getElementById('euWa').value.trim(),
    email:document.getElementById('euEmail').value.trim(),
    dept:document.getElementById('euDept').value};
  const np=document.getElementById('euPass').value;
  if (np&&np.length>=6) data.password=np;
  const res=await API.put(`/users/${u.id}`,data);
  if (res?.error) { toast(res.error,'r'); return; }
  _users=await API.get('/users')||_users;
  renderUMList(); showUserDetail(selUser); closeModal('editUserModal');
  toast('Pengguna diperbarui','g');
}

async function delUser() {
  if (!selUser||selUser==='admin') return;
  const u=_users.find(x=>x.username===selUser); if (!u) return;
  if (!confirm(`Hapus akun "${u.name}"?`)) return;
  const res=await API.del(`/users/${u.id}`);
  if (res?.error) { toast(res.error,'r'); return; }
  selUser=null; _users=await API.get('/users')||_users;
  document.getElementById('umEmpty').style.display='flex';
  document.getElementById('umDetailBody').style.display='none';
  renderUMList(); toast('Akun dihapus','r');
}

// ── Evidence files ────────────────────────────────────────────
function validateFile(file) {
  const blocked=['.exe','.bat','.sh','.cmd','.ps1','.vbs','.jar'];
  const ext='.'+file.name.split('.').pop().toLowerCase();
  if (blocked.includes(ext)) { toast(`${file.name}: tipe file tidak diizinkan`,'r'); return false; }
  return true;
}

function handleUpdFileInput(event) {
  const files=Array.from(event.target.files).filter(validateFile);
  if (!window._pendingEvidence) window._pendingEvidence=[];
  window._pendingEvidence.push(...files);
  renderEvidencePreview();
  toast(`${files.length} file siap diupload · klik Simpan`,'g');
  event.target.value='';
}
function handleUpdDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag');
  handleUpdFileInput({target:{files:event.dataTransfer.files,value:''}});
}
function renderEvidencePreview() {
  const el=document.getElementById('updEvidencePreview'); if (!el) return;
  const pending=window._pendingEvidence||[];
  if (!pending.length) { el.innerHTML=''; return; }
  el.innerHTML=pending.map((f,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg3);border-radius:var(--rsm);border:1px solid var(--border);margin-bottom:4px">
      <span style="font-size:16px">${fileIcon(f.name)}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</div>
        <div style="font-size:10px;color:var(--text3)">${formatSize(f.size)}</div>
      </div>
      <button class="abtn red" onclick="removePending(${i})">✕</button>
    </div>`).join('');
}
function removePending(idx) {
  if (window._pendingEvidence) window._pendingEvidence.splice(idx,1);
  renderEvidencePreview();
}
function fileIcon(name) {
  const ext=name.split('.').pop().toLowerCase();
  const icons={pdf:'📄',jpg:'🖼',jpeg:'🖼',png:'🖼',gif:'🖼',webp:'🖼',
               doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📑',pptx:'📑',
               zip:'🗜',rar:'🗜',mp4:'🎬',mp3:'🎵'};
  return icons[ext]||'📎';
}
function formatSize(bytes) {
  if (bytes<1024) return bytes+'B';
  if (bytes<1048576) return (bytes/1024).toFixed(1)+'KB';
  return (bytes/1048576).toFixed(1)+'MB';
}

// Upload from detail panel (inline)
async function handleFileInput(event, rid) {
  const files=Array.from(event.target.files).filter(validateFile);
  for (const file of files) {
    const fd=new FormData(); fd.append('file',file);
    const res=await apiUpload(`/findings/${rid}/evidence/upload`,fd);
    if (res?.url) { toast(`${file.name} berhasil diupload`,'g'); refreshEvidenceInDetail(rid); }
    else toast(`Gagal upload ${file.name}`,'r');
  }
  event.target.value='';
}
function handleDrop(event, rid) {
  event.preventDefault(); event.currentTarget.classList.remove('drag');
  handleFileInput({target:{files:event.dataTransfer.files,value:''}},rid);
}
async function refreshEvidenceInDetail(rid) {
  const evFiles=await API.get(`/findings/${rid}/evidence`)||[];
  const el=document.getElementById('evidenceList_'+rid); if (!el) return;
  el.innerHTML=buildEvidenceList(evFiles,rid);
}
function buildEvidenceList(files, rid) {
  if (!files.length) return '<div class="no-img">Belum ada file evidence</div>';
  return files.map(f=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rsm);margin-bottom:4px">
      <span style="font-size:18px;flex-shrink:0">${fileIcon(f.original_name||f.filename)}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          <a href="${f.url}" target="_blank" style="color:var(--blue);text-decoration:none">${f.original_name||f.filename}</a>
        </div>
        <div style="font-size:10px;color:var(--text3)">${formatSize(f.file_size||0)} · ${f.uploaded_by} · ${(f.uploaded_at||'').slice(0,10)}</div>
      </div>
      <button class="abtn red" onclick="deleteEvidence('${rid}','${f.filename}')" title="Hapus">🗑</button>
    </div>`).join('');
}
async function deleteEvidence(rid, filename) {
  if (!confirm('Hapus file ini?')) return;
  const res=await API.del(`/findings/${rid}/evidence/${filename}`);
  if (res?.ok) { toast('File dihapus','r'); refreshEvidenceInDetail(rid); }
  else toast('Gagal menghapus','r');
}

// ── Validation ────────────────────────────────────────────────
async function validateFinding(fid, action, updateId) {
  const note = action==='clarify' ? prompt('Masukkan catatan klarifikasi untuk PIC:','') : '';
  if (action==='clarify' && note===null) return; // cancelled
  const res = await API.post(`/findings/${fid}/validate`, {action, note:note||'', update_id:updateId});
  if (!res?.ok) { toast('Gagal melakukan validasi','r'); return; }
  if (action==='validate') {
    toast(`✅ Temuan ${fid} divalidasi SELESAI!`,'g');
  } else {
    toast(`⚠️ Klarifikasi dikirim ke PIC`,'a');
    // Auto-open WA if available
    if (res.wa_message?.to && res.wa_message?.text) {
      const wa=res.wa_message.to.replace(/[^0-9]/g,'');
      const url=`https://wa.me/${wa}?text=${encodeURIComponent(res.wa_message.text)}`;
      if (confirm(`Buka WhatsApp untuk kirim klarifikasi ke ${res.wa_message.name}?`)) {
        window.open(url,'_blank');
      }
    }
  }
  // Refresh data
  const fresh=await API.get('/findings');
  if (fresh) { _findings=fresh; window._findings=fresh; }
  renderDashboard(); renderTemuan(); renderNotif(); renderUpdate();
  loadInboxNotifs();
  // If detail panel open, refresh it
  if (expandedId===fid) { closeDetail(); setTimeout(()=>toggleDetail(fid),100); }
}

// ── Notifications inbox ───────────────────────────────────────
async function loadInboxNotifs() {
  const res=await API.get('/notifications');
  if (!res) return;
  const unread=res.unread||0;
  // Update sidebar badge
  const badge=document.getElementById('overdueCount');
  // Show notification bell badge  
  updateNotifBadge(unread, res.notifications||[]);
}

function updateNotifBadge(unread, notifs) {
  const badge=document.getElementById('notifInboxBadge');
  if (badge) { badge.textContent=unread||''; badge.style.display=unread?'':'none'; }
  const panel=document.getElementById('notifInboxPanel');
  if (!panel) return;
  if (!notifs.length) { panel.innerHTML='<div style="padding:16px;font-size:12px;color:var(--text3)">Tidak ada notifikasi</div>'; return; }
  panel.innerHTML=notifs.slice(0,20).map(n=>{
    const icons={update:'📋',validated:'✅',clarify:'⚠️',system:'🔔'};
    const colors={update:'var(--blue)',validated:'var(--green)',clarify:'var(--amber)',system:'var(--purple)'};
    const ic=icons[n.type]||'🔔'; const col=colors[n.type]||'var(--blue)';
    return`<div style="display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid var(--border);cursor:pointer;opacity:${n.is_read?'0.6':'1'};background:${n.is_read?'':'var(--bg3)'}" onclick="markNotifRead(${n.id},this)">
      <span style="font-size:16px;flex-shrink:0">${ic}</span>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:${n.is_read?'400':'600'};color:var(--text);line-height:1.4">${n.message}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${(n.created_at||'').slice(0,16)} · ${n.finding_id}</div>
        <button class="abtn" style="margin-top:4px;font-size:10px" onclick="event.stopPropagation();goToDetail('${n.finding_id}');closeNotifPanel()">Lihat Temuan →</button>
      </div>
    </div>`;
  }).join('');
}

async function markNotifRead(id, el) {
  await API.post('/notifications/read',{id});
  if (el) el.style.opacity='0.6';
  loadInboxNotifs();
}
async function markAllRead() {
  await API.post('/notifications/read',{});
  loadInboxNotifs();
}
function closeNotifPanel() {
  const p=document.getElementById('notifDropdown');
  if (p) p.style.display='none';
}

// ── Override toggleDetail: async images + validation + evidence ──
const _coreDetail=window.toggleDetail||function(){};
window.toggleDetail=async function(id) {
  const data=getEffData(); const r=data.find(x=>x.id===id); if (!r) return;
  const panel=document.getElementById('detailPanel');
  if (expandedId===id) { panel.style.display='none'; expandedId=null; return; }
  expandedId=id; panel.style.display='block';
  document.getElementById('detailTitle').textContent=`${r.id} – ${r.no_rekomendasi||r.id}`;
  const isAdmin=window.CUR?.role==='admin';
  const hasSptSbt=r.sheet==='SPT'||r.sheet==='SBT';
  const valBadge=r.validation_action==='validate'
    ?'<span class="badge b-green" style="font-size:11px">✅ Validated</span>'
    :r.validation_action==='clarify'
    ?'<span class="badge b-amber" style="font-size:11px">⚠️ Perlu Klarifikasi</span>'
    :r.update_status==='pending'&&r.latest_update_id
    ?'<span class="badge b-blue" style="font-size:11px">🕐 Menunggu Validasi</span>':''

  const rows=[['Sheet',r.sheet],['No. Rekomendasi',r.no_rekomendasi||'-'],
    ['Proses/Lokasi',r.proses||r.lokasi||'-'],
    ['Uraian',r.uraian_rekomendasi||r.rekomendasi||'-'],
    ['Rencana TL',r.rencana_tindak_lanjut||'-'],
    ['Deliverables',r.deliverables||'-'],
    ['PIC',r.pic||'-'],['Due Date',fmtDate(r.due_date)],
    ['Realisasi',r.pct_realisasi+'%'],['Status',getStatus(r)],
    ['Catatan',r.catatan_update||r.catatan||'-'],
    ['Update oleh',r.updated_by?`${r.updated_by} (${(r.updated_at||'').slice(0,10)})`:'–'],
    ['Validasi',valBadge||(r.validated_by?`${r.validated_by} (${(r.validated_at||'').slice(0,10)})`:'Belum divalidasi')],
  ];

  // Validation buttons for admin
  let valHtml='';
  if (isAdmin && r.latest_update_id && r.validation_action!=='validate') {
    valHtml=`<div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
      <button class="btn btn-green btn-sm" onclick="validateFinding('${r.id}','validate',${r.latest_update_id})">✅ Validate – Tandai Selesai</button>
      <button class="btn btn-amber btn-sm" onclick="validateFinding('${r.id}','clarify',${r.latest_update_id})">⚠️ Clarify – Minta Klarifikasi</button>
    </div>`;
  }

  document.getElementById('detailContent').innerHTML=`<div class="detail-panel">
    ${rows.map(([l,v])=>`<div class="dp-row"><span class="dp-lbl">${l}</span><span class="dp-val">${v}</span></div>`).join('')}
    ${valHtml}
    <div class="img-section" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
      <div class="img-section-title"><span>📎</span> Evidence Files <span id="evCount_${r.id}" class="badge b-blue" style="margin-left:6px">${r.evidence_count||0}</span></div>
      <div id="evidenceList_${r.id}"><div style="color:var(--text3);font-size:11px">⏳ Memuat file...</div></div>
      <div style="margin-top:10px">
        <div class="img-upload-area" onclick="document.getElementById('fileInput_${r.id}').click()"
          ondragover="event.preventDefault();this.classList.add('drag')"
          ondragleave="this.classList.remove('drag')"
          ondrop="handleDrop(event,'${r.id}')">
          <div class="upload-ico">📎</div>
          <div class="upload-label">Upload File Evidence</div>
          <div class="upload-hint">Gambar, PDF, Word, Excel, dll · Tidak ada batasan jumlah</div>
        </div>
        <input type="file" id="fileInput_${r.id}" multiple style="display:none" onchange="handleFileInput(event,'${r.id}')">
      </div>
    </div>
    ${hasSptSbt?'<div id="sptSbtImgs_'+r.id+'"><div style="color:var(--text3);font-size:11px;margin-top:12px">⏳ Memuat foto temuan...</div></div>':''}
  </div>`;

  panel.scrollIntoView({behavior:'smooth',block:'nearest'});

  // Load evidence files
  const evFiles=await API.get(`/findings/${r.id}/evidence`)||[];
  const evEl=document.getElementById('evidenceList_'+r.id);
  if (evEl) evEl.innerHTML=buildEvidenceList(evFiles,r.id);
  const cntEl=document.getElementById('evCount_'+r.id);
  if (cntEl) cntEl.textContent=evFiles.length;

  // Load SPT/SBT photos
  if (hasSptSbt) {
    const imgs=await API.get(`/findings/${r.id}/images`);
    const el=document.getElementById('sptSbtImgs_'+r.id);
    if (el && imgs) {
      const temuan=imgs.static?.temuan||[];
      el.innerHTML=temuan.length?`
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div class="img-section-title"><span style="color:var(--red)">📸</span> Foto Temuan (${temuan.length})</div>
          <div class="img-gallery">${temuan.map((src,i)=>`<img class="img-thumb" src="${src}" onclick="openLB(${JSON.stringify(temuan)},${i},'Foto Temuan')" loading="lazy">`).join('')}</div>
        </div>`:'';
    }
  }
};

// ── Lightbox ──────────────────────────────────────────────────
let lbImgs=[], lbIdx=0;
function openLB(imgs,idx,label) {
  lbImgs=imgs; lbIdx=idx;
  document.getElementById('lbImg').src=imgs[idx];
  document.getElementById('lbInfo').textContent=label+' '+(idx+1)+'/'+imgs.length;
  document.getElementById('lightbox').classList.add('on');
}
function closeLB() { document.getElementById('lightbox').classList.remove('on'); }
function lbNav(d) {
  lbIdx=(lbIdx+d+lbImgs.length)%lbImgs.length;
  document.getElementById('lbImg').src=lbImgs[lbIdx];
  document.getElementById('lbInfo').textContent='Foto '+(lbIdx+1)+'/'+lbImgs.length;
}
document.addEventListener('keydown',e=>{
  if (!document.getElementById('lightbox').classList.contains('on')) return;
  if(e.key==='ArrowLeft')lbNav(-1); if(e.key==='ArrowRight')lbNav(1); if(e.key==='Escape')closeLB();
});
document.getElementById('lightbox').addEventListener('click',function(e){if(e.target===this)closeLB();});

// ── Override submitUpdate ─────────────────────────────────────
function submitUpdate() { /* see async version above */ }
// Already defined as async above, re-alias if needed
window.submitUpdate = submitUpdate;

// ── Settings save ─────────────────────────────────────────────
function saveWaConfig() {
  const cfg={phoneId:document.getElementById('waPhoneId').value.trim(),
    token:document.getElementById('waToken').value.trim(),
    sender:document.getElementById('waSender').value.trim(),
    testNum:document.getElementById('waTestNum').value.trim(),
    mode:document.getElementById('waMode').value,
    autoSend:document.getElementById('waAutoSend').checked};
  saveWaCfg(cfg); toast('Konfigurasi WA API disimpan','g'); updateWaStatus();
}

// ── WA Cloud API ──────────────────────────────────────────────
async function sendWAApi(to, message) {
  const cfg=getWaCfg();
  if (!cfg.phoneId||!cfg.token) throw new Error('API belum dikonfigurasi');
  const res=await fetch(`https://graph.facebook.com/v19.0/${cfg.phoneId}/messages`,{
    method:'POST',
    headers:{'Authorization':'Bearer '+cfg.token,'Content-Type':'application/json'},
    body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',
      to:to.replace(/[^0-9]/g,''),type:'text',text:{preview_url:false,body:message}})
  });
  const data=await res.json();
  if (!res.ok) throw new Error(data.error?.message||'API Error');
  return data;
}

// ── Init ─────────────────────────────────────────────────────
async function initApp() {
  const user=await API.get('/auth/me');
  if (!user||user.error) {
    document.getElementById('authScreen').style.display='flex';
    document.getElementById('appScreen').style.display='none';
    return;
  }
  window.CUR=user; // expose for validation check in toggleDetail
  await loadAllData();
  startApp(user);
  loadInboxNotifs();
  // Poll notifications every 30s
  setInterval(loadInboxNotifs, 30000);
  const upd=new URLSearchParams(window.location.search).get('upd');
  if (upd) setTimeout(()=>goUpd(upd),800);
}

// ── Override openUpdForm to show evidence upload ──────────────
const _coreOpenUpdForm=window.openUpdForm||function(){};
window.openUpdForm=function(id) {
  _coreOpenUpdForm.call(this,id);
  window._pendingEvidence=[];
  renderEvidencePreview();
};

document.addEventListener('DOMContentLoaded',()=>{
  initApp();
  document.getElementById('loginPass')?.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
});

// Toggle notification dropdown
function toggleNotifDropdown() {
  const d = document.getElementById('notifDropdown');
  if (!d) return;
  const showing = d.style.display !== 'none';
  d.style.display = showing ? 'none' : 'block';
  if (!showing) loadInboxNotifs();
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('notifDropdown');
  if (!dropdown) return;
  const bell = dropdown.previousElementSibling;
  if (dropdown.style.display === 'block' && !dropdown.contains(e.target) && !bell.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

// Go to finding detail
function goToDetail(fid) {
  showPage('temuan');
  setTimeout(() => {
    const row = document.querySelector(`[data-id="${fid}"]`);
    if (row) row.click();
    else toggleDetail(fid);
  }, 300);
}

// Override openUpdForm to init evidence list
const _origOpenUpdForm2 = window.openUpdForm;
window.openUpdForm = function(id) {
  if (_origOpenUpdForm2) _origOpenUpdForm2.call(this, id);
  window._pendingEvidence = [];
  const preview = document.getElementById('updEvidencePreview');
  if (preview) preview.innerHTML = '';
  // Pre-load existing evidence count
  API.get('/findings/' + id + '/evidence').then(files => {
    if (files && files.length) {
      const info = document.getElementById('updEvidencePreview');
      if (info) info.innerHTML = `<div style="font-size:10px;color:var(--text3);padding:4px 0">${files.length} file evidence sudah ada untuk temuan ini</div>`;
    }
  });
};
