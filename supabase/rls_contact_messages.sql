-- ============================================================
-- RLS: contact_messages
-- Anon boleh INSERT (kirim pesan), hanya admin yang bisa baca/edit/hapus.
-- ============================================================
-- SUDAH DISELARASKAN dengan public_features.sql (file kanonik untuk
-- fitur public: comments + contact_messages + visitors).
--
--   * id          = uuid (BUKAN bigint) — sama persis dengan public_features.sql
--   * policy insert = tervalidasi (email & panjang pesan dicek) — bukan `true`
--   * idempotent: boleh dijalankan berulang kali, di urutan file mana pun.
--
-- Ganti 'admin2@naomi.dev' jika email admin-mu berbeda (isi yang SAMA dengan
-- VITE_ADMIN_EMAIL di .env dan akun Supabase Auth).
-- ============================================================

-- ── 1) Pastikan tabel ada (buat jika belum ada) ──────────────
-- Skema WAJIB sama dengan public_features.sql.
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  email      text not null default '',
  message    text not null default '',
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- ── 2) Aktifkan RLS ─────────────────────────────────────────
alter table public.contact_messages enable row level security;

-- ── 3) Grant: anon boleh INSERT saja (bukan SELECT/UPDATE/DELETE) ──
revoke all on table public.contact_messages from anon;
grant insert on public.contact_messages to anon;
grant select, update, delete on public.contact_messages to authenticated;

-- ── 4) Hapus policy lama (idempotent) ───────────────────────
drop policy if exists "contact_messages_insert_anon"   on public.contact_messages;
drop policy if exists "contact_messages_insert_public" on public.contact_messages;
drop policy if exists "contact_messages_select_admin"  on public.contact_messages;
drop policy if exists "contact_messages_update_admin"  on public.contact_messages;
drop policy if exists "contact_messages_delete_admin"  on public.contact_messages;

-- ── 5) Policy INSERT: siapa saja (anon) boleh kirim pesan ───
--     tapi TETAP divalidasi (email format + panjang) — SAMA seperti di
--     public_features.sql. Jangan diganti jadi `with check (true)`.
create policy "contact_messages_insert_public"
  on public.contact_messages
  for insert
  to anon
  with check (
    char_length(trim(email))   between 3 and 254
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and char_length(trim(message)) between 1 and 5000
  );

-- ── 6) Policy SELECT/UPDATE/DELETE: hanya admin ─────────────
-- GANTI 'admin2@naomi.dev' dengan email admin-mu.

create policy "contact_messages_select_admin"
  on public.contact_messages
  for select
  to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

create policy "contact_messages_update_admin"
  on public.contact_messages
  for update
  to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'))
  with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

create policy "contact_messages_delete_admin"
  on public.contact_messages
  for delete
  to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- ── Verifikasi ───────────────────────────────────────────────
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename = 'contact_messages'
-- order by cmd;