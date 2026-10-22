-- ============================================================
-- FITUR PUBLIC: Komentar (guestbook) + Kontak Email + Visitor
-- ============================================================
-- INI FILE KANONIK untuk fitur public.
-- Jalankan di Supabase SQL Editor pada database yang SUDAH ADA.
--
-- ✓ Tidak menghapus/mengubah tabel projects & experiences
-- ✓ Tidak menghapus data yang sudah ada
-- ✓ Membuat tabel baru: comments, contact_messages, visitors
-- ✓ Idempotent: aman dijalankan ulang & boleh dijalankan setelah
--   rls_contact_messages.sql versi lama (policy lama ikut dihapus).
--
-- ⚠️ GANTI 'admin2@naomi.dev' dengan email admin kamu
--    (sama seperti di rls_admin.sql & VITE_ADMIN_EMAIL di .env)
-- ============================================================

-- ── 1) TABEL: comments (guestbook) ─────────────────────────────
-- parent_id  -> dukungan balasan (thread). Public membuat parent (null);
--               admin nanti bisa membalas via parent_id.
-- status     -> 'published' / 'pending' / 'hidden'
--              • published = tampil untuk umum (default: komentar langsung
--                muncul karena UI moderasi belum ada).
--              • pending   = menunggu persetujuan admin (tahap admin nanti).
--              • hidden    = disembunyikan admin (tahap admin nanti).
-- is_admin   -> tanda komentar berasal dari admin (untuk tampilan "↳ Admin")
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.comments (id) on delete cascade,
  name       text not null default '',
  content    text not null default '',
  created_at timestamptz not null default now(),
  status     text not null default 'published',
  is_admin   boolean not null default false
);

create index if not exists comments_created_at_idx on public.comments (created_at desc);
create index if not exists comments_parent_id_idx on public.comments (parent_id);

-- ── 2) TABEL: contact_messages (fitur Kirim Email) ─────────────
-- status -> new | read | replied (untuk admin nanti)
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  email      text not null default '',
  message    text not null default '',
  created_at timestamptz not null default now(),
  status     text not null default 'new'
);

create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);

-- ── 3) TABEL: visitors (statistik kunjungan) ───────────────────
-- Satu baris = satu kunjungan (session). `session_id` dibuat di
-- browser (sessionStorage) sehingga pergantian halaman dalam satu
-- kunjungan TIDAK menambah counter.
create table if not exists public.visitors (
  id         uuid primary key default gen_random_uuid(),
  session_id text not null default '',
  device_type text not null default 'Unknown',
  device_name text not null default 'Unknown',
  visited_at timestamptz not null default now()
);

create index if not exists visitors_visited_at_idx on public.visitors (visited_at desc);

-- ── 4) GRANT ───────────────────────────────────────────────────
-- anon        : bisa menulis komentar, pesan kontak, dan mencatat kunjungan.
--                BISA MEMBACA komentar berstatus published, TAPI TIDAK BISA
--                membaca contact_messages (privasi) — hanya admin yang bisa.
-- authenticated: admin (sesuai RLS) — akses penuh untuk dashboard nanti.
revoke all on table public.comments         from anon;
revoke all on table public.contact_messages from anon;
revoke all on table public.visitors         from anon;

grant select, insert on table public.comments to anon;
grant insert on table public.contact_messages to anon;
grant insert on table public.visitors to anon;

grant select, insert, update, delete on table public.comments         to authenticated;
grant select, insert, update, delete on table public.contact_messages to authenticated;
grant select, insert, update, delete on table public.visitors         to authenticated;

-- ── 5) RLS: comments ───────────────────────────────────────────
alter table public.comments enable row level security;

-- Hapus policy lama (jika ada) supaya file bisa dijalankan ulang
drop policy if exists "comments_select_public"    on public.comments;
drop policy if exists "comments_insert_public"    on public.comments;
drop policy if exists "comments_select_admin"     on public.comments;
drop policy if exists "comments_insert_admin"     on public.comments;
drop policy if exists "comments_update_admin"     on public.comments;
drop policy if exists "comments_delete_admin"     on public.comments;

-- Public: baca komentar published saja
create policy "comments_select_public" on public.comments
for select to anon
using (status = 'published');

-- Public: kirim komentar baru (hanya root, tanpa parent; otomatis published).
-- Status/parent/is_admin TIDAK bisa diubah publik — semua dipaksa di sini,
-- sehingga publik tidak bisa menyembunyikan komentar, memalsukan admin, atau
-- membuat balasan (balasan hanya dari admin nanti via parent_id).
create policy "comments_insert_public" on public.comments
for insert to anon
with check (
  status = 'published'
  and parent_id is null
  and is_admin = false
  and char_length(trim(name))   between 1 and 80
  and char_length(trim(content)) between 1 and 2000
);

-- Admin: baca semua (termasuk pending/hidden) — hanya email admin
create policy "comments_select_admin" on public.comments
for select to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- Admin: tulis (termasuk balasan via parent_id)
create policy "comments_insert_admin" on public.comments
for insert to authenticated
with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- Admin: update komentar (moderasi / status)
create policy "comments_update_admin" on public.comments
for update to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'))
with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- Admin: hapus komentar
create policy "comments_delete_admin" on public.comments
for delete to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- ── 6) RLS: contact_messages ───────────────────────────────────
alter table public.contact_messages enable row level security;

drop policy if exists "contact_messages_insert_public" on public.contact_messages;
drop policy if exists "contact_messages_insert_anon"  on public.contact_messages; -- legacy rls_contact_messages.sql
drop policy if exists "contact_messages_select_admin"  on public.contact_messages;
drop policy if exists "contact_messages_update_admin"  on public.contact_messages;
drop policy if exists "contact_messages_delete_admin"  on public.contact_messages;

-- Public: hanya bisa mengirim (tidak bisa membaca daftar pesan)
create policy "contact_messages_insert_public" on public.contact_messages
for insert to anon
with check (
  char_length(trim(email))   between 3 and 254
  and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  and char_length(trim(message)) between 1 and 5000
);

-- Admin: baca semua pesan (untuk dashboard nanti)
create policy "contact_messages_select_admin" on public.contact_messages
for select to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- Admin: update status pesan
create policy "contact_messages_update_admin" on public.contact_messages
for update to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'))
with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- Admin: hapus pesan
create policy "contact_messages_delete_admin" on public.contact_messages
for delete to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- ── 7) RLS: visitors ───────────────────────────────────────────
alter table public.visitors enable row level security;

drop policy if exists "visitors_insert_public" on public.visitors;
drop policy if exists "visitors_select_admin"  on public.visitors;
drop policy if exists "visitors_delete_admin"  on public.visitors;

-- Public: hanya bisa mencatat kunjungan
create policy "visitors_insert_public" on public.visitors
for insert to anon
with check (
  char_length(session_id) between 1 and 128
  and device_type in ('Mobile', 'Tablet', 'Desktop', 'Unknown')
  and char_length(device_name) between 1 and 100
);

-- Public: tidak bisa membaca (statistik untuk admin di dashboard nanti)
create policy "visitors_select_admin" on public.visitors
for select to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

create policy "visitors_delete_admin" on public.visitors
for delete to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- ── 8) Verifikasi (opsional, bisa dijalankan terpisah) ──────────
-- select tablename, policyname, cmd
-- from pg_policies
-- where tablename in ('comments', 'contact_messages', 'visitors')
-- order by tablename, cmd;