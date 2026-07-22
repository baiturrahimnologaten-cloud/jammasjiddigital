# Panduan Pengaturan Firebase & Hosting di GitHub Pages

Dokumen ini berisi panduan langkah demi langkah untuk menghubungkan Jam Masjid Digital Anda ke database awan **Firebase** (untuk kontrol nirkabel real-time) dan mempublikasikannya secara gratis ke **GitHub Pages** agar bisa diakses oleh TV masjid dan HP pengurus dari mana saja.

---

## BAGIAN 1: Mengatur Database Cloud Firebase

Kita akan menggunakan layanan **Cloud Firestore** dari Firebase sebagai database real-time gratis.

### Langkah 1: Buat Proyek Firebase
1. Buka [Firebase Console](https://console.firebase.google.com/) dan masuk menggunakan akun Google Anda.
2. Klik tombol **Add project** (Tambah Proyek).
3. Masukkan nama proyek Anda, contoh: `masjid-baiturrahim-digital`, lalu klik **Continue**.
4. Di bagian Google Analytics, Anda bisa menonaktifkannya (opsional/disable) agar proses pembuatan proyek lebih cepat, lalu klik **Create project**.
5. Tunggu beberapa saat hingga proyek siap, lalu klik **Continue**.

### Langkah 2: Daftarkan Aplikasi Web & Salin Konfigurasi
1. Pada halaman beranda proyek Firebase Anda, klik ikon **Web ( `</>` )** untuk mendaftarkan aplikasi web baru.
2. Masukkan nama aplikasi Anda, contoh: `Jam Masjid Baiturrahim`, lalu klik **Register app**.
3. Firebase akan menampilkan kode konfigurasi. Cari bagian objek `firebaseConfig` yang terlihat seperti ini:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
4. Buka berkas [js/firebase-config.js](js/firebase-config.js) di folder proyek Anda.
5. Ganti nilai-nilai penampung (placeholder) di dalam berkas tersebut dengan kredensial yang Anda salin dari Firebase tadi. Simpan berkas tersebut.

### Langkah 3: Aktifkan Database Cloud Firestore
1. Pada menu sebelah kiri di Firebase Console, klik **Build** lalu pilih **Firestore Database**.
2. Klik tombol **Create database** (Buat database).
3. Pilih lokasi database terdekat (misal: `asia-southeast2` untuk Jakarta/Singapura), lalu klik **Next**.
4. Pilih **Start in test mode** (Mulai dalam mode pengujian) agar database dapat langsung dibaca dan ditulis oleh aplikasi tanpa autentikasi yang rumit terlebih dahulu, lalu klik **Create**.
5. Setelah database siap, buka tab **Rules** (Aturan) di bagian atas halaman Firestore. Pastikan aturannya memperbolehkan baca dan tulis secara umum. Contoh aturan untuk pengujian:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   *(Catatan: Mode pengujian ini sangat cocok untuk penggunaan jam digital masjid luring/daring sederhana).*

---

## BAGIAN 2: Mempublikasikan Website ke GitHub Pages (Gratis)

Kita akan mengunggah kode website Anda ke GitHub dan mengaktifkan fitur GitHub Pages untuk hosting gratis.

### Langkah 1: Buat Akun & Repositori di GitHub
1. Jika belum punya, daftar akun gratis di [GitHub](https://github.com/).
2. Masuk ke akun GitHub Anda, lalu klik tombol **New** (Baru) di pojok kiri atas untuk membuat repositori baru.
3. Isi informasi berikut:
   - **Repository name**: `masjid` (atau nama lain yang Anda sukai).
   - **Public/Private**: Pilih **Public** (wajib agar fitur GitHub Pages gratis bisa aktif).
   - **Initialize this repository with**: Biarkan semuanya tidak tercentang (kosong).
4. Klik tombol **Create repository** di bagian bawah.

### Langkah 2: Unggah Kode Anda Menggunakan Git (Alternatif CLI)
Buka terminal/PowerShell di folder proyek Anda (`d:\Project Web\masjid`) dan jalankan perintah berikut secara berurutan:

1. **Inisialisasi Git lokal**:
   ```bash
   git init
   ```
2. **Tambahkan semua file ke antrean**:
   ```bash
   git add .
   ```
3. **Commit perubahan pertama Anda**:
   ```bash
   git commit -m "First release Jam Masjid Digital"
   ```
4. **Sambungkan Git lokal ke repositori GitHub Anda** (Ganti `username-anda` dengan nama pengguna GitHub Anda):
   ```bash
   git remote add origin https://github.com/username-anda/masjid.git
   ```
5. **Ubah nama cabang utama menjadi main**:
   ```bash
   git branch -M main
   ```
6. **Unggah file Anda ke GitHub**:
   ```bash
   git push -u origin main
   ```

> 💡 **Cara Mudah Tanpa Git CLI (Menggunakan Browser):**
> Jika Anda belum menginstal Git di komputer Anda, Anda bisa mengunggah file langsung lewat website GitHub:
> 1. Pada halaman repositori kosong Anda di GitHub, klik tautan **"uploading an existing file"** di bagian atas.
> 2. Tarik dan lepas (Drag & Drop) seluruh file dan folder (`index.html`, `admin.html`, folder `css`, `js`, `assets`) dari komputer Anda ke browser.
> 3. Klik tombol **Commit changes** di bagian bawah.

### Langkah 3: Aktifkan Fitur GitHub Pages
1. Pada halaman repositori Anda di GitHub, klik tab **Settings** (Pengaturan) di bagian menu atas (ikon roda gigi).
2. Di menu sebelah kiri, cari bagian **Code and automation** dan klik **Pages**.
3. Di bawah bagian **Build and deployment**:
   - **Source**: Pilih **Deploy from a branch**.
   - **Branch**: Klik menu dropdown yang bertuliskan *None*, lalu pilih **main** (atau **master**).
   - Folder di sampingnya biarkan tetap **/ (root)**.
4. Klik tombol **Save** (Simpan).
5. Tunggu sekitar 1 hingga 2 menit. Refresh halaman Settings Pages tersebut.
6. Di bagian atas halaman Pages, Anda akan melihat kotak berwarna hijau yang berisi tautan website Anda, contoh:
   > 🚀 **Your site is live at** `https://username-anda.github.io/masjid/`

---

## Langkah Uji Coba Sinkronisasi Real-Time

Setelah semuanya aktif:
1. **Layar TV Masjid**: Buka tautan berikut di monitor TV masjid Anda:
   `https://username-anda.github.io/masjid/index.html` (Tekan **F11** untuk layar penuh).
2. **Dashboard Pengurus**: Buka tautan berikut di HP atau laptop pengurus masjid:
   `https://username-anda.github.io/masjid/admin.html`
3. Masukkan kata sandi `admin123` untuk masuk ke dashboard pengurus.
4. Coba ubah teks pengumuman berjalan atau jumlah saldo kas di HP Anda, lalu tekan **Simpan Perubahan**.
5. Amati layar monitor TV masjid Anda, tampilan di TV akan langsung terupdate secara real-time nirkabel!
