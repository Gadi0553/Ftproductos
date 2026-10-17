import type { LatLng } from './types'

export const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

/** Centro por defecto: Santo Domingo, RD */
export const DEFAULT_CENTER: LatLng = { lat: 18.4861, lng: -69.9312 }

let loader: Promise<typeof google> | null = null
const win = () => window as unknown as { google?: typeof google }

/** Carga el SDK de Google Maps JavaScript una sola vez. */
export function loadGoogleMaps(): Promise<typeof google> {
  const g = win().google
  if (g?.maps?.Map && g.maps.geometry && g.maps.DirectionsService) return Promise.resolve(g)
  if (loader) return loader
  loader = new Promise((resolve, reject) => {
    const cb = '__ftMapsReady'
    ;(window as unknown as Record<string, unknown>)[cb] = async () => {
      try {
        await Promise.all([
          google.maps.importLibrary('maps'),
          google.maps.importLibrary('marker'),
          google.maps.importLibrary('geometry'),
          google.maps.importLibrary('geocoding'),
          google.maps.importLibrary('routes'),
        ])
        resolve(win().google as typeof google)
      } catch (e) {
        reject(e)
      }
    }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&v=weekly&language=es&region=DO&loading=async&callback=${cb}`
    s.async = true
    s.onerror = () => {
      loader = null
      reject(new Error('No se pudo cargar Google Maps. Revisa tu API key y conexión.'))
    }
    document.head.appendChild(s)
  })
  return loader
}

/** Ubicación actual del dispositivo (la persona que usa la página). */
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Tu navegador no soporta geolocalización'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? 'Debes permitir el acceso a tu ubicación' : 'No se pudo obtener tu ubicación')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
  })
}

// ---------------------------------------------------------------------------
//  Enlaces de navegación externa
// ---------------------------------------------------------------------------
export function googleMapsUrl(dest: LatLng, origin?: LatLng | null, mode: TravelMode = 'DRIVE') {
  const tm = mode === 'WALK' ? 'walking' : mode === 'TWO_WHEELER' ? 'two-wheeler' : 'driving'
  const o = origin ? `&origin=${origin.lat},${origin.lng}` : ''
  return `https://www.google.com/maps/dir/?api=1${o}&destination=${dest.lat},${dest.lng}&travelmode=${tm}&dir_action=navigate`
}

export function wazeUrl(dest: LatLng) {
  return `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes&zoom=17`
}

// ---------------------------------------------------------------------------
//  Cálculo de rutas
//  1) Routes API (moderna, con tráfico en tiempo real y rutas alternativas)
//  2) Respaldo: DirectionsService del SDK de Maps JS
// ---------------------------------------------------------------------------
export type TravelMode = 'DRIVE' | 'TWO_WHEELER' | 'WALK'

export interface RouteStep {
  instruction: string
  distanceMeters: number
  durationSec: number
}

export interface RouteResult {
  distanceMeters: number
  durationSec: number
  path: LatLng[]
  steps: RouteStep[]
  label: string
}

export interface RoutesResponse {
  best: RouteResult
  alternatives: RouteResult[]
  source: 'routes' | 'directions'
}

const secs = (s?: string) => (s ? parseFloat(s.replace('s', '')) : 0)

async function viaRoutesApi(origin: LatLng, dest: LatLng, mode: TravelMode): Promise<RoutesResponse> {
  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
    travelMode: mode,
    computeAlternativeRoutes: true,
    languageCode: 'es',
    units: 'METRIC',
  }
  if (mode !== 'WALK') body.routingPreference = 'TRAFFIC_AWARE'

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask':
        'routes.duration,routes.distanceMeters,routes.description,routes.polyline.encodedPolyline,' +
        'routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Routes API ${res.status}`)
  const data = await res.json()
  if (!data.routes?.length) throw new Error('Sin rutas')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed: RouteResult[] = data.routes.map((r: any, i: number) => ({
    distanceMeters: r.distanceMeters ?? 0,
    durationSec: secs(r.duration),
    label: r.description ? `Vía ${r.description}` : `Ruta ${i + 1}`,
    path: google.maps.geometry.encoding
      .decodePath(r.polyline.encodedPolyline)
      .map((p) => ({ lat: p.lat(), lng: p.lng() })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    steps: (r.legs?.[0]?.steps ?? []).map((s: any) => ({
      instruction: s.navigationInstruction?.instructions ?? 'Continúa',
      distanceMeters: s.distanceMeters ?? 0,
      durationSec: secs(s.staticDuration),
    })),
  }))
  parsed.sort((a, b) => a.durationSec - b.durationSec)
  return { best: parsed[0], alternatives: parsed.slice(1), source: 'routes' }
}

async function viaDirections(origin: LatLng, dest: LatLng, mode: TravelMode): Promise<RoutesResponse> {
  const svc = new google.maps.DirectionsService()
  const travelMode = mode === 'WALK' ? google.maps.TravelMode.WALKING : google.maps.TravelMode.DRIVING
  const r = await svc.route({
    origin,
    destination: dest,
    travelMode,
    provideRouteAlternatives: true,
    drivingOptions: travelMode === google.maps.TravelMode.DRIVING
      ? { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS }
      : undefined,
  })
  const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const parsed: RouteResult[] = r.routes.map((rt, i) => {
    const leg = rt.legs[0]
    return {
      distanceMeters: leg.distance?.value ?? 0,
      durationSec: leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0,
      label: rt.summary ? `Vía ${rt.summary}` : `Ruta ${i + 1}`,
      path: rt.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })),
      steps: leg.steps.map((s) => ({
        instruction: strip(s.instructions),
        distanceMeters: s.distance?.value ?? 0,
        durationSec: s.duration?.value ?? 0,
      })),
    }
  })
  parsed.sort((a, b) => a.durationSec - b.durationSec)
  return { best: parsed[0], alternatives: parsed.slice(1), source: 'directions' }
}

/** Devuelve la ruta más rápida (con tráfico) y las alternativas. */
export async function computeBestRoute(origin: LatLng, dest: LatLng, mode: TravelMode = 'DRIVE'): Promise<RoutesResponse> {
  await loadGoogleMaps()
  try {
    return await viaRoutesApi(origin, dest, mode)
  } catch (e) {
    console.warn('Routes API no disponible, usando DirectionsService:', e)
    return await viaDirections(origin, dest, mode)
  }
}

/** Dirección legible a partir de coordenadas. */
export async function reverseGeocode(p: LatLng): Promise<string | null> {
  await loadGoogleMaps()
  try {
    const { results } = await new google.maps.Geocoder().geocode({ location: p })
    return results[0]?.formatted_address ?? null
  } catch {
    return null
  }
}

/** Coordenadas a partir de una dirección escrita. */
export async function geocodeAddress(address: string): Promise<{ pos: LatLng; address: string } | null> {
  await loadGoogleMaps()
  try {
    const { results } = await new google.maps.Geocoder().geocode({ address, region: 'DO' })
    const r = results[0]
    if (!r) return null
    return { pos: { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() }, address: r.formatted_address }
  } catch {
    return null
  }
}

/** Distancia en línea recta (metros). */
export function haversine(a: LatLng, b: LatLng) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
