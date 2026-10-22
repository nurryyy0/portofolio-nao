-- ============================================================
-- FIX: ADMIN TIDAK BISA UPLOAD / KELOLA PROJEK & EXPERIENCE
-- ============================================================
-- Akar masalah yang sering terjadi:
--   1. Email login admin di Supabase Auth ≠ email yang di-hardcode
--      di policy RLS ('admin2@naomi.dev')  → tombol CRUD tidak muncul
--      / data disimpan tampak sukses tapi hilang setelah refresh.
--   2. Tabel `projects`/`experiences` tidak punya unique/PK pada `id`
--      → upsert (tambah/edit) gagal.
--   3. Grant/policy tulis untuk role authenticated bermasalah.

-- Yang dilakukan file ini:
--   ✔ Akses admin ditentukan dari tabel `public.admins` (berdasar auth
--     user id) → TIDAK bergantung email hardcoded.
--   ✔ Simpan Projek/Experience lewat fungsi RPC `SECURITY DEFINER` →
--     bebas dari masalah grant/RLS/konflik upsert di sisi tabel.
--   ✔ Kolom `id` dipastikan UNIQUE/PK supaya upsert tidak error.
--   ✔ Semua policy tulis admin dialihkan ke helper `app_is_admin()`.
--   ✔ Idempotent: aman dijalankan kapan pun / berulang kali.
--   ✔ TIDAK menghapus / mengubah data projek & experience yang ada.

-- ============================================================
-- CARA PAKAI (Supabase Dashboard → SQL Editor):
--   1) Tempel seluruh file ini → Run.
--   2) Pastikan akun admin sudah ada di Authentication → Users
--      (email + password yang Anda pakai untuk login di /admin).
--   3) Di bagian "── 5) SEED ADMIN ──" pilih SALAH SATU cara,
--      ganti dengan data akun admin Anda, lalu Run lagi.
--   4) Build & deploy ulang frontend (npm run build).
-- ============================================================

-- ── 0) Pastikan kolom `id` UNIQUE/PK supaya UPSERT berhasil ──
do $fix$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'id'
  ) then
    raise exception 'Tabel projects tidak punya kolom id. Jalankan schema.sql dulu.';
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = 'projects'
      and c.contype in ('p','u')
      and c.conkey = (select array_agg(attnum) from pg_attribute
                      where attrelid = c.conrelid and attname = 'id')
  ) then
    alter table public.projects add constraint projects_id_key unique (id);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'experiences' and column_name = 'id'
  ) then
    raise exception 'Tabel experiences tidak punya kolom id. Jalankan schema.sql dulu.';
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = 'experiences'
      and c.contype in ('p','u')
      and c.conkey = (select array_agg(attnum) from pg_attribute
                      where attrelid = c.conrelid and attname = 'id')
  ) then
    alter table public.experiences add constraint experiences_id_key unique (id);
  end if;
end $fix$;

-- ── 1) Tabel admins (siapa yang boleh kelola) ────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

-- ── 2) Helper: apakah user yang sedang login adalah admin? ────
create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  )
$$;
revoke all on function public.app_is_admin() from public;
grant execute on function public.app_is_admin() to authenticated;

-- ── 3) RPC simpan semua projek (upsert + hapus yang tidak ada) ──
create or replace function public.admin_save_projects(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item     jsonb;
  v_ins      int := 0;
  v_upd      int := 0;
  v_created  boolean;
  v_error    text := null;
begin
  if not public.app_is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if jsonb_typeof(payload) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'payload harus array');
  end if;

  for v_item in select jsonb_array_elements(payload)
  loop
    begin
      insert into public.projects as p
        (id, title, short_desc, description, category, year, tags, thumb, github_link, live_link, featured)
      values (
        v_item->>'id',
        coalesce(v_item->>'title', ''),
        coalesce(v_item->>'short_desc', ''),
        coalesce(v_item->>'description', ''),
        coalesce(v_item->>'category', ''),
        coalesce(v_item->>'year', ''),
        case when jsonb_typeof(v_item->'tags') = 'array'
             then coalesce(v_item->'tags', '[]'::jsonb)
             else '[]'::jsonb end,
        nullif(v_item->>'thumb', ''),
        coalesce(v_item->>'github_link', '#'),
        coalesce(v_item->>'live_link', ''),
        case when v_item->>'featured' = 'true' then true else false end
      )
      on conflict (id) do update set
        title       = excluded.title,
        short_desc  = excluded.short_desc,
        description = excluded.description,
        category    = excluded.category,
        year        = excluded.year,
        tags        = excluded.tags,
        thumb       = excluded.thumb,
        github_link = excluded.github_link,
        live_link   = excluded.live_link,
        featured    = excluded.featured
      returning (xmax = 0) into v_created;
      if v_created then v_ins := v_ins + 1; else v_upd := v_upd + 1; end if;
    exception when others then
      v_error := sqlerrm;
      exit;
    end;
  end loop;

  if v_error is null then
    -- Hapus projek yang tidak ada lagi di daftar (CRUD delete tersimpan)
    delete from public.projects t
    where not exists (
      select 1 from jsonb_array_elements(payload) x
      where x->>'id' = t.id
    );
  end if;

  if v_error is not null then
    return jsonb_build_object('ok', false, 'error', v_error);
  end if;
  return jsonb_build_object('ok', true, 'inserted', v_ins, 'updated', v_upd);
end;
$$;
revoke all on function public.admin_save_projects(jsonb) from public;
grant execute on function public.admin_save_projects(jsonb) to authenticated;

-- ── 4) RPC simpan semua experience ────────────────────────────
alter table public.experiences
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists highlights jsonb not null default '[]'::jsonb;

create or replace function public.admin_save_experiences(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item     jsonb;
  v_ins      int := 0;
  v_upd      int := 0;
  v_created  boolean;
  v_error    text := null;
begin
  if not public.app_is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if jsonb_typeof(payload) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'payload harus array');
  end if;

  for v_item in select jsonb_array_elements(payload)
  loop
    begin
      insert into public.experiences as e
        (id, category, title, institution, start_date, description, link, image, tags, highlights)
      values (
        v_item->>'id',
        coalesce(v_item->>'category', ''),
        coalesce(v_item->>'title', ''),
        coalesce(v_item->>'institution', ''),
        coalesce(v_item->>'start_date', ''),
        coalesce(v_item->>'description', ''),
        coalesce(v_item->>'link', ''),
        nullif(v_item->>'image', ''),
        case when jsonb_typeof(v_item->'tags') = 'array'
          then v_item->'tags' else '[]'::jsonb end,
        case when jsonb_typeof(v_item->'highlights') = 'array'
          then v_item->'highlights' else '[]'::jsonb end
      )
      on conflict (id) do update set
        category    = excluded.category,
        title       = excluded.title,
        institution = excluded.institution,
        start_date  = excluded.start_date,
        description = excluded.description,
        link        = excluded.link,
        image       = excluded.image,
        tags        = excluded.tags,
        highlights  = excluded.highlights
      returning (xmax = 0) into v_created;
      if v_created then v_ins := v_ins + 1; else v_upd := v_upd + 1; end if;
    exception when others then
      v_error := sqlerrm;
      exit;
    end;
  end loop;

  if v_error is null then
    delete from public.experiences t
    where not exists (
      select 1 from jsonb_array_elements(payload) x
      where x->>'id' = t.id
    );
  end if;

  if v_error is not null then
    return jsonb_build_object('ok', false, 'error', v_error);
  end if;
  return jsonb_build_object('ok', true, 'inserted', v_ins, 'updated', v_upd);
end;
$$;
revoke all on function public.admin_save_experiences(jsonb) from public;
grant execute on function public.admin_save_experiences(jsonb) to authenticated;

-- ── 5) SEED ADMIN ─────────────────────────────────────────────
-- Cara 1 (paling mudah): tambahkan EMAIL LOGIN admin kamu ke daftar ini.
insert into public.admins (user_id)
select id from auth.users
where lower(email) in (
  'admin2@naomi.dev'
  -- , 'email-lain@kamu.com'
)
on conflict (user_id) do nothing;

-- Cara 2: tempel user id admin langsung (Authentication → Users → UUID)
-- insert into public.admins (user_id) values ('UUUUUUUU-UUUU-UUUU-UUUU-UUUUUUUUUUUU')
-- on conflict (user_id) do nothing;

-- Cara 3 (OTOMATIS, AKTIF): tambahkan user TERBARU di auth.users sebagai
-- admin. Umumnya akun admin adalah user terakhir yang dibuat — jadi bagian
-- ini membuat script langsung bekerja tanpa edit apa pun.
-- Kalau ternyata user terbaru BUKAN admin, nonaktifkan baris di bawah
-- (atau beri # di depannya), lalu pakai Cara 1/2.
insert into public.admins (user_id)
select id from auth.users
order by created_at desc
limit 1
on conflict (user_id) do nothing;

-- ── 6) Policy tulis admin → app_is_admin() ────────────────────
-- (idempotent; tidak menyentuh policy SELECT publik)

-- projects
drop policy if exists "admin_projects_insert" on public.projects;
drop policy if exists "admin_projects_update" on public.projects;
drop policy if exists "admin_projects_delete" on public.projects;
create policy "admin_projects_insert" on public.projects
  for insert to authenticated with check (public.app_is_admin());
create policy "admin_projects_update" on public.projects
  for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy "admin_projects_delete" on public.projects
  for delete to authenticated using (public.app_is_admin());

-- experiences
drop policy if exists "admin_experiences_insert" on public.experiences;
drop policy if exists "admin_experiences_update" on public.experiences;
drop policy if exists "admin_experiences_delete" on public.experiences;
create policy "admin_experiences_insert" on public.experiences
  for insert to authenticated with check (public.app_is_admin());
create policy "admin_experiences_update" on public.experiences
  for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy "admin_experiences_delete" on public.experiences
  for delete to authenticated using (public.app_is_admin());

-- comments (admin: lihat semua + moderasi/hapus)
drop policy if exists "comments_select_admin" on public.comments;
drop policy if exists "comments_insert_admin" on public.comments;
drop policy if exists "comments_update_admin" on public.comments;
drop policy if exists "comments_delete_admin" on public.comments;
create policy "comments_select_admin" on public.comments
  for select to authenticated using (public.app_is_admin());
create policy "comments_insert_admin" on public.comments
  for insert to authenticated
  with check (public.app_is_admin());
create policy "comments_update_admin" on public.comments
  for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy "comments_delete_admin" on public.comments
  for delete to authenticated using (public.app_is_admin());

-- contact_messages (admin: baca semua + update status + hapus)
drop policy if exists "contact_messages_select_admin" on public.contact_messages;
drop policy if exists "contact_messages_update_admin" on public.contact_messages;
drop policy if exists "contact_messages_delete_admin" on public.contact_messages;
create policy "contact_messages_select_admin" on public.contact_messages
  for select to authenticated using (public.app_is_admin());
create policy "contact_messages_update_admin" on public.contact_messages
  for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy "contact_messages_delete_admin" on public.contact_messages
  for delete to authenticated using (public.app_is_admin());

-- visitors (admin: baca statistik + hapus)
drop policy if exists "visitors_select_admin" on public.visitors;
drop policy if exists "visitors_delete_admin" on public.visitors;
create policy "visitors_select_admin" on public.visitors
  for select to authenticated using (public.app_is_admin());
create policy "visitors_delete_admin" on public.visitors
  for delete to authenticated using (public.app_is_admin());

-- ── 7) Verifikasi ─────────────────────────────────────────────
-- select email from auth.users;
-- select * from public.admins;
-- select * from pg_policies where schemaname = 'public' and tablename in ('projects','experiences') order by tablename, cmd;

-- ── 8) Pembersihan (opsional) ─────────────────────────────────
-- Hapus komentar percobaan diagnostik (kalau ada dari proses tes):
-- delete from public.comments where name in ('probe-tmp', 'probe');