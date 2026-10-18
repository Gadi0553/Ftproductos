-- =====================================================================
-- FT PRODUCTOS · Migración 06: comprobante de pago (transferencias)
-- El cliente sube una captura de la transferencia; se ve en el pedido,
-- en el panel del admin / delivery y en la factura.
-- =====================================================================

alter table public.orders add column if not exists comprobante_path text;
alter table public.orders add column if not exists comprobante_at timestamptz;

-- Bucket PRIVADO (los comprobantes tienen datos bancarios): solo se ven con URL firmada
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 6291456,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Cada cliente sube solo dentro de su carpeta:  comprobantes/<su uid>/archivo
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='comprobantes_insert_own') then
    create policy comprobantes_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='comprobantes_select') then
    create policy comprobantes_select on storage.objects for select to authenticated
      using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
  end if;
end $$;

-- Asociar el comprobante a un pedido (solo el dueño del pedido o el admin)
create or replace function public.set_order_comprobante(p_order uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if o.user_id <> auth.uid() and not public.is_admin() then raise exception 'No autorizado'; end if;
  if split_part(p_path, '/', 1) <> o.user_id::text then raise exception 'Archivo no válido'; end if;
  if o.estado in ('entregado','cancelado') and not public.is_admin() then
    raise exception 'El pedido ya está cerrado';
  end if;

  update public.orders set comprobante_path = p_path, comprobante_at = now(), updated_at = now()
   where id = p_order;

  insert into public.delivery_logs (order_id, autor_id, autor, estado, nota)
  values (p_order, auth.uid(),
          coalesce(o.cliente_nombre, (select nullif(trim(coalesce(nombre,'')), '') from public.profiles where id = auth.uid()), 'Cliente'),
          null,
          case when o.comprobante_path is null then '🧾 El cliente subió el comprobante de la transferencia'
               else '🧾 El cliente reemplazó el comprobante de la transferencia' end);
end $$;

grant execute on function public.set_order_comprobante(uuid, text) to authenticated;
