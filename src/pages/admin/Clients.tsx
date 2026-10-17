import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ClientFields, { ClientData, emptyClient } from '../../components/ClientFields'
import { Loading } from '../../components/Guards'
import MapView, { MapMarker } from '../../components/MapView'
import { fmtDate } from '../../lib/format'
import { errMsg, supabase } from '../../lib/supabase'
import type { Client } from '../../lib/types'

export default function AdminClients() {
  const [list, setList] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [form, setForm] = useState<ClientData>(emptyClient)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  const load = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setList((data as Client[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const open = (c: Client | 'new') => {
    setEditing(c)
    setError(null)
    setForm(c === 'new' ? emptyClient : {
      nombre: c.nombre, apellido: c.apellido, numero: c.numero, email: c.email ?? '',
      empresa: c.empresa ?? c.local ?? '', descripcion_empresa: c.descripcion_empresa ?? '',
      direccion: c.direccion ?? '', referencia: c.referencia ?? '', pos: { lat: c.latitude, lng: c.longitude },
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.pos) return setError('Marca la ubicación en el mapa')
    setBusy(true)
    const row = {
      nombre: form.nombre, apellido: form.apellido, numero: form.numero, email: form.email || null,
      empresa: form.empresa, local: form.empresa, descripcion_empresa: form.descripcion_empresa,
      direccion: form.direccion, referencia: form.referencia, latitude: form.pos.lat, longitude: form.pos.lng,
    }
    const { error } = editing === 'new'
      ? await supabase.from('clients').insert(row)
      : await supabase.from('clients').update(row).eq('id', (editing as Client).id)
    setBusy(false)
    if (error) return setError(errMsg(error))
    setEditing(null)
    load()
  }

  const del = async (c: Client) => {
    if (!confirm(`¿Eliminar al cliente ${c.nombre} ${c.apellido}?`)) return
    const { error } = await supabase.from('clients').delete().eq('id', c.id)
    if (error) alert(errMsg(error))
    load()
  }

  const shown = list.filter((c) =>
    `${c.nombre} ${c.apellido} ${c.empresa ?? c.local ?? ''} ${c.numero} ${c.email ?? ''}`.toLowerCase().includes(q.toLowerCase()))

  const markers = useMemo<MapMarker[]>(() => shown.map((c) => ({
    id: String(c.id),
    pos: { lat: c.latitude, lng: c.longitude },
    title: c.empresa ?? c.local ?? c.nombre,
    info: `<b>${c.empresa ?? c.local ?? ''}</b><br>${c.nombre} ${c.apellido}<br>${c.numero}`,
    onClick: () => nav(`/admin/clientes/${c.id}/ruta`),
  })), [list, q]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="row-between">
        <h1>Clientes y rutas</h1>
        <button className="btn btn-yellow" onClick={() => open('new')}>+ Agregar cliente</button>
      </div>

      {editing && (
        <form className="card form" onSubmit={save}>
          <h3>{editing === 'new' ? 'Nuevo cliente' : `Editar: ${editing.nombre} ${editing.apellido}`}</h3>
          <ClientFields value={form} onChange={setForm} />
          {error && <div className="alert alert-error">{error}</div>}
          <div className="row">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cliente'}</button>
            <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="card">
        <h3>Mapa de clientes</h3>
        <small className="muted">Haz clic en un punto para trazar la ruta hasta ese cliente.</small>
        {markers.length > 0 && <MapView markers={markers} height={340} />}
      </div>

      <input className="search" placeholder="Buscar cliente, empresa, teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <Loading /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Cliente</th><th>Empresa</th><th>Contacto</th><th>Registro</th><th /></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={String(c.id)}>
                  <td><b>{c.nombre} {c.apellido}</b>{c.user_id && <><br /><span className="tag">Cuenta web</span></>}</td>
                  <td>{c.empresa ?? c.local}<br /><small className="muted">{c.descripcion_empresa}</small></td>
                  <td>{c.numero}<br /><small className="muted">{c.email}</small></td>
                  <td className="nowrap"><small>{fmtDate(c.created_at)}</small></td>
                  <td className="right nowrap">
                    <Link className="btn btn-sm btn-yellow" to={`/admin/clientes/${c.id}/ruta`}>🧭 Ruta</Link>{' '}
                    <button className="btn btn-sm btn-outline" onClick={() => open(c)}>Editar</button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => del(c)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p className="muted center">Sin clientes.</p>}
        </div>
      )}
    </>
  )
}
