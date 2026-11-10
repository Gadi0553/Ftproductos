-- =====================================================================
-- FT PRODUCTOS · Migración 10: Chat general del equipo
-- Notas con delivery_id NULL = chat general (admin + todos los delivery).
-- Las notas con delivery_id siguen siendo privadas (admin ↔ ese delivery).
-- =====================================================================

alter policy staff_notes_select on public.staff_notes
  using (
    public.is_admin()
    or (public.is_delivery() and (delivery_id is null or delivery_id = auth.uid()))
  );

alter policy staff_notes_insert on public.staff_notes
  with check (
    (delivery_id is null and public.is_staff())
    or (public.is_admin() and exists (select 1 from public.profiles p where p.id = delivery_id and p.role = 'delivery'))
    or (public.is_delivery() and delivery_id = auth.uid())
  );

-- Un delivery escribe en el general o en SU conversación privada (nunca en la de otro)
create or replace function public.staff_notes_set_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.autor_id := auth.uid();
  select coalesce(nullif(trim(p.nombre), ''), p.email), p.role into new.autor, new.rol
    from public.profiles p where p.id = auth.uid();
  if new.rol = 'delivery' and new.delivery_id is not null then new.delivery_id := auth.uid(); end if;
  new.mensaje := trim(new.mensaje);
  new.created_at := now();
  return new;
end $$;
