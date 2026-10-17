-- =====================================================================
--  FT PRODUCTOS · Migración 04 · Zonas de venta y entrega (ya aplicada)
--  El administrador habilita pueblos/zonas (círculo: centro + radio km).
--  Solo se puede comprar si la empresa del cliente está dentro de una zona activa.
-- =====================================================================
create table if not exists public.zonas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  provincia text,
  latitude double precision not null,
  longitude double precision not null,
  radio_km numeric(6,2) not null default 5 check (radio_km > 0 and radio_km <= 100),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.zonas enable row level security;
-- políticas: lectura pública; escritura solo admin
--   create policy "zonas_select" on public.zonas for select using (true);
--   create policy "zonas_admin"  on public.zonas for all using (public.is_admin()) with check (public.is_admin());

alter table public.orders add column if not exists zona text;

create or replace function public.distancia_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = public
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function public.zona_para(p_lat double precision, p_lng double precision)
returns text language sql stable security definer set search_path = public
as $$
  select z.nombre from public.zonas z
   where z.activo and public.distancia_km(p_lat, p_lng, z.latitude, z.longitude) <= z.radio_km
   order by public.distancia_km(p_lat, p_lng, z.latitude, z.longitude) limit 1
$$;

insert into public.zonas (nombre, provincia, latitude, longitude, radio_km, activo)
select 'Hato Mayor del Rey', 'Hato Mayor', 18.7631, -69.2567, 6, true
where not exists (select 1 from public.zonas where nombre = 'Hato Mayor del Rey');

-- create_order ahora valida la zona (ver definición aplicada en el proyecto):
--   v_zona := public.zona_para(c.latitude, c.longitude);
--   if v_zona is null then raise exception 'Por ahora no hacemos entregas en la ubicación de tu empresa...'
