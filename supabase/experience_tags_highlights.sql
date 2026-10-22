-- Persist admin-entered Experience tags and highlights.
-- Safe to run repeatedly in the Supabase SQL Editor.
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
