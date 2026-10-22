-- ============================================================
-- Migrasi: tambah kolom `featured` (pilihan manual project di Home)
--
-- Jalankan di Supabase SQL Editor:
--   Project Settings -> SQL Editor -> New query -> paste file ini -> Run
--
-- Syarat: database sudah punya tabel `projects` dan fungsi
--         `app_is_admin()` — artinya `schema.sql` + `fix_admin.sql`
--         sudah pernah dijalankan. Untuk database yang benar-benar baru,
--         jalankan `schema.sql` lalu `fix_admin.sql` lebih dulu.
--
-- Aman dijalankan berulang (idempotent):
--   - Kolom sudah ada  -> dilewati, tidak error.
--   - Kolom belum ada  -> dibuat, lalu RPC admin_save_projects
--                         diperbarui supaya ikut menyimpan featured.
--
-- Catatan: kolom ini default false, jadi project yang sudah ada TIDAK
-- otomatis jadi featured. Section Featured Work di Home akan pakai
-- fallback lama sampai ada project yang dicentang dari dashboard admin.
-- ============================================================

-- ── 1) Tambah kolom featured (kalau belum ada) ───────────────
alter table public.projects
  add column if not exists featured boolean not null default false;

-- ── 2) Perbarui RPC admin_save_projects ──────────────────────
-- Fungsi ini yang dipakai frontend untuk menyimpan project.
-- Tanpa bagian featured di sini, centang "Tampilkan di Home" akan
-- hilang setiap kali disimpan.
create or replace function public.admin_save_projects(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ins int := 0;
  v_upd int := 0;
  v_created boolean;
  v_item jsonb;
  v_error text;
begin
  -- Hanya admin yang boleh menulis.
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
        -- Parse longgar: apa pun selain string "true" dianggap false,
        -- supaya payload lama / nilai rusak tidak bikin save error.
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
