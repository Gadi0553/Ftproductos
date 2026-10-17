import { useEffect, useRef, useState } from 'react'

// La librería de QR se carga desde un CDN en el navegador: no hace falta instalar nada con npm.
type QRLib = {
  toCanvas: (c: HTMLCanvasElement, text: string, opts: Record<string, unknown>) => Promise<void>
}
let qrLib: Promise<QRLib> | null = null
function loadQR(): Promise<QRLib> {
  if (!qrLib) {
    const url = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm'
    qrLib = import(/* @vite-ignore */ url).then((m) => (m.default ?? m) as QRLib)
    qrLib.catch(() => { qrLib = null })
  }
  return qrLib
}

const DESTINOS = [
  { path: '/', label: 'Página de inicio' },
  { path: '/tienda', label: 'Tienda' },
  { path: '/registro', label: 'Crear cuenta de cliente' },
]

const NAVY = '#0a1f44'

/** Genera el código QR de la página para imprimir o compartir. */
export default function QrCode() {
  const [base, setBase] = useState(window.location.origin)
  const [path, setPath] = useState('/tienda')
  const [titulo, setTitulo] = useState('¡Escanea y pide tus jugos!')
  const [error, setError] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  const url = `${base.replace(/\/+$/, '')}${path}`
  const isLocal = /localhost|127\.0\.0\.1/.test(base)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    setError(null)
    loadQR().then((QRCode) => QRCode.toCanvas(c, url, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'H', // permite poner el logo en el centro
      color: { dark: NAVY, light: '#ffffff' },
    }))
      .then(() => {
        // Logo en el centro
        const ctx = c.getContext('2d')
        if (!ctx) return
        const img = new Image()
        img.onload = () => {
          const s = c.width * 0.2
          const x = (c.width - s) / 2
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(x - 12, x - 12, s + 24, s + 24)
          ctx.drawImage(img, x, x, s, s)
        }
        img.src = '/favicon.png'
      })
      .catch(() => setError('No se pudo generar el QR. Revisa tu conexión a internet y recarga la página.'))
  }, [url])

  const download = () => {
    const c = canvas.current
    if (!c) return
    const a = document.createElement('a')
    a.download = `qr-ftproductos${path.replace(/\//g, '-') || ''}.png`
    a.href = c.toDataURL('image/png')
    a.click()
  }

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'FT Productos', text: titulo, url })
      else {
        await navigator.clipboard.writeText(url)
        alert('Enlace copiado')
      }
    } catch {
      /* cancelado */
    }
  }

  return (
    <>
      <h1 className="no-print">Código QR de la página</h1>

      <div className="qr-layout">
        <div className="card form no-print">
          <label>Dirección de tu página
            <input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://ftproductos.vercel.app" />
          </label>
          {isLocal && (
            <div className="alert alert-warn">
              Estás en <b>localhost</b>: ese QR solo abre la página en esta misma computadora.
              Cuando publiques la web, abre esta pantalla desde tu dominio (o escribe la dirección arriba) y el QR se generará con ella.
            </div>
          )}
          <label>¿A dónde lleva el QR?
            <select value={path} onChange={(e) => setPath(e.target.value)}>
              {DESTINOS.map((d) => <option key={d.path} value={d.path}>{d.label}</option>)}
            </select>
          </label>
          <label>Texto del cartel
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="row">
            <button className="btn btn-primary" onClick={download}>⬇ Descargar PNG</button>
            <button className="btn btn-yellow" onClick={() => window.print()}>🖨 Imprimir cartel</button>
            <button className="btn btn-outline" onClick={share}>Compartir enlace</button>
          </div>
        </div>

        <div className="qr-poster print-area">
          <div className="qr-brand">
            <img src="/logo-light.png" alt="FT" />
            <span><b>Productos</b></span>
          </div>
          <h2>{titulo}</h2>
          <canvas ref={canvas} className="qr-canvas" />
          <p className="qr-url">{url.replace(/^https?:\/\//, '')}</p>
          <small>Jugos naturales · Entrega directa a tu negocio</small>
        </div>
      </div>
    </>
  )
}

