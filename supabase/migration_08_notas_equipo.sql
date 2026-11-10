-- =====================================================================
-- FT PRODUCTOS · Migración 08: Notas del equipo (chat admin ↔ delivery)
-- Solo el personal (admin y delivery) puede leer y escribir.
-- =====================================================================

create table if not exists public.staff_notes (
  id          uuid primary key default gen_random_uuid(),
  autor_id    uuid default auth.uid() references auth.users(id) on delete set null,
  autor       text,
  rol         text,
  mensaje     text not null check (char_length(trim(mensaje)) between 1 and 2000),
  pedido_numero integer,
  created_at  timestamptz not null default now()
);

create index if not exists staff_notes_created_idx on public.staff_notes (created_at desc);

alter table public.staff_notes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='staff_notes' and policyname='staff_notes_select') then
    create policy staff_notes_select on public.staff_notes for select to authenticated using (public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename='staff_notes' and policyname='staff_notes_insert') then
    create policy staff_notes_insert on public.staff_notes for insert to authenticated
      with check (public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename='staff_notes' and policyname='staff_notes_delete') then
    create policy staff_notes_delete on public.staff_notes for delete to authenticated
      using (autor_id = auth.uid() or public.is_admin());
  end if;
end $$;

-- Nombre y rol del autor los pone la base de datos (no se pueden falsificar)
create or replace function public.staff_notes_set_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.autor_id := auth.uid();
  select coalesce(nullif(trim(p.nombre), ''), p.email), p.role into new.autor, new.rol
    from public.profiles p where p.id = auth.uid();
  new.mensaje := trim(new.mensaje);
  new.created_at := now();
  return new;
end $$;

create or replace trigger staff_notes_autor before insert on public.staff_notes
  for each row execute function public.staff_notes_set_autor();

-- Tiempo real
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='staff_notes') then
    alter publication supabase_realtime add table public.staff_notes;
  end if;
end $$;
