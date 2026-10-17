import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loading } from '../../components/Guards'
import { StatusBadge } from '../../components/OrderBits'
import RoutePanel from '../../components/RoutePanel'
import { fmtDate, fmtMoney } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Client, Order } from '../../lib/types'

export default function ClientRoute() {
  const { id } = useParams()
  const [c, setC] = useState<Client | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('clients').select('*').eq('id', id!).maybeSingle().then(async ({ data }) => {
      const cl = data as Client | null
      setC(cl)
      if (cl?.user_id) {
        const { data: o } = await supabase.from('orders').select('*').eq('user_id', cl.user_id).order('created_at', { ascending: false }).limit(10)
        setOrders((o as Order[]) ?? [])
      }
      setLoading(false)
    })
  }, [id])

  if (loading) return <Loading />
  if (!c) return <div className="card empty">Cliente no encontrado</div>

  return (
    <>
      <Link to="/admin/clientes" className="back">← Clientes</Link>
      <h1>Ruta hacia {c.empresa ?? c.local ?? `${c.nombre} ${c.apellido}`}</h1>
      <p className="muted">{c.nombre} {c.apellido} · {c.numero} · {c.direccion}{c.referencia ? ` · Ref: ${c.referencia}` : ''}</p>
      <div className="card">
        <RoutePanel destination={{ lat: c.latitude, lng: c.longitude }} destName={c.empresa ?? c.local ?? `${c.nombre} ${c.apellido}`} />
      </div>
      {orders.length > 0 && (
        <div className="card">
          <h3>Pedidos de este cliente</h3>
          <table className="table">
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/admin/pedidos/${o.id}`}>#{o.numero}</Link></td>
                  <td>{fmtDate(o.created_at)}</td>
                  <td><StatusBadge estado={o.estado} /></td>
                  <td className="right">{fmtMoney(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
