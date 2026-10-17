-- =====================================================================
--  FT PRODUCTOS · Esquema completo para Supabase
--  Ejecuta TODO este archivo en: Supabase Dashboard > SQL Editor > New query
--  Es idempotente: se puede ejecutar varias veces sin romper nada.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1) PERFILES Y ROLES (admin / cliente)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  nombre      text,
  role        text not null default 'cliente' check (role in ('admin','cliente','delivery')),
  created_at  timestamptz not null default now()
);

-- ¿El usuario actual es admin?  (security definer evita recursión en RLS)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 2) CLIENTES (tabla existente: se agregan columnas)
--    columnas existentes: id, nombre, apellido, numero, local, latitude, longitude, created_at
-- ---------------------------------------------------------------------
alter table public.clients add column if not exists user_id      uuid references auth.users(id) on delete set null;
alter table public.clients add column if not exists email        text;
alter table public.clients add column if not exists empresa      text;
alter table public.clients add column if not exists descripcion_empresa text;
alter table public.clients add column if not exists direccion    text;
alter table public.clients add column if not exists referencia   text;
alter table public.clients add column if not exists updated_at   timestamptz default now();

create unique index if not exists clients_user_id_key on public.clients(user_id) where user_id is not null;

-- ---------------------------------------------------------------------
-- 3) PRODUCTOS + PRESENTACIONES (unidad, litro, galón, etc.)
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id                      uuid primary key default gen_random_uuid(),
  nombre                  text not null,
  descripcion             text,
  categoria               text not null default 'Jugos',
  sabor                   text,
  ingredientes            text,
  es_natural              boolean not null default true,
  sin_azucar              boolean not null default false,
  requiere_refrigeracion  boolean not null default true,
  vida_util_dias          integer,
  imagenes                text[] not null default '{}',
  destacado               boolean not null default false,
  activo                  boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  nombre        text not null,                       -- ej. "Botella 500 ml", "Galón"
  unidad_medida text not null default 'unidad'
                check (unidad_medida in ('unidad','ml','litro','galon','onza','vaso','botella','caja','paquete','docena','kg','lb')),
  cantidad      numeric(10,2) not null default 1,    -- ej. 0.5 (litro), 1 (galón), 12 (unidades por caja)
  precio        numeric(12,2) not null check (precio >= 0),
  stock         integer not null default 0 check (stock >= 0),
  sku           text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists product_variants_product_idx on public.product_variants(product_id);

-- ---------------------------------------------------------------------
-- 4) PEDIDOS
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity,
  user_id          uuid not null references auth.users(id) on delete cascade,
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente','confirmado','preparando','en_camino','entregado','cancelado')),
  total            numeric(12,2) not null default 0,
  metodo_pago      text not null default 'efectivo' check (metodo_pago in ('efectivo','transferencia','tarjeta')),
  notas_cliente    text,
  -- copia de los datos de entrega al momento de comprar
  cliente_nombre   text,
  cliente_telefono text,
  empresa          text,
  direccion        text,
  latitude         double precision,
  longitude        double precision,
  asignado_a       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id);

create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  variant_id      uuid references public.product_variants(id) on delete set null,
  nombre          text not null,
  presentacion    text,
  precio_unitario numeric(12,2) not null,
  cantidad        integer not null check (cantidad > 0),
  subtotal        numeric(12,2) not null
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- Bitácora de entrega: cada paso con notas y ubicación
create table if not exists public.delivery_logs (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  autor_id    uuid references auth.users(id),
  autor       text,
  estado      text,
  nota        text not null,
  latitude    double precision,
  longitude   double precision,
  created_at  timestamptz not null default now()
);
create index if not exists delivery_logs_order_idx on public.delivery_logs(order_id);

-- ---------------------------------------------------------------------
-- 5) TRIGGER: al registrarse un usuario se crea su perfil y su ficha de cliente
--    El correo del dueño queda como ADMIN automáticamente.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
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
      insert into public.clients (user_id, nombre, apellido, numero, email, empresa, descripcion_empresa,
                                  local, direccion, referencia, latitude, longitude)
      values (new.id, m->>'nombre', coalesce(m->>'apellido',''), coalesce(m->>'numero',''), new.email,
              m->>'empresa', m->>'descripcion_empresa', m->>'empresa', m->>'direccion', m->>'referencia',
              (m->>'latitude')::double precision, (m->>'longitude')::double precision);
    exception when others then
      -- no bloquear el registro: el cliente podrá completar su perfil luego
      raise warning 'No se pudo crear la ficha de cliente: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para usuarios que ya existían antes de este script
insert into public.profiles (id, email, role)
select u.id, u.email,
       case when lower(u.email) = 'eleazargadiel2025@gmail.com' then 'admin' else 'cliente' end
from auth.users u
on conflict (id) do nothing;
update public.profiles set role = 'admin' where lower(email) = 'eleazargadiel2025@gmail.com';

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 6) RPC: crear pedido de forma segura (precios y stock calculados en el servidor)
--    items = [{ "variant_id": "...", "cantidad": 2 }, ...]
-- ---------------------------------------------------------------------
create or replace function public.create_order(items jsonb, notas text default null, metodo text default 'efectivo')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  c        public.clients%rowtype;
  v_order  uuid;
  it       jsonb;
  v        record;
  qty      integer;
  v_total  numeric(12,2) := 0;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;

  select * into c from public.clients where user_id = auth.uid() limit 1;
  if not found then raise exception 'Completa tu perfil y la ubicación de tu empresa antes de comprar'; end if;
  if jsonb_array_length(coalesce(items,'[]'::jsonb)) = 0 then raise exception 'El carrito está vacío'; end if;

  insert into public.orders (user_id, notas_cliente, metodo_pago, cliente_nombre, cliente_telefono, empresa,
                             direccion, latitude, longitude)
  values (auth.uid(), notas, coalesce(metodo,'efectivo'), trim(c.nombre || ' ' || coalesce(c.apellido,'')), c.numero,
          coalesce(c.empresa, c.local), c.direccion, c.latitude, c.longitude)
  returning id into v_order;

  for it in select * from jsonb_array_elements(items) loop
    qty := (it->>'cantidad')::integer;
    if qty is null or qty <= 0 then raise exception 'Cantidad inválida'; end if;

    select pv.id, pv.nombre as pres, pv.precio, pv.stock, p.id as pid, p.nombre
      into v
      from public.product_variants pv join public.products p on p.id = pv.product_id
     where pv.id = (it->>'variant_id')::uuid and pv.activo and p.activo
     for update of pv;
    if not found then raise exception 'Producto no disponible'; end if;
    if v.stock < qty then raise exception 'Stock insuficiente para % (%)', v.nombre, v.pres; end if;

    update public.product_variants set stock = stock - qty where id = v.id;
    insert into public.order_items (order_id, product_id, variant_id, nombre, presentacion, precio_unitario, cantidad, subtotal)
    values (v_order, v.pid, v.id, v.nombre, v.pres, v.precio, qty, v.precio * qty);
    v_total := v_total + v.precio * qty;
  end loop;

  update public.orders set total = v_total where id = v_order;
  insert into public.delivery_logs (order_id, autor_id, autor, estado, nota)
  values (v_order, auth.uid(), 'Cliente', 'pendiente', 'Pedido realizado por el cliente');
  return v_order;
end;
$$;
grant execute on function public.create_order(jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7) SEGURIDAD (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.clients          enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.delivery_logs    enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- clients
drop policy if exists "clients_select" on public.clients;
create policy "clients_select" on public.clients for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "clients_insert" on public.clients;
create policy "clients_insert" on public.clients for insert with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "clients_update" on public.clients;
create policy "clients_update" on public.clients for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "clients_delete" on public.clients;
create policy "clients_delete" on public.clients for delete using (public.is_admin());

-- products / variants: todos ven lo activo; admin gestiona todo
drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products for select using (activo or public.is_admin());
drop policy if exists "products_admin" on public.products;
create policy "products_admin" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "variants_select" on public.product_variants;
create policy "variants_select" on public.product_variants for select using (activo or public.is_admin());
drop policy if exists "variants_admin" on public.product_variants;
create policy "variants_admin" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

-- orders (se crean solo vía create_order)
drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete" on public.orders for delete using (public.is_admin());

drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists "logs_select" on public.delivery_logs;
create policy "logs_select" on public.delivery_logs for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
drop policy if exists "logs_admin_insert" on public.delivery_logs;
create policy "logs_admin_insert" on public.delivery_logs for insert with check (public.is_admin());
drop policy if exists "logs_admin_delete" on public.delivery_logs;
create policy "logs_admin_delete" on public.delivery_logs for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8) STORAGE: bucket público para imágenes de productos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists "productos_public_read" on storage.objects;
create policy "productos_public_read" on storage.objects for select using (bucket_id = 'productos');
drop policy if exists "productos_admin_insert" on storage.objects;
create policy "productos_admin_insert" on storage.objects for insert with check (bucket_id = 'productos' and public.is_admin());
drop policy if exists "productos_admin_update" on storage.objects;
create policy "productos_admin_update" on storage.objects for update using (bucket_id = 'productos' and public.is_admin());
drop policy if exists "productos_admin_delete" on storage.objects;
create policy "productos_admin_delete" on storage.objects for delete using (bucket_id = 'productos' and public.is_admin());

-- ---------------------------------------------------------------------
-- 9) Tiempo real para que el cliente vea el avance de su pedido
-- ---------------------------------------------------------------------
do $$ begin
  begin alter publication supabase_realtime add table public.orders;        exception when others then null; end;
  begin alter publication supabase_realtime add table public.delivery_logs; exception when others then null; end;
end $$;

-- ---------------------------------------------------------------------
-- 10) Productos de ejemplo (solo si la tabla está vacía)
-- ---------------------------------------------------------------------
do $$
declare p uuid;
begin
  if not exists (select 1 from public.products) then
    insert into public.products (nombre, descripcion, categoria, sabor, ingredientes, destacado)
    values ('Jugo de Chinola', 'Jugo natural de chinola recién exprimido.', 'Jugos', 'Chinola', 'Chinola, agua, azúcar de caña', true)
    returning id into p;
    insert into public.product_variants (product_id, nombre, unidad_medida, cantidad, precio, stock) values
      (p, 'Botella 500 ml', 'ml', 500, 75, 100),
      (p, 'Litro', 'litro', 1, 140, 60),
      (p, 'Galón', 'galon', 1, 450, 20);

    insert into public.products (nombre, descripcion, categoria, sabor, ingredientes, sin_azucar, destacado)
    values ('Jugo de Naranja', '100% naranja, sin azúcar añadida.', 'Jugos', 'Naranja', 'Naranja', true, true)
    returning id into p;
    insert into public.product_variants (product_id, nombre, unidad_medida, cantidad, precio, stock) values
      (p, 'Botella 500 ml', 'ml', 500, 85, 100),
      (p, 'Litro', 'litro', 1, 160, 50),
      (p, 'Galón', 'galon', 1, 520, 15),
      (p, 'Caja 12 botellas 500 ml', 'caja', 12, 950, 10);
  end if;
end $$;
