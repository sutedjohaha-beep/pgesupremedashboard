"""
PGE UBL Audit Monitor - Web Application
Flask backend with SQLite database
"""
import os, json, sqlite3, hashlib, secrets, uuid
from datetime import datetime, timedelta
from functools import wraps
from flask import (Flask, request, jsonify, session, send_from_directory,
                   redirect, url_for, render_template_string)

# ─────────────────────────── CONFIG ───────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'data', 'audit.db')
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(BASE_DIR, 'static', 'uploads')
MAX_UPLOAD = 5 * 1024 * 1024  # 5 MB

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=12)

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─────────────────────────── DATABASE ─────────────────────────
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'pic',
        dept TEXT NOT NULL DEFAULT '',
        wa TEXT DEFAULT '',
        email TEXT DEFAULT '',
        color TEXT DEFAULT '#4d8ef7',
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        finding_id TEXT NOT NULL,
        pct INTEGER NOT NULL DEFAULT 0,
        note TEXT DEFAULT '',
        deliverables TEXT DEFAULT '',
        updated_by TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tl_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        finding_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT DEFAULT '',
        uploaded_by TEXT NOT NULL,
        uploaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notif_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        finding_id TEXT NOT NULL,
        recipient_wa TEXT NOT NULL,
        recipient_name TEXT DEFAULT '',
        interval_days TEXT DEFAULT '',
        status TEXT DEFAULT 'sent',
        sent_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sent_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        finding_id TEXT NOT NULL,
        log_key TEXT UNIQUE NOT NULL,
        sent_at TEXT DEFAULT (datetime('now'))
    );
    """)

    # Default admin user
    existing = db.execute("SELECT id FROM users WHERE username='admin'").fetchone()
    if not existing:
        ph = hashlib.sha256('Admin2025!'.encode()).hexdigest()
        db.execute("INSERT INTO users (username,password_hash,name,role,dept,color) VALUES (?,?,?,?,?,?)",
                   ('admin', ph, 'Admin Audit', 'admin', 'Admin', '#4d8ef7'))

    # Default settings
    defaults = {
        'active_intervals': json.dumps([10,7,5,3]),
        'custom_intervals': json.dumps([]),
        'auto_notif': '1',
        'wa_phone_id': '',
        'wa_token': '',
        'wa_mode': 'link',
        'wa_auto_send': '0',
        'admin_code': 'PGEADMIN2025',
    }
    for k, v in defaults.items():
        db.execute("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)", (k, v))

    db.commit()
    db.close()

def get_setting(key, default=''):
    db = get_db()
    row = db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    db.close()
    return row['value'] if row else default

def set_setting(key, value):
    db = get_db()
    db.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", (key, str(value)))
    db.commit()
    db.close()

# ─────────────────────────── AUTH ─────────────────────────────
def hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin only'}), 403
        return f(*args, **kwargs)
    return decorated

# ─────────────────────────── STATIC DATA ──────────────────────
def load_audit_data():
    with open(os.path.join(DATA_DIR, 'audit_data.json'), encoding='utf-8') as f:
        return json.load(f)

def load_img_data():
    with open(os.path.join(DATA_DIR, 'img_data.json'), encoding='utf-8') as f:
        return json.load(f)

# ─────────────────────────── ROUTES ───────────────────────────

# Serve main SPA
@app.route('/')
@app.route('/index.html')
def index():
    with open(os.path.join(BASE_DIR, 'templates', 'index.html'), encoding='utf-8') as f:
        return f.read()

# Static files
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

# ── AUTH ROUTES ──
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username','').strip()
    password = data.get('password','')
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username=? AND password_hash=?",
                      (username, hash_pw(password))).fetchone()
    db.close()
    if not user:
        return jsonify({'error': 'Username atau password salah'}), 401
    session.permanent = True
    session['user_id'] = user['id']
    session['username'] = user['username']
    session['role'] = user['role']
    session['name'] = user['name']
    session['dept'] = user['dept']
    return jsonify({
        'id': user['id'], 'username': user['username'],
        'name': user['name'], 'role': user['role'],
        'dept': user['dept'], 'wa': user['wa'],
        'email': user['email'], 'color': user['color']
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})

@app.route('/api/auth/me')
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id=?", (session['user_id'],)).fetchone()
    db.close()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'id': user['id'], 'username': user['username'],
        'name': user['name'], 'role': user['role'],
        'dept': user['dept'], 'wa': user['wa'],
        'email': user['email'], 'color': user['color']
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    code = data.get('code','')
    admin_code = get_setting('admin_code', 'PGEADMIN2025')
    if code != admin_code:
        return jsonify({'error': 'Kode admin tidak valid'}), 403
    username = data.get('username','').strip().lower()
    if not username or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Field wajib belum lengkap'}), 400
    db = get_db()
    try:
        colors = ['#4d8ef7','#2ecc8e','#f0a030','#9b7af5','#26c6da','#e85252']
        cnt = db.execute("SELECT COUNT(*) as c FROM users").fetchone()['c']
        db.execute("INSERT INTO users (username,password_hash,name,role,dept,wa,email,color) VALUES (?,?,?,?,?,?,?,?)",
                   (username, hash_pw(data['password']), data['name'],
                    data.get('role','pic'), data.get('dept',''), data.get('wa',''),
                    data.get('email',''), colors[cnt % len(colors)]))
        db.commit()
        return jsonify({'ok': True})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username sudah digunakan'}), 409
    finally:
        db.close()

# ── USER MANAGEMENT ──
@app.route('/api/users')
@login_required
def get_users():
    db = get_db()
    users = db.execute("SELECT id,username,name,role,dept,wa,email,color,created_at FROM users ORDER BY id").fetchall()
    db.close()
    return jsonify([dict(u) for u in users])

@app.route('/api/users/<int:uid>', methods=['PUT'])
@login_required
def update_user(uid):
    # Only admin or self can update
    if session['role'] != 'admin' and session['user_id'] != uid:
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json()
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404
    name = data.get('name', user['name'])
    wa = data.get('wa', user['wa'])
    email = data.get('email', user['email'])
    dept = data.get('dept', user['dept'])
    role = data.get('role', user['role']) if session['role'] == 'admin' else user['role']
    pw_hash = user['password_hash']
    if data.get('password') and len(data['password']) >= 6:
        pw_hash = hash_pw(data['password'])
    db.execute("UPDATE users SET name=?,wa=?,email=?,dept=?,role=?,password_hash=? WHERE id=?",
               (name, wa, email, dept, role, pw_hash, uid))
    db.commit()
    db.close()
    return jsonify({'ok': True})

@app.route('/api/users/<int:uid>', methods=['DELETE'])
@admin_required
def delete_user(uid):
    db = get_db()
    user = db.execute("SELECT username FROM users WHERE id=?", (uid,)).fetchone()
    if user and user['username'] == 'admin':
        return jsonify({'error': 'Cannot delete admin'}), 400
    db.execute("DELETE FROM users WHERE id=?", (uid,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── AUDIT DATA ──
@app.route('/api/findings')
@login_required
def get_findings():
    audit_data = load_audit_data()
    db = get_db()
    # Get latest update for each finding
    updates = db.execute("""
        SELECT u1.finding_id, u1.pct, u1.note, u1.deliverables, u1.updated_by, u1.updated_at
        FROM updates u1
        INNER JOIN (SELECT finding_id, MAX(id) as max_id FROM updates GROUP BY finding_id) u2
        ON u1.finding_id=u2.finding_id AND u1.id=u2.max_id
    """).fetchall()
    db.close()
    upd_map = {u['finding_id']: dict(u) for u in updates}
    # Merge
    result = []
    for r in audit_data:
        item = dict(r)
        if r['id'] in upd_map:
            u = upd_map[r['id']]
            item['pct_realisasi'] = u['pct']
            item['catatan_update'] = u['note']
            item['deliverables'] = u['deliverables'] or r.get('deliverables','')
            item['updated_by'] = u['updated_by']
            item['updated_at'] = u['updated_at']
        result.append(item)
    return jsonify(result)

@app.route('/api/findings/<fid>/update', methods=['POST'])
@login_required
def update_finding(fid):
    data = request.get_json()
    db = get_db()
    db.execute("INSERT INTO updates (finding_id,pct,note,deliverables,updated_by) VALUES (?,?,?,?,?)",
               (fid, data.get('pct',0), data.get('note',''),
                data.get('deliverables',''), session['name']))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── IMAGES ──
@app.route('/api/findings/<fid>/images')
@login_required
def get_images(fid):
    # Return static images from JSON
    img_data = load_img_data()
    # Find sheet and no from finding id
    audit_data = load_audit_data()
    finding = next((r for r in audit_data if r['id'] == fid), None)
    static_imgs = {'temuan': [], 'tl': []}
    if finding and finding['sheet'] in ('SPT','SBT'):
        sheet = finding['sheet']
        no = str(finding['no'])
        entry = img_data.get(sheet, {}).get(no, {})
        static_imgs['temuan'] = entry.get('temuan', [])
        static_imgs['tl'] = entry.get('tl', [])
    # User uploaded TL images
    db = get_db()
    uploaded = db.execute("SELECT filename,original_name,uploaded_by,uploaded_at FROM tl_images WHERE finding_id=? ORDER BY id",
                          (fid,)).fetchall()
    db.close()
    user_tl = [{'url': f'/static/uploads/{u["filename"]}',
                'name': u['original_name'], 'by': u['uploaded_by'],
                'at': u['uploaded_at']} for u in uploaded]
    return jsonify({'static': static_imgs, 'uploaded': user_tl})

@app.route('/api/findings/<fid>/images/upload', methods=['POST'])
@login_required
def upload_image(fid):
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No filename'}), 400
    # Validate type
    allowed = {'image/jpeg','image/jpg','image/png','image/gif','image/webp'}
    if file.mimetype not in allowed:
        return jsonify({'error': 'Hanya file gambar yang diizinkan'}), 400
    # Check size
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_UPLOAD:
        return jsonify({'error': 'File terlalu besar (maks 5MB)'}), 400
    # Save
    ext = os.path.splitext(file.filename)[1].lower() or '.jpg'
    filename = f"{fid}_{uuid.uuid4().hex[:8]}{ext}"
    file.save(os.path.join(UPLOAD_DIR, filename))
    db = get_db()
    db.execute("INSERT INTO tl_images (finding_id,filename,original_name,uploaded_by) VALUES (?,?,?,?)",
               (fid, filename, file.filename, session['name']))
    db.commit()
    db.close()
    return jsonify({'ok': True, 'url': f'/static/uploads/{filename}', 'filename': filename})

@app.route('/api/findings/<fid>/images/<filename>', methods=['DELETE'])
@login_required
def delete_image(fid, filename):
    db = get_db()
    row = db.execute("SELECT id FROM tl_images WHERE finding_id=? AND filename=?", (fid, filename)).fetchone()
    if not row:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    db.execute("DELETE FROM tl_images WHERE id=?", (row['id'],))
    db.commit()
    db.close()
    try:
        os.remove(os.path.join(UPLOAD_DIR, filename))
    except:
        pass
    return jsonify({'ok': True})

# ── SETTINGS ──
@app.route('/api/settings', methods=['GET'])
@login_required
def get_settings():
    db = get_db()
    rows = db.execute("SELECT key,value FROM settings").fetchall()
    db.close()
    s = {r['key']: r['value'] for r in rows}
    # Don't expose token in plain
    if 'wa_token' in s:
        s['wa_token_set'] = bool(s.get('wa_token'))
        del s['wa_token']
    return jsonify(s)

@app.route('/api/settings', methods=['PUT'])
@admin_required
def save_settings():
    data = request.get_json()
    db = get_db()
    allowed = ['active_intervals','custom_intervals','auto_notif','wa_phone_id',
               'wa_token','wa_mode','wa_auto_send','admin_code']
    for k in allowed:
        if k in data:
            v = data[k]
            if isinstance(v, (list, dict)):
                v = json.dumps(v)
            db.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", (k, str(v)))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── NOTIFICATION LOG ──
@app.route('/api/notif/log', methods=['GET'])
@login_required
def get_notif_log():
    db = get_db()
    rows = db.execute("SELECT * FROM notif_log ORDER BY id DESC LIMIT 200").fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/notif/log', methods=['POST'])
@login_required
def add_notif_log():
    data = request.get_json()
    db = get_db()
    db.execute("INSERT INTO notif_log (finding_id,recipient_wa,recipient_name,interval_days,status) VALUES (?,?,?,?,?)",
               (data.get('finding_id',''), data.get('wa',''), data.get('name',''),
                str(data.get('interval','')), data.get('status','sent')))
    db.commit()
    db.close()
    return jsonify({'ok': True})

@app.route('/api/notif/sent', methods=['GET'])
@login_required
def get_sent_log():
    db = get_db()
    rows = db.execute("SELECT log_key FROM sent_log WHERE sent_at >= date('now','-1 day')").fetchall()
    db.close()
    return jsonify([r['log_key'] for r in rows])

@app.route('/api/notif/sent', methods=['POST'])
@login_required
def mark_sent():
    data = request.get_json()
    keys = data.get('keys', [])
    db = get_db()
    for k in keys:
        db.execute("INSERT OR IGNORE INTO sent_log (log_key) VALUES (?)", (k,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

@app.route('/api/notif/log', methods=['DELETE'])
@admin_required
def clear_notif_log():
    db = get_db()
    db.execute("DELETE FROM notif_log")
    db.execute("DELETE FROM sent_log")
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── UPDATES HISTORY ──
@app.route('/api/findings/<fid>/history')
@login_required
def get_history(fid):
    db = get_db()
    rows = db.execute("SELECT * FROM updates WHERE finding_id=? ORDER BY id DESC", (fid,)).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

# ── IMAGE DATA (static) ──
@app.route('/api/imgdata/<sheet>/<no>')
@login_required
def get_img_data(sheet, no):
    img_data = load_img_data()
    entry = img_data.get(sheet, {}).get(no, {'temuan':[], 'tl':[]})
    return jsonify(entry)

# ── HEALTH CHECK ──
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.now().isoformat()})

# ─────────────────────────── MAIN ─────────────────────────────
if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    print(f"🚀 PGE Audit Monitor berjalan di http://localhost:{port}")
    print(f"   Login: admin / Admin2025!")
    app.run(host='0.0.0.0', port=port, debug=debug)
