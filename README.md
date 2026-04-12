# PGE UBL Audit Monitor – Panduan Deployment

Aplikasi web untuk monitoring tindak lanjut temuan Audit SUPREME 2025  
PT Pertamina Geothermal Energy Tbk. Area Ulubelu

---

## 🚀 Quick Start (Local)

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Jalankan server
python app.py

# 3. Buka browser
http://localhost:5000

# Login: admin / Admin2025!
```

---

## ☁️ Deploy ke Railway.app (GRATIS, Direkomendasikan)

### Langkah 1 – Buat akun GitHub & Railway
- Daftar di https://github.com (gratis)
- Daftar di https://railway.app (gratis, sambungkan dengan GitHub)

### Langkah 2 – Upload kode ke GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/pge-audit-app.git
git push -u origin main
```

### Langkah 3 – Deploy di Railway
1. Buka https://railway.app → New Project → Deploy from GitHub repo
2. Pilih repo `pge-audit-app`
3. Railway otomatis mendeteksi Python/Flask dan deploy
4. Di tab **Variables**, tambahkan:
   - `SECRET_KEY` = (string random panjang)
   - `PORT` = 5000
5. Klik **Deploy** → tunggu 2-3 menit
6. Klik **Generate Domain** → dapat URL publik seperti `pge-audit.up.railway.app`

✅ Aplikasi bisa diakses dari manapun!

---

## 🐍 Deploy ke PythonAnywhere (Gratis)

1. Daftar di https://www.pythonanywhere.com
2. Upload semua file via **Files** tab
3. Di **Bash console**:
   ```bash
   pip install flask gunicorn
   ```
4. Buat **Web app** → Manual configuration → Python 3.10
5. Set **Source code** ke folder upload
6. Set **WSGI file**:
   ```python
   import sys
   sys.path.insert(0, '/home/USERNAME/pge-audit-app')
   from app import app as application
   ```
7. Reload → `USERNAME.pythonanywhere.com`

---

## 🖥️ Deploy ke VPS/Server Internal

```bash
# Install dependencies
pip install -r requirements.txt

# Jalankan dengan Gunicorn (production)
gunicorn app:app --bind 0.0.0.0:5000 --workers 4 --daemon

# Atau dengan systemd service (direkomendasikan)
sudo nano /etc/systemd/system/pge-audit.service
```

**systemd service:**
```ini
[Unit]
Description=PGE Audit Monitor
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/pge-audit-app
Environment=SECRET_KEY=your_secret_key_here
ExecStart=/usr/bin/gunicorn app:app --bind 0.0.0.0:5000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable pge-audit
sudo systemctl start pge-audit
```

**Nginx reverse proxy (opsional, untuk domain/HTTPS):**
```nginx
server {
    listen 80;
    server_name audit.perusahaan.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /static/ {
        alias /opt/pge-audit-app/static/;
    }
}
```

---

## 👥 Manajemen Pengguna

### Login Admin Default
- **Username:** `admin`  
- **Password:** `Admin2025!`  
- ⚠️ Ganti password setelah login pertama!

### Mendaftarkan User Baru (2 cara)

**Cara 1 – Admin dashboard:**  
Login sebagai admin → Sidebar → Kelola Pengguna → Tambah User

**Cara 2 – Daftar mandiri:**  
User buka URL aplikasi → klik "Daftar Mandiri" → masukkan **Kode Admin: `PGEADMIN2025`**  
*(Kode bisa diganti di Settings)*

---

## 🔗 Link Update untuk WA Reminder

Saat sistem mengirim WA reminder, pesan berisi link seperti:  
`https://DOMAIN-ANDA.com/?upd=SPT-3#update`

Saat PIC klik link → login → form update otomatis terbuka untuk temuan tersebut.

---

## 📁 Struktur File

```
pge-audit-web/
├── app.py              # Flask backend (server utama)
├── requirements.txt    # Python dependencies
├── Procfile            # Untuk Railway/Render deployment
├── .env.example        # Template konfigurasi
├── data/
│   ├── audit_data.json # 86 temuan dari Excel
│   ├── img_data.json   # Foto temuan SPT/SBT
│   └── audit.db        # Database SQLite (auto-created)
├── static/
│   ├── css/style.css   # Styling
│   ├── js/
│   │   ├── core.js     # Logika frontend utama
│   │   └── api.js      # API client (koneksi ke backend)
│   └── uploads/        # Foto tindak lanjut yang diupload PIC
└── templates/
    └── index.html      # Halaman utama SPA
```

---

## 🔒 Keamanan

- Password di-hash dengan SHA-256
- Session menggunakan Flask server-side session
- File upload divalidasi type dan ukuran (maks 5MB)
- Admin-only routes dilindungi decorator
- Ganti `SECRET_KEY` dengan string random yang kuat di production

---

## 📊 Database

SQLite database otomatis dibuat di `data/audit.db` saat pertama kali dijalankan.  
Tabel: `users`, `updates`, `tl_images`, `notif_log`, `sent_log`, `settings`

Backup database:
```bash
cp data/audit.db data/audit_backup_$(date +%Y%m%d).db
```
