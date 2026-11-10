-- =====================================================================
-- FT PRODUCTOS · Migración 09: Notas del equipo divididas por delivery
-- Cada conversación es entre el administrador y UN delivery.
--   · El admin ve todas las conversaciones.
--   · Cada delivery ve solo la suya.
-- =====================================================================

alter table public.staff_notes add column if not exists delivery_id uuid references auth.users(id) on delete cascade;
create index if not exists staff_notes_delivery_idx on public.staff_notes (delivery_id, created_at desc);

alter policy staff_notes_select on public.staff_notes
  using (public.is_admin() or (public.is_delivery() and delivery_id = auth.uid()));

alter policy staff_notes_insert on public.staff_notes
  with check (
    delivery_id is not null and (
      (public.is_admin() and exists (select 1 from public.profiles p where p.id = delivery_id and p.role = 'delivery'))
      or (public.is_delivery() and delivery_id = auth.uid())
    )
  );

-- El autor lo pone la base de datos; un delivery siempre escribe en su propia conversación
create or replace function public.staff_notes_set_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.autor_id := auth.uid();
  select coalesce(nullif(trim(p.nombre), ''), p.email), p.role into new.autor, new.rol
    from public.profiles p where p.id = auth.uid();
  if new.rol = 'delivery' then new.delivery_id := auth.uid(); end if;
  new.mensaje := trim(new.mensaje);
  new.created_at := now();
  return new;
end $$;
