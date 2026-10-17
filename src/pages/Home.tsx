import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCarousel from '../components/ProductCarousel'
import { iconoDe, useCategorias } from '../lib/categorias'
import { supabase } from '../lib/supabase'
import { useZonasActivas } from '../lib/zonas'
import { ZonesBanner } from '../components/ZoneNotice'
import type { Product } from '../lib/types'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([])
  const { user } = useAuth()
  const { zonas } = useZonasActivas()
  const { categorias } = useCategorias()

  useEffect(() => {
    supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('activo', true)
      .order('destacado', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setFeatured((data as Product[]) ?? []))
  }, [])

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow">Jugos naturales · Entrega a domicilio</span>
            <h1>Lo más fresco, <span className="hl">directo a tu negocio</span></h1>
            <p>
              Regístrate, marca la ubicación de tu empresa y haz tu pedido. Nosotros trazamos la ruta más rápida
              con Google Maps y Waze para llevártelo, y puedes seguir cada paso de la entrega.
            </p>
            <div className="hero-cta">
              <Link to="/tienda" className="btn btn-yellow btn-lg">Ver la tienda</Link>
              {!user && <Link to="/registro" className="btn btn-outline-light btn-lg">Registrar mi empresa</Link>}
            </div>
          </div>
          <div className="hero-art" aria-hidden>
            <div className="bottle b1">🧃</div>
            <div className="bottle b2">🍊</div>
            <div className="bottle b3">🥭</div>
          </div>
        </div>
      </section>

      <section className="container page">
        <div className="features">
          <div className="feature card"><span>📝</span><h3>1. Regístrate</h3><p>Crea tu perfil con los datos y la ubicación de tu empresa.</p></div>
          <div className="feature card"><span>🛒</span><h3>2. Compra</h3><p>Elige jugos por unidad, litro o galón, y otros productos.</p></div>
          <div className="feature card"><span>🧭</span><h3>3. Ruta óptima</h3><p>Calculamos el camino más rápido hasta ti con tráfico en tiempo real.</p></div>
          <div className="feature card"><span>📦</span><h3>4. Seguimiento</h3><p>Ves cada paso y nota de la entrega hasta que llega.</p></div>
        </div>

        <ZonesBanner zonas={zonas} />
        {featured.length ? (
          <>
            {featured.some((p) => p.destacado) && (
              <ProductCarousel
                title="⭐ Productos destacados"
                products={featured.filter((p) => p.destacado)}
                action={<Link to="/tienda" className="see-all">Ver tienda</Link>}
              />
            )}
            {categorias
              .filter((c) => featured.some((p) => p.categoria === c.nombre))
              .map((c) => (
                <ProductCarousel
                  key={c.id}
                  title={<>{iconoDe(c.nombre, categorias)} {c.nombre}</>}
                  products={featured.filter((p) => p.categoria === c.nombre)}
                />
              ))}
          </>
        ) : (
          <p className="muted">Pronto tendremos productos disponibles.</p>
        )}
      </section>
    </>
  )
}
