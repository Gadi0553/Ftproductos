import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  COMPROBANTE_ACCEPT, COMPROBANTE_MAX_MB, adjuntarComprobante, esPdf, useComprobanteUrl, validarComprobante,
} from '../lib/comprobantes'
import { fmtDate } from '../lib/format'
import { errMsg } from '../lib/supabase'
import type { Order } from '../lib/types'

/* ------------------------------------------------------------------ */
/* Selector de archivo con vista previa (se usa en el carrito)          */
/* ------------------------------------------------------------------ */
export function ComprobantePicker({ file, onChange, label = 'Comprobante de la transferencia' }: {
  file: File | null
  onChange: (f: File | null) => void
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  useEffect(() => {
    if (!file || file.type === 'application/pdf') { setPreview(null); return }
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const pick = (f?: File | null) => {
    if (!f) return
    const e = validarComprobante(f)
    setError(e)
    if (!e) onChange(f)
  }
  const onInput = (e: ChangeEvent<HTMLInputElement>) => { pick(e.target.files?.[0]); e.target.value = '' }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]) }

  return (
    <div className="comp-picker">
      <div className="label">{label}</div>
      {!file ? (
        <button type="button" className={`comp-drop ${over ? 'over' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)} onDrop={onDrop}>
          <span className="comp-drop-icon">📸</span>
          <b>Sube la captura del pago</b>
          <small>Toca aquí o arrastra la imagen · JPG, PNG o PDF · máx. {COMPROBANTE_MAX_MB} MB</small>
        </button>
      ) : (
        <div className="comp-selected">
          {preview ? <img src={preview} alt="Vista previa del comprobante" /> : <div className="comp-pdf">PDF</div>}
          <div className="grow">
            <b>{file.name}</b>
            <small className="muted">{(file.size / 1024 / 1024).toFixed(2)} MB · listo para enviar ✅</small>
            <div className="row">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => input.current?.click()}>Cambiar</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(null)}>Quitar</button>
            </div>
          </div>
        </div>
      )}
      <input ref={input} type="file" accept={COMPROBANTE_ACCEPT} hidden onChange={onInput} />
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Vista del comprobante guardado (imagen o enlace al PDF)              */
/* ------------------------------------------------------------------ */
export function ComprobanteImagen({ path, onLoad, className = '' }: {
  path: string
  onLoad?: () => void
  className?: string
}) {
  const { url, error } = useComprobanteUrl(path)
  // Avisar cuando ya se puede imprimir (error, o PDF que no se dibuja como imagen)
  useEffect(() => { if (error || (url && esPdf(path))) onLoad?.() }, [error, url, path, onLoad])
  if (error) return <div className="alert alert-warn">No se pudo cargar el comprobante.</div>
  if (!url) return <div className="comp-loading">Cargando comprobante…</div>
  if (esPdf(path)) {
    return (
      <a className="btn btn-sm btn-outline" href={url} target="_blank" rel="noreferrer">
        📄 Abrir comprobante (PDF)
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`comp-img ${className}`} title="Ver en tamaño completo">
      <img src={url} alt="Comprobante de la transferencia" onLoad={onLoad} onError={onLoad} />
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* Tarjeta del comprobante en el detalle del pedido                    */
/* ------------------------------------------------------------------ */
export function ComprobanteCard({ order, canUpload, onChanged }: {
  order: Order
  canUpload: boolean
  onChanged?: () => void
}) {
  const { user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [cambiando, setCambiando] = useState(false)

  if (order.metodo_pago !== 'transferencia') return null

  const enviar = async () => {
    if (!file || !user) return
    setBusy(true); setError(null)
    try {
      await adjuntarComprobante(order.id, file, user.id)
      setFile(null); setOk(true); setCambiando(false)
      onChanged?.()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="comp-card">
      <div className="row-between">
        <h3>🧾 Comprobante de pago</h3>
        {order.comprobante_path
          ? <span className="chip chip-ok">Recibido</span>
          : <span className="chip chip-warn">Pendiente</span>}
      </div>

      {order.comprobante_path && !cambiando && (
        <>
          <ComprobanteImagen path={order.comprobante_path} />
          {order.comprobante_at && <small className="muted">Subido el {fmtDate(order.comprobante_at)}</small>}
          {ok && <div className="alert alert-ok">¡Gracias! Recibimos tu comprobante.</div>}
          {canUpload && (
            <button type="button" className="btn btn-sm btn-outline" onClick={() => { setCambiando(true); setOk(false) }}>
              Reemplazar comprobante
            </button>
          )}
        </>
      )}

      {!order.comprobante_path && !canUpload && (
        <p className="muted">El cliente todavía no ha subido la captura de la transferencia.</p>
      )}

      {canUpload && (!order.comprobante_path || cambiando) && (
        <>
          {!order.comprobante_path && (
            <p className="muted">Sube aquí la captura de tu transferencia para que podamos confirmar el pago y despachar tu pedido.</p>
          )}
          <ComprobantePicker file={file} onChange={setFile} label="" />
          {error && <div className="alert alert-error">{error}</div>}
          <div className="row">
            <button type="button" className="btn btn-shine" disabled={!file || busy} onClick={enviar}>
              {busy ? 'Subiendo…' : 'Enviar comprobante'}
            </button>
            {cambiando && <button type="button" className="btn btn-ghost" onClick={() => { setCambiando(false); setFile(null) }}>Cancelar</button>}
          </div>
        </>
      )}
    </div>
  )
}
