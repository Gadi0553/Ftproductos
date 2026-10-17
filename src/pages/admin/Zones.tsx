import { FormEvent, useEffect, useRef, useState } from 'react'
import { COLORS, useGoogleMap } from '../../components/useGoogleMap'
import { geocodeAddress } from '../../lib/maps'
import { errMsg, supabase } from '../../lib/supabase'
import type { LatLng, Zona } from '../../lib/types'

type Draft = { id?: string; nombre: string; provincia: string; pos: LatLng | null; radio_km: number; activo: boolean }
const empty: Draft = { nombre: '', provincia: '', pos: null, radio_km: 5, activo: true }

/** El administrador define en qué pueblos/zonas se vende y se reparte. */
export default function Zones() {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const { map, error: mapError } = useGoogleMap(ref, { lat: 18.76, lng: -69.26 }, 11)
  const draftRef = useRef<Draft | null>(draft)
  draftRef.current = draft

  const load = () =>
    supabase.from('zonas').select('*').order('nombre').then(({ data }) => setZonas((data as Zona[]) ?? []))
  useEffect(() => { load() }, [])

  // Clic en el mapa = centro de la zona que se está editando
  useEffect(() => {
    if (!map) return
    const l = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (draftRef.current && e.latLng) setDraft({ ...draftRef.current, pos: { lat: e.latLng.lat(), lng: e.latLng.lng() } })
    })
    return () => l.remove()
  }, [map])

  // Dibujar todas las zonas + la que se está editando
  useEffect(() => {
    if (!map) return
    const objs: { setMap: (m: google.maps.Map | null) => void }[] = []
    const b = new google.maps.LatLngBounds()
    zonas.filter((z) => z.id !== draft?.id).forEach((z) => {
      const c = new google.maps.Circle({
        map, center: { lat: z.latitude, lng: z.longitude }, radius: Number(z.radio_km) * 1000,
        strokeColor: z.activo ? COLORS.navy : '#8a97b1', strokeWeight: 2,
        fillColor: z.activo ? COLORS.yellow : '#8a97b1', fillOpacity: z.activo ? 0.22 : 0.1, clickable: false,
      })
      objs.push(c)
      const cb = c.getBounds()
      if (cb) b.union(cb)
    })
    if (draft?.pos) {
      const c = new google.maps.Circle({
        map, center: draft.pos, radius: draft.radio_km * 1000, editable: true, draggable: true,
        strokeColor: COLORS.blue, strokeWeight: 3, fillColor: COLORS.blue, fillOpacity: 0.18,
      })
      c.addListener('radius_changed', () => {
        const r = Math.round((c.getRadius() / 1000) * 10) / 10
        if (draftRef.current) setDraft({ ...draftRef.current, radio_km: Math.min(100, Math.max(0.5, r)) })
      })
      c.addListener('dragend', () => {
        const p = c.getCenter()
        if (p && draftRef.current) setDraft({ ...draftRef.current, pos: { lat: p.lat(), lng: p.lng() } })
      })
      objs.push(c)
      const cb = c.getBounds()
      if (cb) { map.fitBounds(cb, 40) }
    } else if (!b.isEmpty()) {
      map.fitBounds(b, 40)
    }
    return () => objs.forEach((o) => o.setMap(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, zonas, draft?.id, draft?.pos?.lat, draft?.pos?.lng, draft?.radio_km])

  const buscar = async () => {
    if (!draft?.nombre.trim()) return
    setBusy(true)
    const r = await geocodeAddress(`${draft.nombre}${draft.provincia ? ', ' + draft.provincia : ''}, República Dominicana`)
    setBusy(false)
    if (!r) return setMsg({ ok: false, text: 'No se encontró ese lugar. Haz clic en el mapa para marcar el centro.' })
    setMsg(null)
    setDraft({ ...draft, pos: r.pos })
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    if (!draft.pos) return setMsg({ ok: false, text: 'Busca el pueblo o haz clic en el mapa para marcar el centro de la zona' })
    setBusy(true)
    setMsg(null)
    const row = {
      nombre: draft.nombre.trim(), provincia: draft.provincia.trim() || null,
      latitude: draft.pos.lat, longitude: draft.pos.lng, radio_km: draft.radio_km, activo: draft.activo,
    }
    const { error } = draft.id
      ? await supabase.from('zonas').update(row).eq('id', draft.id)
      : await supabase.from('zonas').insert(row)
    setBusy(false)
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    setMsg({ ok: true, text: `Zona "${row.nombre}" guardada` })
    setDraft(null)
    load()
  }

  const toggle = async (z: Zona) => {
    const { error } = await supabase.from('zonas').update({ activo: !z.activo }).eq('id', z.id)
    if (error) setMsg({ ok: false, text: errMsg(error) })
    else setMsg({ ok: true, text: `${z.nombre}: ${!z.activo ? 'habilitada para ventas y entregas' : 'deshabilitada'}` })
    load()
  }

  const remove = async (z: Zona) => {
    if (!confirm(`¿Eliminar la zona "${z.nombre}"? (Si solo quieres pausarla, usa "Deshabilitar")`)) return
    const { error } = await supabase.from('zonas').delete().eq('id', z.id)
    if (error) setMsg({ ok: false, text: errMsg(error) })
    load()
  }

  const edit = (z: Zona) => setDraft({
    id: z.id, nombre: z.nombre, provincia: z.provincia ?? '', pos: { lat: z.latitude, lng: z.longitude },
    radio_km: Number(z.radio_km), activo: z.activo,
  })

  const activas = zonas.filter((z) => z.activo)

  return (
    <>
      <div className="row-between">
        <h1>Zonas de venta y entrega</h1>
        {!draft && <button className="btn btn-yellow" onClick={() => { setDraft({ ...empty }); setMsg(null) }}>+ Agregar pueblo / zona</button>}
      </div>
      <p className="muted">
        Solo los clientes cuya empresa esté dentro de una zona <b>habilitada</b> pueden comprar, y los delivery solo reparten ahí.
        Ahora mismo se vende en: <b>{activas.length ? activas.map((z) => z.nombre).join(', ') : 'ninguna zona'}</b>.
      </p>
      {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`}>{msg.text}</div>}

      <div className="zones-layout">
        <div>
          {draft && (
            <form className="card form" onSubmit={save}>
              <h3>{draft.id ? `Editar: ${draft.nombre}` : 'Nueva zona'}</h3>
              <div className="grid-2">
                <label>Pueblo / sector *
                  <input required value={draft.nombre} placeholder="Ej. San Pedro de Macorís" onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
                </label>
                <label>Provincia
                  <input value={draft.provincia} placeholder="Ej. San Pedro de Macorís" onChange={(e) => setDraft({ ...draft, provincia: e.target.value })} />
                </label>
              </div>
              <button type="button" className="btn btn-outline" disabled={busy || !draft.nombre.trim()} onClick={buscar}>🔍 Ubicar en el mapa</button>
              <label>Radio de cobertura: <b>{draft.radio_km} km</b>
                <input type="range" min={0.5} max={30} step={0.5} value={draft.radio_km}
                       onChange={(e) => setDraft({ ...draft, radio_km: Number(e.target.value) })} />
              </label>
              <small className="muted">También puedes arrastrar el círculo azul o su borde en el mapa.</small>
              <label className="check"><input type="checkbox" checked={draft.activo} onChange={(e) => setDraft({ ...draft, activo: e.target.checked })} /> Habilitada para ventas y entregas</label>
              <div className="row">
                <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar zona'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setDraft(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="card">
            <h3>Zonas ({zonas.length})</h3>
            {!zonas.length && <p className="muted">No hay zonas. Agrega la primera.</p>}
            <div className="zone-list">
              {zonas.map((z) => (
                <div key={z.id} className={`zone-item ${z.activo ? 'on' : 'off'}`}>
                  <div className="grow">
                    <b>{z.nombre}</b>
                    <small className="muted">{z.provincia ? `${z.provincia} · ` : ''}Radio {Number(z.radio_km)} km</small>
                  </div>
                  <button className={`btn btn-sm ${z.activo ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggle(z)}>
                    {z.activo ? '✔ Habilitada' : 'Deshabilitada'}
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => edit(z)}>Editar</button>
                  <button className="icon-btn" title="Eliminar" onClick={() => remove(z)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <small className="muted">{draft ? '👆 Haz clic en el mapa para mover el centro de la zona' : '🟡 habilitadas · ⚪ deshabilitadas'}</small>
          <div className="map-wrap" style={{ height: 520 }}>
            {mapError && <div className="map-error">{mapError}</div>}
            <div ref={ref} className="map" />
          </div>
        </div>
      </div>
    </>
  )
}
