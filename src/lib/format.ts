import { ESTADOS, OrderStatus, UNIDADES, Unidad } from './types'

const money = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })
export const fmtMoney = (n: number | null | undefined) => money.format(Number(n || 0))

export const fmtDate = (s: string) =>
  new Date(s).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })

export const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)

export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export const estadoLabel = (e: OrderStatus | null | undefined) =>
  ESTADOS.find((x) => x.value === e)?.label ?? e ?? ''

export const unidadLabel = (u: Unidad) => UNIDADES.find((x) => x.value === u)?.label ?? u

export function presentacionTexto(unidad: Unidad, cantidad: number) {
  const c = Number(cantidad)
  switch (unidad) {
    case 'ml': return `${c} ml`
    case 'litro': return `${c} ${c === 1 ? 'litro' : 'litros'}`
    case 'galon': return `${c} ${c === 1 ? 'galón' : 'galones'}`
    case 'onza': return `${c} oz`
    case 'caja': return `Caja de ${c}`
    case 'paquete': return `Paquete de ${c}`
    case 'docena': return `${c} ${c === 1 ? 'docena' : 'docenas'}`
    case 'kg': return `${c} kg`
    case 'lb': return `${c} ${c === 1 ? 'libra' : 'libras'}`
    case 'media_libra': return `${c === 1 ? '' : c + ' × '}½ libra`
    case 'cuarto_libra': return `${c === 1 ? '' : c + ' × '}¼ libra`
    case 'gramo': return `${c} g`
    case 'lata': return `${c === 1 ? '1 lata' : c + ' latas'}`
    case 'six_pack': return `Six pack (${c * 6} unidades)`
    case 'funda': return `Funda${c !== 1 ? ' de ' + c : ''}`
    case 'sobre': return `${c === 1 ? 'Sobre' : c + ' sobres'}`
    case 'carton': return `Cartón de ${c}`
    case 'rollo': return `${c === 1 ? '1 rollo' : c + ' rollos'}`
    case 'saco': return `Saco${c !== 1 ? ' de ' + c : ''}`
    default: return `${c} ${unidadLabel(unidad).toLowerCase()}`
  }
}

/** Nombre a mostrar del destino: la empresa, o el nombre de la persona si es usuario básico. */
export const destinatario = (o: { empresa?: string | null; cliente_nombre?: string | null }) =>
  (o.empresa && o.empresa.trim()) || (o.cliente_nombre && o.cliente_nombre.trim()) || 'Cliente'

/** Nombre a mostrar de un cliente (empresa o persona). */
export const nombreCliente = (c: { empresa?: string | null; local?: string | null; nombre?: string | null; apellido?: string | null }) =>
  (c.empresa && c.empresa.trim()) || (c.local && c.local.trim()) || `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() || 'Cliente'
