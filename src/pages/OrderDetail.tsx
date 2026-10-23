import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Loading } from '../components/Guards'
import MapView, { MapMarker } from '../components/MapView'
import { LogTimeline, OrderProgress, StatusBadge } from '../components/OrderBits'
import { COLORS } from '../components/useGoogleMap'
import { fmtDate, fmtMoney, destinatario } from '../lib/format'
import BankInfo from '../components/BankInfo'
import { ComprobanteCard } from '../components/Comprobante'
import { supabase } from '../lib/supabase'
import type { DeliveryLog, Order } from '../lib/types'

/** Vista del cliente: estado del pedido y bitácora de la entrega en tiempo real. */
export default function OrderDetail() {
  const { id } = useParams()
  const loc = useLocation()
  const st = loc.state as { nuevo?: boolean; compFallo?: boolean } | null
  const nuevo = st?.nuevo
  const [order, setOrder] = useState<Order | null>(null)
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [loading, setLoading] = useState(true)
  const loadRef = useRef<() => void>(() => {})

  useEffect(() => {
    const load = async () => {
      const [{ data: o }, { data: l }] = await Promise.all([
        supabase.from('orders').select('*, order_items(*)').eq('id', id!).maybeSingle(),
        supabase.from('delivery_logs').select('*').eq('order_id', id!).order('created_at', { ascending: false }),
      ])
      setOrder(o as Order | null)
      setLogs((l as DeliveryLog[]) ?? [])
      setLoading(false)
    }
    loadRef.current = load
    load()
    const ch = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_logs', filter: `order_id=eq.${id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = []
    if (order?.latitude != null && order.longitude != null) {
      m.push({ id: 'dest', pos: { lat: order.latitude, lng: order.longitude }, title: order.empresa ? 'Tu empresa' : 'Lugar de entrega', color: COLORS.yellow, info: '<b>Punto de entrega</b>' })
    }
    const last = logs.find((l) => l.latitude != null && l.longitude != null)
    if (last && order?.estado === 'en_camino') {
      m.push({ id: 'rep', pos: { lat: last.latitude!, lng: last.longitude! }, title: 'Repartidor', color: COLORS.blue, info: `<b>Última ubicación del repartidor</b><br>${fmtDate(last.created_at)}` })
    }
    return m
  }, [order, logs])

  if (loading) return <Loading />
  if (!order) return <div className="container page"><div className="card empty">Pedido no encontrado</div></div>

  return (
    <div className="container page">
      <Link to="/mis-pedidos" className="back">← Mis pedidos</Link>
      {nuevo && <div className="alert alert-ok">¡Gracias por tu compra! Tu pedido fue recibido y pronto lo prepararemos.</div>}
      {st?.compFallo && <div className="alert alert-warn">Tu pedido se creó, pero no pudimos subir el comprobante. Vuelve a subirlo abajo, en "Comprobante de pago".</div>}
      <div className="row-between">
        <h1>Pedido #{order.numero}</h1>
        <Link to={`/factura/${order.id}`} className="btn btn-shine">🧾 Ver factura / PDF</Link>
        <StatusBadge estado={order.estado} />
      </div>
      <OrderProgress estado={order.estado} />

      <div className="two-col">
        <div className="card">
          <h3>Productos</h3>
          <table className="table">
            <tbody>
              {order.order_items?.map((i) => (
                <tr key={i.id}>
                  <td>{i.cantidad} ×</td>
                  <td>{i.nombre}<br /><small className="muted">{i.presentacion}</small></td>
                  <td className="right">{fmtMoney(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td /><td><b>Total</b></td><td className="right"><b>{fmtMoney(order.total)}</b></td></tr></tfoot>
          </table>
          <p className="muted">Pago: {order.metodo_pago} · Realizado: {fmtDate(order.created_at)}</p>
          {order.metodo_pago === 'transferencia' && !['entregado', 'cancelado'].includes(order.estado) && (
            <BankInfo total={Number(order.total)} pedido={order.numero} />
          )}
          <ComprobanteCard order={order} canUpload={!['entregado', 'cancelado'].includes(order.estado)} onChanged={() => loadRef.current()} />
          {order.notas_cliente && <p><b>Tus notas:</b> {order.notas_cliente}</p>}
          <h3>Entrega en</h3>
          <p><b>{destinatario(order)}</b><br /><small className="muted">{order.direccion}</small></p>
          {markers.length > 0 && <MapView height={240} markers={markers} />}
        </div>
        <div className="card">
          <h3>Seguimiento de la entrega</h3>
          <LogTimeline logs={logs} />
        </div>
      </div>
    </div>
  )
}
