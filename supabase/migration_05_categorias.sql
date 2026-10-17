-- =====================================================================
--  FT PRODUCTOS · Migración 05 · Categorías de colmado (ya aplicada)
--  - Tabla "categorias" editable por el administrador (nombre, ícono, orden, visible)
--  - Columna "marca" en productos
--  - Más unidades de medida típicas de colmado (libra, ½ libra, funda, sobre, lata, six pack, cartón…)
--  Se cargaron 28 categorías: Jugos, Bebidas y refrescos, Agua y hielo, Cervezas, Rones y licores,
--  Arroz/granos/habichuelas, Aceites, Azúcar/sal/condimentos, Enlatados, Pastas y harinas, Embutidos,
--  Lácteos y huevos, Panadería, Víveres, Frutas y vegetales, Carnes y pollo, Café/desayuno, Snacks y dulces,
--  Limpieza del hogar, Cuidado personal, Papel y desechables, Bebé, Mascotas, Farmacia básica,
--  Cigarrillos, Gas/carbón/fósforos, Recargas y servicios, Otros.
-- =====================================================================
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  icono text not null default '📦',
  descripcion text,
  orden integer not null default 100,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.categorias enable row level security;
-- políticas: lectura pública ("categorias_select"), escritura solo admin ("categorias_admin")
alter table public.products add column if not exists marca text;
alter table public.product_variants add constraint product_variants_unidad_medida_check check (unidad_medida in
 ('unidad','ml','litro','galon','onza','vaso','botella','caja','paquete','docena','kg','lb',
  'lata','funda','sobre','rollo','saco','carton','pote','frasco','barra','mazo','media_libra','cuarto_libra','gramo','six_pack','jumbo'));
