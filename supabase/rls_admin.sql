-- ============================================================
-- RLS: PUBLIC read-only, ADMIN boleh CRUD
-- ============================================================
-- Jalankan di Supabase SQL Editor (untuk database yang SUDAH ADA).
--
-- ⚠️ SEBELUM RUN:
--   1. Buat user admin di Supabase Dashboard:
--      Authentication -> Users -> Add user / Invite user
--      (gunakan email + password admin, centang "Auto Confirm User")
--   2. GANTI 'admin2@naomi.dev' di bawah dengan email admin kamu.
--      Gunakan email yang SAMA dengan VITE_ADMIN_EMAIL di file .env
--
-- Tidak menghapus / mengubah tabel, tidak menghapus data.
-- Hanya mengganti policy RLS dan grant.
-- ============================================================

-- ── 1) Pastikan RLS aktif ────────────────────────────────────
alter table public.projects    enable row level security;
alter table public.experiences enable row level security;

-- ── 2) Hapus policy tulis lama yang terbuka untuk umum ───────
drop policy if exists "projects_insert"    on public.projects;
drop policy if exists "projects_update"    on public.projects;
drop policy if exists "projects_delete"    on public.projects;
drop policy if exists "experiences_insert" on public.experiences;
drop policy if exists "experiences_update" on public.experiences;
drop policy if exists "experiences_delete" on public.experiences;

-- ── 3) Cabut grant tulis dari anon (public benar-benar read-only) ──
revoke insert, update, delete on public.projects    from anon;
revoke insert, update, delete on public.experiences from anon;

-- ── 4) Pastikan authenticated (admin yang login) punya grant tulis ──
grant insert, update, delete on public.projects    to authenticated;
grant insert, update, delete on public.experiences to authenticated;

-- ── 5) Pastikan policy SELECT tetap ada untuk semua orang ────
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'projects' and policyname = 'projects_select') then
    create policy "projects_select" on public.projects for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'experiences' and policyname = 'experiences_select') then
    create policy "experiences_select" on public.experiences for select to anon, authenticated using (true);
  end if;
end $$;

-- ── 5b) Hapus policy admin lama (jika ada) supaya file bisa dijalankan ulang ──
drop policy if exists "admin_projects_insert"    on public.projects;
drop policy if exists "admin_projects_update"    on public.projects;
drop policy if exists "admin_projects_delete"    on public.projects;
drop policy if exists "admin_experiences_insert" on public.experiences;
drop policy if exists "admin_experiences_update" on public.experiences;
drop policy if exists "admin_experiences_delete" on public.experiences;

-- ── 6) Policy INSERT / UPDATE / DELETE HANYA untuk admin ─────
-- GANTI 'admin2@naomi.dev' dengan email admin kamu.

-- Projects
create policy "admin_projects_insert" on public.projects
for insert to authenticated
with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

create policy "admin_projects_update" on public.projects
for update to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'))
with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

create policy "admin_projects_delete" on public.projects
for delete to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- Experiences
create policy "admin_experiences_insert" on public.experiences
for insert to authenticated
with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

create policy "admin_experiences_update" on public.experiences
for update to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'))
with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

create policy "admin_experiences_delete" on public.experiences
for delete to authenticated
using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));

-- ── Verifikasi cepat (query ini harus menampilkan policy admin) ──
-- select schemaname, tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, cmd;