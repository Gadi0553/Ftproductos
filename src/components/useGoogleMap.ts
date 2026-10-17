import { RefObject, useEffect, useState } from 'react'
import { DEFAULT_CENTER, loadGoogleMaps } from '../lib/maps'
import type { LatLng } from '../lib/types'

/** Crea un mapa de Google dentro del div referenciado. */
export function useGoogleMap(ref: RefObject<HTMLDivElement>, center: LatLng = DEFAULT_CENTER, zoom = 13) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !ref.current) return
        setMap(
          new google.maps.Map(ref.current, {
            center,
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false,
            gestureHandling: 'greedy',
          }),
        )
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { map, error }
}

/** Ícono circular de color para marcadores. */
export function pin(color: string, scale = 9): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
    scale,
  }
}

export const COLORS = { navy: '#0a1f44', yellow: '#ffc93c', blue: '#1e5bd8', green: '#16a34a', red: '#dc2626' }
