-- =====================================================================
--  FT PRODUCTOS · Migración 02
--  - Tres roles: admin, cliente, delivery (repartidor)
--  - Permisos del repartidor (ver/tomar pedidos, ruta, bitácora, cambiar estado)
--  (La función para eliminar usuarios está en migration_03_admin_delete_user.sql)
--  Idempotente. Ya aplicada en el proyecto; se guarda como referencia.
-- =====================================================================

-- 1) Roles ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','cliente','delivery'));

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_delivery()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'delivery') $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','delivery')) $$;

-- 2) Índices / ajustes
alter table public.orders alter column user_id drop not null;
create index if not exists orders_asignado_idx on public.orders(asignado_a);

-- 3) Qué pedidos puede ver un repartidor --------------------------------
--    Los asignados a él + los activos sin asignar (para poder tomarlos)
create or replace function public.delivery_can_see(o public.orders)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_delivery() and (
    o.asignado_a = auth.uid()
    or (o.asignado_a is null and o.estado in ('pendiente','confirmado','preparando','en_camino'))
  )
$$;

alter policy "orders_select" on public.orders using (
  user_id = auth.uid() or public.is_admin()
  or (public.is_delivery() and (asignado_a = auth.uid()
      or (asignado_a is null and estado in ('pendiente','confirmado','preparando','en_camino'))))
);

alter policy "order_items_select" on public.order_items using (
  exists (select 1 from public.orders o where o.id = order_id
          and (o.user_id = auth.uid() or public.is_admin() or public.delivery_can_see(o))));

alter policy "logs_select" on public.delivery_logs using (
  exists (select 1 from public.orders o where o.id = order_id
          and (o.user_id = auth.uid() or public.is_admin() or public.delivery_can_see(o))));

-- 4) Acciones del repartidor (funciones seguras) -------------------------

-- Tomar un pedido sin asignar
create or replace function public.take_order(p_order uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare n text;
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
  update public.orders set asignado_a = auth.uid()
   where id = p_order and asignado_a is null and estado not in ('entregado','cancelado');
  if not found then raise exception 'Este pedido ya fue tomado por otro repartidor o no está disponible'; end if;
  select coalesce(nullif(nombre,''), email) into n from public.profiles where id = auth.uid();
  insert into public.delivery_logs (order_id, autor_id, autor, estado, nota)
  select p_order, auth.uid(), n, estado, 'Pedido asignado al repartidor ' || coalesce(n,'') from public.orders where id = p_order;
end; $$;

-- Liberar un pedido (el repartidor lo devuelve)
create or replace function public.release_order(p_order uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare n text;
begin
  if not (public.is_admin() or exists (select 1 from public.orders where id = p_order and asignado_a = auth.uid())) then
    raise exception 'No autorizado';
  end if;
  update public.orders set asignado_a = null where id = p_order and estado <> 'entregado';
  select coalesce(nullif(nombre,''), email) into n from public.profiles where id = auth.uid();
  insert into public.delivery_logs (order_id, autor_id, autor, estado, nota)
  select p_order, auth.uid(), n, estado, 'Pedido liberado, queda disponible para otro repartidor' from public.orders where id = p_order;
end; $$;

-- Registrar un paso en la bitácora (y opcionalmente cambiar el estado)
-- Admin: cualquier pedido y cualquier estado.
-- Delivery: solo pedidos asignados a él; estados permitidos: preparando, en_camino, entregado.
create or replace function public.add_delivery_log(
  p_order uuid, p_nota text, p_estado text default null,
  p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  o public.orders%rowtype;
  n text;
  admin boolean := public.is_admin();
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'Pedido no encontrado'; end if;

  if not admin then
    if not public.is_delivery() or o.asignado_a is distinct from auth.uid() then
      raise exception 'Solo el repartidor asignado puede actualizar este pedido';
    end if;
    if p_estado is not null and p_estado not in ('preparando','en_camino','entregado') then
      raise exception 'El repartidor solo puede marcar: preparando, en camino o entregado';
    end if;
    if o.estado in ('entregado','cancelado') and p_estado is not null and p_estado <> o.estado then
      raise exception 'El pedido ya está cerrado';
    end if;
  end if;

  if coalesce(trim(p_nota),'') = '' then raise exception 'Escribe una nota'; end if;

  if p_estado is not null and p_estado <> o.estado then
    update public.orders set estado = p_estado where id = p_order;
  end if;

  select coalesce(nullif(nombre,''), email) into n from public.profiles where id = auth.uid();
  insert into public.delivery_logs (order_id, autor_id, autor, estado, nota, latitude, longitude)
  values (p_order, auth.uid(), coalesce(n, 'Equipo'), coalesce(p_estado, o.estado), trim(p_nota), p_lat, p_lng);
end; $$;

-- Permisos de ejecución
revoke all on function public.take_order(uuid) from public, anon;
revoke all on function public.release_order(uuid) from public, anon;
revoke all on function public.add_delivery_log(uuid, text, text, double precision, double precision) from public, anon;
grant execute on function public.take_order(uuid) to authenticated;
grant execute on function public.release_order(uuid) to authenticated;
grant execute on function public.add_delivery_log(uuid, text, text, double precision, double precision) to authenticated;

-- Endurecimiento (recomendaciones del asesor de seguridad de Supabase)
revoke execute on function public.create_order(jsonb, text, text) from public, anon;
grant execute on function public.create_order(jsonb, text, text) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;
alter function public.touch_updated_at() set search_path = public;
