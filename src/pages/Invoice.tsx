import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Loading } from '../components/Guards'
import { useAuth } from '../context/AuthContext'
import { CUENTA_BANCARIA, NEGOCIO } from '../lib/config'
import { estadoLabel, fmtDate, fmtMoney } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { DeliveryLog, Order } from '../lib/types'

const METODO: Record<string, string> = {
  efectivo: 'Efectivo contra entrega',
  transferencia: 'Transferencia bancaria',
  tarjeta: 'Tarjeta al recibir',
}

export const facturaNo = (n: number) => `FT-${String(n).padStart(6, '0')}`

/** Factura imprimible / descargable en PDF de un pedido. */
export default function Invoice() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { isAdmin, isStaff } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [entregado, setEntregado] = useState<DeliveryLog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('orders').select('*, order_items(*)').eq('id', id!).maybeSingle(),
      supabase.from('delivery_logs').select('*').eq('order_id', id!).eq('estado', 'entregado')
        .order('created_at', { ascending: false }).limit(1),
    ]).then(([o, l]) => {
      setOrder(o.data as Order | null)
      setEntregado(((l.data as DeliveryLog[]) ?? [])[0] ?? null)
      setLoading(false)
    })
  }, [id])

  // ?print=1 abre el diálogo de impresión automáticamente
  useEffect(() => {
    if (order && params.get('print') === '1') setTimeout(() => window.print(), 600)
  }, [order, params])

  useEffect(() => {
    if (!order) return
    const prev = document.title
    document.title = `Factura ${facturaNo(order.numero)} - ${order.empresa ?? order.cliente_nombre ?? ''}`
    return () => { document.title = prev }
  }, [order])

  if (loading) return <Loading />
  if (!order) return <div className="container page"><div className="card empty">Factura no encontrada</div></div>

  const items = order.order_items ?? []
  const unidades = items.reduce((a, i) => a + i.cantidad, 0)
  const back = isAdmin ? `/admin/pedidos/${order.id}` : isStaff ? `/delivery/${order.id}` : `/mis-pedidos/${order.id}`
  const anulada = order.estado === 'cancelado'

  return (
    <div className="container page invoice-page">
      <div className="invoice-toolbar no-print">
        <Link to={back} className="back">← Volver al pedido</Link>
        <div className="row">
          <button className="btn btn-shine" onClick={() => window.print()}>🖨️ Imprimir / Guardar PDF</button>
        </div>
      </div>
      <p className="muted no-print invoice-tip">
        Para guardar en PDF: pulsa <b>Imprimir / Guardar PDF</b> y en "Destino" elige <b>Guardar como PDF</b>.
      </p>

      <article className={`invoice ${anulada ? 'void' : ''}`}>
        {anulada && <div className="inv-void">ANULADA</div>}
        <header className="inv-head">
          <div className="inv-brand">
            <img src="/logo-dark.png" alt="FT" style={{ height: 60, width: 'auto' }} />
            <div>
              <h1>{NEGOCIO.nombre}</h1>
              <small>{NEGOCIO.eslogan}</small>
              <small>{NEGOCIO.direccion}</small>
              <small>
                {[NEGOCIO.telefono && `Tel. ${NEGOCIO.telefono}`, NEGOCIO.correo].filter(Boolean).join(' · ')}
              </small>
              {NEGOCIO.rnc && <small>RNC: {NEGOCIO.rnc}</small>}
            </div>
          </div>
          <div className="inv-meta">
            <span className="inv-title">FACTURA</span>
            <table>
              <tbody>
                <tr><td>No.</td><td><b>{facturaNo(order.numero)}</b></td></tr>
                <tr><td>Pedido</td><td>#{order.numero}</td></tr>
                <tr><td>Fecha</td><td>{fmtDate(order.created_at)}</td></tr>
                <tr><td>Estado</td><td>{estadoLabel(order.estado)}</td></tr>
              </tbody>
            </table>
          </div>
        </header>

        <section className="inv-parties">
          <div>
            <h4>Facturado a</h4>
            <b>{order.cliente_nombre}</b>
            {order.empresa && <span>{order.empresa}</span>}
            {order.cliente_telefono && <span>Tel. {order.cliente_telefono}</span>}
          </div>
          <div>
            <h4>Entregar en</h4>
            <span>{order.direccion || '—'}</span>
            {order.zona && <span>Zona: {order.zona}</span>}
            {entregado && <span>Entregado: {fmtDate(entregado.created_at)}</span>}
          </div>
          <div>
            <h4>Pago</h4>
            <span>{METODO[order.metodo_pago] ?? order.metodo_pago}</span>
            {order.metodo_pago === 'transferencia' && (
              <span>{CUENTA_BANCARIA.banco} · {CUENTA_BANCARIA.tipo} {CUENTA_BANCARIA.numero}<br />A nombre de {CUENTA_BANCARIA.titular}</span>
            )}
          </div>
        </section>

        <table className="inv-items">
          <thead>
            <tr><th>#</th><th>Descripción</th><th>Presentación</th><th className="r">Cant.</th><th className="r">Precio unit.</th><th className="r">Importe</th></tr>
          </thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={i.id}>
                <td>{n + 1}</td>
                <td><b>{i.nombre}</b></td>
                <td>{i.presentacion}</td>
                <td className="r">{i.cantidad}</td>
                <td className="r">{fmtMoney(i.precio_unitario)}</td>
                <td className="r">{fmtMoney(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="inv-bottom">
          <div className="inv-notes">
            {order.notas_cliente && (<><h4>Notas del cliente</h4><p>{order.notas_cliente}</p></>)}
            <h4>Condiciones</h4>
            <p>Precios en pesos dominicanos (RD$). Revise su pedido al recibirlo. Gracias por preferirnos.</p>
          </div>
          <table className="inv-totals">
            <tbody>
              <tr><td>Artículos</td><td>{items.length} ({unidades} unidades)</td></tr>
              <tr><td>Subtotal</td><td>{fmtMoney(order.total)}</td></tr>
              <tr><td>Envío</td><td>Gratis</td></tr>
              <tr className="grand"><td>TOTAL</td><td>{fmtMoney(order.total)}</td></tr>
            </tbody>
          </table>
        </section>

        <footer className="inv-foot">
          <div className="inv-sign"><span />Recibido por</div>
          <p>¡Gracias por su compra! · {NEGOCIO.nombre}</p>
        </footer>
      </article>
    </div>
  )
}
