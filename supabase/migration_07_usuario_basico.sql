-- =====================================================================
-- FT PRODUCTOS · Migración 07: tipo de cliente (usuario básico / empresa)
-- "basico"  → persona sin negocio: solo datos personales + lugar de entrega
-- "empresa" → todo lo anterior + nombre y descripción de la empresa
-- =====================================================================

alter table public.clients add column if not exists tipo text not null default 'empresa';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clients_tipo_check') then
    alter table public.clients add constraint clients_tipo_check check (tipo in ('basico','empresa'));
  end if;
end $$;

-- El registro guarda el tipo elegido (por defecto "empresa", como hasta ahora)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_tipo text := case when m->>'tipo' = 'basico' then 'basico' else 'empresa' end;
  v_emp  text := case when v_tipo = 'basico' then null else nullif(trim(coalesce(m->>'empresa','')), '') end;
begin
  insert into public.profiles (id, email, nombre, role)
  values (
    new.id, new.email,
    trim(coalesce(m->>'nombre','') || ' ' || coalesce(m->>'apellido','')),
    case when lower(new.email) in ('eleazargadiel2025@gmail.com') then 'admin' else 'cliente' end
  )
  on conflict (id) do nothing;

  if (m ? 'latitude') and (m ? 'longitude') and coalesce(m->>'nombre','') <> '' then
    begin
      insert into public.clients (user_id, tipo, nombre, apellido, numero, email, empresa, descripcion_empresa,
                                  local, direccion, referencia, latitude, longitude)
      values (new.id, v_tipo, m->>'nombre', coalesce(m->>'apellido',''), coalesce(m->>'numero',''), new.email,
              v_emp, case when v_tipo = 'basico' then null else m->>'descripcion_empresa' end, v_emp,
              m->>'direccion', m->>'referencia',
              (m->>'latitude')::double precision, (m->>'longitude')::double precision);
    exception when others then
      raise warning 'No se pudo crear la ficha de cliente: %', sqlerrm;
    end;
  end if;
  return new;
end $$;
