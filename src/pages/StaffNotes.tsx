import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { destinatario, estadoLabel } from '../lib/format'
import { errMsg, supabase } from '../lib/supabase'
import type { OrderStatus } from '../lib/types'

export interface StaffNote {
  id: string
  autor_id: string | null
  autor: string | null
  rol: string | null
  mensaje: string
  pedido_numero: number | null
  delivery_id: string | null
  created_at: string
}

interface Repartidor { id: string; nombre: string | null; email: string | null }
interface PedidoAsignado { id: string; numero: number; estado: OrderStatus; empresa: string | null; cliente_nombre: string | null }
const ACTIVOS: OrderStatus[] = ['pendiente', 'confirmado', 'preparando', 'en_camino']
/** Clave del chat general (notas sin delivery_id) */
export const GENERAL = 'general'
const hiloDe = (n: { delivery_id: string | null }) => n.delivery_id ?? GENERAL

/* ------------------------------------------------------------------ */
/* "Leído" por conversación (se guarda en este navegador)               */
/* ------------------------------------------------------------------ */
const vistoKey = (hilo: string) => `ft-notas-visto:${hilo}`
const leerVisto = (hilo: string) => { try { return localStorage.getItem(vistoKey(hilo)) ?? '' } catch { return '' } }
const marcarVisto = (hilo: string) => {
  try { localStorage.setItem(vistoKey(hilo), new Date().toISOString()) } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event('ft-notas-visto'))
}
const esNoLeida = (n: Pick<StaffNote, 'autor_id' | 'delivery_id' | 'created_at'>, yo?: string) =>
  n.autor_id !== yo && n.created_at > leerVisto(hiloDe(n))

/** Cantidad de notas sin leer (para el globito rojo de la barra superior). */
export function useNotasSinLeer(activo: boolean, userId?: string) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!activo || !userId) { setN(0); return }
    const contar = async () => {
      const { data } = await supabase.from('staff_notes').select('id, autor_id, delivery_id, created_at')
        .neq('autor_id', userId)
        .order('created_at', { ascending: false }).limit(300)
      setN(((data as StaffNote[]) ?? []).filter((x) => esNoLeida(x, userId)).length)
    }
    contar()
    const ch = supabase.channel('notas-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_notes' }, contar)
      .subscribe()
    window.addEventListener('ft-notas-visto', contar)
    return () => { supabase.removeChannel(ch); window.removeEventListener('ft-notas-visto', contar) }
  }, [activo, userId])
  return n
}

/* ------------------------------------------------------------------ */
const hora = (d: string) => new Date(d).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })
const dia = (d: string) => {
  const f = new Date(d), hoy = new Date(), ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
  if (f.toDateString() === hoy.toDateString()) return 'Hoy'
  if (f.toDateString() === ayer.toDateString()) return 'Ayer'
  return f.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
}
const cuando = (d: string) => dia(d) === 'Hoy' ? hora(d) : dia(d) === 'Ayer' ? 'Ayer' : new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
const nombreDe = (r?: Repartidor | null) => (r?.nombre && r.nombre.trim()) || r?.email || 'Delivery'
const inicial = (s: string) => s.trim().charAt(0).toUpperCase() || '?'

/** Notas del equipo: chat general de todo el equipo + una conversación privada admin ↔ cada delivery. */
export default function StaffNotes() {
  const { user, isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [notas, setNotas] = useState<StaffNote[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setTick] = useState(0) // re-render al marcar leídas

  // Conversación abierta. Admin: general o un delivery. Delivery: general o su chat privado.
  const d = params.get('d')
  const actual = isAdmin ? d : d === GENERAL ? GENERAL : d === 'privado' ? user?.id ?? null : null

  useEffect(() => {
    if (!user) return
    const cargar = async () => {
      const [{ data: n, error: e1 }, reps] = await Promise.all([
        supabase.from('staff_notes').select('*')
          .order('created_at', { ascending: false }).limit(1000),
        isAdmin
          ? supabase.from('profiles').select('id, nombre, email').eq('role', 'delivery').order('nombre')
          : Promise.resolve({ data: [] as Repartidor[] }),
      ])
      if (e1) setError(errMsg(e1))
      setNotas(((n as StaffNote[]) ?? []).reverse())
      setRepartidores((reps.data as Repartidor[]) ?? [])
      setCargando(false)
    }
    cargar()
    const ch = supabase.channel('notas-equipo')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_notes' }, (p) => {
        const x = p.new as StaffNote
        setNotas((prev) => prev.some((y) => y.id === x.id) ? prev : [...prev, x])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'staff_notes' }, (p) => {
        const id = (p.old as { id?: string }).id
        setNotas((prev) => prev.filter((y) => y.id !== id))
      })
      .subscribe()
    const onVisto = () => setTick((t) => t + 1)
    window.addEventListener('ft-notas-visto', onVisto)
    return () => { supabase.removeChannel(ch); window.removeEventListener('ft-notas-visto', onVisto) }
  }, [user, isAdmin])

  // Resumen por conversación (último mensaje y no leídas) para la lista del admin
  const resumen = useMemo(() => {
    const m = new Map<string, { ultima?: StaffNote; sinLeer: number }>()
    for (const n of notas) {
      const h = hiloDe(n)
      const r = m.get(h) ?? { sinLeer: 0 }
      r.ultima = n
      if (esNoLeida(n, user?.id)) r.sinLeer++
      m.set(h, r)
    }
    return m
  }, [notas, user?.id])

  const lista = useMemo(() => [...repartidores].sort((a, b) => {
    const ta = resumen.get(a.id)?.ultima?.created_at ?? ''
    const tb = resumen.get(b.id)?.ultima?.created_at ?? ''
    return tb.localeCompare(ta) || nombreDe(a).localeCompare(nombreDe(b))
  }), [repartidores, resumen])

  const abrir = (id: string | null) => setParams(id ? { d: id } : {}, { replace: false })

  // Fila de la lista de conversaciones
  const Fila = ({ hilo, clave, nombre, avatar, extra }: { hilo: string; clave: string; nombre: string; avatar: string; extra?: string }) => {
    const s = resumen.get(hilo)
    const on = actual === hilo
    const ult = s?.ultima
    const quien = ult ? (ult.autor_id === user?.id ? 'Tú: ' : hilo === GENERAL ? `${(ult.autor || 'Equipo').split(' ')[0]}: ` : '') : ''
    return (
      <button type="button" className={`notas-conv ${on ? 'on' : ''} ${hilo === GENERAL ? 'general' : ''}`} onClick={() => abrir(clave)}>
        <span className={`notas-avatar ${hilo === GENERAL ? 'general' : ''}`}>{avatar}</span>
        <span className="notas-conv-txt">
          <span className="notas-conv-top">
            <b>{nombre}</b>
            {ult && <small>{cuando(ult.created_at)}</small>}
          </span>
          <span className="notas-conv-bottom">
            <small>{ult ? `${quien}${ult.mensaje}` : extra ?? 'Sin mensajes todavía'}</small>
            {!!s?.sinLeer && !on && <span className="nav-badge">{s.sinLeer}</span>}
          </span>
        </span>
      </button>
    )
  }

  if (!user) return null

  return (
    <div className="container page notas-page">
      <h1>💬 Notas del equipo</h1>
      <p className="muted">
        {isAdmin
          ? 'Usa el chat General para avisar a todos los delivery a la vez, o abre la conversación privada de cada uno.'
          : 'El chat General es de todo el equipo. Tu chat con el administrador es privado: solo ustedes dos pueden verlo.'}
      </p>
      {error && <div className="alert alert-error">{error}</div>}

      <div className={`card notas-shell con-lista ${actual ? 'abierta' : ''}`}>
        {!isAdmin && (
          <aside className="notas-side">
            <div className="notas-side-head">💬 Conversaciones</div>
            <Fila hilo={GENERAL} clave={GENERAL} nombre="General" avatar="📢" extra="Todo el equipo" />
            <Fila hilo={user.id} clave="privado" nombre="Administrador" avatar="A" extra="Tu chat privado" />
          </aside>
        )}
        {isAdmin && (
          <aside className="notas-side">
            <Fila hilo={GENERAL} clave={GENERAL} nombre="General · Todos los deliverys" avatar="📢" extra="Mensajes para todo el equipo" />
            <div className="notas-side-head">🛵 Deliverys ({repartidores.length})</div>
            {cargando && <p className="muted center">Cargando…</p>}
            {!cargando && !repartidores.length && (
              <p className="muted notas-side-empty">
                Aún no hay deliverys. Asigna el rol <b>Delivery</b> a un usuario en <b>Panel admin › Usuarios</b>.
              </p>
            )}
            {lista.map((r) => (
              <Fila key={r.id} hilo={r.id} clave={r.id} nombre={nombreDe(r)} avatar={inicial(nombreDe(r))} />
            ))}
          </aside>
        )}

        {actual ? (
          <Conversacion
            key={actual}
            hilo={actual}
            titulo={actual === GENERAL ? 'General' : isAdmin ? nombreDe(repartidores.find((r) => r.id === actual)) : 'Administrador'}
            subtitulo={actual === GENERAL
              ? (isAdmin ? `Todo el equipo · ${repartidores.length} delivery${repartidores.length === 1 ? '' : 's'}` : 'Todo el equipo')
              : isAdmin ? 'Delivery · conversación privada' : 'Conversación privada'}
            notas={notas.filter((n) => hiloDe(n) === actual)}
            onEnviada={(n) => setNotas((prev) => prev.some((y) => y.id === n.id) ? prev : [...prev, n])}
            onBorrada={(id) => setNotas((prev) => prev.filter((y) => y.id !== id))}
            onVolver={() => abrir(null)}
            cargando={cargando}
          />
        ) : (
          <div className="notas-placeholder">
            <span>💬</span>
            <b>Elige una conversación</b>
            <small>Abre el chat General o una conversación de la lista para ver y enviar notas.</small>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Una conversación                                                     */
/* ------------------------------------------------------------------ */
function Conversacion({ hilo, titulo, subtitulo, notas, onEnviada, onBorrada, onVolver, cargando }: {
  hilo: string
  titulo: string
  subtitulo: string
  notas: StaffNote[]
  onEnviada: (n: StaffNote) => void
  onBorrada: (id: string) => void
  onVolver?: () => void
  cargando: boolean
}) {
  const { user, isAdmin } = useAuth()
  const [texto, setTexto] = useState('')
  const [pedido, setPedido] = useState('')          // pedido de la nota que se va a enviar
  const [filtro, setFiltro] = useState<number | null>(null) // pedido por el que se filtra el chat
  const [pedidos, setPedidos] = useState<PedidoAsignado[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const caja = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const esGeneral = hilo === GENERAL
  const deliveryId = esGeneral ? null : hilo

  // Pedidos asignados a este delivery (primero los que están en curso)
  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      // General: el admin ve los pedidos en curso de todos; un delivery, los suyos
      let q = supabase.from('orders').select('id, numero, estado, empresa, cliente_nombre')
      if (!esGeneral) q = q.eq('asignado_a', deliveryId!)
      else if (isAdmin) q = q.in('estado', ACTIVOS)
      else q = q.eq('asignado_a', user!.id)
      const { data } = await q.order('created_at', { ascending: false }).limit(60)
      if (!vivo) return
      const l = (data as PedidoAsignado[]) ?? []
      setPedidos([...l.filter((o) => ACTIVOS.includes(o.estado)), ...l.filter((o) => !ACTIVOS.includes(o.estado))])
    }
    cargar()
    const ch = supabase.channel(`notas-pedidos-${hilo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, cargar)
      .subscribe()
    return () => { vivo = false; supabase.removeChannel(ch) }
  }, [hilo, esGeneral, deliveryId, isAdmin, user])

  const cuenta = useMemo(() => {
    const m = new Map<number, number>()
    for (const n of notas) if (n.pedido_numero != null) m.set(n.pedido_numero, (m.get(n.pedido_numero) ?? 0) + 1)
    return m
  }, [notas])
  const visibles = filtro == null ? notas : notas.filter((n) => n.pedido_numero === filtro)
  const elegirFiltro = (num: number | null) => { setFiltro(num); setPedido(num == null ? '' : String(num)) }

  // Al ver la conversación, sus mensajes quedan leídos
  useEffect(() => { marcarVisto(hilo) }, [hilo, notas.length])

  useLayoutEffect(() => {
    const el = caja.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visibles.length, cargando, hilo, filtro])

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault()
    const msg = texto.trim()
    if (!msg || busy) return
    const num = parseInt(pedido.replace(/\D/g, ''), 10)
    setBusy(true); setError(null)
    const { data, error } = await supabase.from('staff_notes')
      .insert({ mensaje: msg, delivery_id: deliveryId, pedido_numero: Number.isFinite(num) ? num : null })
      .select('*').single()
    setBusy(false)
    if (error) return setError(errMsg(error))
    onEnviada(data as StaffNote)
    setTexto(''); setPedido(filtro == null ? '' : String(filtro))
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  const borrar = async (n: StaffNote) => {
    if (!confirm('¿Borrar esta nota?')) return
    const { error } = await supabase.from('staff_notes').delete().eq('id', n.id)
    if (error) return setError(errMsg(error))
    onBorrada(n.id)
  }

  const abrirPedido = async (numero: number) => {
    const { data } = await supabase.from('orders').select('id').eq('numero', numero).maybeSingle()
    if (!data) return setError(`No encontré el pedido #${numero} (o no tienes acceso a él).`)
    nav(isAdmin ? `/admin/pedidos/${data.id}` : `/delivery/${data.id}`)
  }

  let diaPrevio = ''
  return (
    <section className="notas-chat">
      <header className="notas-chat-head">
        {onVolver && <button type="button" className="notas-back" onClick={onVolver} aria-label="Volver a la lista">←</button>}
        <span className={`notas-avatar ${esGeneral ? 'general' : ''}`}>{esGeneral ? '📢' : inicial(titulo)}</span>
        <div><b>{titulo}</b><small>{subtitulo}</small></div>
      </header>

      <div className="notas-filtro" role="tablist" aria-label={esGeneral ? 'Filtrar por pedido en curso' : 'Filtrar por pedido asignado'}>
        <button type="button" role="tab" aria-selected={filtro == null} className={`notas-chip ${filtro == null ? 'on' : ''}`} onClick={() => elegirFiltro(null)}>
          Todas <span>{notas.length}</span>
        </button>
        {pedidos.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={filtro === o.numero}
                  className={`notas-chip ${filtro === o.numero ? 'on' : ''} ${ACTIVOS.includes(o.estado) ? 'activo' : 'cerrado'}`}
                  title={`${destinatario(o)} · ${estadoLabel(o.estado)}`}
                  onClick={() => elegirFiltro(filtro === o.numero ? null : o.numero)}>
            📦 #{o.numero} <em>{destinatario(o)}</em> <i>{estadoLabel(o.estado)}</i>
            {!!cuenta.get(o.numero) && <span>{cuenta.get(o.numero)}</span>}
          </button>
        ))}
        {!pedidos.length && <small className="muted notas-filtro-vacio">{esGeneral && isAdmin ? 'No hay pedidos en curso.' : 'No tiene pedidos asignados todavía.'}</small>}
      </div>

      <div className="notas-list" ref={caja}>
        {cargando && <p className="muted center">Cargando notas…</p>}
        {!cargando && !!notas.length && !visibles.length && filtro != null && (
          <div className="notas-empty">
            <span>📦</span>
            <b>Sin notas del pedido #{filtro}</b>
            <small>Escribe abajo y la nota quedará ligada a este pedido.</small>
          </div>
        )}
        {!cargando && !notas.length && (
          <div className="notas-empty">
            <span>💬</span>
            <b>Todavía no hay notas</b>
            <small>Escribe la primera: avisos, cambios de ruta, pedidos urgentes…</small>
          </div>
        )}
        {visibles.map((n) => {
          const mia = n.autor_id === user?.id
          const d = dia(n.created_at)
          const sep = d !== diaPrevio ? (diaPrevio = d) : null
          return (
            <div key={n.id}>
              {sep && <div className="notas-day"><span>{sep}</span></div>}
              <div className={`nota ${mia ? 'mia' : ''}`}>
                <div className="nota-bubble">
                  {esGeneral && !mia && (
                    <div className="nota-autor">
                      <b>{n.autor || 'Equipo'}</b>
                      {n.rol && <span className={`nota-rol ${n.rol}`}>{n.rol === 'admin' ? 'Admin' : 'Delivery'}</span>}
                    </div>
                  )}
                  {n.pedido_numero != null && (
                    <button type="button" className="nota-pedido" onClick={() => abrirPedido(n.pedido_numero!)}>
                      📦 Pedido #{n.pedido_numero}
                    </button>
                  )}
                  <p>{n.mensaje}</p>
                  <div className="nota-meta">
                    <span>{hora(n.created_at)}</span>
                    {(mia || isAdmin) && (
                      <button type="button" className="nota-del" title="Borrar nota" onClick={() => borrar(n)}>✕</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && <div className="alert alert-error notas-err">{error}</div>}

      <form className="notas-form" onSubmit={enviar}>
        <select className="notas-pedido" value={pedido} onChange={(e) => setPedido(e.target.value)} aria-label="Pedido de la nota">
          <option value="">Sin pedido</option>
          {pedidos.map((o) => <option key={o.id} value={o.numero}>#{o.numero} · {destinatario(o)}</option>)}
        </select>
        <textarea
          rows={1}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKey}
          maxLength={2000}
          placeholder={esGeneral ? 'Escribe a todo el equipo… (Enter envía, Shift+Enter nueva línea)' : `Escribe a ${titulo}… (Enter envía, Shift+Enter nueva línea)`}
          aria-label="Mensaje"
        />
        <button className="btn btn-shine" disabled={busy || !texto.trim()}>{busy ? 'Enviando…' : 'Enviar'}</button>
      </form>
    </section>
  )
}
