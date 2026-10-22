-- ============================================================
-- FASE 3: Dashboard admin + Storage gambar + Realtime komentar
-- ============================================================
-- IDEMPOTENT — aman dijalankan ulang.
-- Jalankan di SQL Editor ATAU lewat CLI:
--   npx supabase db query --linked --file supabase/features3.sql
--
-- Isi file ini:
--   1) RPC `admin_dashboard_stats()`         → statistik untuk dashboard admin
--   2) Storage bucket `portfolio` (public)   → upload gambar projek/pengalaman
--      + RLS: baca publik, tulis hanya admin (app_is_admin)
--   3) Realtime `comments`                   → komentar baru tampil live
-- ============================================================

-- ── 1) RPC admin_dashboard_stats ────────────────────────────────
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.app_is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select jsonb_build_object(
    'visitors_total',    (select count(*)::int from public.visitors),
    'visitors_today',    (select count(*)::int from public.visitors where visited_at >= date_trunc('day', now())),
    'visitors_week',     (select count(*)::int from public.visitors where visited_at >= now() - interval '7 days'),
    'visitors_unique',   (select count(distinct session_id)::int from public.visitors),
    'messages_new',      (select count(*)::int from public.contact_messages where status = 'new'),
    'messages_total',    (select count(*)::int from public.contact_messages),
    'comments_total',    (select count(*)::int from public.comments),
    'comments_published',(select count(*)::int from public.comments where status = 'published'),
    'comments_pending',  (select count(*)::int from public.comments where status = 'pending'),
    'comments_hidden',   (select count(*)::int from public.comments where status = 'hidden'),
    'projects_count',    (select count(*)::int from public.projects),
    'experiences_count', (select count(*)::int from public.experiences)
  ) into v;

  return v;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ── 2) Storage bucket `portfolio` (public) ──────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880, '{image/png,image/jpeg,image/webp}')
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = '{image/png,image/jpeg,image/webp}';

-- Hapus policy khusus bucket ini dulu supaya idempotent
drop policy if exists "portfolio_select_public" on storage.objects;
drop policy if exists "portfolio_insert_admin"  on storage.objects;
drop policy if exists "portfolio_update_admin"  on storage.objects;
drop policy if exists "portfolio_delete_admin"  on storage.objects;

-- Baca publik: gambar ditampilkan di halaman public
create policy "portfolio_select_public" on storage.objects
  for select using (bucket_id = 'portfolio');

-- Tulis (upload/update/hapus): HANYA admin
create policy "portfolio_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portfolio' and public.app_is_admin());

create policy "portfolio_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'portfolio' and public.app_is_admin())
  with check (bucket_id = 'portfolio' and public.app_is_admin());

create policy "portfolio_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'portfolio' and public.app_is_admin());

-- ── 3) Realtime untuk tabel comments ────────────────────────────
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime drop table public.comments;
  end if;
  alter publication supabase_realtime add table public.comments;
end $$;

-- ── 4) Kolom message_id (verifikasi anti-spam edge function) ────
-- Frontend menyimpan id unik pesan; edge function mengecek id ini
-- ada di DB sebelum mengirim email (mencegah spam langsung ke fungsi).
alter table public.contact_messages add column if not exists message_id text;
create index if not exists contact_messages_message_id_idx
  on public.contact_messages (message_id);

-- ── 5) RPC admin_visitor_days: grafik kunjungan 7 hari terakhir ──
create or replace function public.admin_visitor_days()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.app_is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select jsonb_agg(x ORDER BY x.day)
  into v
  from (
    select to_char(date_trunc('day', visited_at), 'YYYY-MM-DD') as day,
           count(*)::int as count
    from public.visitors
    where visited_at >= date_trunc('day', now()) - interval '6 days'
    group by date_trunc('day', visited_at)
  ) x;

  return coalesce(v, '[]'::jsonb);
end;
$$;

revoke all on function public.admin_visitor_days() from public, anon;
grant execute on function public.admin_visitor_days() to authenticated;

-- ── Verifikasi cepat ────────────────────────────────────────────
-- select proname from pg_proc where proname = 'admin_dashboard_stats';
-- select id, name, public from storage.buckets where id = 'portfolio';
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime';