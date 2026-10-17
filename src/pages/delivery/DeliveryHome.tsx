import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loading } from '../../components/Guards'
import MapView, { MapMarker } from '../../components/MapView'
import { StatusBadge } from '../../components/OrderBits'
import { COLORS } from '../../components/useGoogleMap'
import { useAuth } from '../../context/AuthContext'
import { fmtDate, fmtDistance, fmtMoney } from '../../lib/format'
import { getCurrentPosition, haversine } from '../../lib/maps'
import { errMsg, supabase } from '../../lib/supabase'
import type { LatLng, Order } from '../../lib/types'

type Tab = 'mias' | 'disponibles' | 'entregadas'

/** Panel del repartidor: sus entregas, pedidos disponibles para tomar e historial. */
export default function DeliveryHome() {
  const { user, profile } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('mias')
  const [me, setMe] = useState<LatLng | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  const load = useCallback(async () => {
    // RLS devuelve: pedidos asignados a mí + pedidos activos sin asignar
    const { data } = await supabase.from('orders').select('*, order_items(*)')
      .order('created_at', { ascending: false }).limit(200)
    setOrders((data as Order[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    getCurrentPosition().then(setMe).catch(() => null)
    const ch = supabase.channel('delivery-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const activo = (o: Order) => !['entregado', 'cancelado'].includes(o.estado)
  const mias = orders.filter((o) => o.asignado_a === user?.id && activo(o))
  const disponibles = orders.filter((o) => !o.asignado_a && activo(o))
  const entregadas = orders.filter((o) => o.asignado_a === user?.id && o.estado === 'entregado')
  const hoy = new Date().toDateString()
  const entregadasHoy = entregadas.filter((o) => new Date(o.updated_at).toDateString() === hoy)

  const dist = (o: Order) => (me && o.latitude != null && o.longitude != null
    ? haversine(me, { lat: o.latitude, lng: o.longitude }) : null)

  const list = useMemo(() => {
    const base = tab === 'mias' ? mias : tab === 'disponibles' ? disponibles : entregadas
    if (tab === 'entregadas' || !me) return base
    return [...base].sort((a, b) => (dist(a) ?? 1e12) - (dist(b) ?? 1e12)) // más cercanos primero
  }, [orders, tab, me]) // eslint-disable-line react-hooks/exhaustive-deps

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [...mias, ...disponibles]
      .filter((o) => o.latitude != null && o.longitude != null)
      .map((o) => ({
        id: o.id,
        pos: { lat: o.latitude!, lng: o.longitude! },
        title: `#${o.numero} ${o.empresa ?? ''}`,
        color: o.asignado_a ? COLORS.yellow : '#8a97b1',
        info: `<b>#${o.numero} · ${o.empresa ?? ''}</b><br>${o.direccion ?? ''}<br>${o.asignado_a ? 'Asignado a ti' : 'Disponible'}`,
        onClick: () => nav(`/delivery/${o.id}`),
      }))
    if (me) m.push({ id: 'me', pos: me, title: 'Tú', color: COLORS.blue, info: '<b>Tu ubicación</b>' })
    return m
  }, [orders, me]) // eslint-disable-line react-hooks/exhaustive-deps

  const take = async (o: Order) => {
    setError(null)
    const { error } = await supabase.rpc('take_order', { p_order: o.id })
    if (error) return setError(errMsg(error))
    nav(`/delivery/${o.id}`)
  }

  if (loading) return <Loading />

  return (
    <>
      <h1>Hola, {profile?.nombre || 'repartidor'} 🛵</h1>
      <div className="stats">
        <div className="stat yellow"><span>Mis entregas activas</span><b>{mias.length}</b></div>
        <div className="stat"><span>Disponibles para tomar</span><b>{disponibles.length}</b></div>
        <div className="stat"><span>Entregadas hoy</span><b>{entregadasHoy.length}</b></div>
      </div>

      <div className="card">
        <div className="row-between">
          <h3>Mapa de entregas</h3>
          <small className="muted">🟡 asignadas a ti · ⚪ disponibles · 🔵 tú</small>
        </div>
        {markers.length ? <MapView markers={markers} height={340} /> : <p className="muted">No hay entregas pendientes.</p>}
      </div>

      <div className="cat-pills">
        <button className={tab === 'mias' ? 'active' : ''} onClick={() => setTab('mias')}>Mis entregas ({mias.length})</button>
        <button className={tab === 'disponibles' ? 'active' : ''} onClick={() => setTab('disponibles')}>Disponibles ({disponibles.length})</button>
        <button className={tab === 'entregadas' ? 'active' : ''} onClick={() => setTab('entregadas')}>Entregadas ({entregadas.length})</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {!list.length ? (
        <div className="card empty"><p>{tab === 'mias' ? 'No tienes entregas asignadas. Revisa la pestaña "Disponibles".' : 'Nada por aquí.'}</p></div>
      ) : (
        <div className="order-list">
          {list.map((o) => {
            const d = dist(o)
            return (
              <div key={o.id} className="card delivery-card">
                <div className="grow">
                  <div className="row"><b>#{o.numero} · {o.empresa}</b><StatusBadge estado={o.estado} />{o.zona && <span className="chip">📍 {o.zona}</span>}</div>
                  <small className="muted">{o.cliente_nombre} · {o.cliente_telefono}</small>
                  <small>{o.direccion}</small>
                  <small className="muted">
                    {o.order_items?.map((i) => `${i.cantidad}× ${i.nombre} (${i.presentacion})`).join(', ')}
                  </small>
                  <small className="muted">{fmtDate(o.created_at)}{d != null ? ` · a ${fmtDistance(d)} en línea recta` : ''}</small>
                </div>
                <div className="delivery-actions">
                  <b className="price">{fmtMoney(o.total)}</b>
                  {o.asignado_a ? (
                    <Link className="btn btn-primary" to={`/delivery/${o.id}`}>🧭 Ruta y bitácora</Link>
                  ) : (
                    <>
                      <button className="btn btn-yellow" onClick={() => take(o)}>🙋 Tomar</button>
                      <Link className="btn btn-sm btn-outline" to={`/delivery/${o.id}`}>Ver</Link>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
