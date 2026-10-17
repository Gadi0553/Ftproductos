import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { nombresZonas, zonaPara } from '../lib/zonas'
import type { LatLng, Zona } from '../lib/types'

/** Indica si una ubicación está dentro de las zonas de entrega activas. */
export default function ZoneNotice({ pos, zonas, compact }: { pos: LatLng | null; zonas: Zona[]; compact?: boolean }) {
  if (!zonas.length) return null
  if (!pos) {
    return compact ? null : (
      <div className="alert alert-info">🚚 Por ahora entregamos en: <b>{nombresZonas(zonas)}</b>. La zona amarilla del mapa es el área de cobertura.</div>
    )
  }
  const z = zonaPara(pos, zonas)
  return z ? (
    <div className="alert alert-ok">✅ ¡Entregamos en tu zona! (<b>{z.nombre}</b>)</div>
  ) : (
    <div className="alert alert-warn">
      ⚠️ Esa ubicación está fuera de nuestra zona de entrega. Por ahora solo entregamos en: <b>{nombresZonas(zonas)}</b>.
      {!compact && <> Puedes crear tu cuenta, pero no podrás comprar hasta que habilitemos tu zona.</>}
    </div>
  )
}

/** Franja informativa para la tienda / inicio. Se adapta a quién está mirando. */
export function ZonesBanner({ zonas }: { zonas: Zona[] }) {
  const { user, client, isStaff, loading } = useAuth()
  if (!zonas.length || loading) return null

  // Personal (admin / delivery): solo informativo
  if (isStaff) {
    return <div className="zones-banner">🚚 Zonas de entrega activas: <b>{nombresZonas(zonas)}</b></div>
  }

  // Cliente ya registrado con su negocio
  if (user && client) {
    const z = zonaPara({ lat: client.latitude, lng: client.longitude }, zonas)
    const negocio = client.empresa || client.local || 'Tu negocio'
    return z ? (
      <div className="zones-banner ok">
        ✅ <span><b>{negocio}</b> está dentro de nuestra zona de entrega ({z.nombre}). ¡Haz tu pedido!</span>
      </div>
    ) : (
      <div className="zones-banner warn">
        ⚠️ <span><b>{negocio}</b> está fuera de nuestra zona de entrega. Por ahora entregamos en: <b>{nombresZonas(zonas)}</b>.</span>
        <Link to="/perfil">Revisar ubicación</Link>
      </div>
    )
  }

  // Sesión iniciada pero sin datos del negocio
  if (user && !client) {
    return (
      <div className="zones-banner">
        🚚 Entregas disponibles en: <b>{nombresZonas(zonas)}</b>
        <Link to="/perfil">Completa los datos de tu negocio</Link>
      </div>
    )
  }

  // Visitante sin cuenta
  return (
    <div className="zones-banner">
      🚚 Entregas disponibles en: <b>{nombresZonas(zonas)}</b>
      <Link to="/registro">Registra tu negocio</Link>
    </div>
  )
}
