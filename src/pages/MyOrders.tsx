import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loading } from '../components/Guards'
import { StatusBadge } from '../components/OrderBits'
import { useAuth } from '../context/AuthContext'
import { fmtDate, fmtMoney } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'

export default function MyOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    if (!user) return
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as Order[]) ?? [])
        setLoading(false)
      })
  }, [user])

  if (loading) return <Loading />

  return (
    <div className="container page">
      <h1>Mis pedidos</h1>
      {!orders.length ? (
        <div className="card empty">
          <p>Todavía no has hecho pedidos.</p>
          <Link className="btn btn-primary" to="/tienda">Ir a la tienda</Link>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((o) => (
            <Link key={o.id} to={`/mis-pedidos/${o.id}`} className="card order-card">
              <div>
                <b>Pedido #{o.numero}</b>
                <small className="muted">{fmtDate(o.created_at)} · {o.order_items?.length ?? 0} artículo(s)</small>
              </div>
              <StatusBadge estado={o.estado} />
              <b className="price">{fmtMoney(o.total)}</b>
              <button className="btn btn-sm btn-yellow-soft" title="Ver factura"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav(`/factura/${o.id}`) }}>
                🧾 Factura
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
