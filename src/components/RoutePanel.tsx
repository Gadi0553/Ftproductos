import { useEffect, useRef, useState } from 'react'
import { COLORS, pin, useGoogleMap } from './useGoogleMap'
import {
  computeBestRoute, getCurrentPosition, googleMapsUrl, haversine,
  RoutesResponse, TravelMode, wazeUrl,
} from '../lib/maps'
import { fmtDistance, fmtDuration } from '../lib/format'
import type { LatLng } from '../lib/types'

interface Props {
  destination: LatLng
  destName: string
  /** Se llama cada vez que cambia la ubicación del repartidor */
  onOrigin?: (p: LatLng | null) => void
}

/**
 * Calcula y dibuja la mejor ruta desde la ubicación actual de quien usa la página
 * hasta el destino. Ofrece abrir la navegación en Google Maps o Waze.
 */
export default function RoutePanel({ destination, destName, onOrigin }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { map, error: mapError } = useGoogleMap(ref, destination, 14)
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [mode, setMode] = useState<TravelMode>('DRIVE')
  const [route, setRoute] = useState<RoutesResponse | null>(null)
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tracking, setTracking] = useState(false)
  const overlays = useRef<{ setMap: (m: google.maps.Map | null) => void }[]>([])
  const meMarker = useRef<google.maps.Marker | null>(null)
  const watchId = useRef<number | null>(null)

  const all = route ? [route.best, ...route.alternatives] : []
  const current = all[selected]

  // Marcador del destino
  useEffect(() => {
    if (!map) return
    const m = new google.maps.Marker({ map, position: destination, title: destName, icon: pin(COLORS.yellow, 11), zIndex: 10 })
    const info = new google.maps.InfoWindow({ content: `<b style="color:#0a1f44">${destName}</b>` })
    m.addListener('click', () => info.open({ map, anchor: m }))
    return () => m.setMap(null)
  }, [map, destination.lat, destination.lng, destName])

  // Marcador de "mi ubicación"
  useEffect(() => {
    onOrigin?.(origin)
    if (!map || !origin) return
    if (!meMarker.current) {
      meMarker.current = new google.maps.Marker({ map, position: origin, title: 'Tu ubicación', icon: pin(COLORS.blue, 9), zIndex: 20 })
    } else meMarker.current.setPosition(origin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, origin])

  // Dibujar rutas
  useEffect(() => {
    overlays.current.forEach((o) => o.setMap(null))
    overlays.current = []
    if (!map || !route) return
    all.forEach((r, i) => {
      if (i === selected) return
      const alt = new google.maps.Polyline({ map, path: r.path, strokeColor: '#8a97b1', strokeOpacity: 0.8, strokeWeight: 5, zIndex: 1 })
      alt.addListener('click', () => setSelected(i))
      overlays.current.push(alt)
    })
    if (current) {
      overlays.current.push(new google.maps.Polyline({ map, path: current.path, strokeColor: COLORS.navy, strokeWeight: 9, zIndex: 2 }))
      overlays.current.push(new google.maps.Polyline({ map, path: current.path, strokeColor: COLORS.yellow, strokeWeight: 4, zIndex: 3 }))
      const b = new google.maps.LatLngBounds()
      current.path.forEach((p) => b.extend(p))
      map.fitBounds(b, 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, route, selected])

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
  }, [])

  const calc = async (from?: LatLng) => {
    setLoading(true)
    setError(null)
    try {
      const o = from ?? (await getCurrentPosition())
      setOrigin(o)
      const r = await computeBestRoute(o, destination, mode)
      setRoute(r)
      setSelected(0)
    } catch (e) {
      setError((e as Error).message || 'No se pudo calcular la ruta')
    } finally {
      setLoading(false)
    }
  }

  const toggleTracking = () => {
    if (tracking) {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
      setTracking(false)
      return
    }
    if (!navigator.geolocation) return setError('Geolocalización no disponible')
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError('No se pudo seguir tu ubicación'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
    setTracking(true)
  }

  const eta = current ? new Date(Date.now() + current.durationSec * 1000) : null
  const straight = origin ? haversine(origin, destination) : null

  return (
    <div className="route-panel">
      <div className="route-controls">
        <div className="seg">
          {([['DRIVE', '🚗 Carro'], ['TWO_WHEELER', '🛵 Motor'], ['WALK', '🚶 A pie']] as [TravelMode, string][]).map(([v, l]) => (
            <button key={v} type="button" className={mode === v ? 'active' : ''} onClick={() => setMode(v)}>{l}</button>
          ))}
        </div>
        <button type="button" className="btn btn-yellow" onClick={() => calc()} disabled={loading}>
          {loading ? 'Calculando…' : route ? '↻ Recalcular ruta' : '🧭 Trazar mejor ruta desde mi ubicación'}
        </button>
        <button type="button" className={`btn ${tracking ? 'btn-primary' : 'btn-outline'}`} onClick={toggleTracking}>
          {tracking ? '● Siguiendo mi ubicación' : 'Seguir mi ubicación'}
        </button>
      </div>

      {(error || mapError) && <div className="alert alert-error">{error || mapError}</div>}

      <div className="route-grid">
        <div className="map-wrap" style={{ height: 460 }}>
          <div ref={ref} className="map" />
        </div>

        <aside className="route-info card">
          <h3>Destino</h3>
          <p className="strong">{destName}</p>
          <div className="nav-links">
            <a className="btn btn-gmaps" href={googleMapsUrl(destination, origin, mode)} target="_blank" rel="noreferrer">
              Abrir en Google Maps
            </a>
            <a className="btn btn-waze" href={wazeUrl(destination)} target="_blank" rel="noreferrer">
              Abrir en Waze
            </a>
          </div>

          {current ? (
            <>
              <div className="route-stats">
                <div><span>Tiempo</span><b>{fmtDuration(current.durationSec)}</b></div>
                <div><span>Distancia</span><b>{fmtDistance(current.distanceMeters)}</b></div>
                <div><span>Llegada</span><b>{eta?.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</b></div>
              </div>
              {all.length > 1 && (
                <div className="alt-list">
                  {all.map((r, i) => (
                    <button key={i} type="button" className={i === selected ? 'active' : ''} onClick={() => setSelected(i)}>
                      {i === 0 && <span className="tag">Más rápida</span>} {r.label} · {fmtDuration(r.durationSec)} · {fmtDistance(r.distanceMeters)}
                    </button>
                  ))}
                </div>
              )}
              <h4>Indicaciones paso a paso</h4>
              <ol className="steps">
                {current.steps.map((s, i) => (
                  <li key={i}>
                    <span>{s.instruction}</span>
                    <small>{fmtDistance(s.distanceMeters)}</small>
                  </li>
                ))}
              </ol>
              <small className="muted">
                Fuente: {route?.source === 'routes' ? 'Google Routes API (tráfico en tiempo real)' : 'Google Directions'}
              </small>
            </>
          ) : (
            <p className="muted">
              Pulsa “Trazar mejor ruta” para calcular el camino más rápido desde donde estás
              {straight ? ` (a ${fmtDistance(straight)} en línea recta)` : ''}.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
