import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MapView from '../components/MapView'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { fmtMoney } from '../lib/format'
import BankInfo from '../components/BankInfo'
import { errMsg, supabase } from '../lib/supabase'
import { nombresZonas, useZonasActivas, zonaPara } from '../lib/zonas'

export default function Cart() {
  const { items, total, setQty, remove, clear } = useCart()
  const { user, client } = useAuth()
  const [notas, setNotas] = useState('')
  const [metodo, setMetodo] = useState<'efectivo' | 'transferencia' | 'tarjeta'>('efectivo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const { zonas } = useZonasActivas()
  const zona = client ? zonaPara({ lat: client.latitude, lng: client.longitude }, zonas) : null
  const fueraDeZona = !!client && zonas.length > 0 && !zona

  const checkout = async () => {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_order', {
      items: items.map((i) => ({ variant_id: i.variantId, cantidad: i.cantidad })),
      notas: notas || null,
      metodo,
    })
    setBusy(false)
    if (error) return setError(errMsg(error))
    clear()
    nav(`/mis-pedidos/${data}`, { state: { nuevo: true } })
  }

  if (!items.length) {
    return (
      <div className="container page">
        <div className="card empty">
          <h2>Tu carrito está vacío</h2>
          <Link to="/tienda" className="btn btn-primary">Ir a la tienda</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <h1>Carrito</h1>
      <div className="cart-layout">
        <div className="card">
          {items.map((i) => (
            <div key={i.variantId} className="cart-row">
              {i.imagen ? <img src={i.imagen} alt="" /> : <div className="no-img sm">🧃</div>}
              <div className="grow">
                <b>{i.nombre}</b>
                <small className="muted">{i.presentacion} · {fmtMoney(i.precio)}</small>
              </div>
              <div className="qty sm">
                <button onClick={() => setQty(i.variantId, i.cantidad - 1)}>−</button>
                <span>{i.cantidad}</span>
                <button onClick={() => setQty(i.variantId, i.cantidad + 1)}>+</button>
              </div>
              <b className="w-money">{fmtMoney(i.precio * i.cantidad)}</b>
              <button className="icon-btn" title="Quitar" onClick={() => remove(i.variantId)}>✕</button>
            </div>
          ))}
        </div>

        <aside className="card checkout">
          <h3>Resumen</h3>
          <div className="row-between"><span>Total</span><b className="price big">{fmtMoney(total)}</b></div>

          {!user ? (
            <>
              <p className="muted">Inicia sesión o crea tu cuenta para completar la compra.</p>
              <Link to="/login" state={{ from: '/carrito' }} className="btn btn-primary block">Iniciar sesión</Link>
              <Link to="/registro" className="btn btn-outline block">Crear cuenta</Link>
            </>
          ) : !client ? (
            <>
              <div className="alert alert-warn">Antes de comprar, completa tu perfil y la ubicación de tu empresa.</div>
              <Link to="/perfil" className="btn btn-primary block">Completar perfil</Link>
            </>
          ) : (
            <>
              <h4>Entregar en</h4>
              <p><b>{client.empresa || client.local}</b><br /><small className="muted">{client.direccion}</small></p>
              <MapView height={180} markers={[{ id: 'c', pos: { lat: client.latitude, lng: client.longitude }, title: client.empresa ?? 'Mi empresa' }]} />
              <Link to="/perfil" className="small-link">Cambiar ubicación</Link>
              {zona && <div className="alert alert-ok">✅ Zona de entrega: <b>{zona.nombre}</b></div>}
              {fueraDeZona && (
                <div className="alert alert-warn">
                  ⚠️ Tu empresa está fuera de nuestra zona de entrega. Por ahora solo entregamos en: <b>{nombresZonas(zonas)}</b>.
                </div>
              )}
              <label>Método de pago
                <select value={metodo} onChange={(e) => setMetodo(e.target.value as typeof metodo)}>
                  <option value="efectivo">Efectivo contra entrega</option>
                  <option value="transferencia">Transferencia bancaria</option>
                  <option value="tarjeta">Tarjeta al recibir</option>
                </select>
              </label>
              {metodo === 'transferencia' && <BankInfo total={total} />}
              <label>Notas para la entrega
                <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Horario, a quién entregar, etc." />
              </label>
              {error && <div className="alert alert-error">{error}</div>}
              <button className="btn btn-shine block btn-lg" disabled={busy || fueraDeZona} onClick={checkout}>
                {busy ? 'Procesando…' : `Confirmar pedido · ${fmtMoney(total)}`}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
