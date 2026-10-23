import { FormEvent, useEffect, useRef, useState } from 'react'
import { COLORS, useGoogleMap } from './useGoogleMap'
import { geocodeAddress, getCurrentPosition, reverseGeocode } from '../lib/maps'
import type { LatLng, Zona } from '../lib/types'

interface Props {
  value: LatLng | null
  onChange: (pos: LatLng, address: string | null) => void
  height?: number
  /** Zonas de entrega para dibujar en el mapa */
  zonas?: Zona[]
}

/** Selector de ubicación: clic en el mapa, arrastrar el pin, buscar dirección o usar GPS. */
export default function LocationPicker({ value, onChange, height = 320, zonas = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { map, error } = useGoogleMap(ref, value ?? undefined, value ? 16 : 12)
  const marker = useRef<google.maps.Marker | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const cbRef = useRef(onChange)
  cbRef.current = onChange

  const choose = async (pos: LatLng, address?: string | null) => {
    const addr = address ?? (await reverseGeocode(pos))
    cbRef.current(pos, addr)
  }

  // Dibujar zonas de entrega (círculos)
  useEffect(() => {
    if (!map || !zonas.length) return
    const circles = zonas.map((z) => {
      const c = new google.maps.Circle({
        map, center: { lat: z.latitude, lng: z.longitude }, radius: Number(z.radio_km) * 1000,
        strokeColor: COLORS.navy, strokeOpacity: 0.7, strokeWeight: 2,
        fillColor: COLORS.yellow, fillOpacity: 0.15, clickable: true,
      })
      c.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) choose({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      })
      return c
    })
    if (!value) {
      const b = new google.maps.LatLngBounds()
      circles.forEach((c) => { const cb = c.getBounds(); if (cb) b.union(cb) })
      map.fitBounds(b, 20)
    }
    return () => circles.forEach((c) => c.setMap(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, zonas])

  useEffect(() => {
    if (!map) return
    const l = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) choose({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    })
    return () => l.remove()
  }, [map])

  useEffect(() => {
    if (!map) return
    if (!value) {
      marker.current?.setMap(null)
      marker.current = null
      return
    }
    if (!marker.current) {
      marker.current = new google.maps.Marker({
        map,
        position: value,
        draggable: true,
        title: 'Lugar de entrega',
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: COLORS.yellow,
          fillOpacity: 1,
          strokeColor: COLORS.navy,
          strokeWeight: 2,
        },
      })
      marker.current.addListener('dragend', () => {
        const p = marker.current!.getPosition()!
        choose({ lat: p.lat(), lng: p.lng() })
      })
    } else {
      marker.current.setPosition(value)
    }
    map.panTo(value)
  }, [map, value])

  const useGps = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const p = await getCurrentPosition()
      map?.setZoom(17)
      await choose(p)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const search = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setMsg(null)
    const r = await geocodeAddress(query)
    setBusy(false)
    if (!r) return setMsg('No se encontró esa dirección')
    map?.setZoom(17)
    await choose(r.pos, r.address)
  }

  return (
    <div className="picker">
      <div className="picker-bar">
        <input
          type="search"
          name="ft-buscar-direccion"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(e)}
          placeholder="Buscar dirección (ej. Av. Winston Churchill, Santo Domingo)"
        />
        <button type="button" className="btn btn-outline" onClick={search} disabled={busy}>Buscar</button>
        <button type="button" className="btn btn-yellow" onClick={useGps} disabled={busy}>📍 Mi ubicación</button>
      </div>
      <div className="map-wrap" style={{ height }}>
        {error && <div className="map-error">{error}</div>}
        <div ref={ref} className="map" />
      </div>
      <small className="muted">
        {msg ?? (value
          ? `Ubicación: ${value.lat.toFixed(6)}, ${value.lng.toFixed(6)} · puedes arrastrar el pin para ajustarla`
          : 'Haz clic en el mapa para marcar el lugar exacto de entrega')}
      </small>
    </div>
  )
}
