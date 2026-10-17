import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { haversine } from './maps'
import type { LatLng, Zona } from './types'

/** Zonas de entrega activas (las que el administrador habilitó). */
export function useZonasActivas() {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('zonas').select('*').eq('activo', true).order('nombre').then(({ data }) => {
      setZonas((data as Zona[]) ?? [])
      setLoading(false)
    })
  }, [])
  return { zonas, loading }
}

/** Zona activa que cubre un punto (la más cercana), o null si está fuera de cobertura. */
export function zonaPara(p: LatLng | null | undefined, zonas: Zona[]): Zona | null {
  if (!p) return null
  let best: Zona | null = null
  let bestD = Infinity
  for (const z of zonas) {
    if (!z.activo) continue
    const d = haversine(p, { lat: z.latitude, lng: z.longitude }) / 1000
    if (d <= Number(z.radio_km) && d < bestD) {
      best = z
      bestD = d
    }
  }
  return best
}

export const nombresZonas = (zonas: Zona[]) => zonas.map((z) => z.nombre).join(', ')
