import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loading } from '../../components/Guards'
import { StatusBadge } from '../../components/OrderBits'
import { fmtDate, fmtMoney, destinatario } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { ESTADOS, Order, OrderStatus, Profile } from '../../lib/types'

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'activos' | OrderStatus | 'todos'>('activos')
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const [staff, setStaff] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from('profiles').select('id, nombre, email').in('role', ['delivery', 'admin']).then(({ data }) => {
      const m: Record<string, string> = {}
      ;((data as Profile[]) ?? []).forEach((p) => { m[p.id] = p.nombre || p.email || 'Repartidor' })
      setStaff(m)
    })
  }, [])

  useEffect(() => {
    const load = () =>
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(300)
        .then(({ data }) => { setOrders((data as Order[]) ?? []); setLoading(false) })
    load()
    const ch = supabase.channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const shown = orders.filter((o) =>
    (filtro === 'todos' || (filtro === 'activos' ? !['entregado', 'cancelado'].includes(o.estado) : o.estado === filtro)) &&
    (!q || `${o.numero} ${o.empresa} ${o.cliente_nombre} ${o.cliente_telefono}`.toLowerCase().includes(q.toLowerCase())),
  )

  return (
    <>
      <h1>Pedidos y entregas</h1>
      <div className="toolbar">
        <input className="search" placeholder="Buscar por #, empresa, cliente o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="activos">Por entregar</option>
          <option value="todos">Todos</option>
          {ESTADOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {loading ? <Loading /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>#</th><th>Cliente / Empresa</th><th>Artículos</th><th>Fecha</th><th>Estado</th><th>Repartidor</th><th className="right">Total</th><th /></tr></thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => nav(`/admin/pedidos/${o.id}`)}>
                  <td><b>{o.numero}</b></td>
                  <td>{destinatario(o)}<br /><small className="muted">{o.empresa ? `${o.cliente_nombre} · ` : ''}{o.cliente_telefono}</small>{o.zona && <><br /><span className="chip">📍 {o.zona}</span></>}</td>
                  <td><small>{o.order_items?.map((i) => `${i.cantidad}× ${i.nombre} (${i.presentacion})`).join(', ')}</small></td>
                  <td className="nowrap">{fmtDate(o.created_at)}</td>
                  <td><StatusBadge estado={o.estado} /></td>
                  <td>{o.asignado_a ? <small>🛵 {staff[o.asignado_a] ?? '—'}</small> : <small className="muted">Sin asignar</small>}</td>
                  <td className="right">{fmtMoney(o.total)}</td>
                  <td className="nowrap">
                    <span className="btn btn-sm btn-yellow">🧭 Ruta</span>{' '}
                    <button className="btn btn-sm btn-outline" title="Factura"
                            onClick={(e) => { e.stopPropagation(); nav(`/factura/${o.id}`) }}>🧾</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p className="muted center">No hay pedidos en este filtro.</p>}
        </div>
      )}
    </>
  )
}
