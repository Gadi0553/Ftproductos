# FT Productos · Tienda de jugos + rutas de entrega

Aplicación web en **React + TypeScript (Vite)** con base de datos **Supabase** y mapas de **Google Maps / Waze**.

## ¿Qué hace?

**Clientes**
- Se registran con nombre, apellido, teléfono, correo, nombre y descripción de su empresa, y marcan la **ubicación exacta** del negocio en el mapa (clic, buscar dirección o GPS).
- Compran en la tienda (jugos por vaso, ml, litro, galón, caja… o cualquier otro producto).
- Siguen su pedido en tiempo real: estado y bitácora de cada paso de la entrega.

**Administradores**
- Crean/editan productos con **varias imágenes**, categoría, sabor, ingredientes, vida útil y **presentaciones** (cada una con unidad de medida, cantidad, precio, stock y SKU).
- Ven todos los pedidos y un mapa con las entregas pendientes.
- Para cada pedido o cliente: **trazan la ruta más rápida** desde su ubicación actual (con tráfico en tiempo real y rutas alternativas), con indicaciones paso a paso, y botones para **abrir la navegación en Google Maps o Waze**.
- Registran **notas y pasos** de la entrega (Confirmado → Preparando → Salí → Llegué → Entregado), con su ubicación adjunta. El cliente lo ve al instante.
- Agregan clientes manualmente y asignan qué usuarios son administradores.

## Roles

| Rol | Qué puede hacer |
|---|---|
| **Administrador** | Todo: productos, pedidos, clientes, asignar repartidores, cambiar roles y **eliminar usuarios** (Panel admin › Usuarios). |
| **Delivery** | Menú **🛵 Entregas**: ve los pedidos asignados a él y los disponibles, **toma** pedidos, traza la mejor ruta (Google Maps / Waze), llama o escribe por WhatsApp al cliente y registra pasos en la bitácora (Recogiendo, En camino, Llegué, Entregado). No puede ver pedidos de otros repartidores ni cancelar pedidos. |
| **Cliente** | Compra en la tienda y sigue el estado de sus pedidos en tiempo real. |

*Crear cuenta* solo crea cuentas de **cliente**. El administrador decide quién es repartidor: en **Panel admin › Usuarios** cambia el rol de ese usuario a **Delivery** (y puede volverlo a Cliente cuando quiera).

> Para activar **Eliminar usuario**, ejecuta una vez `supabase/migration_03_admin_delete_user.sql` en el SQL Editor de Supabase.

## Puesta en marcha (una sola vez)

### 1. Base de datos (Supabase)
1. Abre tu proyecto: https://supabase.com/dashboard/project/yidysyicdzgmlvekpuoh
2. Ve a **SQL Editor → New query**, pega todo el contenido de `supabase/schema.sql` y pulsa **Run**.
   - Agrega columnas a tu tabla `clients` (user_id, email, empresa, descripcion_empresa, direccion, referencia) sin borrar datos.
   - Crea `profiles`, `products`, `product_variants`, `orders`, `order_items`, `delivery_logs`, el bucket de imágenes `productos`, la seguridad (RLS) y 2 productos de ejemplo.
   - El correo **eleazargadiel2025@gmail.com** queda como administrador automáticamente.
3. Ve a **Project Settings → API** y copia la **anon public key**.
4. Renombra `.env.example` a `.env` (o ejecuta `iniciar.bat`, que lo crea) y pega la key en `VITE_SUPABASE_ANON_KEY=`.
5. (Opcional) En **Authentication → URL Configuration** agrega `http://localhost:5173` como Site URL / Redirect URL.

### 2. Google Cloud (API key de mapas)
En https://console.cloud.google.com/apis/library habilita en el proyecto de tu key:
- **Maps JavaScript API**
- **Routes API** (rutas con tráfico y alternativas)
- **Directions API** (respaldo)
- **Geocoding API** (buscar direcciones)

> ⚠️ **Seguridad:** tu API key quedó escrita en el chat. En **APIs y servicios → Credenciales**, restríngela por
> *Referentes HTTP* (ej. `http://localhost:5173/*` y tu dominio) y limítala a las 4 APIs de arriba.

> **Sobre Waze:** Waze no ofrece una API pública de rutas con API key. La ruta se calcula con Google y el botón
> **“Abrir en Waze”** abre la navegación de Waze directo al cliente (en el celular abre la app).

### 3. Ejecutar
Requiere [Node.js 18+](https://nodejs.org).

```bash
npm install
npm run dev
```
O haz doble clic en `iniciar.bat` (Windows). Se abre en http://localhost:5173

Para producción: `npm run build` genera la carpeta `dist/` (puedes subirla a Vercel, Netlify, etc.).

> La geolocalización del navegador solo funciona en `localhost` o en sitios con **https**.

## Estructura
```
supabase/schema.sql          ← script de base de datos
src/lib/maps.ts              ← carga de Google Maps, cálculo de rutas, enlaces Google Maps/Waze
src/lib/supabase.ts          ← cliente Supabase y subida de imágenes
src/components/RoutePanel.tsx← mapa con mejor ruta, alternativas y pasos
src/components/LocationPicker.tsx ← selector de ubicación de la empresa
src/pages/                   ← tienda, carrito, registro, perfil, mis pedidos
src/pages/admin/             ← panel: resumen, productos, pedidos/entregas, clientes, usuarios
```
