import { useEffect, useRef } from 'react'
import { COLORS, pin, useGoogleMap } from './useGoogleMap'
import type { LatLng } from '../lib/types'

export interface MapMarker {
  id: string
  pos: LatLng
  title: string
  color?: string
  info?: string
  onClick?: () => void
}

interface Props {
  markers: MapMarker[]
  height?: number | string
  path?: LatLng[]
}

/** Mapa simple con varios marcadores (se ajusta para mostrarlos todos). */
export default function MapView({ markers, height = 360, path }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { map, error } = useGoogleMap(ref)
  const latest = useRef({ markers, path })
  latest.current = { markers, path }
  const sig = JSON.stringify([markers.map((m) => [m.id, m.pos, m.color, m.info, m.title]), path?.length, path?.[0]])

  useEffect(() => {
    if (!map) return
    const { markers, path } = latest.current
    const info = new google.maps.InfoWindow()
    const objs = markers.map((m) => {
      const mk = new google.maps.Marker({ map, position: m.pos, title: m.title, icon: pin(m.color ?? COLORS.yellow) })
      mk.addListener('click', () => {
        if (m.info) {
          info.setContent(`<div style="color:#0a1f44;font-family:Poppins,sans-serif">${m.info}</div>`)
          info.open({ map, anchor: mk })
        }
        latest.current.markers.find((x) => x.id === m.id)?.onClick?.()
      })
      return mk
    })
    let line: google.maps.Polyline | null = null
    if (path?.length) {
      line = new google.maps.Polyline({ map, path, strokeColor: COLORS.blue, strokeWeight: 5, strokeOpacity: 0.85 })
    }
    if (markers.length > 1 || path?.length) {
      const b = new google.maps.LatLngBounds()
      markers.forEach((m) => b.extend(m.pos))
      path?.forEach((p) => b.extend(p))
      map.fitBounds(b, 60)
    } else if (markers.length === 1) {
      map.setCenter(markers[0].pos)
      map.setZoom(15)
    }
    return () => {
      objs.forEach((o) => o.setMap(null))
      line?.setMap(null)
      info.close()
    }
  }, [map, sig])

  return (
    <div className="map-wrap" style={{ height }}>
      {error && <div className="map-error">{error}</div>}
      <div ref={ref} className="map" />
    </div>
  )
}
