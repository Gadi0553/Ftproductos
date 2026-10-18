import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loading } from '../../components/Guards'
import { LogTimeline, OrderProgress, StatusBadge } from '../../components/OrderBits'
import RoutePanel from '../../components/RoutePanel'
import { useAuth } from '../../context/AuthContext'
import { estadoLabel, fmtDate, fmtMoney } from '../../lib/format'
import { getCurrentPosition } from '../../lib/maps'
import { errMsg, supabase } from '../../lib/supabase'
import { DeliveryLog, ESTADOS, LatLng, Order, OrderStatus, Profile } from '../../lib/types'
import { ComprobanteCard } from '../../components/Comprobante'

type Quick = { estado: OrderStatus | null; nota: string; label: string }

const QUICK_ADMIN: Quick[] = [
  { estado: 'confirmado', nota: 'Pedido confirmado', label: '✔ Confirmar' },
  { estado: 'preparando', nota: 'Preparando el pedido', label: '🧃 Preparando' },
  { estado: 'en_camino', nota: 'Salió a entregar el pedido', label: '🛵 En camino' },
  { estado: 'entregado', nota: 'Pedido entregado al cliente', label: '✅ Entregado' },
  { estado: 'cancelado', nota: 'Pedido cancelado', label: '✖ Cancelar' },
]

const QUICK_DELIVERY: Quick[] = [
  { estado: 'preparando', nota: 'Recogiendo el pedido en almacén', label: '📦 Recogiendo' },
  { estado: 'en_camino', nota: 'Salí a entregar el pedido', label: '🛵 Salí a entregar' },
  { estado: null, nota: 'Hay tráfico, puede haber retraso', label: '🚦 Retraso' },
  { estado: null, nota: 'Llegué al lugar del cliente', label: '📍 Llegué' },
  { estado: 'entregado', nota: 'Pedido entregado al cliente', label: '✅ Entregado' },
]

const DELIVERY_STATES: OrderStatus[] = ['preparando', 'en_camino', 'entregado']

/**
 * Pantalla de trabajo de una entrega. La usan:
 *  - Administrador (/admin/pedidos/:id): todo + asignar repartidor + cualquier estado
 *  - Delivery (/delivery/:id): tomar el pedido, ruta, bitácora y estados de reparto
 */
export default function OrderDelivery() {
  const { id } = useParams()
  const { user, isAdmin } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [repartidores, setRepartidores] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [nota, setNota] = useState('')
  const [estado, setEstado] = useState<OrderStatus | ''>('')
  const [withLoc, setWithLoc] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState<LatLng | null>(null)

  const load = useCallback(async () => {
    const [{ data: o }, { data: l }] = await Promise.all([
      supabase.from('orders').select('*, order_items(*)').eq('id', id!).maybeSingle(),
      supabase.from('delivery_logs').select('*').eq('order_id', id!).order('created_at', { ascending: false }),
    ])
    setOrder(o as Order | null)
    setLogs((l as DeliveryLog[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const ch = supabase.channel(`work-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_logs', filter: `order_id=eq.${id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('profiles').select('*').in('role', ['delivery', 'admin']).order('nombre')
      .then(({ data }) => setRepartidores((data as Profile[]) ?? []))
  }, [isAdmin])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const addLog = (st: OrderStatus | null, text: string) => run(async () => {
    if (!order || !text.trim()) return
    let pos: LatLng | null = null
    if (withLoc) pos = origin ?? (await getCurrentPosition().catch(() => null))
    const { error } = await supabase.rpc('add_delivery_log', {
      p_order: order.id,
      p_nota: text.trim(),
      p_estado: st,
      p_lat: pos?.lat ?? null,
      p_lng: pos?.lng ?? null,
    })
    if (error) throw error
    setNota('')
    setEstado('')
  })

  const take = () => run(async () => {
    const { error } = await supabase.rpc('take_order', { p_order: order!.id })
    if (error) throw error
  })

  const release = () => {
    if (!confirm('¿Liberar este pedido para que lo tome otro repartidor?')) return
    run(async () => {
      const { error } = await supabase.rpc('release_order', { p_order: order!.id })
      if (error) throw error
    })
  }

  const assign = (uid: string) => run(async () => {
    const r = repartidores.find((p) => p.id === uid)
    const { error } = await supabase.from('orders').update({ asignado_a: uid || null }).eq('id', order!.id)
    if (error) throw error
    await supabase.rpc('add_delivery_log', {
      p_order: order!.id,
      p_nota: uid ? `Asignado a ${r?.nombre || r?.email}` : 'Pedido sin repartidor asignado',
    })
  })

  const delLog = async (logId: string) => {
    if (!confirm('¿Eliminar esta nota?')) return
    await supabase.from('delivery_logs').delete().eq('id', logId)
    load()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    addLog(estado || null, nota || (estado ? `Estado cambiado a ${estadoLabel(estado)}` : ''))
  }

  if (loading) return <Loading />
  if (!order) {
    return <div className="card empty">Pedido no encontrado o ya fue tomado por otro repartidor.
      <Link to={isAdmin ? '/admin/pedidos' : '/delivery'}>Volver</Link></div>
  }

  const mine = order.asignado_a === user?.id
  const unassigned = !order.asignado_a
  const closed = order.estado === 'entregado' || order.estado === 'cancelado'
  const canWork = isAdmin || mine
  const hasDest = order.latitude != null && order.longitude != null
  const tel = order.cliente_telefono?.replace(/\D/g, '')
  const quick = isAdmin ? QUICK_ADMIN : QUICK_DELIVERY
  const estadosPermitidos = isAdmin ? ESTADOS : ESTADOS.filter((s) => DELIVERY_STATES.includes(s.value))

  return (
    <>
      <Link to={isAdmin ? '/admin/pedidos' : '/delivery'} className="back">← {isAdmin ? 'Pedidos' : 'Mis entregas'}</Link>
      <div className="row-between">
        <h1>Pedido #{order.numero} · {order.empresa}</h1>
        <Link to={`/factura/${order.id}`} className="btn btn-sm btn-yellow">🧾 Factura / PDF</Link>
        <StatusBadge estado={order.estado} />
      </div>
      <OrderProgress estado={order.estado} />

      {/* Asignación */}
      <div className="card assign-bar">
        {isAdmin ? (
          <label className="row">
            <b>🛵 Repartidor:</b>
            <select value={order.asignado_a ?? ''} disabled={busy} onChange={(e) => assign(e.target.value)}>
              <option value="">— Sin asignar (visible para todos los delivery) —</option>
              {repartidores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre || p.email} {p.role === 'admin' ? '(admin)' : ''}</option>
              ))}
            </select>
          </label>
        ) : unassigned ? (
          <div className="row-between">
            <span>Este pedido está <b>disponible</b>. Tómalo para encargarte de la entrega.</span>
            <button className="btn btn-yellow btn-lg" disabled={busy} onClick={take}>🙋 Tomar este pedido</button>
          </div>
        ) : mine ? (
          <div className="row-between">
            <span>✅ Este pedido está <b>asignado a ti</b>.</span>
            {!closed && <button className="btn btn-sm btn-outline" disabled={busy} onClick={release}>Liberar pedido</button>}
          </div>
        ) : (
          <span>Este pedido está asignado a otro repartidor.</span>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>🧭 Ruta de entrega</h3>
        {hasDest ? (
          <RoutePanel
            destination={{ lat: order.latitude!, lng: order.longitude! }}
            destName={`${order.empresa ?? 'Cliente'} — ${order.cliente_nombre ?? ''}`}
            onOrigin={setOrigin}
          />
        ) : (
          <div className="alert alert-warn">Este pedido no tiene coordenadas de entrega.</div>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Cliente</h3>
          <p><b>{order.cliente_nombre}</b><br />{order.empresa}<br /><small className="muted">{order.direccion}</small>{order.zona && <><br /><span className="chip">📍 Zona: {order.zona}</span></>}</p>
          {tel && (
            <div className="row">
              <a className="btn btn-sm btn-outline" href={`tel:${tel}`}>📞 Llamar</a>
              <a className="btn btn-sm btn-whatsapp" target="_blank" rel="noreferrer"
                 href={`https://wa.me/${tel.length === 10 ? '1' + tel : tel}?text=${encodeURIComponent(`Hola, le escribimos de FT Productos sobre su pedido #${order.numero}.`)}`}>
                WhatsApp
              </a>
            </div>
          )}
          <h3>Productos a entregar</h3>
          <table className="table">
            <tbody>
              {order.order_items?.map((i) => (
                <tr key={i.id}><td>{i.cantidad} ×</td><td>{i.nombre}<br /><small className="muted">{i.presentacion}</small></td><td className="right">{fmtMoney(i.subtotal)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td /><td><b>Cobrar · {order.metodo_pago}</b></td><td className="right"><b>{fmtMoney(order.total)}</b></td></tr></tfoot>
          </table>
          {order.notas_cliente && <div className="alert alert-warn"><b>Nota del cliente:</b> {order.notas_cliente}</div>}
          <ComprobanteCard order={order} canUpload={false} />
          <small className="muted">Creado: {fmtDate(order.created_at)}</small>
        </div>

        <div className="card">
          <h3>📝 Bitácora de la entrega</h3>
          {canWork ? (
            <>
              <div className="quick">
                {quick.map((qk) => (
                  <button key={qk.label} type="button" className="chip-btn" disabled={busy || (closed && !isAdmin)}
                          onClick={() => addLog(qk.estado, qk.nota)}>{qk.label}</button>
                ))}
              </div>
              <form onSubmit={submit} className="form log-form">
                <textarea rows={3} placeholder="Escribe una nota o detalle de este paso (tráfico, quién recibió, incidencia…)" value={nota} onChange={(e) => setNota(e.target.value)} />
                <div className="row">
                  <select value={estado} onChange={(e) => setEstado(e.target.value as OrderStatus | '')}>
                    <option value="">Mantener estado ({estadoLabel(order.estado)})</option>
                    {estadosPermitidos.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <label className="check"><input type="checkbox" checked={withLoc} onChange={(e) => setWithLoc(e.target.checked)} /> Adjuntar mi ubicación</label>
                  <button className="btn btn-primary" disabled={busy || (!nota.trim() && !estado)}>{busy ? 'Guardando…' : 'Agregar paso'}</button>
                </div>
              </form>
            </>
          ) : (
            <div className="alert alert-warn">Toma el pedido para poder registrar pasos de la entrega.</div>
          )}
          <LogTimeline logs={logs} onDelete={isAdmin ? delLog : undefined} />
        </div>
      </div>
    </>
  )
}
