import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loading } from '../components/Guards'
import { useCart } from '../context/CartContext'
import { fmtMoney, presentacionTexto } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Product } from '../lib/types'

export default function ProductDetail() {
  const { id } = useParams()
  const [p, setP] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [img, setImg] = useState(0)
  const [vid, setVid] = useState<string>()
  const [qty, setQty] = useState(1)
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    supabase.from('products').select('*, product_variants(*)').eq('id', id!).maybeSingle().then(({ data }) => {
      const prod = data as Product | null
      setP(prod)
      const vs = (prod?.product_variants ?? []).filter((v) => v.activo).sort((a, b) => a.precio - b.precio)
      setVid(vs.find((v) => v.stock > 0)?.id ?? vs[0]?.id)
      setLoading(false)
    })
  }, [id])

  if (loading) return <Loading />
  if (!p) return <div className="container page"><div className="card empty">Producto no encontrado. <Link to="/tienda">Volver</Link></div></div>

  const variants = (p.product_variants ?? []).filter((v) => v.activo).sort((a, b) => a.precio - b.precio)
  const v = variants.find((x) => x.id === vid)

  const addToCart = (go: boolean) => {
    if (!v) return
    add({ variantId: v.id, productId: p.id, nombre: p.nombre, presentacion: v.nombre, precio: Number(v.precio), imagen: p.imagenes[0] ?? null, stock: v.stock }, qty)
    if (go) nav('/carrito')
    else { setAdded(true); setTimeout(() => setAdded(false), 1400) }
  }

  return (
    <div className="container page">
      <Link to="/tienda" className="back">← Volver a la tienda</Link>
      <div className="detail">
        <div className="gallery">
          <div className="gallery-main">
            {p.imagenes.length ? <img src={p.imagenes[img]} alt={p.nombre} /> : <div className="no-img big">🧃</div>}
          </div>
          {p.imagenes.length > 1 && (
            <div className="thumbs">
              {p.imagenes.map((u, i) => (
                <button key={u} className={i === img ? 'active' : ''} onClick={() => setImg(i)}><img src={u} alt="" /></button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <small className="cat">{p.categoria}{p.sabor ? ` · ${p.sabor}` : ''}</small>
          <h1>{p.nombre}</h1>
          <div className="chips">
            {p.es_natural && <span className="chip">🌿 Natural</span>}
            {p.sin_azucar && <span className="chip">Sin azúcar añadida</span>}
            {p.requiere_refrigeracion && <span className="chip">❄️ Mantener refrigerado</span>}
            {p.vida_util_dias && <span className="chip">⏱ Dura {p.vida_util_dias} días</span>}
          </div>
          {p.descripcion && <p>{p.descripcion}</p>}
          {p.ingredientes && <p className="muted"><b>Ingredientes:</b> {p.ingredientes}</p>}

          <h3>Elige la presentación</h3>
          <div className="variant-grid">
            {variants.map((x) => (
              <button key={x.id} disabled={x.stock <= 0} className={`variant ${x.id === vid ? 'active' : ''}`}
                      onClick={() => { setVid(x.id); setQty(1) }}>
                <b>{x.nombre}</b>
                <small>{presentacionTexto(x.unidad_medida, x.cantidad)}</small>
                <span>{fmtMoney(x.precio)}</span>
                <small className={x.stock > 0 ? 'ok' : 'bad'}>{x.stock > 0 ? `${x.stock} disponibles` : 'Agotado'}</small>
              </button>
            ))}
          </div>

          {v && (
            <div className="buy-box card">
              <div className="buy-top">
                <div className="qty qty-yellow">
                  <button aria-label="Menos" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                  <input type="number" min={1} max={v.stock} value={qty}
                         onChange={(e) => setQty(Math.max(1, Math.min(v.stock, Number(e.target.value) || 1)))} />
                  <button aria-label="Más" onClick={() => setQty(Math.min(v.stock, qty + 1))}>+</button>
                </div>
                <div className="buy-total">
                  <small>Total</small>
                  <span key={qty} className="price big pop">{fmtMoney(Number(v.precio) * qty)}</span>
                </div>
              </div>
              <div className="buy-actions">
                <button className={`btn btn-yellow-soft btn-lg ${added ? 'bump' : ''}`} disabled={v.stock <= 0} onClick={() => addToCart(false)}>
                  {added ? '✓ ¡Agregado!' : '🛒 Agregar al carrito'}
                </button>
                <button className="btn btn-shine btn-lg" disabled={v.stock <= 0} onClick={() => addToCart(true)}>
                  ⚡ Comprar ahora
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
