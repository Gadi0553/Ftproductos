import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MapView, { MapMarker } from '../../components/MapView'
import { StatusBadge } from '../../components/OrderBits'
import { COLORS } from '../../components/useGoogleMap'
import { fmtDate, fmtMoney, destinatario } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Order } from '../../lib/types'

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [counts, setCounts] = useState({ productos: 0, clientes: 0 })
  const nav = useNavigate()

  useEffect(() => {
    const since = new Date()
    since.setDate(since.getDate() - 30)
    Promise.all([
      supabase.from('orders').select('*').gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('clients').select('id', { count: 'exact', head: true }),
    ]).then(([o, p, c]) => {
      setOrders((o.data as Order[]) ?? [])
      setCounts({ productos: p.count ?? 0, clientes: c.count ?? 0 })
    })
  }, [])

  const today = new Date().toDateString()
  const ventasHoy = orders.filter((o) => new Date(o.created_at).toDateString() === today && o.estado !== 'cancelado')
    .reduce((a, o) => a + Number(o.total), 0)
  const ventasMes = orders.filter((o) => o.estado !== 'cancelado').reduce((a, o) => a + Number(o.total), 0)
  const activos = orders.filter((o) => !['entregado', 'cancelado'].includes(o.estado))

  const markers = useMemo<MapMarker[]>(() =>
    activos.filter((o) => o.latitude != null && o.longitude != null).map((o) => ({
      id: o.id,
      pos: { lat: o.latitude!, lng: o.longitude! },
      title: `#${o.numero} ${destinatario(o)}`,
      color: o.estado === 'en_camino' ? COLORS.blue : COLORS.yellow,
      info: `<b>Pedido #${o.numero}</b><br>${destinatario(o)}<br>${fmtMoney(o.total)}`,
      onClick: () => nav(`/admin/pedidos/${o.id}`),
    })), [orders]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1>Resumen</h1>
      <div className="stats">
        <div className="stat"><span>Ventas hoy</span><b>{fmtMoney(ventasHoy)}</b></div>
        <div className="stat"><span>Ventas 30 días</span><b>{fmtMoney(ventasMes)}</b></div>
        <div className="stat yellow"><span>Pedidos por entregar</span><b>{activos.length}</b></div>
        <div className="stat"><span>Productos</span><b>{counts.productos}</b></div>
        <div className="stat"><span>Clientes</span><b>{counts.clientes}</b></div>
      </div>

      <div className="card">
        <div className="row-between">
          <h3>Mapa de entregas pendientes</h3>
          <small className="muted">🟡 pendiente/preparando · 🔵 en camino</small>
        </div>
        {markers.length ? <MapView markers={markers} height={380} /> : <p className="muted">No hay entregas pendientes.</p>}
      </div>

      <div className="card">
        <div className="row-between"><h3>Pedidos recientes</h3><Link to="/admin/pedidos">Ver todos →</Link></div>
        <table className="table">
          <thead><tr><th>#</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th className="right">Total</th></tr></thead>
          <tbody>
            {orders.slice(0, 8).map((o) => (
              <tr key={o.id} className="clickable" onClick={() => nav(`/admin/pedidos/${o.id}`)}>
                <td>{o.numero}</td>
                <td>{destinatario(o)}{o.empresa && <><br /><small className="muted">{o.cliente_nombre}</small></>}</td>
                <td>{fmtDate(o.created_at)}</td>
                <td><StatusBadge estado={o.estado} /></td>
                <td className="right">{fmtMoney(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
