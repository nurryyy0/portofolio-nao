-- ============================================================
-- FASE 4: Kelola konten situs (Home & About) dari dashboard admin
-- ============================================================
-- IDEMPOTENT — aman dijalankan ulang.
-- Menambah tabel `site_content` (key-value) + RLS + RPC simpan konten + seed default.
-- Publik boleh BACA (Home/About), hanya admin yang boleh TULIS.
-- Jalankan: npx supabase db query --linked --file supabase/features4.sql

-- ── 1) Tabel konten situs ──────────────────────────────────────
create table if not exists public.site_content (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

-- Grant: publik baca; authenticated (admin) baca + tulis
revoke all on table public.site_content from anon;
revoke all on table public.site_content from authenticated;
grant select on table public.site_content to anon, authenticated;
grant insert, update, delete on table public.site_content to authenticated;

-- ── 2) Policy RLS ──────────────────────────────────────────────
drop policy if exists "site_content_select_public" on public.site_content;
drop policy if exists "site_content_insert_admin" on public.site_content;
drop policy if exists "site_content_update_admin" on public.site_content;
drop policy if exists "site_content_delete_admin" on public.site_content;

create policy "site_content_select_public" on public.site_content
  for select to anon, authenticated using (true);

create policy "site_content_insert_admin" on public.site_content
  for insert to authenticated with check (public.app_is_admin());

create policy "site_content_update_admin" on public.site_content
  for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy "site_content_delete_admin" on public.site_content
  for delete to authenticated using (public.app_is_admin());

-- ── 3) RPC simpan konten (upsert banyak key sekaligus) ────────
create or replace function public.admin_save_content(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_upd  int := 0;
begin
  if not public.app_is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if jsonb_typeof(payload) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'payload harus array');
  end if;

  for v_item in select jsonb_array_elements(payload)
  loop
    continue when v_item->>'key' is null;
    insert into public.site_content (key, value, updated_at)
    values (v_item->>'key', coalesce(v_item->>'value', ''), now())
    on conflict (key) do update set
      value = excluded.value,
      updated_at = now();
    v_upd := v_upd + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saved', v_upd);
end;
$$;

revoke all on function public.admin_save_content(jsonb) from public, anon;
grant execute on function public.admin_save_content(jsonb) to authenticated;

-- ── 4) Seed konten default (idempotent) ────────────────────────
insert into public.site_content (key, value) values
  ('home_hero_l1a', 'Hallo!'),
  ('home_hero_l1b', 'It''s Me'),
  ('home_hero_l2a', 'Nurry Nurul'),
  ('home_hero_l2b', 'Naomi'),
  ('home_subtitle', 'Saya Naomi, siswa SMK N 1 Purbalingga. Selamat datang di portofolio saya, tempat saya membagikan berbagai proyek, pengalaman, dan perjalanan yang telah saya lalui. Jelajahi lebih lanjut untuk mengenal saya dan karya-karya yang telah saya buat. 🚀'),
  ('about_subtitle', 'Learning, building, and growing every day.'),
  ('about_bio', 'Haii, Saya Nurry Nurul Naomi, siswa Rekayasa Perangkat Lunak (RPL) di SMK N 1 Purbalingga, yang senang mempelajari teknologi, mengembangkan proyek, dan terus mencari pengalaman baru untuk meningkatkan kemampuan serta wawasan saya. Melalui berbagai kegiatan akademik maupun organisasi, saya berusaha untuk terus berkembang dan memberikan hasil terbaik dalam setiap kesempatan.')
on conflict (key) do nothing;

-- ── Verifikasi ─────────────────────────────────────────────────
-- select key, value from public.site_content order by key;