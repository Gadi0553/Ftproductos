-- =====================================================================
--  FT PRODUCTOS · Migración 03
--  Permite al ADMINISTRADOR eliminar usuarios (clientes o repartidores)
--  desde Panel admin › Usuarios. Conserva el historial de pedidos.
--
--  ▶ Ejecútalo en Supabase › SQL Editor › New query › Run
-- =====================================================================
create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede eliminar usuarios'; end if;
  if p_user = auth.uid() then raise exception 'No puedes eliminar tu propia cuenta'; end if;
  delete from public.clients where user_id = p_user;
  update public.orders set user_id = null where user_id = p_user;
  update public.orders set asignado_a = null where asignado_a = p_user;
  update public.delivery_logs set autor_id = null where autor_id = p_user;
  delete from auth.users where id = p_user;   -- su perfil se borra en cascada
end; $$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
