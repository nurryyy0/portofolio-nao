# Portofolio Naomi — React + Vite + Supabase

Web portofolio interaktif dengan fitur **database (Supabase)** dan **email (Send via Resend)**:

- Kelola **Projects** & **Experience** (CRUD admin, public read-only).
- Section **Proyek Pilihan** di Home — admin mencentang project yang tampil (kolom `featured`).
- **Link demo/deploy** per project (kolom `live_link`).
- Guestbook **Komentar** + **Kirim Email** di halaman Contact.
- **Visitor tracking** (statistik kunjungan per sesi tab).
- Area admin di `/admin` (login Supabase Auth).

## Tech Stack

- React 19 + Vite 8 (ESM)
- `@supabase/supabase-js` (REST + Auth + Edge Functions)
- Supabase Edge Function `send-contact-email` (Resend API)

---

## 1. Instalasi

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`.

---

## 2. Konfigurasi `.env` (frontend)

Copy template lalu isi:

```bash
cp .env.example .env
```

| Variabel | Keterangan |
|---|---|
| `VITE_SUPABASE_URL` | Project URL, dari Dashboard → Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) |
| `VITE_SUPABASE_ANON_KEY` | Key anon legacy (`eyJ...`) — boleh dikosongkan jika pakai publishable |
| `VITE_ADMIN_EMAIL` | Email admin. **WAJIB sama** dengan email di policy RLS (`admin2@naomi.dev`) dan akun Supabase Auth |

> ⚠️ File `.env` jangan ikut di-commit (sudah di-ignore di `.gitignore`).

---

## 3. Setup Database (Supabase)

Buka **Dashboard → SQL Editor**, lalu jalankan file berikut **secara berurutan**:

1. **`supabase/schema.sql`** — tabel `projects` & `experiences` + seed data awal + RLS admin.
2. **`supabase/public_features.sql`** — tabel `comments`, `contact_messages`, `visitors` + RLS-nya (file kanonik).
3. **`supabase/features3.sql`** *(Fase 3, opsional tapi disarankan)* — RPC `admin_dashboard_stats()`, storage bucket `portfolio` (upload gambar), dan realtime tabel `comments`.
4. **`supabase/features4.sql`** *(Fase 4)* — tabel `site_content` (teks Home & About yang bisa diedit admin) + RLS + RPC `admin_save_content` + seed konten default.

> Untuk database yang sudah ada, jalankan **`supabase/add_visitor_device.sql`** satu kali agar kunjungan baru menyimpan nama perangkat yang tersedia dari browser. Nama model bergantung pada browser dan dapat berupa nama umum (misalnya "iPhone" atau "Windows PC"); kunjungan lama akan tampil sebagai "Unknown".

> **Kolom tambahan di tabel `projects`** (hanya untuk database yang **sudah ada** sebelum
> `schema.sql` diperbarui — kalau database baru, `schema.sql` sudah membawa keduanya):
>
> 5. **`supabase/add_live_link.sql`** — kolom `live_link` (link demo/deploy) + perbarui RPC `admin_save_projects`.
> 6. **`supabase/add_featured.sql`** — kolom `featured` (pilihan project di Home) + perbarui RPC `admin_save_projects`.
>
> Urutan penting: **6 dijalankan terakhir**, karena versi `admin_save_projects`
> di `add_featured.sql` sudah mencakup `live_link` juga. Jadi cukup jalankan
> `add_featured.sql` saja untuk dapat kedua kolom. Kedua file idempotent
> (aman dijalankan berulang).

Untuk database yang sudah ada / mau aman dijalankan ulang:

- **`supabase/rls_admin.sql`** — versi idempotent untuk policy CRUD admin di `projects`/`experiences`.
- **`supabase/rls_contact_messages.sql`** — versi idempotent untuk RLS `contact_messages` (sudah diselaraskan, pakai `id uuid` + policy tervalidasi).

> **Status komentar (guestbook):** komentar status `'published'` tampil untuk umum.
> Kolom `status` (`'pending'` / `'hidden'`) dipakai moderasi admin — kelola di
> **Dashboard admin → Moderasi Komentar** (terbitkan, sembunyikan, hapus, balas
> sebagai admin via `parent_id` → tampil sebagai thread "↳ Admin" di halaman Contact).
> RLS memvalidasi isi dan melarang publik mengubah status.

> Pastikan email di policy = `VITE_ADMIN_EMAIL` (saat ini `admin2@naomi.dev`).
> Buat akun adminnya di **Authentication → Users → Add user** (centang *Auto Confirm User*).

---

## 4. Setup Email (Resend)

Alur: Form Contact → pesan disimpan ke `contact_messages` (RLS anon insert) → **Edge Function `send-contact-email`** mengirim email via Resend ke inbox pemilik portfolio.

Prasyarat:

1. Daftar akun di [resend.com](https://resend.com) dan buat **API Key** (`re_...`).
2. **Verify domain** di resend.com (`Domains`) — pengirim harus dari domain/email terverifikasi.

> **Jalur GRATIS tanpa domain:** biarkan `CONTACT_FROM_EMAIL` kosong → edge function
> otomatis memakai `onboarding@resend.dev`. Batasannya: email hanya bisa dikirim ke
> **email akun Resend kamu sendiri**, jadi set `CONTACT_OWNER_EMAIL` = email akun Resend.
> Cocok untuk portofolio (100 email/hari gratis); pengirim di inbox tampil
> `onboarding@resend.dev`. Upgrade ke domain sendiri = ubah `CONTACT_FROM_EMAIL` saja.

Langkah deploy:

```bash
# 1) Login CLI (browser dibuka otomatis)
npm run supabase:login

# 2) (opsional) link proyek
npm run supabase:link

# 3) Isi secrets — copy template lalu isi nilainya
Copy-Item supabase/.env.example supabase/.env   # Windows
npm run secrets:email

# 4) Deploy edge function
npm run deploy:email
```

Verifikasi — **cara paling mudah**: isi form di halaman `/contact`. 💌

Mengetes langsung via curl harus **simpan dulu** `message_id` ke tabel `contact_messages`
(karena edge function memverifikasi id pesan untuk mencegah spam):

```bash
# 1) Simpan pesan (boleh dummy id)
curl -X POST https://dkbrxwudehntzlyhtsdb.supabase.co/rest/v1/contact_messages \
  -H "apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>" \
  -H "Authorization: Bearer <VITE_SUPABASE_PUBLISHABLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"pengirim@contoh.com","message":"Halo, ini test","status":"new","message_id":"test-123"}'

# 2) Panggil fungsi dengan messageId yang sama
curl -X POST https://dkbrxwudehntzlyhtsdb.supabase.co/functions/v1/send-contact-email \
  -H "apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"pengirim@contoh.com","message":"Halo, ini test","messageId":"test-123"}'
```

Response `{"ok":true}` = berhasil. Panggilan dengan `messageId` palsu / tanpa lewat form
akan ditolak (`400` / `429`) — verifikasi `message_id` + rate limit (10 email/15 menit)
dipakai fungsi otomatis via secret key bawaan runtime (tidak perlu set manual).

> Jika belum dideploy / secret belum diisi, aplikasi tetap berfungsi: pesan tersimpan di database dan pengunjung melihat notifikasi "Pesan tersimpan".

---

## 5. Admin Access

- Buka `/admin`, login pakai email+password admin (yang dibuat di **Authentication → Users**).
- Setelah login, dashboard admin menampilkan:
  - **Ringkasan** — statistik pengunjung (total/hari ini/7 hari/unik), pesan, dan komentar + pintu CRUD Projects/Experience.
  - **Pesan Masuk** — daftar `contact_messages`, tandai baru/dibaca/sudah dibalas, hapus.
  - **Moderasi Komentar** — terbitkan/pending/sembunyikan, hapus, dan **balas sebagai admin**.
  - **Konten Situs** (*✏️*) — edit teks **Home** (hero + paragraf pengantar) dan **About** (sub-judul + biodata) langsung dari panel; tersimpan di tabel `site_content` dan langsung tampil di halaman publik.
- Tombol **Edit/Hapus/Tambah** muncul di halaman `Projects` & `Experience`.

> **Security:** pastikan **public signup dimatikan** (Dashboard → Authentication →
> Sign In / Providers → *Allow new users to sign up* = OFF), supaya hanya akun
> admin yang bisa dibuat. *(Sudah dimatikan di project ini.)*

> **Jika admin tidak bisa menyimpan (tambah/edit/hapus) Projek atau Experience:**
> jalankan **`supabase/fix_admin.sql`** di SQL Editor. File ini membuat:
> 1. Tabel `admins` (kunci akses admin berdasarkan **auth user id**, bukan email hardcoded),
> 2. Fungsi helper `app_is_admin()` dan RPC `admin_save_projects` / `admin_save_experiences`
>    (write via SECURITY DEFINER → bebas masalah grant/RLS/upsert),
> 3. Policy tulis admin dialihkan ke `app_is_admin()`.
>
> Yang perlu Anda sesuaikan di file itu hanyalah **SEED ADMIN** (email login admin
> atau user id). Kode frontend otomatis mendeteksi apakah RPC admin sudah ada:
> pakai RPC kalau ada, fallback ke mekanisme lama (email) kalau belum.
>
> `VITE_ADMIN_EMAIL` juga bisa berisi beberapa email (dipisah koma).

---

## Scripts (npm)

| Script | Fungsi |
|---|---|
| `npm run dev` / `build` / `preview` | Vite dev / build / preview |
| `npm run lint` | ESLint |
| `npm run supabase:login` | Login CLI Supabase |
| `npm run supabase:link` | Link ke project `dkbrxwudehntzlyhtsdb` |
| `npm run deploy:email` | Deploy edge function email (JWT non-verifikasi) |
| `npm run secrets:email` | Kirim secrets dari `supabase/.env` ke Supabase |

---

## Struktur penting

```
src/lib/storage.js   → layer CRUD (Supabase + fallback localStorage) + upload gambar & resolveImageUrl
src/lib/auth.js      → login/logout & hook useAdmin
src/lib/contact.js   → komentar, contact message, visitor tracking
src/lib/admin.js     → dashboard admin (statistik, inbox pesan, moderasi komentar)
src/lib/content.js   → konten situs yang bisa diedit admin (Home/About)
src/hooks/useSiteContent.js → hook pemuat konten untuk halaman publik
src/components/AdminInbox.jsx & AdminModeration.jsx → panel dashboard (tab Pesan/Moderasi)
src/components/AdminContent.jsx → panel edit konten Home & About
src/hooks/useModalA11y.js → aksesibilitas modal (focus trap + ESC + restore focus)
supabase/functions/send-contact-email/index.ts → edge function email (send via Resend)
supabase/*.sql       → skema + RLS (lihat bagian 3)
supabase/features3.sql → Fase 3: RPC statistik + storage bucket `portfolio` + realtime
supabase/features4.sql → Fase 4: tabel `site_content` + RPC admin_save_content
supabase/add_live_link.sql / add_featured.sql → kolom `live_link` + `featured` di tabel projects
```