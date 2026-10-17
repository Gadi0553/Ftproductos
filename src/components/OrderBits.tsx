import { estadoLabel, fmtDate } from '../lib/format'
import type { DeliveryLog, OrderStatus } from '../lib/types'

export function StatusBadge({ estado }: { estado: OrderStatus | null }) {
  return <span className={`status status-${estado}`}>{estadoLabel(estado)}</span>
}

const FLOW: OrderStatus[] = ['pendiente', 'confirmado', 'preparando', 'en_camino', 'entregado']

export function OrderProgress({ estado }: { estado: OrderStatus }) {
  if (estado === 'cancelado') return <div className="alert alert-error">Este pedido fue cancelado.</div>
  const idx = FLOW.indexOf(estado)
  return (
    <div className="progress">
      {FLOW.map((s, i) => (
        <div key={s} className={`progress-step ${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''}`}>
          <div className="dot">{i < idx ? '✓' : i + 1}</div>
          <span>{estadoLabel(s)}</span>
        </div>
      ))}
    </div>
  )
}

export function LogTimeline({ logs, onDelete }: { logs: DeliveryLog[]; onDelete?: (id: string) => void }) {
  if (!logs.length) return <p className="muted">Aún no hay movimientos registrados.</p>
  return (
    <ul className="timeline">
      {logs.map((l) => (
        <li key={l.id}>
          <div className="tl-dot" />
          <div className="tl-body">
            <div className="tl-head">
              {l.estado && <StatusBadge estado={l.estado} />}
              <small>{fmtDate(l.created_at)} · {l.autor ?? 'Sistema'}</small>
            </div>
            <p>{l.nota}</p>
            {l.latitude != null && l.longitude != null && (
              <a className="small-link" target="_blank" rel="noreferrer"
                 href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`}>
                📍 Ver ubicación registrada
              </a>
            )}
            {onDelete && (
              <button className="link-danger" onClick={() => onDelete(l.id)}>Eliminar</button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
