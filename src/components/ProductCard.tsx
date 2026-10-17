import { Link } from 'react-router-dom'
import type { Product } from '../lib/types'
import { fmtMoney } from '../lib/format'

/** Tarjeta de producto: toda la tarjeta abre el detalle para comprar. */
export default function ProductCard({ product }: { product: Product }) {
  const img = product.imagenes?.[0]
  const variants = (product.product_variants ?? []).filter((v) => v.activo)
  const agotado = variants.length > 0 && variants.every((v) => v.stock <= 0)
  const precios = variants.map((v) => Number(v.precio))
  const min = precios.length ? Math.min(...precios) : null
  const max = precios.length ? Math.max(...precios) : null

  return (
    <Link to={`/producto/${product.id}`} className={`pcard ${agotado ? 'is-out' : ''}`} aria-label={`Ver ${product.nombre}`}>
      <div className="pcard-img">
        {img ? <img src={img} alt={product.nombre} loading="lazy" /> : <div className="pcard-noimg">🧃</div>}
        {product.destacado && <span className="pcard-ribbon">★ Destacado</span>}
        {agotado && <span className="pcard-out">Agotado</span>}
        <span className="pcard-cta">Ver y comprar →</span>
      </div>
      <div className="pcard-body">
        <small className="pcard-cat">{product.marca ? `${product.marca} · ` : ''}{product.categoria}{product.sabor ? ` · ${product.sabor}` : ''}</small>
        <h3>{product.nombre}</h3>
        <div className="pcard-tags">
          {product.es_natural && <span className="ptag ptag-green">🌿 Natural</span>}
          {product.sin_azucar && <span className="ptag ptag-yellow">Sin azúcar</span>}
          {product.requiere_refrigeracion && <span className="ptag ptag-blue">❄️ Refrigerado</span>}
        </div>
        {min != null && (
          <div className="pcard-price">
            {min !== max && <small>Desde</small>}
            <b>{fmtMoney(min)}</b>
          </div>
        )}
      </div>
    </Link>
  )
}
