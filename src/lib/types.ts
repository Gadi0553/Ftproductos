export type Role = 'admin' | 'cliente' | 'delivery'

export const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: 'cliente', label: 'Cliente', desc: 'Compra en la tienda y sigue sus pedidos' },
  { value: 'delivery', label: 'Delivery', desc: 'Toma pedidos, traza rutas y registra la entrega' },
  { value: 'admin', label: 'Administrador', desc: 'Acceso total: productos, pedidos, clientes y usuarios' },
]

export interface Profile {
  id: string
  email: string | null
  nombre: string | null
  role: Role
  created_at: string
}

export type ClientTipo = 'basico' | 'empresa'

export interface Client {
  id: number | string
  tipo?: ClientTipo
  user_id: string | null
  nombre: string
  apellido: string
  numero: string
  email: string | null
  empresa: string | null
  descripcion_empresa: string | null
  local: string | null
  direccion: string | null
  referencia: string | null
  latitude: number
  longitude: number
  created_at: string
}

export type Unidad =
  | 'unidad' | 'ml' | 'litro' | 'galon' | 'onza' | 'vaso' | 'botella' | 'caja' | 'paquete' | 'docena'
  | 'kg' | 'lb' | 'lata' | 'funda' | 'sobre' | 'rollo' | 'saco' | 'carton' | 'pote' | 'frasco'
  | 'barra' | 'mazo' | 'media_libra' | 'cuarto_libra' | 'gramo' | 'six_pack' | 'jumbo'

export const UNIDADES: { value: Unidad; label: string }[] = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'lb', label: 'Libra (lb)' },
  { value: 'media_libra', label: 'Media libra' },
  { value: 'cuarto_libra', label: 'Cuarto de libra' },
  { value: 'onza', label: 'Onzas (oz)' },
  { value: 'gramo', label: 'Gramos (g)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'litro', label: 'Litro(s)' },
  { value: 'galon', label: 'Galón(es)' },
  { value: 'botella', label: 'Botella' },
  { value: 'jumbo', label: 'Jumbo / Grande' },
  { value: 'lata', label: 'Lata' },
  { value: 'six_pack', label: 'Six pack' },
  { value: 'vaso', label: 'Vaso' },
  { value: 'funda', label: 'Funda' },
  { value: 'sobre', label: 'Sobre / Sobrecito' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'caja', label: 'Caja' },
  { value: 'docena', label: 'Docena' },
  { value: 'carton', label: 'Cartón (huevos)' },
  { value: 'rollo', label: 'Rollo' },
  { value: 'pote', label: 'Pote' },
  { value: 'frasco', label: 'Frasco' },
  { value: 'barra', label: 'Barra' },
  { value: 'mazo', label: 'Mazo' },
  { value: 'saco', label: 'Saco' },
]

export interface Categoria {
  id: string
  nombre: string
  icono: string
  descripcion: string | null
  orden: number
  activo: boolean
}

export const CATEGORIAS = ['Jugos', 'Batidos', 'Limonadas', 'Agua', 'Refrescos', 'Snacks', 'Combos', 'Otros']

export interface Variant {
  id: string
  product_id: string
  nombre: string
  unidad_medida: Unidad
  cantidad: number
  precio: number
  stock: number
  sku: string | null
  activo: boolean
}

export interface Product {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string
  sabor: string | null
  marca: string | null
  ingredientes: string | null
  es_natural: boolean
  sin_azucar: boolean
  requiere_refrigeracion: boolean
  vida_util_dias: number | null
  imagenes: string[]
  destacado: boolean
  activo: boolean
  created_at: string
  product_variants?: Variant[]
}

export type OrderStatus = 'pendiente' | 'confirmado' | 'preparando' | 'en_camino' | 'entregado' | 'cancelado'

export const ESTADOS: { value: OrderStatus; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'preparando', label: 'Preparando' },
  { value: 'en_camino', label: 'En camino' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
]

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  variant_id: string | null
  nombre: string
  presentacion: string | null
  precio_unitario: number
  cantidad: number
  subtotal: number
}

export interface Order {
  id: string
  numero: number
  user_id: string
  estado: OrderStatus
  total: number
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta'
  notas_cliente: string | null
  cliente_nombre: string | null
  cliente_telefono: string | null
  empresa: string | null
  direccion: string | null
  latitude: number | null
  longitude: number | null
  asignado_a: string | null
  zona: string | null
  comprobante_path?: string | null
  comprobante_at?: string | null
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
}

export interface DeliveryLog {
  id: string
  order_id: string
  autor_id: string | null
  autor: string | null
  estado: OrderStatus | null
  nota: string
  latitude: number | null
  longitude: number | null
  created_at: string
}

export interface LatLng {
  lat: number
  lng: number
}

export interface Zona {
  id: string
  nombre: string
  provincia: string | null
  latitude: number
  longitude: number
  radio_km: number
  activo: boolean
  created_at: string
}
