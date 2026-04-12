const TODAY=(()=>{const d=new Date();return d.toISOString().slice(0,10);})();
const ADMIN_CODE='PGEADMIN2025';
const DEPTS=['HSSE','MTC','OPS','BS'];
const DEPT_COLORS={'HSSE':'#4d8ef7','MTC':'#2ecc8e','OPS':'#f0a030','BS':'#9b7af5'};
const AVT=['#4d8ef7','#2ecc8e','#f0a030','#9b7af5','#26c6da','#e85252'];

// Notification thresholds: days before due date
const NOTIF_DAYS_DEFAULT=[90,60,30,10,7,5,3]; // all available intervals in days
function getActiveIntervals(){
  // Admin can toggle which intervals are active. Default: 10,7,5,3
  const saved=localStorage.getItem('pge_intervals');
  if(saved){try{return JSON.parse(saved);}catch(e){}}
  return [10,7,5,3];
}
function saveActiveIntervals(arr){localStorage.setItem('pge_intervals',JSON.stringify(arr));}
// For backward compat, keep NOTIF_DAYS as dynamic getter
Object.defineProperty(window,'NOTIF_DAYS',{get:getActiveIntervals});

// ===== STORAGE =====
const getUsers=()=>JSON.parse(localStorage.getItem('pge_users')||'[]');
const saveUsers=u=>localStorage.setItem('pge_users',JSON.stringify(u));
const getUpdates=()=>JSON.parse(localStorage.getItem('pge_upd')||'{}');
const saveUpdates=u=>localStorage.setItem('pge_upd',JSON.stringify(u));
const getCurrent=()=>JSON.parse(sessionStorage.getItem('pge_cur')||'null');
const setCurrent=u=>sessionStorage.setItem('pge_cur',JSON.stringify(u));
const getAutoLog=()=>JSON.parse(localStorage.getItem('pge_autoLog')||'[]');
const saveAutoLog=l=>localStorage.setItem('pge_autoLog',JSON.stringify(l.slice(-200)));
const getSentLog=()=>JSON.parse(localStorage.getItem('pge_sent')||'{}');
const saveSentLog=s=>localStorage.setItem('pge_sent',JSON.stringify(s));
const getAutoOn=()=>localStorage.getItem('pge_autoOn')!=='0';
const setAutoOn=v=>localStorage.setItem('pge_autoOn',v?'1':'0');

// Templates storage
const DEFAULT_TPLS={
  wa_10:`Halo {NAMA},

📋 *REMINDER AUDIT SUPREME 2025* – 10 hari lagi

🔖 ID: {ID}
📌 {TEMUAN}
🎯 Deliverables: {DELIVERABLES}
📅 Due Date: {DEADLINE} ({HARI} hari lagi)
📊 Realisasi saat ini: {PROGRES}%

Mohon mulai mempersiapkan penyelesaian tindak lanjut ini.

{LINKTEXT}

_Tim Internal Audit PGE UBL_`,
  wa_7:`Halo {NAMA},

⏰ *REMINDER AUDIT SUPREME 2025* – 7 hari lagi

🔖 ID: {ID}
📌 {TEMUAN}
📅 Due Date: {DEADLINE} ({HARI} hari lagi)
📊 Realisasi: {PROGRES}%

Seminggu lagi! Mohon dipastikan progress terus berjalan.

{LINKTEXT}

_Tim Internal Audit PGE UBL_`,
  wa_5:`Halo {NAMA},

⚠️ *REMINDER URGENT – AUDIT SUPREME 2025* – 5 hari lagi

🔖 ID: {ID}
📌 {TEMUAN}
🎯 Deliverables: {DELIVERABLES}
📅 Due Date: {DEADLINE} ({HARI} hari lagi)
📊 Realisasi: {PROGRES}%

Segera selesaikan dalam 5 hari ke depan!

{LINKTEXT}

_Tim Internal Audit PGE UBL_`,
  wa_3:`Halo {NAMA},

‼️ *URGENT – 3 HARI LAGI! AUDIT SUPREME 2025*

🔖 ID: {ID}
📌 {TEMUAN}
📅 Due Date: {DEADLINE}
📊 Realisasi: {PROGRES}%

⚠️ Hanya tersisa 3 hari! Mohon segera diselesaikan.
Jika ada hambatan, segera eskalasikan ke atasan.

{LINKTEXT}

_Tim Internal Audit PGE UBL_`,
  wa_ov:`Halo {NAMA},

⛔ *OVERDUE! AUDIT SUPREME 2025*

🔖 ID: {ID}
📌 {TEMUAN}
📅 Due Date: {DEADLINE} (Terlambat {HARI} hari)
📊 Realisasi: {PROGRES}%

Temuan ini telah MELEWATI batas waktu penyelesaian.
Mohon segera ditindaklanjuti dan perbarui progres.
Jika ada hambatan, segera eskalasikan ke manajemen.

{LINKTEXT}

_Tim Internal Audit PGE UBL_`,
  wa_90:`Halo {NAMA},

📅 *REMINDER AWAL – AUDIT SUPREME 2025* – 3 bulan lagi

🔖 ID: {ID}
📌 {TEMUAN}
🎯 Deliverables: {DELIVERABLES}
📅 Due Date: {DEADLINE} ({HARI} hari lagi)
📊 Realisasi saat ini: {PROGRES}%

Ini adalah pengingat awal. Mohon mulai menyusun rencana tindak lanjut.

{LINKTEXT}

_Tim Internal Audit PGE UBL_`,
  wa_60:`Halo {NAMA},

📋 *REMINDER – AUDIT SUPREME 2025* – 2 bulan lagi

🔖 ID: {ID}
📌 {TEMUAN}
🎯 Deliverables: {DELIVERABLES}
📅 Due Date: {DEADLINE} ({HARI} hari lagi)
📊 Realisasi saat ini: {PROGRES}%

Dua bulan menuju deadline. Pastikan progres sudah berjalan.

{LINKTEXT}

_Tim Internal Audit PGE UBL_`,
  wa_30:`Halo {NAMA},

⏰ *REMINDER – AUDIT SUPREME 2025* – 1 bulan lagi

🔖 ID: {ID}
📌 {TEMUAN}
🎯 Deliverables: {DELIVERABLES}
📅 Due Date: {DEADLINE} ({HARI} hari lagi)
📊 Realisasi: {PROGRES}%

Satu bulan lagi! Pastikan tindak lanjut hampir selesai.

{LINKTEXT}

_Tim Internal Audit PGE UBL_`,
  wa_custom:`Halo {NAMA},

🔔 *REMINDER AUDIT SUPREME 2025*

🔖 ID: {ID}
📌 {TEMUAN}
🎯 Deliverables: {DELIVERABLES}
📅 Due Date: {DEADLINE} ({HARI} hari lagi)
📊 Realisasi: {PROGRES}%

Mohon segera ditindaklanjuti sesuai target.

{LINKTEXT}

_Tim Internal Audit PGE UBL_`,
  em_std:`Subject: [REMINDER] Tindak Lanjut Audit SUPREME 2025 – {ID}

Yth. {NAMA},

Kami mengingatkan kembali tindak lanjut temuan audit berikut:

  ID Temuan    : {ID}
  Uraian       : {TEMUAN}
  Deliverables : {DELIVERABLES}
  Due Date     : {DEADLINE} ({HARI} hari lagi)
  Realisasi    : {PROGRES}%

Silakan perbarui progres tindak lanjut melalui tautan berikut:
{LINK}

Mohon segera ditindaklanjuti sesuai target.

Hormat kami,
Tim Internal Audit
PT Pertamina Geothermal Energy Tbk. Area Ulubelu`,
  em_ov:`Subject: [URGENT – OVERDUE] Tindak Lanjut Audit SUPREME 2025 – {ID}

Yth. {NAMA},

⚠️ Temuan audit berikut telah MELEWATI batas waktu:

  ID Temuan    : {ID}
  Uraian       : {TEMUAN}
  Deliverables : {DELIVERABLES}
  Due Date     : {DEADLINE} (Terlambat {HARI} hari)
  Realisasi    : {PROGRES}%

Mohon segera selesaikan dan perbarui progres melalui:
{LINK}

Hormat kami,
Tim Internal Audit
PT Pertamina Geothermal Energy Tbk. Area Ulubelu`
};
function getTpls(){return Object.assign({...DEFAULT_TPLS},JSON.parse(localStorage.getItem('pge_tpls')||'{}'));}
function saveTpls(t){localStorage.setItem('pge_tpls',JSON.stringify(t));}

function getUpdateLink(rid){
  // Build a URL that links to dashboard and auto-opens update form for this finding
  // Uses current page URL + hash for sharing
  const base=window.location.href.split('#')[0].split('?')[0];
  return base+'?upd='+encodeURIComponent(rid)+'#update';
}
function fillTpl(tpl,r,picUser){
  const dl=dLeft(r.due_date);
  const isOv=dl!==null&&dl<0;
  const name=picUser?picUser.name:('Tim '+r.pic);
  const link=getUpdateLink(r.id);
  return tpl
    .replace(/{NAMA}/g,name)
    .replace(/{ID}/g,r.id)
    .replace(/{TEMUAN}/g,(r.uraian_rekomendasi||r.rekomendasi||'-').slice(0,150))
    .replace(/{DELIVERABLES}/g,r.deliverables||'-')
    .replace(/{DEADLINE}/g,fmtDate(r.due_date))
    .replace(/{PROGRES}/g,String(r.pct_realisasi))
    .replace(/{PIC}/g,r.pic||'-')
    .replace(/{HARI}/g,dl!==null?String(Math.abs(dl)):'-')
    .replace(/{LINK}/g,link)
    .replace(/{LINKTEXT}/g,'👉 Update progres di sini: '+link);
}

function buildWAMsg(r,picUser,forceDay){
  const tpls=getTpls();
  const dl=dLeft(r.due_date);
  const s=getStatus(r);
  let key='wa_custom';
  if(s==='overdue') key='wa_ov';
  else if(forceDay) key=`wa_${forceDay}`;
  else {
    // Match to known template keys based on days
    const knownKeys={90:'wa_90',60:'wa_60',30:'wa_30',10:'wa_10',7:'wa_7',5:'wa_5',3:'wa_3'};
    if(dl!==null&&knownKeys[dl]) key=knownKeys[dl];
    else if(dl!==null&&dl<=3) key='wa_3';
    else if(dl!==null&&dl<=5) key='wa_5';
    else if(dl!==null&&dl<=7) key='wa_7';
    else if(dl!==null&&dl<=10) key='wa_10';
    else if(dl!==null&&dl<=30) key='wa_30';
    else if(dl!==null&&dl<=60) key='wa_60';
    else if(dl!==null&&dl<=90) key='wa_90';
  }
  return fillTpl(tpls[key]||DEFAULT_TPLS[key]||DEFAULT_TPLS.wa_custom||DEFAULT_TPLS.wa_10,r,picUser);
}
function buildEmailMsg(r,picUser){
  const tpls=getTpls();
  const s=getStatus(r);
  const key=s==='overdue'?'em_ov':'em_std';
  return fillTpl(tpls[key]||DEFAULT_TPLS[key],r,picUser);
}

// ===== AUTH =====
function switchAuth(m){
  document.getElementById('loginForm').style.display=m==='login'?'':'none';
  document.getElementById('regForm').style.display=m==='reg'?'':'none';
  document.querySelectorAll('.auth-tab').forEach((t,i)=>t.classList.toggle('on',(i===0&&m==='login')||(i===1&&m==='reg')));
}
function doLogin(){ /* overridden by api.js */ }
function doSelfRegister(){ /* overridden by api.js */ }
function doLogout(){ /* overridden by api.js */ }
function initAdmin(){} // handled by server

// ===== HELPERS =====
const getEffData=()=>{
  const upd=getUpdates();
  return (window._findings||[]).map(r=>{const u=upd[r.id];return u?{...r,pct_realisasi:u.pct,catatan_update:u.note,updated_at:u.at,updated_by:u.by,deliverables:u.deliv||r.deliverables}:r;});
};
function getStatus(r){
  if(r.pct_realisasi===100)return'selesai';
  if(r.due_date&&r.due_date<TODAY&&r.pct_realisasi<100)return'overdue';
  if(r.pct_realisasi>0)return'proses';
  return'belum';
}
function statusBadge(s){
  const m={selesai:['Selesai','b-green'],overdue:['Overdue','b-red'],proses:['Proses','b-blue'],belum:['Belum','b-amber']};
  const[l,c]=m[s]||['-','b-gray'];
  return`<span class="badge ${c}">${l}</span>`;
}
function pCol(p){if(p===100)return'#2ecc8e';if(p>=50)return'#4d8ef7';if(p>0)return'#f0a030';return'#e85252';}
function fmtDate(d){if(!d)return'-';try{return new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}catch{return d;}}
function dLeft(d){if(!d)return null;return Math.ceil((new Date(d+'T00:00:00')-new Date(TODAY+'T00:00:00'))/86400000);}
function getPicUser(pic){
  if(!pic)return null;
  const users=getUsers();
  const p=pic.toUpperCase();
  return users.find(u=>u.dept&&(u.dept.toUpperCase()===p||p.includes(u.dept.toUpperCase())||u.dept.toUpperCase().split(' ').some(part=>p.includes(part))));
}
function closeModal(id){document.getElementById(id).classList.remove('on');}

// ===== APP START =====
let CUR=null;let cKat,cDonut,cPic,cDue;let autoInterval=null;
function startApp(user){
  CUR=user;
  document.getElementById('authScreen').style.display='none';
  document.getElementById('appScreen').style.display='block';
  document.getElementById('dashDate').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  document.getElementById('sbName').textContent=user.name;
  document.getElementById('sbRole').textContent=user.role==='admin'?'Administrator':'PIC – '+user.dept;
  const av=document.getElementById('sbAv');
  av.textContent=user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  av.style.background=user.color+'22';av.style.color=user.color;
  if(user.role==='admin'){
    document.getElementById('adminMenu').style.display='';
    document.getElementById('regTab').style.display='';
  }
  const pics=[...new Set((window._findings||[]).map(r=>r.pic).filter(Boolean))].sort();
  ['fPic','updPic'].forEach(id=>{
    const sel=document.getElementById(id);
    pics.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;sel.appendChild(o);});
  });
  if(user.role!=='admin'&&user.dept){
    const match=pics.find(p=>p.toUpperCase()===user.dept.toUpperCase()||p.toUpperCase().includes(user.dept.toUpperCase())||user.dept.toUpperCase().includes(p.toUpperCase()));
    if(match){['fPic','updPic'].forEach(id=>document.getElementById(id).value=match);}
    document.getElementById('updSub').textContent='Temuan untuk fungsi: '+user.dept;
  }
  renderDashboard();renderTemuan();renderNotif();renderUpdate();
  startAutoNotif();
}

// ===== SIDEBAR =====
let drawerOpen=false;
function toggleDrawer(){
  drawerOpen=!drawerOpen;
  document.getElementById('adminDrawer').classList.toggle('open',drawerOpen);
  document.getElementById('adminArrow').classList.toggle('open',drawerOpen);
}
function openUM(view){
  if(!drawerOpen){drawerOpen=true;document.getElementById('adminDrawer').classList.add('open');document.getElementById('adminArrow').classList.add('open');}
  showPage('users');
  setTimeout(()=>switchUM(view),50);
}
function switchUM(v){
  document.getElementById('umListView').style.display=v==='list'?'':'none';
  document.getElementById('umAddView').style.display=v==='add'?'':'none';
  document.getElementById('umTitle').textContent=v==='add'?'Tambah User Baru':'Kelola Pengguna';
  document.getElementById('btnList').className='btn btn-'+(v==='list'?'primary':'ghost')+' btn-sm';
  document.getElementById('btnAdd').className='btn btn-'+(v==='add'?'primary':'ghost')+' btn-sm';
  document.querySelectorAll('.sb-sub').forEach(b=>b.classList.remove('on'));
  if(v==='list'){document.getElementById('subList').classList.add('on');renderUMList();}
  else document.getElementById('subAdd').classList.add('on');
}

// ===== AUTO NOTIF =====
function startAutoNotif(){
  updateAutoBtn();
  if(getAutoOn())scheduleCheck();
  setInterval(()=>{if(getAutoOn())scheduleCheck();},3600000); // every hour
}
function toggleAutoNotif(){
  const on=!getAutoOn();setAutoOn(on);updateAutoBtn();
  if(on){scheduleCheck();toast('Notifikasi otomatis diaktifkan','g');}
  else toast('Notifikasi otomatis dinonaktifkan','a');
}
function updateAutoBtn(){
  const on=getAutoOn();
  const btn=document.getElementById('autoToggleBtn');
  if(btn)btn.textContent=on?'⏸ Nonaktifkan':'▶ Aktifkan';
  const pill=document.getElementById('autoStatus');
  if(pill)pill.classList.toggle('on',on);
}
function runAutoNow(){scheduleCheck(true);}

function scheduleCheck(force){
  const data=getEffData();
  const sentLog=getSentLog();
  const todayStr=TODAY;
  const toSend=[];
  data.forEach(r=>{
    if(r.pct_realisasi===100)return;
    const dl=dLeft(r.due_date);
    if(dl===null)return;
    const s=getStatus(r);
    const picUser=getPicUser(r.pic);
    if(!picUser||!picUser.wa)return;
    const logKey=`${r.id}_${todayStr}`;
    // Determine if today matches a threshold
    let shouldSend=false;
    let dayLabel='';
    if(s==='overdue'){shouldSend=!sentLog[logKey+'_ov']||force;dayLabel='overdue';}
    else{
      NOTIF_DAYS.forEach(n=>{
        if(dl===n){const k=logKey+`_${n}`;if(!sentLog[k]||force){shouldSend=true;dayLabel=String(n);}};
      });
    }
    if(shouldSend)toSend.push({r,picUser,dayLabel});
  });

  const cnt=document.getElementById('autoNextCount');
  if(cnt)cnt.textContent=toSend.length;

  if(!toSend.length){
    if(force)toast('Tidak ada reminder yang perlu dikirim sekarang.','a');
    renderAutoLog();return;
  }

  if(force||confirm(`${toSend.length} reminder siap dikirim via WhatsApp. Lanjutkan?`)){
    const newSent={...sentLog};
    const log=getAutoLog();
    toSend.forEach(item=>{
      const dl=dLeft(item.r.due_date);
      const isOv=getStatus(item.r)==='overdue';
      const msg=buildWAMsg(item.r,item.picUser);
      const wa=item.picUser.wa.replace(/[^0-9]/g,'');
      const url=`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
      // Open WA for each (browser will batch)
      setTimeout(()=>window.open(url,'_blank'),toSend.indexOf(item)*800);
      const logKey=`${item.r.id}_${TODAY}`;
      if(isOv)newSent[logKey+'_ov']=true;
      else newSent[logKey+`_${item.dayLabel}`]=true;
      log.unshift({id:item.r.id,pic:item.r.pic,to:item.picUser.name,wa:item.picUser.wa,day:item.dayLabel,at:new Date().toLocaleString('id-ID'),due:item.r.due_date});
    });
    saveSentLog(newSent);saveAutoLog(log);
    localStorage.setItem('pge_lastRun',new Date().toLocaleString('id-ID'));
    const todaySent=log.filter(l=>l.at.startsWith(new Date().toLocaleDateString('id-ID')));
    const sc=document.getElementById('autoStatusCount');
    if(sc)sc.textContent=todaySent.length;
    const lr=document.getElementById('autoLastRun');
    if(lr)lr.textContent=localStorage.getItem('pge_lastRun')||'–';
    toast(`${toSend.length} reminder WA dikirim!`,'g');
    renderAutoLog();updateOverdueBadge();
  }
}

function renderAutoLog(){
  const log=getAutoLog();
  const el=document.getElementById('autoLog');if(!el)return;
  const lr=document.getElementById('autoLastRun');
  if(lr)lr.textContent=localStorage.getItem('pge_lastRun')||'–';
  const sc=document.getElementById('autoStatusCount');
  if(sc){const t=new Date().toLocaleDateString('id-ID');sc.textContent=log.filter(l=>l.at.startsWith(t)).length;}
  if(!log.length){el.innerHTML='<div style="color:var(--text3);font-size:12px;padding:8px">Belum ada log.</div>';return;}
  el.innerHTML=log.slice(0,50).map(l=>{
    const isOv=l.day==='overdue';
    return`<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:11px">
      <span style="color:${isOv?'var(--red)':'var(--amber)'};flex-shrink:0">${isOv?'⛔':'🔔'}</span>
      <div style="flex:1">
        <div style="color:var(--text)">${l.id} → ${l.to} <span style="font-family:var(--mono);color:var(--green)">${l.wa}</span></div>
        <div style="color:var(--text3);margin-top:1px">${l.day==='overdue'?'Overdue':l.day+' hari sebelum'} · Due: ${fmtDate(l.due)} · ${l.at}</div>
      </div>
    </div>`;
  }).join('');
}

function renderThresholds(){
  const el=document.getElementById('thresholdList');if(!el)return;
  const data=getEffData();
  const sentLog=getSentLog();
  const rows=[...NOTIF_DAYS.map(n=>{
    const items=data.filter(r=>{const dl=dLeft(r.due_date);return dl===n&&getStatus(r)!=='selesai';});
    const sent=items.filter(r=>sentLog[`${r.id}_${TODAY}_${n}`]);
    return{label:`${n} hari sebelum`,count:items.length,sent:sent.length,color:n<=3?'var(--red)':n<=5?'var(--amber)':'var(--blue)'};
  }),{label:'Overdue',count:data.filter(r=>getStatus(r)==='overdue').length,sent:0,color:'var(--red)'}];
  el.innerHTML=rows.map(r=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border-radius:var(--rsm);border:1px solid var(--border)">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="width:8px;height:8px;border-radius:50%;background:${r.color};flex-shrink:0"></span>
      <span style="font-size:12px;color:var(--text2)">${r.label}</span>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <span style="font-size:11px;color:var(--text3)">${r.count} temuan</span>
      <span class="badge b-green">${r.sent} terkirim</span>
    </div>
  </div>`).join('');
}

function renderSchedSummary(){
  const data=getEffData();
  const el=document.getElementById('schedSummary');if(!el)return;
  const cards=[
    {days:10,label:'Hari Lagi',color:'var(--blue)'},
    {days:7,label:'Hari Lagi',color:'var(--blue)'},
    {days:5,label:'Hari Lagi',color:'var(--amber)'},
    {days:3,label:'Hari Lagi',color:'var(--red)'},
  ];
  el.innerHTML=cards.map(c=>{
    const items=data.filter(r=>{const dl=dLeft(r.due_date);return dl===c.days&&getStatus(r)!=='selesai';});
    const active=items.length>0;
    return`<div class="sched-card ${active?'active':''}">
      <div class="sched-day" style="color:${c.color}">${c.days}</div>
      <div class="sched-label">${c.label}</div>
      <div class="sched-count" style="color:${active?c.color:'var(--text3)'}">
        ${items.length} temuan${active?`<div class="sched-dot"></div>`:''}</div>
    </div>`;
  }).join('');
}

// Template editor
function loadTpl(){
  const key=document.getElementById('tplSelect').value;
  const tpls=getTpls();
  document.getElementById('tplEditor').value=tpls[key]||DEFAULT_TPLS[key]||'';
}
function saveTpl(){
  const key=document.getElementById('tplSelect').value;
  const val=document.getElementById('tplEditor').value;
  const tpls=getTpls();tpls[key]=val;saveTpls(tpls);
  toast('Template disimpan','g');
}
function resetTpl(){
  const key=document.getElementById('tplSelect').value;
  const tpls=getTpls();delete tpls[key];saveTpls(tpls);
  document.getElementById('tplEditor').value=DEFAULT_TPLS[key]||'';
  toast('Template direset ke default','a');
}

// ===== DASHBOARD =====
function updateOverdueBadge(){
  const data=getEffData();
  const cnt=data.filter(r=>{const dl=dLeft(r.due_date);return getStatus(r)==='overdue'||(getStatus(r)!=='selesai'&&dl!==null&&dl<=10);}).length;
  const badge=document.getElementById('overdueCount');
  badge.textContent=cnt||'';badge.style.display=cnt?'':'none';
}
function renderDashboard(){
  Chart.defaults.color='#7d8fa8';Chart.defaults.borderColor='rgba(255,255,255,0.05)';
  const data=getEffData();
  const total=data.length;
  const selesai=data.filter(r=>getStatus(r)==='selesai').length;
  const proses=data.filter(r=>getStatus(r)==='proses').length;
  const overdue=data.filter(r=>getStatus(r)==='overdue').length;
  const belum=data.filter(r=>getStatus(r)==='belum').length;
  updateOverdueBadge();
  document.getElementById('hdrBadges').innerHTML=
    `<span class="badge b-red">${overdue} Overdue</span><span class="badge b-amber">${belum} Belum</span><span class="badge b-blue">${data.filter(r=>{const dl=dLeft(r.due_date);return getStatus(r)!=='selesai'&&dl!==null&&dl<=10;}).length} Due ≤10hr</span><span class="badge b-green">${selesai} Selesai</span>`;
  document.getElementById('statCards').innerHTML=`
    <div class="stat cB" onclick="filterAndGo('')" style="cursor:pointer;transition:transform 0.15s" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform=''"><div class="stat-l">Total Temuan</div><div class="stat-v">${total}</div><div class="stat-s">↗ klik → semua temuan</div></div>
    <div class="stat cG" onclick="filterAndGo('selesai')" style="cursor:pointer;transition:transform 0.15s" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform=''"><div class="stat-l">Selesai</div><div class="stat-v">${selesai}</div><div class="stat-s">↗ ${Math.round(selesai/total*100)}% · klik → detail</div></div>
    <div class="stat cB" onclick="filterAndGo('proses')" style="cursor:pointer;transition:transform 0.15s" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform=''"><div class="stat-l">Dalam Proses</div><div class="stat-v">${proses}</div><div class="stat-s">↗ klik → detail</div></div>
    <div class="stat cA" onclick="filterAndGo('belum')" style="cursor:pointer;transition:transform 0.15s" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform=''"><div class="stat-l">Belum Mulai</div><div class="stat-v">${belum}</div><div class="stat-s">↗ klik → detail</div></div>
    <div class="stat cR" onclick="filterAndGo('overdue')" style="cursor:pointer;transition:transform 0.15s" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform=''"><div class="stat-l">Overdue</div><div class="stat-v">${overdue}</div><div class="stat-s">↗ klik → detail</div></div>`;
  // Overdue + due <=10 panel
  const urgent=data.filter(r=>{const dl=dLeft(r.due_date);return getStatus(r)==='overdue'||(getStatus(r)!=='selesai'&&dl!==null&&dl<=10);}).sort((a,b)=>{
    if(getStatus(a)==='overdue'&&getStatus(b)!=='overdue')return-1;
    if(getStatus(b)==='overdue'&&getStatus(a)!=='overdue')return 1;
    return(dLeft(a.due_date)||0)-(dLeft(b.due_date)||0);
  });
  const odPanel=document.getElementById('odPanel');
  if(urgent.length){
    odPanel.style.display='';
    document.getElementById('odList').innerHTML=urgent.slice(0,8).map(r=>{
      const s=getStatus(r);const dl=dLeft(r.due_date);const isOv=s==='overdue';
      const pu=getPicUser(r.pic);const hasWa=pu&&pu.wa;
      return`<div class="od-row" onclick="goToDetail('${r.id}')" style="cursor:pointer">
        <div class="od-dot" style="background:${isOv?'var(--red)':dl<=3?'var(--red)':dl<=5?'var(--amber)':'var(--blue)'}"></div>
        <div class="od-text">
          <div class="od-nm">${(r.uraian_rekomendasi||r.rekomendasi||'-').slice(0,85)}…</div>
          <div class="od-meta">${r.id} · PIC: ${r.pic} · ${isOv?Math.abs(dl)+'h terlambat':dl+'h lagi'} · ${r.pct_realisasi}% · ${hasWa?'💬 '+pu.wa:'⚠️ No WA'}</div>
        </div>
        <div class="od-actions">
          <button class="abtn wa" onclick="openRM('${r.id}','wa')"${!hasWa?' disabled title="Set WA di Kelola Pengguna"':''}>WA</button>
        </div>
      </div>`;
    }).join('');
  } else odPanel.style.display='none';
  // Dept bars
  const dCols=['#4d8ef7','#2ecc8e','#f0a030','#9b7af5'];
  document.getElementById('deptList').innerHTML=DEPTS.map((d,i)=>{
    const items=data.filter(r=>r.pic&&r.pic.toUpperCase().includes(d));
    const done=items.filter(r=>r.pct_realisasi===100).length;
    const pct=items.length?Math.round(done/items.length*100):0;
    return`<div class="dept-item" onclick="filterAndGo('',null,'${d}')" style="cursor:pointer;padding:4px 6px;border-radius:var(--rsm);transition:background 0.15s" onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background=''"><div class="dept-hd"><span class="dept-name" style="color:${dCols[i]}">${d} <span style="font-size:9px;opacity:0.7">↗</span></span><span class="dept-pct">${done}/${items.length} · ${pct}%</span></div><div class="dept-bar"><div class="dept-fill" style="width:${pct}%;background:${dCols[i]}"></div></div></div>`;
  }).join('');
  const sheets=['Proses','SPT','SBT'];
  if(cKat)cKat.destroy();
  cKat=new Chart(document.getElementById('cKat'),{type:'bar',data:{labels:sheets,datasets:[
    {label:'Selesai',data:sheets.map(s=>data.filter(r=>r.sheet===s&&r.pct_realisasi===100).length),backgroundColor:'#2ecc8e',borderRadius:4},
    {label:'Proses',data:sheets.map(s=>data.filter(r=>r.sheet===s&&r.pct_realisasi>0&&r.pct_realisasi<100).length),backgroundColor:'#4d8ef7',borderRadius:4},
    {label:'Belum',data:sheets.map(s=>data.filter(r=>r.sheet===s&&r.pct_realisasi===0).length),backgroundColor:'#e85252',borderRadius:4},
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:([i])=>i.label+' – '+i.dataset.label}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true}},onClick:(e,els)=>{if(!els.length)return;const el=els[0];const sh=sheets[el.index];const st=['selesai','proses','belum'][el.datasetIndex];filterAndGo(st,sh);}}});
  if(cDonut)cDonut.destroy();
  cDonut=new Chart(document.getElementById('cDonut'),{type:'doughnut',data:{labels:['Selesai','Proses','Belum','Overdue'],datasets:[{data:[selesai,proses,belum,overdue],backgroundColor:['#2ecc8e','#4d8ef7','#445165','#e85252'],borderWidth:3,borderColor:'#0d1117'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:false}},onClick:(e,els)=>{if(!els.length)return;const labels=['selesai','proses','belum','overdue'];filterAndGo(labels[els[0].index]);}}});
  const pcts=DEPTS.map(d=>{const items=data.filter(r=>r.pic&&r.pic.toUpperCase().includes(d));return items.length?Math.round(items.reduce((s,r)=>s+r.pct_realisasi,0)/items.length):0;});
  if(cPic)cPic.destroy();
  cPic=new Chart(document.getElementById('cPic'),{type:'bar',data:{labels:DEPTS,datasets:[{data:pcts,backgroundColor:dCols,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y+'% realisasi'}}},scales:{x:{grid:{display:false}},y:{max:100,ticks:{callback:v=>v+'%'}}},onClick:(e,els)=>{if(!els.length)return;filterAndGo('',null,DEPTS[els[0].index]);}}});
  const dd={};data.forEach(r=>{if(r.due_date){const k=r.due_date.slice(0,7);dd[k]=(dd[k]||0)+1;}});
  const dk=Object.keys(dd).sort();
  if(cDue)cDue.destroy();
  cDue=new Chart(document.getElementById('cDue'),{type:'bar',data:{labels:dk.map(k=>{const[y,m]=k.split('-');return['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][+m]+' '+y;}),datasets:[{data:dk.map(k=>dd[k]),backgroundColor:dk.map(k=>k<TODAY.slice(0,7)?'#e85252':k===TODAY.slice(0,7)?'#f0a030':'#4d8ef7'),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:([i])=>i.label+' ('+dd[dk[i.dataIndex]]+' temuan)'}}},scales:{x:{grid:{display:false}},y:{ticks:{stepSize:5}}},onClick:(e,els)=>{if(!els.length)return;filterAndGo('',null,null,dk[els[0].index]);}}});
  renderSchedSummary();
}

// ===== NOTIF PAGE =====
function renderNotif(){
  const data=getEffData();
  const ovd=data.filter(r=>getStatus(r)==='overdue').sort((a,b)=>(a.due_date||'')>(b.due_date||'')?1:-1);
  const due10=data.filter(r=>{const dl=dLeft(r.due_date);return getStatus(r)!=='selesai'&&getStatus(r)!=='overdue'&&dl!==null&&dl<=10;}).sort((a,b)=>dLeft(a.due_date)-dLeft(b.due_date));
  const all=data.filter(r=>getStatus(r)!=='selesai').sort((a,b)=>(a.due_date||'')>(b.due_date||'')?1:-1);
  document.getElementById('cntOv').textContent=ovd.length;
  document.getElementById('cnt10').textContent=due10.length;
  document.getElementById('cntAll').textContent=all.length;
  function mkItems(list){
    if(!list.length)return'<div style="padding:16px 18px;font-size:12px;color:var(--text3)">Tidak ada item.</div>';
    return list.map(r=>{
      const s=getStatus(r);const dl=dLeft(r.due_date);const isOv=s==='overdue';
      const pu=getPicUser(r.pic);const hasWa=pu&&pu.wa;
      const bg=isOv?'var(--red-l)':dl<=3?'var(--red-l)':dl<=5?'var(--amber-l)':'var(--blue-l)';
      const ico=isOv?'⛔':dl<=3?'‼️':dl<=5?'⚠️':'🔔';
      const dLabel=isOv
        ?`<span style="color:var(--red);font-weight:600">Terlambat ${Math.abs(dl)} hari</span>`
        :`<span style="color:${dl<=3?'var(--red)':dl<=5?'var(--amber)':'var(--blue)'}">Due: ${fmtDate(r.due_date)} (${dl} hari lagi)</span>`;
      // Show actual PIC name if available
      const picLabel=pu?`${pu.name} (${r.pic})`:r.pic;
      return`<div class="notif-item">
        <div class="notif-ico" style="background:${bg}">${ico}</div>
        <div class="notif-main">
          <div class="notif-t">${(r.uraian_rekomendasi||r.rekomendasi||'-').slice(0,95)}…</div>
          <div class="notif-m">
            <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${r.id}</span>
            <span>PIC: <b style="color:var(--text)">${picLabel}</b></span>
            ${dLabel}
            <span style="color:var(--text3)">${r.pct_realisasi}%</span>
            ${hasWa?`<span style="color:var(--green)">💬 ${pu.wa}</span>`:`<span style="color:var(--red)">⚠️ WA belum diset</span>`}
          </div>
          <div class="notif-acts">
            <button class="abtn wa" onclick="openRM('${r.id}','wa')"${!hasWa?' title="Nomor WA belum diset"':''}>💬 WA${hasWa?' ('+pu.wa.slice(-4)+')':''}</button>
            <button class="abtn" onclick="openRM('${r.id}','em')">📧 Email</button>
            <button class="abtn" onclick="goUpd('${r.id}')">✏️ Update</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('listOv').innerHTML=mkItems(ovd);
  document.getElementById('list10').innerHTML=mkItems(due10);
  document.getElementById('listAll').innerHTML=mkItems(all);
  renderThresholds();renderAutoLog();
  const lr=document.getElementById('autoLastRun');if(lr)lr.textContent=localStorage.getItem('pge_lastRun')||'–';
}

function sendAllWA(){
  const data=getEffData();
  const urgent=data.filter(r=>{const dl=dLeft(r.due_date);return getStatus(r)==='overdue'||(getStatus(r)!=='selesai'&&dl!==null&&dl<=10);});
  const withWa=urgent.filter(r=>{const pu=getPicUser(r.pic);return pu&&pu.wa;});
  const noWa=urgent.filter(r=>{const pu=getPicUser(r.pic);return!pu||!pu.wa;});
  if(noWa.length)toast(`${noWa.length} PIC belum punya nomor WA. Set di Kelola Pengguna.`,'r');
  if(!withWa.length){toast('Tidak ada WA yang bisa dikirim.','a');return;}
  if(!confirm(`Kirim ${withWa.length} reminder WA sekarang?
(Browser akan membuka ${withWa.length} tab WhatsApp)`))return;
  withWa.forEach((r,i)=>{
    const pu=getPicUser(r.pic);
    const msg=encodeURIComponent(buildWAMsg(r,pu));
    const wa=pu.wa.replace(/[^0-9]/g,'');
    setTimeout(()=>window.open(`https://wa.me/${wa}?text=${msg}`,'_blank'),i*600);
  });
  toast(`${withWa.length} reminder WA dibuka!`,'g');
}

function sendGroupWA(group){
  const data=getEffData();
  let list=[];
  if(group==='overdue')list=data.filter(r=>getStatus(r)==='overdue');
  else if(group==='10')list=data.filter(r=>{const dl=dLeft(r.due_date);return getStatus(r)!=='selesai'&&getStatus(r)!=='overdue'&&dl!==null&&dl<=10;});
  const withWa=list.filter(r=>{const pu=getPicUser(r.pic);return pu&&pu.wa;});
  if(!withWa.length){toast('Tidak ada nomor WA terdaftar untuk grup ini.','a');return;}
  if(!confirm(`Kirim ${withWa.length} WA?`))return;
  withWa.forEach((r,i)=>{
    const pu=getPicUser(r.pic);
    const msg=encodeURIComponent(buildWAMsg(r,pu));
    setTimeout(()=>window.open(`https://wa.me/${pu.wa.replace(/[^0-9]/g,'')}?text=${msg}`,'_blank'),i*600);
  });
  toast(`${withWa.length} WA dibuka!`,'g');
}

// ===== REMINDER MODAL =====
let rmId=null,rmCh='wa',rmOrig='';
function openRM(id,ch){
  const data=getEffData();const r=data.find(x=>x.id===id);if(!r)return;
  rmId=id;rmCh=ch;
  document.getElementById('rmTitle').textContent='Reminder: '+r.id;
  document.getElementById('rmSub').textContent=(r.uraian_rekomendasi||r.rekomendasi||'-').slice(0,90)+'…';
  setRmCh(ch);
  document.getElementById('rmModal').classList.add('on');
}
function setRmCh(ch){
  rmCh=ch;
  const data=getEffData();const r=data.find(x=>x.id===rmId);if(!r)return;
  const pu=getPicUser(r.pic);
  // Build message using the actual PIC user (personalized)
  const msg=ch==='wa'?buildWAMsg(r,pu):buildEmailMsg(r,pu);
  rmOrig=msg;
  document.getElementById('rmMsg').value=msg;
  document.getElementById('rmWaBtn').classList.toggle('on',ch==='wa');
  document.getElementById('rmEmBtn').classList.toggle('on',ch==='em');
  document.getElementById('rmSendWa').style.display=ch==='wa'?'':'none';
  document.getElementById('rmSendEm').style.display=ch==='em'?'':'none';
  const hasWa=pu&&pu.wa;const hasEm=pu&&pu.email;
  document.getElementById('rmTarget').innerHTML=ch==='wa'
    ?(hasWa?`💬 <b style="color:var(--text)">${pu.name}</b> · <span style="font-family:var(--mono);color:var(--green)">${pu.wa}</span>`:`⚠️ Nomor WA belum diset untuk PIC <b>${r.pic}</b>. Isi di Kelola Pengguna → Edit.`)
    :(hasEm?`📧 <b style="color:var(--text)">${pu.name}</b> · <span style="color:var(--blue)">${pu.email}</span>`:`📧 Email belum diset untuk PIC <b>${r.pic}</b>.`);
}
function resetRmMsg(){document.getElementById('rmMsg').value=rmOrig;toast('Pesan direset ke template','a');}
function copyRmMsg(){navigator.clipboard.writeText(document.getElementById('rmMsg').value).then(()=>toast('Pesan disalin','g'));}
function doSendWa(){
  const data=getEffData();const r=data.find(x=>x.id===rmId);if(!r)return;
  const pu=getPicUser(r.pic);
  const msg=document.getElementById('rmMsg').value; // use edited message
  const wa=pu&&pu.wa?pu.wa.replace(/[^0-9]/g,''):'';
  window.open(wa?`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`:`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
  closeRM();toast('Membuka WhatsApp…','g');
}
function doSendEmail(){
  const data=getEffData();const r=data.find(x=>x.id===rmId);if(!r)return;
  const pu=getPicUser(r.pic);
  const raw=document.getElementById('rmMsg').value;
  const lines=raw.split('\n');
  const subj=encodeURIComponent(lines[0].replace(/^Subject:\s*/i,''));
  const body=encodeURIComponent(lines.slice(1).join('\n'));
  window.open(`mailto:${pu&&pu.email?pu.email:''}?subject=${subj}&body=${body}`,'_blank');
  closeRM();toast('Membuka email client…','g');
}
function closeRM(){document.getElementById('rmModal').classList.remove('on');}
document.getElementById('rmModal').addEventListener('click',function(e){if(e.target===this)closeRM();});

// ===== TEMUAN TABLE =====
let expandedId=null;
function renderTemuan(){
  const data=getEffData();
  const sh=document.getElementById('fSheet').value;
  const st=document.getElementById('fStatus').value;
  const pic=document.getElementById('fPic').value;
  const q=document.getElementById('srchTemuan').value.toLowerCase();
  const filtered=data.filter(r=>{
    if(sh&&r.sheet!==sh)return false;
    if(pic&&r.pic!==pic)return false;
    if(st&&getStatus(r)!==st)return false;
    if(q&&!((r.uraian_rekomendasi||r.rekomendasi||'').toLowerCase().includes(q)||(r.id||'').toLowerCase().includes(q)||(r.pic||'').toLowerCase().includes(q)))return false;
    return true;
  });
  const tb=document.getElementById('temuanBody');
  const empty=document.getElementById('temuanEmpty');
  if(!filtered.length){tb.innerHTML='';empty.style.display='';return;}
  empty.style.display='none';
  tb.innerHTML=filtered.map(r=>{
    const s=getStatus(r);const dl=dLeft(r.due_date);
    const desc=r.uraian_rekomendasi||r.rekomendasi||'-';
    const dLabel=r.due_date?`<div style="font-size:9px;margin-top:1px;color:${dl<0?'var(--red)':dl<=10?'var(--amber)':'var(--text3)'};">${dl<0?Math.abs(dl)+'h terlambat':dl+'h lagi'}</div>`:'';
    return`<tr onclick="toggleDetail('${r.id}')" style="cursor:pointer">
      <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${r.id}</td>
      <td><span class="badge b-blue" style="font-size:9px">${r.sheet}</span></td>
      <td style="max-width:280px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px" title="${desc.replace(/"/g,'')}">${desc.length>85?desc.slice(0,85)+'…':desc}</div></td>
      <td style="font-size:11px;font-family:var(--mono)">${r.pic||'-'}</td>
      <td><div style="font-size:11px;font-family:var(--mono)">${fmtDate(r.due_date)}</div>${dLabel}</td>
      <td><div class="prog"><div class="prog-bar"><div class="prog-fill" style="width:${r.pct_realisasi}%;background:${pCol(r.pct_realisasi)}"></div></div><span class="prog-num">${r.pct_realisasi}%</span></div></td>
      <td>${statusBadge(s)}</td>
      <td onclick="event.stopPropagation()"><div style="display:flex;gap:3px">
        <button class="abtn wa" onclick="openRM('${r.id}','wa')">WA</button>
        <button class="abtn" onclick="openRM('${r.id}','em')">Mail</button>
        <button class="abtn" onclick="goUpd('${r.id}')">Edit</button>
      </div></td>
    </tr>`;
  }).join('');
}
function getImgs(r){
  if(!r.no||!IMG_DATA)return{temuan:[],tl:[]};
  const sh=r.sheet;
  if(sh!=='SPT'&&sh!=='SBT')return{temuan:[],tl:[]};
  const entry=IMG_DATA[sh]&&IMG_DATA[sh][String(r.no)];
  if(!entry)return{temuan:[],tl:[]};
  // Merge with user-uploaded TL images
  const uplKey='tl_imgs_'+r.id;
  const userTl=JSON.parse(localStorage.getItem(uplKey)||'[]');
  return{temuan:entry.temuan||[],tl:[...(entry.tl||[]),...userTl]};
}
function buildImgGallery(imgs, label, color, idPrefix){
  if(!imgs.length) return `<div class="no-img">Belum ada foto ${label}</div>`;
  return imgs.map((src,i)=>`<img class="img-thumb" src="${src}" alt="${label} ${i+1}" onclick="openLB(${JSON.stringify(imgs)},${i},'${label}')" loading="lazy">`).join('');
}
function buildTlGallery(imgs, rid){
  const uplKey='tl_imgs_'+rid;
  const userImgs=JSON.parse(localStorage.getItem(uplKey)||'[]');
  const allImgs=imgs;
  let html='';
  if(allImgs.length){
    html+=allImgs.map((src,i)=>{
      const isUser=i>=((allImgs.length)-userImgs.length)&&userImgs.length>0;
      return`<div class="tl-img-wrap"><img class="tl-img-thumb" src="${src}" onclick="openLB(${JSON.stringify(allImgs)},${i},'Tindak Lanjut')" loading="lazy">${isUser?`<button class="tl-img-del" onclick="event.stopPropagation();delTlImg('${rid}',${i-(allImgs.length-userImgs.length)})">✕</button>`:''}</div>`;
    }).join('');
  } else {
    html+='<div class="no-img">Belum ada foto tindak lanjut</div>';
  }
  return html;
}
function toggleDetail(id){
  const data=getEffData();const r=data.find(x=>x.id===id);if(!r)return;
  const panel=document.getElementById('detailPanel');
  if(expandedId===id){panel.style.display='none';expandedId=null;return;}
  expandedId=id;panel.style.display='block';
  document.getElementById('detailTitle').textContent=`${r.id} – ${r.no_rekomendasi||r.id}`;
  const rows=[['Sheet',r.sheet],['No. Rekomendasi',r.no_rekomendasi||'-'],['Proses/Lokasi',r.proses||r.lokasi||'-'],
    ['Referensi',r.referensi||r.klasifikasi||'-'],['Uraian',r.uraian_rekomendasi||r.rekomendasi||'-'],
    ['Rencana TL',r.rencana_tindak_lanjut||'-'],['Deliverables',r.deliverables||'-'],
    ['PIC',r.pic||'-'],['Due Date',fmtDate(r.due_date)],['Realisasi',r.pct_realisasi+'%'],
    ['Status',getStatus(r)],['Catatan',r.catatan_update||r.catatan||'-'],
    ['Diupdate oleh',r.updated_by?r.updated_by+' ('+r.updated_at+')':'-']];
  
  const imgs=getImgs(r);
  const hasSptSbt=r.sheet==='SPT'||r.sheet==='SBT';
  
  let imgHtml='';
  if(hasSptSbt){
    imgHtml=`
    <div class="img-section">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div class="img-section-title"><span style="color:var(--red)">📸</span> Foto Temuan (${imgs.temuan.length})</div>
          <div class="img-gallery">${buildImgGallery(imgs.temuan,'Foto Temuan','red',r.id+'_t')}</div>
        </div>
        <div>
          <div class="img-section-title"><span style="color:var(--green)">✅</span> Foto Tindak Lanjut (${imgs.tl.length})</div>
          <div class="img-gallery" id="tlGallery_${r.id}">${buildTlGallery(imgs.tl,r.id)}</div>
          <div style="margin-top:10px">
            <div class="img-upload-area" onclick="triggerUpload('${r.id}')" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="handleDrop(event,'${r.id}')">
              <div class="upload-ico">📤</div>
              <div class="upload-label">Upload Foto Bukti TL</div>
              <div class="upload-hint">Klik atau drag foto · JPG/PNG · maks 5MB/foto</div>
            </div>
            <input type="file" id="fileInput_${r.id}" accept="image/*" multiple style="display:none" onchange="handleFileInput(event,'${r.id}')">
          </div>
        </div>
      </div>
    </div>`;
  }
  
  document.getElementById('detailContent').innerHTML=`<div class="detail-panel">${rows.map(([l,v])=>`<div class="dp-row"><span class="dp-lbl">${l}</span><span class="dp-val">${v}</span></div>`).join('')}${imgHtml}</div>`;
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function closeDetail(){document.getElementById('detailPanel').style.display='none';expandedId=null;}

// ===== USER MANAGEMENT =====
let selUser=null;
function renderUMList(){
  const users=getUsers();
  document.getElementById('uCount').textContent=users.length+' user';
  document.getElementById('umItems').innerHTML=users.map(u=>{
    const ini=u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const c=u.color||'#4d8ef7';const isOn=selUser===u.username;
    return`<div class="um-row${isOn?' on':''}" onclick="selectUser('${u.username}')">
      <div class="um-av" style="background:${c}22;color:${c}">${ini}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name}</div>
        <div style="font-size:10px;color:var(--text3)">${u.role==='admin'?'Admin':'PIC'} · ${u.dept} ${u.wa?'· 💬':'· ⚠️ No WA'}</div>
      </div>
    </div>`;
  }).join('');
  if(selUser)showUserDetail(selUser);
}
function selectUser(uname){selUser=uname;renderUMList();}
function showUserDetail(uname){
  const u=getUsers().find(x=>x.username===uname);if(!u)return;
  const c=u.color||'#4d8ef7';const ini=u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('umEmpty').style.display='none';
  document.getElementById('umDetailBody').style.display='flex';
  const av=document.getElementById('udAv');av.textContent=ini;av.style.background=c+'22';av.style.color=c;
  document.getElementById('udName').textContent=u.name;
  document.getElementById('udRole2').textContent=(u.role==='admin'?'Administrator':'PIC')+' · '+u.dept;
  document.getElementById('udUser').textContent=u.username;
  document.getElementById('udDept').textContent=u.dept;
  document.getElementById('udWa').innerHTML=u.wa
    ?`<a href="https://wa.me/${u.wa.replace(/[^0-9]/g,'')}" target="_blank" style="color:var(--green);font-family:var(--mono)">${u.wa}</a>`
    :`<span style="color:var(--red)">Belum diset – reminder otomatis tidak berjalan</span>`;
  document.getElementById('udEmail').textContent=u.email||'–';
  document.getElementById('udDelBtn').style.display=u.username==='admin'?'none':'';
  const data=getEffData();
  const assigned=data.filter(r=>r.pic&&(r.pic.toUpperCase()===u.dept.toUpperCase()||r.pic.toUpperCase().includes(u.dept.toUpperCase())||u.dept.toUpperCase().includes(r.pic.toUpperCase())));
  document.getElementById('udTCount').textContent=assigned.length;
  document.getElementById('udTemuan').innerHTML=assigned.slice(0,8).map(r=>{
    const s=getStatus(r);const sC={selesai:'var(--green)',proses:'var(--blue)',belum:'var(--amber)',overdue:'var(--red)'};
    return`<div class="temuan-mini">
      <span style="font-size:9px;font-family:var(--mono);color:var(--text3);min-width:48px">${r.id}</span>
      <span style="flex:1;font-size:10px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(r.uraian_rekomendasi||r.rekomendasi||'-').slice(0,55)}…</span>
      <span style="width:6px;height:6px;border-radius:50%;background:${sC[s]};flex-shrink:0"></span>
      <button class="abtn wa" style="padding:2px 6px;font-size:9px" onclick="openRM('${r.id}','wa')">WA</button>
    </div>`;
  }).join('')+(assigned.length>8?`<div style="font-size:10px;color:var(--text3);padding:6px">…dan ${assigned.length-8} lagi</div>`:'');
}
function editUser(){
  if(!selUser)return;const u=getUsers().find(x=>x.username===selUser);if(!u)return;
  document.getElementById('euSub').textContent='@'+u.username+' · '+u.dept;
  document.getElementById('euName').value=u.name;
  document.getElementById('euWa').value=u.wa||'';
  document.getElementById('euEmail').value=u.email||'';
  document.getElementById('euDept').value=u.dept;
  document.getElementById('euPass').value='';
  document.getElementById('editUserModal').classList.add('on');
}
function saveEditUser(){/* overridden by api.js */}
function delUser(){/* overridden by api.js */}
function doAddUser(){/* overridden by api.js */}

// ===== UPDATE =====
let updTarget=null,updPct=0;
function renderUpdate(){
  const data=getEffData();
  const pic=document.getElementById('updPic').value;
  const st=document.getElementById('updStatus').value;
  const q=document.getElementById('srchUpd').value.toLowerCase();
  const filtered=data.filter(r=>{
    if(pic&&r.pic!==pic)return false;
    if(st&&getStatus(r)!==st)return false;
    if(q&&!(r.uraian_rekomendasi||r.rekomendasi||'').toLowerCase().includes(q)&&!r.id.toLowerCase().includes(q))return false;
    return true;
  });
  document.getElementById('updBody').innerHTML=filtered.map(r=>{
    const dl=dLeft(r.due_date);
    const dLabel=r.due_date?`<div style="font-size:9px;margin-top:1px;color:${dl<0?'var(--red)':dl<=10?'var(--amber)':'var(--text3)'};">${dl<0?Math.abs(dl)+'h terlambat':dl+'h lagi'}</div>`:'';
    return`<tr>
      <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${r.id}</td>
      <td style="max-width:260px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(r.uraian_rekomendasi||r.rekomendasi||'-').slice(0,70)}…</div></td>
      <td style="font-size:11px;font-family:var(--mono)">${r.pic||'-'}</td>
      <td><div style="font-size:11px;font-family:var(--mono)">${fmtDate(r.due_date)}</div>${dLabel}</td>
      <td><div class="prog"><div class="prog-bar"><div class="prog-fill" style="width:${r.pct_realisasi}%;background:${pCol(r.pct_realisasi)}"></div></div><span class="prog-num">${r.pct_realisasi}%</span></div></td>
      <td><button class="abtn" onclick="openUpdForm('${r.id}')">✏️ Update</button></td>
    </tr>`;
  }).join('');
}
function goUpd(id){showPage('update');setTimeout(()=>openUpdForm(id),80);}
function openUpdForm(id){
  const data=getEffData();const r=data.find(x=>x.id===id);if(!r)return;
  updTarget=r;updPct=r.pct_realisasi;
  window._pendingTlImgs=[];
  document.getElementById('updFTitle').textContent='Update: '+r.id;
  document.getElementById('updFSub').textContent=(r.uraian_rekomendasi||r.rekomendasi||'-').slice(0,100)+'…';
  document.getElementById('updNote').value=r.catatan_update||'';
  document.getElementById('updDeliv').value=r.deliverables||'';
  document.querySelectorAll('.pct-opt').forEach(b=>b.classList.toggle('on',+b.dataset.v===updPct));
  // Show image section only for SPT/SBT
  const isSptSbt=r.sheet==='SPT'||r.sheet==='SBT';
  document.getElementById('updImgSection').style.display=isSptSbt?'':'none';
  if(isSptSbt)renderUpdTlPreview();
  document.getElementById('updForm').style.display='';
  document.getElementById('updForm').scrollIntoView({behavior:'smooth'});
}
function setPct(v,btn){updPct=v;document.querySelectorAll('.pct-opt').forEach(b=>b.classList.remove('on'));btn.classList.add('on');}
function submitUpdate(){/* overridden by api.js */}
function cancelUpdate(){document.getElementById('updForm').style.display='none';updTarget=null;}

// ===== NAV =====
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.getElementById('page-'+name).classList.add('on');
  document.querySelectorAll('.sb-item').forEach(b=>{
    const fn=b.getAttribute('onclick')||'';
    b.classList.toggle('on',fn.includes("'"+name+"'")&&!fn.includes('toggleDrawer')&&!fn.includes('openUM'));
  });
  if(name==='dashboard')renderDashboard();
  if(name==='notif')renderNotif();
  if(name==='update')renderUpdate();
  if(name==='temuan')renderTemuan();
  if(name==='autonotif'){renderAutoLog();renderThresholds();loadTpl();
    const lr=document.getElementById('autoLastRun');if(lr)lr.textContent=localStorage.getItem('pge_lastRun')||'–';
    updateAutoBtn();
  }
}

// ===== TOAST =====
function toast(msg,type){
  const w=document.getElementById('toastWrap');const el=document.createElement('div');
  el.className='toast '+(type||'');el.textContent=msg;w.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity 0.3s';setTimeout(()=>el.remove(),300);},3800);
}

// ===== EXPORT CSV =====
function exportCSV(){
  const data=getEffData();
  const cols=['id','sheet','no_rekomendasi','proses','lokasi','pic','due_date','pct_realisasi','deliverables','catatan_update'];
  const rows=data.map(r=>cols.map(c=>'"'+String(r[c]||'').replace(/"/g,'""')+'"').join(','));
  const csv=[cols.join(','),...rows].join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download='PGE_UBL_Audit_'+TODAY+'.csv';a.click();toast('Data diekspor','g');
}

// ===== AUTO LOGIN =====
// Auto-login handled by api.js initApp()


// ===== INJECTED PATCHES =====
// ====================================================
// filterAndGo: navigate to temuan page with filters
// status: 'selesai'|'proses'|'belum'|'overdue'|''
// sheet: 'Proses'|'SPT'|'SBT'|null
// pic: 'HSSE'|'MTC'|etc|null
// dueMth: 'YYYY-MM' month filter|null
// ====================================================
function filterAndGo(status, sheet, pic, dueMth) {
  // Reset all filters first
  document.getElementById('fStatus').value = status || '';
  document.getElementById('fSheet').value = sheet || '';

  if (pic) {
    // Find closest matching PIC option
    const sel = document.getElementById('fPic');
    let matched = '';
    for (let o of sel.options) {
      if (o.value && o.value.toUpperCase().includes(pic.toUpperCase())) {
        matched = o.value; break;
      }
    }
    sel.value = matched;
  } else {
    document.getElementById('fPic').value = '';
  }
  document.getElementById('srchTemuan').value = '';

  // If month filter, use search box for approximate match
  if (dueMth) {
    document.getElementById('srchTemuan').value = '';
    // Store month filter for renderTemuan
    window._dueMthFilter = dueMth;
  } else {
    window._dueMthFilter = null;
  }

  showPage('temuan');
  // Small delay to ensure page rendered, then scroll to top
  setTimeout(() => {
    renderTemuanWithMonth();
    document.querySelector('.main').scrollTo({ top: 0, behavior: 'smooth' });
  }, 60);
}

function renderTemuanWithMonth() {
  const data = getEffData();
  const sh = document.getElementById('fSheet').value;
  const st = document.getElementById('fStatus').value;
  const pic = document.getElementById('fPic').value;
  const q = document.getElementById('srchTemuan').value.toLowerCase();
  const dueMth = window._dueMthFilter;

  const filtered = data.filter(r => {
    if (sh && r.sheet !== sh) return false;
    if (pic && r.pic !== pic) return false;
    if (st && getStatus(r) !== st) return false;
    if (dueMth && !(r.due_date && r.due_date.startsWith(dueMth))) return false;
    if (q && !((r.uraian_rekomendasi || r.rekomendasi || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q) || (r.pic || '').toLowerCase().includes(q))) return false;
    return true;
  });

  const tb = document.getElementById('temuanBody');
  const empty = document.getElementById('temuanEmpty');
  if (!filtered.length) { tb.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  tb.innerHTML = filtered.map(r => {
    const s = getStatus(r); const dl = dLeft(r.due_date);
    const desc = r.uraian_rekomendasi || r.rekomendasi || '-';
    const dLabel = r.due_date ? `<div style="font-size:9px;margin-top:1px;color:${dl < 0 ? 'var(--red)' : dl <= 10 ? 'var(--amber)' : 'var(--text3)'};">${dl < 0 ? Math.abs(dl) + 'h terlambat' : dl + 'h lagi'}</div>` : '';
    return `<tr onclick="toggleDetail('${r.id}')" style="cursor:pointer">
      <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${r.id}</td>
      <td><span class="badge b-blue" style="font-size:9px">${r.sheet}</span></td>
      <td style="max-width:280px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px" title="${desc.replace(/"/g, '')}">${desc.length > 85 ? desc.slice(0, 85) + '…' : desc}</div></td>
      <td style="font-size:11px;font-family:var(--mono)">${r.pic || '-'}</td>
      <td><div style="font-size:11px;font-family:var(--mono)">${fmtDate(r.due_date)}</div>${dLabel}</td>
      <td><div class="prog"><div class="prog-bar"><div class="prog-fill" style="width:${r.pct_realisasi}%;background:${pCol(r.pct_realisasi)}"></div></div><span class="prog-num">${r.pct_realisasi}%</span></div></td>
      <td>${statusBadge(s)}</td>
      <td onclick="event.stopPropagation()"><div style="display:flex;gap:3px">
        <button class="abtn wa" onclick="openRM('${r.id}','wa')">WA</button>
        <button class="abtn" onclick="openRM('${r.id}','em')">Mail</button>
        <button class="abtn" onclick="goUpd('${r.id}')">Edit</button>
      </div></td>
    </tr>`;
  }).join('');
}

// Override renderTemuan to use month filter
const _origRenderTemuan = renderTemuan;
window.renderTemuan = function() {
  if (window._dueMthFilter) {
    renderTemuanWithMonth();
  } else {
    _origRenderTemuan();
  }
};

// goToDetail: go to temuan page and open detail for specific ID
function goToDetail(id) {
  showPage('temuan');
  window._dueMthFilter = null;
  // Reset filters
  ['fStatus', 'fSheet', 'fPic'].forEach(el => document.getElementById(el).value = '');
  document.getElementById('srchTemuan').value = '';
  setTimeout(() => {
    renderTemuan();
    setTimeout(() => {
      // Find and expand the row
      toggleDetail(id);
      // Scroll to detail panel
      const panel = document.getElementById('detailPanel');
      if (panel && panel.style.display !== 'none') {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, 80);
}

// ====================================================
// WA CLOUD API
// ====================================================
const getWaCfg = () => JSON.parse(localStorage.getItem('pge_wacfg') || '{}');
const saveWaCfg = c => localStorage.setItem('pge_wacfg', JSON.stringify(c));
const getWaLog = () => JSON.parse(localStorage.getItem('pge_waApiLog') || '[]');
const saveWaLog = l => localStorage.setItem('pge_waApiLog', JSON.stringify(l.slice(-300)));

async function sendWAApi(to, message) {
  const cfg = getWaCfg();
  if (!cfg.phoneId || !cfg.token) throw new Error('API belum dikonfigurasi');

  const cleanTo = to.replace(/[^0-9]/g, '');
  const url = `https://graph.facebook.com/v19.0/${cfg.phoneId}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
    type: 'text',
    text: { preview_url: false, body: message }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + cfg.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'API Error: ' + res.status);
  return data;
}

function loadWaConfigForm() {
  const cfg = getWaCfg();
  if (cfg.phoneId) document.getElementById('waPhoneId').value = cfg.phoneId;
  if (cfg.token) document.getElementById('waToken').value = cfg.token;
  if (cfg.sender) document.getElementById('waSender').value = cfg.sender;
  if (cfg.testNum) document.getElementById('waTestNum').value = cfg.testNum;
  if (cfg.mode) document.getElementById('waMode').value = cfg.mode;
  if (cfg.autoSend) document.getElementById('waAutoSend').checked = cfg.autoSend;
  updateWaStatus();
  renderWaLog();
  renderWaPending();
}

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
  toast('Konfigurasi WA API disimpan', 'g');
  updateWaStatus();
}

async function testWaAPI() {
  const cfg = {
    phoneId: document.getElementById('waPhoneId').value.trim(),
    token: document.getElementById('waToken').value.trim(),
  };
  if (!cfg.phoneId || !cfg.token) { toast('Isi Phone Number ID dan Token dulu', 'r'); return; }
  saveWaCfg({ ...getWaCfg(), ...cfg });

  const el = document.getElementById('apiStatus');
  el.style.display = '';
  el.style.background = 'var(--bg3)';
  el.style.color = 'var(--text2)';
  el.textContent = '⏳ Menguji koneksi ke Meta API...';

  try {
    // Test by getting phone number info
    const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.phoneId}?fields=display_phone_number,verified_name&access_token=${cfg.token}`);
    const data = await res.json();
    if (res.ok) {
      el.style.background = 'var(--green-l)';
      el.style.color = 'var(--green)';
      el.textContent = `✅ Koneksi berhasil! Nomor: ${data.display_phone_number || '-'} · Nama: ${data.verified_name || '-'}`;
      updateWaStatus(true, data.display_phone_number);
      toast('Koneksi WA API berhasil!', 'g');
    } else {
      throw new Error(data.error?.message || 'Gagal');
    }
  } catch (e) {
    el.style.background = 'var(--red-l)';
    el.style.color = 'var(--red)';
    el.textContent = '❌ Gagal: ' + e.message;
    updateWaStatus(false);
    toast('Test gagal: ' + e.message, 'r');
  }
}

function updateWaStatus(ok, num) {
  const cfg = getWaCfg();
  const dot = document.getElementById('waStatusDot');
  const lbl = document.getElementById('waStatusLabel');
  const sub = document.getElementById('waStatusSub');
  if (!dot) return;
  if (ok === true) {
    dot.style.background = 'var(--green)';
    lbl.textContent = 'Terhubung';
    sub.textContent = 'Nomor aktif: ' + (num || cfg.sender || '-');
  } else if (ok === false) {
    dot.style.background = 'var(--red)';
    lbl.textContent = 'Gagal terhubung';
    sub.textContent = 'Periksa token dan phone ID';
  } else if (cfg.phoneId && cfg.token) {
    dot.style.background = 'var(--amber)';
    lbl.textContent = 'Terkonfigurasi (belum ditest)';
    sub.textContent = 'Klik Test Koneksi untuk verifikasi';
  } else {
    dot.style.background = 'var(--text3)';
    lbl.textContent = 'Belum dikonfigurasi';
    sub.textContent = 'Isi Phone Number ID dan Token';
  }
}

async function sendTestWA() {
  const cfg = getWaCfg();
  const testNum = document.getElementById('waTestNum').value.trim() || cfg.testNum;
  const msg = document.getElementById('waTestMsg').value;
  if (!testNum) { toast('Isi nomor test dulu', 'r'); return; }
  if (!cfg.phoneId || !cfg.token) { toast('Konfigurasi API dulu', 'r'); return; }
  try {
    toast('⏳ Mengirim pesan test...', '');
    await sendWAApi(testNum, msg);
    addWaLog(testNum, 'Test', 'berhasil');
    toast('✅ Pesan test berhasil dikirim!', 'g');
  } catch (e) {
    addWaLog(testNum, 'Test', 'gagal: ' + e.message);
    toast('❌ Gagal: ' + e.message, 'r');
  }
}

function addWaLog(to, label, status) {
  const log = getWaLog();
  log.unshift({ to, label, status, at: new Date().toLocaleString('id-ID') });
  saveWaLog(log);
  renderWaLog();
  // Update counters
  const today = new Date().toLocaleDateString('id-ID');
  const todayCnt = log.filter(l => l.at.startsWith(today) && l.status === 'berhasil').length;
  const el1 = document.getElementById('waSentToday');
  const el2 = document.getElementById('waSentTotal');
  if (el1) el1.textContent = todayCnt;
  if (el2) el2.textContent = log.filter(l => l.status === 'berhasil').length;
}

function renderWaLog() {
  const log = getWaLog();
  const el = document.getElementById('waApiLog'); if (!el) return;
  if (!log.length) { el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:4px">Belum ada log</div>'; return; }
  el.innerHTML = log.slice(0, 30).map(l => `
    <div style="display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px">
      <span style="color:${l.status === 'berhasil' ? 'var(--green)' : 'var(--red)'}">${l.status === 'berhasil' ? '✓' : '✗'}</span>
      <span style="font-family:var(--mono);color:var(--blue);min-width:100px">${l.to.slice(-8)}</span>
      <span style="color:var(--text2);flex:1">${l.label}</span>
      <span style="color:var(--text3)">${l.at.split(' ')[1] || ''}</span>
    </div>`).join('');
  const today = new Date().toLocaleDateString('id-ID');
  const el1 = document.getElementById('waSentToday');
  const el2 = document.getElementById('waSentTotal');
  if (el1) el1.textContent = log.filter(l => l.at.startsWith(today) && l.status === 'berhasil').length;
  if (el2) el2.textContent = log.filter(l => l.status === 'berhasil').length;
}

function renderWaPending() {
  const el = document.getElementById('waPendingList'); if (!el) return;
  const data = getEffData();
  const sentLog = getSentLog();
  const pending = [];
  data.forEach(r => {
    if (r.pct_realisasi === 100) return;
    const dl = dLeft(r.due_date); if (dl === null) return;
    const s = getStatus(r);
    const pu = getPicUser(r.pic); if (!pu || !pu.wa) return;
    const logKey = `${r.id}_${TODAY}`;
    let needSend = false; let dayLabel = '';
    if (s === 'overdue' && !sentLog[logKey + '_ov']) { needSend = true; dayLabel = 'overdue'; }
    else NOTIF_DAYS.forEach(n => { if (dl === n && !sentLog[logKey + `_${n}`]) { needSend = true; dayLabel = n + ' hari'; } });
    if (needSend) pending.push({ r, pu, dayLabel });
  });
  if (!pending.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:12px;text-align:center">Tidak ada reminder yang perlu dikirim sekarang ✓</div>'; return; }
  el.innerHTML = `<div style="margin-bottom:8px;font-size:11px;color:var(--text3)">${pending.length} reminder siap dikirim</div>` +
    pending.map(p => {
      const isOv = p.dayLabel === 'overdue';
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg3);border-radius:var(--rsm);border:1px solid var(--border);margin-bottom:5px">
        <span style="color:${isOv ? 'var(--red)' : 'var(--amber)'};font-size:14px">${isOv ? '⛔' : '🔔'}</span>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--text);font-weight:500">${p.r.id} – ${p.pu.name} (${p.r.pic})</div>
          <div style="font-size:10px;color:var(--text3);margin-top:1px">${p.dayLabel} · Due: ${fmtDate(p.r.due_date)} · ${p.pu.wa}</div>
        </div>
        <button class="abtn wa" onclick="sendSingleViaAPI('${p.r.id}','${p.pu.wa}','${p.pu.name}')">Kirim</button>
      </div>`;
    }).join('');
}

async function sendSingleViaAPI(id, wa, name) {
  const cfg = getWaCfg();
  const data = getEffData();
  const r = data.find(x => x.id === id); if (!r) return;
  const pu = getPicUser(r.pic);
  const msg = buildWAMsg(r, pu);

  if (cfg.mode === 'link' || !cfg.token) {
    window.open(`https://wa.me/${wa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    toast('Membuka WhatsApp...', 'g');
    return;
  }

  try {
    await sendWAApi(wa, msg);
    // Mark as sent
    const sentLog = getSentLog();
    const s = getStatus(r);
    const dl = dLeft(r.due_date);
    const logKey = `${r.id}_${TODAY}`;
    if (s === 'overdue') sentLog[logKey + '_ov'] = true;
    else NOTIF_DAYS.forEach(n => { if (dl === n) sentLog[logKey + `_${n}`] = true; });
    saveSentLog(sentLog);
    addWaLog(wa, `${id} → ${name}`, 'berhasil');
    toast(`✅ Reminder dikirim ke ${name}`, 'g');
    renderWaPending();
  } catch (e) {
    addWaLog(wa, `${id} → ${name}`, 'gagal: ' + e.message);
    toast('❌ Gagal: ' + e.message + '. Coba via WA link.', 'r');
  }
}

async function sendAllViaAPI() {
  const cfg = getWaCfg();
  const data = getEffData();
  const sentLog = getSentLog();
  const toSend = [];

  data.forEach(r => {
    if (r.pct_realisasi === 100) return;
    const dl = dLeft(r.due_date); if (dl === null) return;
    const s = getStatus(r);
    const pu = getPicUser(r.pic); if (!pu || !pu.wa) return;
    const logKey = `${r.id}_${TODAY}`;
    let needed = false; let dayLabel = '';
    if (s === 'overdue' && !sentLog[logKey + '_ov']) { needed = true; dayLabel = 'overdue'; }
    else NOTIF_DAYS.forEach(n => { if (dl === n && !sentLog[logKey + `_${n}`]) { needed = true; dayLabel = String(n); } });
    if (needed) toSend.push({ r, pu, dayLabel });
  });

  if (!toSend.length) { toast('Tidak ada reminder yang perlu dikirim', 'a'); return; }
  if (!confirm(`Kirim ${toSend.length} reminder via WhatsApp API?\n\nPastikan token valid sebelum mengirim.`)) return;

  let ok = 0; let fail = 0;
  const newSent = { ...sentLog };

  for (const item of toSend) {
    const msg = buildWAMsg(item.r, item.pu);
    try {
      if (cfg.token && cfg.phoneId && cfg.mode !== 'link') {
        await sendWAApi(item.pu.wa, msg);
        addWaLog(item.pu.wa, `${item.r.id} → ${item.pu.name}`, 'berhasil');
      } else {
        window.open(`https://wa.me/${item.pu.wa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
      }
      const logKey = `${item.r.id}_${TODAY}`;
      if (item.dayLabel === 'overdue') newSent[logKey + '_ov'] = true;
      else newSent[logKey + `_${item.dayLabel}`] = true;
      ok++;
      await new Promise(res => setTimeout(res, 400)); // rate limiting
    } catch (e) {
      addWaLog(item.pu.wa, `${item.r.id} → ${item.pu.name}`, 'gagal: ' + e.message);
      fail++;
    }
  }
  saveSentLog(newSent);
  localStorage.setItem('pge_lastRun', new Date().toLocaleString('id-ID'));
  toast(`✅ ${ok} berhasil${fail ? `, ❌ ${fail} gagal` : ''}`, ok > 0 ? 'g' : 'r');
  renderWaPending(); renderWaLog();
}

// Override scheduleCheck to use API if configured
const _origScheduleCheck = scheduleCheck;
window.scheduleCheck = function(force) {
  const cfg = getWaCfg();
  if (cfg.token && cfg.phoneId && cfg.autoSend && cfg.mode !== 'link') {
    // Use API auto-send silently
    const data = getEffData();
    const sentLog = getSentLog();
    const toSend = [];
    data.forEach(r => {
      if (r.pct_realisasi === 100) return;
      const dl = dLeft(r.due_date); if (dl === null) return;
      const s = getStatus(r);
      const pu = getPicUser(r.pic); if (!pu || !pu.wa) return;
      const logKey = `${r.id}_${TODAY}`;
      let needed = false; let dayLabel = '';
      if (s === 'overdue' && !sentLog[logKey + '_ov']) { needed = true; dayLabel = 'overdue'; }
      else NOTIF_DAYS.forEach(n => { if (dl === n && !sentLog[logKey + `_${n}`]) { needed = true; dayLabel = String(n); } });
      if (needed) toSend.push({ r, pu, dayLabel });
    });
    if (!toSend.length) return;
    // Auto-send via API without confirmation
    (async () => {
      const newSent = { ...sentLog };
      let ok = 0;
      for (const item of toSend) {
        try {
          await sendWAApi(item.pu.wa, buildWAMsg(item.r, item.pu));
          addWaLog(item.pu.wa, `AUTO: ${item.r.id} → ${item.pu.name}`, 'berhasil');
          const logKey = `${item.r.id}_${TODAY}`;
          if (item.dayLabel === 'overdue') newSent[logKey + '_ov'] = true;
          else newSent[logKey + `_${item.dayLabel}`] = true;
          ok++;
          await new Promise(res => setTimeout(res, 500));
        } catch (e) {
          addWaLog(item.pu.wa, `AUTO: ${item.r.id}`, 'gagal: ' + e.message);
        }
      }
      saveSentLog(newSent);
      localStorage.setItem('pge_lastRun', new Date().toLocaleString('id-ID'));
      if (ok > 0) toast(`🤖 Auto-sent ${ok} reminder via API`, 'g');
    })();
  } else {
    _origScheduleCheck(force);
  }
};

// Patch showPage to load WA API config when navigating to waapi
const _origShowPage = showPage;
window.showPage = function(name) {
  _origShowPage(name);
  if (name === 'waapi') { loadWaConfigForm(); }
};

// Stat cards hover effect
document.querySelectorAll('.stat').forEach(el => {
  el.addEventListener('mouseenter', () => el.style.transform = 'translateY(-2px)');
  el.addEventListener('mouseleave', () => el.style.transform = '');
  el.style.transition = 'transform 0.15s ease, border-color 0.15s';
});


// ===== IMAGE & UPLOAD FUNCTIONS =====

// Lightbox state
let lbImgs=[], lbIdx=0;
function openLB(imgs, idx, label){
  lbImgs=imgs; lbIdx=idx;
  document.getElementById('lbImg').src=imgs[idx];
  document.getElementById('lbInfo').textContent=label+' '+(idx+1)+' / '+imgs.length;
  document.getElementById('lightbox').classList.add('on');
}
function closeLB(){document.getElementById('lightbox').classList.remove('on');}
function lbNav(dir){
  lbIdx=(lbIdx+dir+lbImgs.length)%lbImgs.length;
  document.getElementById('lbImg').src=lbImgs[lbIdx];
  document.getElementById('lbInfo').textContent='Foto '+(lbIdx+1)+' / '+lbImgs.length;
}
document.addEventListener('keydown',e=>{
  if(!document.getElementById('lightbox').classList.contains('on'))return;
  if(e.key==='ArrowLeft')lbNav(-1);
  if(e.key==='ArrowRight')lbNav(1);
  if(e.key==='Escape')closeLB();
});
document.getElementById('lightbox').addEventListener('click',function(e){if(e.target===this)closeLB();});

// Compress image file to base64 data URI (max 800px, quality 65)
function compressFile(file, cb){
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const MAX=800;
      let w=img.width,h=img.height;
      if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      cb(canvas.toDataURL('image/jpeg',0.65));
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function validateFile(file){
  if(!file.type.startsWith('image/')){toast('File harus berupa gambar (JPG/PNG)','r');return false;}
  if(file.size>5*1024*1024){toast(`${file.name} terlalu besar (maks 5MB)`,'r');return false;}
  return true;
}

// ---- Detail panel upload (for toggleDetail view) ----
function triggerUpload(rid){
  document.getElementById('fileInput_'+rid).click();
}
function handleFileInput(){/* overridden by api.js */}
function handleDrop(){/* overridden by api.js */}
function delTlImg(){/* overridden by api.js */}

// ---- Update page upload ----
function triggerUpdUpload(){document.getElementById('updFileInput').click();}
function handleUpdFileInput(){/* overridden by api.js */}
function handleUpdDrop(){/* overridden by api.js */}
function renderUpdTlPreview(){
  const el=document.getElementById('updTlPreview');if(!el)return;
  const pending=window._pendingTlImgs||[];
  const rid=updTarget?updTarget.id:null;
  // Show existing uploaded + pending
  const existing=rid?JSON.parse(localStorage.getItem('tl_imgs_'+rid)||'[]'):[];
  const all=[...existing,...pending];
  if(!all.length){el.innerHTML='';return;}
  el.innerHTML=all.map((src,i)=>{
    const isPending=i>=existing.length;
    return`<div class="tl-img-wrap">
      <img class="tl-img-thumb" src="${src}" onclick="openLB(${JSON.stringify(all)},${i},'Tindak Lanjut')" loading="lazy">
      <button class="tl-img-del" onclick="${isPending?`delPendingImg(${i-existing.length})`:`delExistingTlImg('${rid}',${i})`}">✕</button>
    </div>`;
  }).join('');
}
function delPendingImg(idx){
  if(window._pendingTlImgs)window._pendingTlImgs.splice(idx,1);
  renderUpdTlPreview();
}
function delExistingTlImg(rid,idx){
  if(!confirm('Hapus foto ini?'))return;
  const k='tl_imgs_'+rid;
  const imgs=JSON.parse(localStorage.getItem(k)||'[]');
  imgs.splice(idx,1);
  localStorage.setItem(k,JSON.stringify(imgs));
  renderUpdTlPreview();
}


// ===== INTERVAL MANAGER =====
const ALL_INTERVALS = [
  {days:90, label:'3 bulan (90 hari)', color:'var(--purple)', tplKey:'wa_90'},
  {days:60, label:'2 bulan (60 hari)', color:'var(--purple)', tplKey:'wa_60'},
  {days:30, label:'1 bulan (30 hari)', color:'var(--blue)', tplKey:'wa_30'},
  {days:10, label:'10 hari', color:'var(--blue)', tplKey:'wa_10'},
  {days:7,  label:'7 hari',  color:'var(--blue)', tplKey:'wa_7'},
  {days:5,  label:'5 hari',  color:'var(--amber)', tplKey:'wa_5'},
  {days:3,  label:'3 hari (URGENT)', color:'var(--red)', tplKey:'wa_3'},
];

function getAllIntervalDefs(){
  const custom = JSON.parse(localStorage.getItem('pge_custom_intervals')||'[]');
  const base = ALL_INTERVALS.map(i=>({...i,isCustom:false}));
  const customDefs = custom.map(d=>({days:d, label:d+' hari (kustom)', color:'var(--teal)', tplKey:'wa_custom', isCustom:true}));
  // Merge and sort descending
  return [...base,...customDefs].sort((a,b)=>b.days-a.days);
}

function renderIntervalChecks(){
  const el = document.getElementById('intervalChecks'); if(!el) return;
  const active = getActiveIntervals();
  const all = getAllIntervalDefs();
  const data = getEffData();
  
  el.innerHTML = all.map(def=>{
    const checked = active.includes(def.days);
    const cnt = data.filter(r=>{const dl=dLeft(r.due_date);return dl===def.days&&getStatus(r)!=='selesai';}).length;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:${checked?'var(--bg4)':'var(--bg3)'};border-radius:var(--rsm);border:1px solid ${checked?'var(--border2)':'var(--border)'};transition:all 0.15s">
      <input type="checkbox" id="intv_${def.days}" ${checked?'checked':''} onchange="toggleInterval(${def.days},this.checked)" style="width:15px;height:15px;cursor:pointer;accent-color:${def.color}">
      <label for="intv_${def.days}" style="flex:1;font-size:12px;font-weight:${checked?'600':'400'};color:${checked?'var(--text)':'var(--text2)'};cursor:pointer">${def.label}</label>
      <span style="font-size:10px;color:${cnt>0?def.color:'var(--text3)'};font-family:var(--mono)">${cnt>0?cnt+' temuan':'–'}</span>
      ${def.isCustom?`<button class="tl-img-del" style="position:static;width:16px;height:16px;font-size:9px" onclick="removeCustomInterval(${def.days})">✕</button>`:''}
    </div>`;
  }).join('');
  
  // Update summary
  const summary = document.getElementById('activeIntervalsSummary');
  if(summary) summary.textContent = active.length ? active.sort((a,b)=>b-a).map(d=>{
    const def=all.find(x=>x.days===d);
    return def?(d<=7?d+'h':d===30?'1bln':d===60?'2bln':d===90?'3bln':d+'h'):d+'h';
  }).join(' · ') : 'Tidak ada interval aktif';
}

function toggleInterval(days, checked){
  const active = getActiveIntervals();
  const updated = checked ? [...new Set([...active,days])] : active.filter(d=>d!==days);
  saveActiveIntervals(updated.sort((a,b)=>b-a));
  renderIntervalChecks();
  renderThresholds();
  toast(checked?`Interval ${days} hari diaktifkan`:`Interval ${days} hari dinonaktifkan`, checked?'g':'a');
}

function addCustomInterval(){
  const val = parseInt(document.getElementById('customDaysInput').value);
  const unit = parseInt(document.getElementById('customDaysUnit').value);
  if(!val||val<1){toast('Masukkan angka yang valid','r');return;}
  const totalDays = val * unit;
  if(totalDays > 730){toast('Maksimal 730 hari (2 tahun)','r');return;}
  const custom = JSON.parse(localStorage.getItem('pge_custom_intervals')||'[]');
  if(custom.includes(totalDays)||ALL_INTERVALS.find(i=>i.days===totalDays)){
    toast('Interval '+totalDays+' hari sudah ada','a');return;
  }
  custom.push(totalDays);
  localStorage.setItem('pge_custom_intervals',JSON.stringify(custom));
  // Also activate it
  const active = getActiveIntervals();
  saveActiveIntervals([...new Set([...active,totalDays])]);
  document.getElementById('customDaysInput').value='';
  renderIntervalChecks();renderThresholds();
  const unitLabel=unit===1?'hari':unit===7?'minggu':'bulan';
  toast(`Interval ${val} ${unitLabel} (${totalDays} hari) ditambahkan & diaktifkan`,'g');
}

function removeCustomInterval(days){
  if(!confirm(`Hapus interval kustom ${days} hari?`))return;
  const custom = JSON.parse(localStorage.getItem('pge_custom_intervals')||'[]').filter(d=>d!==days);
  localStorage.setItem('pge_custom_intervals',JSON.stringify(custom));
  const active = getActiveIntervals().filter(d=>d!==days);
  saveActiveIntervals(active);
  renderIntervalChecks();renderThresholds();
  toast('Interval dihapus','r');
}

function applyPreset(type){
  const presets={
    short:[10,7,5,3],
    medium:[30,10,5,3],
    full:[90,60,30,10,7,5,3]
  };
  saveActiveIntervals(presets[type]||[10,7,5,3]);
  renderIntervalChecks();renderThresholds();
  toast('Preset diterapkan: '+type,'g');
}

function clearAutoLog(){
  if(!confirm('Hapus semua log notifikasi?'))return;
  localStorage.removeItem('pge_autoLog');
  renderAutoLog();
  toast('Log dihapus','r');
}

function previewTpl(){
  const tplKey = document.getElementById('tplSelect').value;
  const tplText = document.getElementById('tplEditor').value;
  const preview = document.getElementById('tplPreviewBox');
  if(!tplText){preview.style.display='none';return;}
  // Use first available SPT/SBT or any finding as sample
  const data = getEffData();
  const sample = data.find(r=>r.sheet==='SPT')||data[0];
  const sampleUser = {name:'Nama PIC Contoh'};
  const tpls = getTpls();
  const key = tplKey;
  const orig = tpls[key];
  // Temporarily override
  const tempTpls = {...tpls, [key]: tplText};
  localStorage.setItem('pge_tpls', JSON.stringify(tempTpls));
  const rendered = fillTpl(tplText, sample, sampleUser);
  localStorage.setItem('pge_tpls', JSON.stringify(tpls)); // restore
  preview.textContent = rendered;
  preview.style.display = '';
}

// Override renderThresholds to use new interval system
function renderThresholds(){
  const el = document.getElementById('thresholdList'); if(!el) return;
  const data = getEffData();
  const sentLog = getSentLog();
  const active = getActiveIntervals();
  const allDefs = getAllIntervalDefs();
  
  // Build rows for active + overdue
  const rows = [...active.sort((a,b)=>b-a).map(n=>{
    const def = allDefs.find(d=>d.days===n)||{label:n+' hari',color:'var(--blue)'};
    const items = data.filter(r=>{const dl=dLeft(r.due_date);return dl===n&&getStatus(r)!=='selesai';});
    const sent = items.filter(r=>sentLog[r.id+'_'+TODAY+'_'+n]);
    return {label:def.label, count:items.length, sent:sent.length, color:def.color, active:true};
  }),{label:'Overdue (lewat batas)',count:data.filter(r=>getStatus(r)==='overdue').length,sent:0,color:'var(--red)',active:true}];
  
  el.innerHTML = rows.map(r=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border-radius:var(--rsm);border:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:${r.color};flex-shrink:0${r.count>0?';animation:pulse 1.6s infinite':''}"></span>
        <span style="font-size:12px;color:var(--text2)">${r.label}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <span style="font-size:11px;color:${r.count>0?r.color:'var(--text3)'};font-family:var(--mono)">${r.count} temuan</span>
        <span class="badge b-green">${r.sent} terkirim</span>
      </div>
    </div>`).join('');
}

// Override showPage to init interval UI on autonotif page
const _showPageOrig2 = window.showPage;
window.showPage = function(name){
  _showPageOrig2(name);
  if(name==='autonotif'){
    renderIntervalChecks();
    renderThresholds();
    renderAutoLog();
    loadTpl();
    updateAutoBtn();
    const lr=document.getElementById('autoLastRun');
    if(lr) lr.textContent=localStorage.getItem('pge_lastRun')||'–';
  }
};

// Handle auto-open update form from URL param (for WA reminder link)
(function checkUrlParam(){
  try{
    const params=new URLSearchParams(window.location.search);
    const upd=params.get('upd');
    if(upd&&getCurrent()){
      // Will be called after startApp
      window._autoOpenUpdate=upd;
    }
  }catch(e){}
})();
