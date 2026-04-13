"""PGE UBL Audit Monitor v2"""
import os, json, sqlite3, hashlib, secrets, uuid
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, session, send_from_directory

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DB_PATH    = os.path.join(BASE_DIR, 'data', 'audit.db')
DATA_DIR   = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(BASE_DIR, 'static', 'uploads')

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=12)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── DB ───────────────────────────────────────────────────────
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db

def hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()

def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'pic',
            dept TEXT NOT NULL DEFAULT '', wa TEXT DEFAULT '', email TEXT DEFAULT '',
            color TEXT DEFAULT '#4d8ef7', created_at TEXT DEFAULT(datetime('now')));
        CREATE TABLE IF NOT EXISTS updates(
            id INTEGER PRIMARY KEY AUTOINCREMENT, finding_id TEXT NOT NULL,
            pct INTEGER NOT NULL DEFAULT 0, note TEXT DEFAULT '', deliverables TEXT DEFAULT '',
            updated_by TEXT NOT NULL, updated_at TEXT DEFAULT(datetime('now')),
            status TEXT DEFAULT 'pending');
        CREATE TABLE IF NOT EXISTS evidence_files(
            id INTEGER PRIMARY KEY AUTOINCREMENT, finding_id TEXT NOT NULL,
            update_id INTEGER, filename TEXT NOT NULL, original_name TEXT DEFAULT '',
            file_size INTEGER DEFAULT 0, mime_type TEXT DEFAULT '',
            uploaded_by TEXT NOT NULL, uploaded_at TEXT DEFAULT(datetime('now')));
        CREATE TABLE IF NOT EXISTS validations(
            id INTEGER PRIMARY KEY AUTOINCREMENT, finding_id TEXT NOT NULL,
            update_id INTEGER, action TEXT NOT NULL, note TEXT DEFAULT '',
            validated_by TEXT NOT NULL, validated_at TEXT DEFAULT(datetime('now')));
        CREATE TABLE IF NOT EXISTS notifications(
            id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT NOT NULL,
            type TEXT NOT NULL, finding_id TEXT NOT NULL, message TEXT DEFAULT '',
            is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT(datetime('now')));
        CREATE TABLE IF NOT EXISTS notif_log(
            id INTEGER PRIMARY KEY AUTOINCREMENT, finding_id TEXT NOT NULL,
            recipient_wa TEXT NOT NULL, recipient_name TEXT DEFAULT '',
            interval_days TEXT DEFAULT '', status TEXT DEFAULT 'sent',
            sent_at TEXT DEFAULT(datetime('now')));
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sent_log(
            id INTEGER PRIMARY KEY AUTOINCREMENT, log_key TEXT UNIQUE NOT NULL,
            sent_at TEXT DEFAULT(datetime('now')));
    """)
    for sql in [
        "ALTER TABLE updates ADD COLUMN status TEXT DEFAULT 'pending'",
        "ALTER TABLE evidence_files ADD COLUMN update_id INTEGER",
    ]:
        try: db.execute(sql)
        except: pass
    if not db.execute("SELECT id FROM users WHERE username='admin'").fetchone():
        db.execute(
            "INSERT INTO users(username,password_hash,name,role,dept,color) VALUES(?,?,?,?,?,?)",
            ('admin', hash_pw('Admin2025!'), 'Admin Audit', 'admin', 'Admin', '#4d8ef7'))
    defaults = {
        'active_intervals': json.dumps([10,7,5,3]), 'custom_intervals': json.dumps([]),
        'auto_notif': '1', 'wa_phone_id': '', 'wa_token': '', 'wa_mode': 'link',
        'wa_auto_send': '0', 'admin_code': 'PGEADMIN2025',
    }
    for k, v in defaults.items():
        db.execute("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", (k, v))
    db.commit(); db.close()

_ready = False

@app.before_request
def ensure_db():
    global _ready
    if not _ready:
        init_db(); _ready = True

try: init_db(); _ready = True
except Exception as e: print(f"DB init: {e}")

def get_setting(k, d=''):
    db = get_db(); r = db.execute("SELECT value FROM settings WHERE key=?", (k,)).fetchone(); db.close()
    return r['value'] if r else d

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session: return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session: return jsonify({'error': 'Unauthorized'}), 401
        if session.get('role') != 'admin': return jsonify({'error': 'Admin only'}), 403
        return f(*args, **kwargs)
    return decorated

def load_audit():
    with open(os.path.join(DATA_DIR, 'audit_data.json'), encoding='utf-8') as f: return json.load(f)

def load_imgs():
    with open(os.path.join(DATA_DIR, 'img_data.json'), encoding='utf-8') as f: return json.load(f)

def add_notif(recipient, ntype, fid, msg):
    db = get_db()
    db.execute("INSERT INTO notifications(recipient,type,finding_id,message) VALUES(?,?,?,?)",
               (recipient, ntype, fid, msg))
    db.commit(); db.close()

def notify_admins(ntype, fid, msg):
    db = get_db()
    for a in db.execute("SELECT username FROM users WHERE role='admin'").fetchall():
        db.execute("INSERT INTO notifications(recipient,type,finding_id,message) VALUES(?,?,?,?)",
                   (a['username'], ntype, fid, msg))
    db.commit(); db.close()

def find_pic_user(pic_dept):
    if not pic_dept: return None
    db = get_db(); users = db.execute("SELECT * FROM users WHERE role='pic'").fetchall(); db.close()
    p = pic_dept.upper()
    for u in users:
        if u['dept'] and (u['dept'].upper() == p or p in u['dept'].upper() or u['dept'].upper() in p):
            return dict(u)
    return None

# ── ROUTES ───────────────────────────────────────────────────

@app.route('/')
@app.route('/index.html')
def index():
    with open(os.path.join(BASE_DIR, 'templates', 'index.html'), encoding='utf-8') as f: return f.read()

@app.route('/static/<path:fn>')
def statics(fn): return send_from_directory('static', fn)

@app.route('/api/auth/login', methods=['POST'])
def login():
    d = request.get_json(); db = get_db()
    u = db.execute("SELECT * FROM users WHERE username=? AND password_hash=?",
                   (d.get('username','').strip(), hash_pw(d.get('password','')))).fetchone()
    db.close()
    if not u: return jsonify({'error': 'Username atau password salah'}), 401
    session.permanent = True
    session['user_id'] = u['id']; session['username'] = u['username']
    session['role'] = u['role']; session['name'] = u['name']; session['dept'] = u['dept']
    return jsonify(dict(u))

@app.route('/api/auth/logout', methods=['POST'])
def logout(): session.clear(); return jsonify({'ok': True})

@app.route('/api/auth/me')
def me():
    if 'user_id' not in session: return jsonify({'error': 'Not logged in'}), 401
    db = get_db(); u = db.execute("SELECT * FROM users WHERE id=?", (session['user_id'],)).fetchone(); db.close()
    return jsonify(dict(u)) if u else (jsonify({'error': 'Not found'}), 404)

@app.route('/api/auth/register', methods=['POST'])
def register():
    d = request.get_json()
    if d.get('code') != get_setting('admin_code', 'PGEADMIN2025'):
        return jsonify({'error': 'Kode admin tidak valid'}), 403
    uname = d.get('username','').strip().lower()
    if not uname or not d.get('password') or not d.get('name'):
        return jsonify({'error': 'Field wajib belum lengkap'}), 400
    db = get_db()
    try:
        colors = ['#4d8ef7','#2ecc8e','#f0a030','#9b7af5','#26c6da','#e85252']
        cnt = db.execute("SELECT COUNT(*) as c FROM users").fetchone()['c']
        db.execute(
            "INSERT INTO users(username,password_hash,name,role,dept,wa,email,color) VALUES(?,?,?,?,?,?,?,?)",
            (uname, hash_pw(d['password']), d['name'], d.get('role','pic'),
             d.get('dept',''), d.get('wa',''), d.get('email',''),
             d.get('color', colors[cnt % len(colors)])))
        db.commit(); return jsonify({'ok': True})
    except sqlite3.IntegrityError: return jsonify({'error': 'Username sudah digunakan'}), 409
    finally: db.close()

@app.route('/api/users')
@login_required
def get_users():
    db = get_db()
    users = db.execute("SELECT id,username,name,role,dept,wa,email,color,created_at FROM users ORDER BY id").fetchall()
    db.close(); return jsonify([dict(u) for u in users])

@app.route('/api/users/<int:uid>', methods=['PUT'])
@login_required
def update_user(uid):
    if session['role'] != 'admin' and session['user_id'] != uid:
        return jsonify({'error': 'Forbidden'}), 403
    d = request.get_json(); db = get_db()
    u = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not u: db.close(); return jsonify({'error': 'Not found'}), 404
    ph = hash_pw(d['password']) if d.get('password') and len(d['password']) >= 6 else u['password_hash']
    role = d.get('role', u['role']) if session['role'] == 'admin' else u['role']
    db.execute("UPDATE users SET name=?,wa=?,email=?,dept=?,role=?,password_hash=? WHERE id=?",
               (d.get('name',u['name']), d.get('wa',u['wa']), d.get('email',u['email']),
                d.get('dept',u['dept']), role, ph, uid))
    db.commit(); db.close(); return jsonify({'ok': True})

@app.route('/api/users/<int:uid>', methods=['DELETE'])
@admin_required
def delete_user(uid):
    db = get_db(); u = db.execute("SELECT username FROM users WHERE id=?", (uid,)).fetchone()
    if u and u['username'] == 'admin': return jsonify({'error': 'Cannot delete admin'}), 400
    db.execute("DELETE FROM users WHERE id=?", (uid,)); db.commit(); db.close()
    return jsonify({'ok': True})

@app.route('/api/findings')
@login_required
def get_findings():
    data = load_audit(); db = get_db()
    upd_rows = db.execute("""SELECT u1.* FROM updates u1
        INNER JOIN(SELECT finding_id,MAX(id) as mid FROM updates GROUP BY finding_id) u2
        ON u1.finding_id=u2.finding_id AND u1.id=u2.mid""").fetchall()
    upd_map = {u['finding_id']: dict(u) for u in upd_rows}
    val_rows = db.execute("""SELECT v1.* FROM validations v1
        INNER JOIN(SELECT finding_id,MAX(id) as mid FROM validations GROUP BY finding_id) v2
        ON v1.finding_id=v2.finding_id AND v1.id=v2.mid""").fetchall()
    val_map = {v['finding_id']: dict(v) for v in val_rows}
    ev_rows = db.execute("SELECT finding_id,COUNT(*) as cnt FROM evidence_files GROUP BY finding_id").fetchall()
    ev_map = {e['finding_id']: e['cnt'] for e in ev_rows}
    db.close()
    result = []
    for r in data:
        item = dict(r)
        if r['id'] in upd_map:
            u = upd_map[r['id']]
            item.update({'pct_realisasi':u['pct'], 'catatan_update':u['note'],
                         'deliverables':u['deliverables'] or r.get('deliverables',''),
                         'updated_by':u['updated_by'], 'updated_at':u['updated_at'],
                         'update_status':u['status'], 'latest_update_id':u['id']})
        else:
            item.update({'update_status':'none', 'latest_update_id':None})
        if r['id'] in val_map:
            v = val_map[r['id']]
            item.update({'validation_action':v['action'], 'validated_by':v['validated_by'],
                         'validated_at':v['validated_at'], 'validation_note':v['note']})
        else:
            item['validation_action'] = None
        item['evidence_count'] = ev_map.get(r['id'], 0)
        result.append(item)
    return jsonify(result)

@app.route('/api/findings/<fid>/update', methods=['POST'])
@login_required
def update_finding(fid):
    d = request.get_json(); db = get_db()
    res = db.execute(
        "INSERT INTO updates(finding_id,pct,note,deliverables,updated_by,status) VALUES(?,?,?,?,?,'pending')",
        (fid, d.get('pct',0), d.get('note',''), d.get('deliverables',''), session['name']))
    uid = res.lastrowid; db.commit(); db.close()
    data = load_audit(); finding = next((r for r in data if r['id'] == fid), None)
    fname = ((finding.get('uraian_rekomendasi') or finding.get('rekomendasi',''))[:60]) if finding else fid
    notify_admins('update', fid, f"\U0001f4cb {session['name']} update {fid}: {d.get('pct',0)}% — {fname}")
    return jsonify({'ok': True, 'update_id': uid})

@app.route('/api/findings/<fid>/history')
@login_required
def get_history(fid):
    db = get_db()
    upds = db.execute("SELECT * FROM updates WHERE finding_id=? ORDER BY id DESC", (fid,)).fetchall()
    vals = db.execute("SELECT * FROM validations WHERE finding_id=? ORDER BY id DESC", (fid,)).fetchall()
    evs  = db.execute("SELECT * FROM evidence_files WHERE finding_id=? ORDER BY id DESC", (fid,)).fetchall()
    db.close()
    return jsonify({
        'updates':     [dict(u) for u in upds],
        'validations': [dict(v) for v in vals],
        'evidence':    [{**dict(e), 'url': f'/static/uploads/{e["filename"]}'} for e in evs],
    })

@app.route('/api/findings/<fid>/evidence')
@login_required
def get_evidence(fid):
    db = get_db()
    files = db.execute("SELECT * FROM evidence_files WHERE finding_id=? ORDER BY id DESC", (fid,)).fetchall()
    db.close()
    return jsonify([{**dict(f), 'url': f'/static/uploads/{f["filename"]}'} for f in files])

@app.route('/api/findings/<fid>/evidence/upload', methods=['POST'])
@login_required
def upload_evidence(fid):
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']; update_id = request.form.get('update_id')
    if not file.filename: return jsonify({'error': 'No filename'}), 400
    blocked = {'.exe','.bat','.sh','.cmd','.ps1','.vbs','.jar'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext in blocked: return jsonify({'error': 'Tipe file tidak diizinkan'}), 400
    file.seek(0, 2); sz = file.tell(); file.seek(0)
    fname = f"{fid}_{uuid.uuid4().hex[:8]}{ext}"
    file.save(os.path.join(UPLOAD_DIR, fname))
    db = get_db()
    db.execute(
        "INSERT INTO evidence_files(finding_id,update_id,filename,original_name,file_size,mime_type,uploaded_by) VALUES(?,?,?,?,?,?,?)",
        (fid, update_id, fname, file.filename, sz, file.mimetype, session['name']))
    db.commit(); db.close()
    return jsonify({'ok':True, 'url':f'/static/uploads/{fname}', 'filename':fname,
                    'original_name':file.filename, 'file_size':sz, 'mime_type':file.mimetype})

@app.route('/api/findings/<fid>/evidence/<fname>', methods=['DELETE'])
@login_required
def delete_evidence(fid, fname):
    db = get_db()
    row = db.execute("SELECT id,uploaded_by FROM evidence_files WHERE finding_id=? AND filename=?",
                     (fid, fname)).fetchone()
    if not row: db.close(); return jsonify({'error': 'Not found'}), 404
    if row['uploaded_by'] != session['name'] and session['role'] != 'admin':
        db.close(); return jsonify({'error': 'Forbidden'}), 403
    db.execute("DELETE FROM evidence_files WHERE id=?", (row['id'],)); db.commit(); db.close()
    try: os.remove(os.path.join(UPLOAD_DIR, fname))
    except: pass
    return jsonify({'ok': True})

@app.route('/api/findings/<fid>/validate', methods=['POST'])
@admin_required
def validate_finding(fid):
    d = request.get_json(); action = d.get('action'); note = d.get('note',''); update_id = d.get('update_id')
    if action not in ('validate', 'clarify'): return jsonify({'error': 'Invalid action'}), 400
    db = get_db()
    db.execute("INSERT INTO validations(finding_id,update_id,action,note,validated_by) VALUES(?,?,?,?,?)",
               (fid, update_id, action, note, session['name']))
    if update_id:
        status = 'validated' if action == 'validate' else 'clarify'
        db.execute("UPDATE updates SET status=? WHERE id=?", (status, update_id))
    db.commit()
    data = load_audit(); finding = next((r for r in data if r['id'] == fid), None)
    pic_dept = finding.get('pic','') if finding else ''
    fname = ((finding.get('uraian_rekomendasi') or finding.get('rekomendasi',''))[:60]) if finding else fid
    pic_users = db.execute("SELECT * FROM users WHERE role='pic'").fetchall(); db.close()
    pic_user = None; p = pic_dept.upper()
    for u in pic_users:
        if u['dept'] and (u['dept'].upper() == p or p in u['dept'].upper() or u['dept'].upper() in p):
            pic_user = dict(u); break
    wa_msg = None
    if action == 'validate':
        msg = f"Temuan {fid} DIVALIDASI oleh {session['name']}. Tindak lanjut dinyatakan SELESAI."
        if pic_user: add_notif(pic_user['username'], 'validated', fid, msg)
    else:
        msg_lines = [
            f"Temuan {fid} perlu KLARIFIKASI dari Admin.",
            f"Catatan: {note}" if note else "",
            f"Deliverables: {(finding.get('deliverables') or '-')[:100] if finding else '-'}"
        ]
        msg = " | ".join(l for l in msg_lines if l)
        if pic_user: add_notif(pic_user['username'], 'clarify', fid, msg)
        if pic_user and pic_user.get('wa'):
            pname = pic_user['name']
            rencana = finding.get('rencana_tindak_lanjut') or finding.get('rencana') or '-' if finding else '-'
            deliv = finding.get('deliverables') or '-' if finding else '-'
            sheet = finding.get('sheet','') if finding else ''
            # Foto info for SPT/SBT
            foto_line = ''
            if sheet in ('SPT','SBT'):
                foto_line = f"\n📸 *Foto Temuan:* tersedia di dashboard"
            wa_lines = [
                f"Halo {pname},", "",
                "*KLARIFIKASI DIPERLUKAN - Audit SUPREME 2025*", "",
                f"🔖 *ID Temuan:* {fid}",
                f"📍 *Sheet/Kategori:* {sheet}",
                f"📌 *Uraian Temuan:*", f"{fname}", "",
                f"📝 *Rencana Tindak Lanjut:*", f"{rencana}", "",
                f"🎯 *Deliverables (yang harus diselesaikan):*", f"{deliv}", "",
                f"📝 *Catatan dari Admin:*", f"{note or 'Mohon melengkapi evidence.'}", "",
                f"Mohon segera perbarui progres tindak lanjut.",
                "_Tim Internal Audit PGE UBL_"
            ]
            wa_msg = {'to': pic_user['wa'], 'name': pname,
                      'text': "\n".join(wa_lines) + foto_line}
    return jsonify({'ok': True, 'action': action, 'wa_message': wa_msg, 'pic': pic_user})

@app.route('/api/notifications')
@login_required
def get_notifications():
    db = get_db()
    notifs = db.execute(
        "SELECT * FROM notifications WHERE recipient=? ORDER BY id DESC LIMIT 50",
        (session['username'],)).fetchall()
    unread = db.execute(
        "SELECT COUNT(*) as c FROM notifications WHERE recipient=? AND is_read=0",
        (session['username'],)).fetchone()['c']
    db.close()
    return jsonify({'notifications': [dict(n) for n in notifs], 'unread': unread})

@app.route('/api/notifications/read', methods=['POST'])
@login_required
def mark_read():
    d = request.get_json() or {}; db = get_db()
    if d.get('id'): db.execute("UPDATE notifications SET is_read=1 WHERE id=? AND recipient=?", (d['id'], session['username']))
    else: db.execute("UPDATE notifications SET is_read=1 WHERE recipient=?", (session['username'],))
    db.commit(); db.close(); return jsonify({'ok': True})

@app.route('/api/findings/<fid>/images')
@login_required
def get_images(fid):
    imgs = load_imgs(); data = load_audit()
    finding = next((r for r in data if r['id'] == fid), None)
    static = {'temuan':[], 'tl':[]}
    if finding and finding['sheet'] in ('SPT','SBT'):
        e = imgs.get(finding['sheet'],{}).get(str(finding['no']),{})
        static = {'temuan': e.get('temuan',[]), 'tl': e.get('tl',[])}
    return jsonify({'static': static})

@app.route('/api/settings')
@login_required
def get_settings():
    db = get_db(); rows = db.execute("SELECT key,value FROM settings").fetchall(); db.close()
    s = {r['key']: r['value'] for r in rows}; s.pop('wa_token', None); return jsonify(s)

@app.route('/api/settings', methods=['PUT'])
@admin_required
def save_settings():
    d = request.get_json()
    allowed = ['active_intervals','custom_intervals','auto_notif','wa_phone_id',
               'wa_token','wa_mode','wa_auto_send','admin_code']
    db = get_db()
    for k in allowed:
        if k in d:
            v = json.dumps(d[k]) if isinstance(d[k],(list,dict)) else str(d[k])
            db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", (k, v))
    db.commit(); db.close(); return jsonify({'ok': True})

@app.route('/api/notif/log')
@login_required
def get_notif_log():
    db = get_db(); rows = db.execute("SELECT * FROM notif_log ORDER BY id DESC LIMIT 200").fetchall(); db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/notif/log', methods=['POST'])
@login_required
def add_notif_log():
    d = request.get_json(); db = get_db()
    db.execute("INSERT INTO notif_log(finding_id,recipient_wa,recipient_name,interval_days,status) VALUES(?,?,?,?,?)",
               (d.get('finding_id',''), d.get('wa',''), d.get('name',''), str(d.get('interval','')), d.get('status','sent')))
    db.commit(); db.close(); return jsonify({'ok': True})

@app.route('/api/notif/log', methods=['DELETE'])
@admin_required
def clear_notif_log():
    db = get_db(); db.execute("DELETE FROM notif_log"); db.execute("DELETE FROM sent_log")
    db.commit(); db.close(); return jsonify({'ok': True})

@app.route('/api/notif/sent')
@login_required
def get_sent_log():
    db = get_db(); rows = db.execute("SELECT log_key FROM sent_log WHERE sent_at>=date('now','-1 day')").fetchall(); db.close()
    return jsonify([r['log_key'] for r in rows])

@app.route('/api/notif/sent', methods=['POST'])
@login_required
def mark_sent():
    keys = (request.get_json() or {}).get('keys', []); db = get_db()
    for k in keys: db.execute("INSERT OR IGNORE INTO sent_log(log_key) VALUES(?)", (k,))
    db.commit(); db.close(); return jsonify({'ok': True})

@app.route('/api/setup/reset-admin', methods=['POST'])
def reset_admin():
    sk = os.environ.get('SETUP_KEY','')
    if not sk: return jsonify({'error': 'SETUP_KEY not set'}), 403
    d = request.get_json()
    if d.get('key') != sk: return jsonify({'error': 'Invalid key'}), 403
    pw = d.get('password','Admin2025!'); db = get_db()
    if db.execute("SELECT COUNT(*) as c FROM users WHERE username='admin'").fetchone()['c']:
        db.execute("UPDATE users SET password_hash=? WHERE username='admin'", (hash_pw(pw),))
    else:
        db.execute("INSERT INTO users(username,password_hash,name,role,dept,color) VALUES(?,?,?,?,?,?)",
                   ('admin',hash_pw(pw),'Admin Audit','admin','Admin','#4d8ef7'))
    db.commit(); db.close(); return jsonify({'ok':True,'message':f'Password set: {pw}'})

@app.route('/api/setup/check')
def check_setup():
    db = get_db(); users = db.execute("SELECT username,role FROM users").fetchall(); db.close()
    return jsonify({'users':[dict(u) for u in users],'db':DB_PATH})

@app.route('/api/health')
def health(): return jsonify({'status':'ok','time':datetime.now().isoformat()})

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    print(f"PGE Audit Monitor v2 → http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=os.environ.get('DEBUG','false')=='true')
