import { useEffect, useMemo, useState } from 'react'
import ProductCard from '../components/ProductCard'
import ProductCarousel from '../components/ProductCarousel'
import { Loading } from '../components/Guards'
import { supabase } from '../lib/supabase'
import { useZonasActivas } from '../lib/zonas'
import { iconoDe, useCategorias } from '../lib/categorias'
import { ZonesBanner } from '../components/ZoneNotice'
import type { Product } from '../lib/types'

export default function Store() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const { zonas } = useZonasActivas()
  const { categorias } = useCategorias()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todas')
  const [sort, setSort] = useState<'nuevo' | 'precio-asc' | 'precio-desc' | 'nombre'>('nuevo')

  useEffect(() => {
    supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProducts((data as Product[]) ?? [])
        setLoading(false)
      })
  }, [])

  const cats = useMemo(() => {
    const usadas = new Set(products.map((p) => p.categoria))
    const ordenadas = categorias.filter((c) => usadas.has(c.nombre)).map((c) => c.nombre)
    const sueltas = Array.from(usadas).filter((n) => !ordenadas.includes(n))
    return ['Todas', ...ordenadas, ...sueltas]
  }, [products, categorias])
  const minPrice = (p: Product) => Math.min(...(p.product_variants ?? []).map((v) => Number(v.precio)), Infinity)

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const r = products.filter(
      (p) =>
        (cat === 'Todas' || p.categoria === cat) &&
        (!t || [p.nombre, p.sabor, p.marca, p.descripcion, p.categoria].some((x) => x?.toLowerCase().includes(t))),
    )
    if (sort === 'precio-asc') r.sort((a, b) => minPrice(a) - minPrice(b))
    if (sort === 'precio-desc') r.sort((a, b) => minPrice(b) - minPrice(a))
    if (sort === 'nombre') r.sort((a, b) => a.nombre.localeCompare(b.nombre))
    return r
  }, [products, q, cat, sort])

  return (
    <div className="container page">
      <ZonesBanner zonas={zonas} />
      <div className="page-head">
        <h1>Tienda</h1>
        <p className="muted">Todo lo de tu colmado: jugos, bebidas, víveres, comestibles, limpieza y más.</p>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Buscar producto, marca o sabor…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="nuevo">Más nuevos</option>
          <option value="precio-asc">Precio: menor a mayor</option>
          <option value="precio-desc">Precio: mayor a menor</option>
          <option value="nombre">Nombre A-Z</option>
        </select>
      </div>
      <div className="cat-pills">
        {cats.map((c) => (
          <button key={c} className={c === cat ? 'active' : ''} onClick={() => setCat(c)}>
            {c === 'Todas' ? '🛒' : iconoDe(c, categorias)} {c}
          </button>
        ))}
      </div>
      {loading ? <Loading /> : !list.length ? (
        <div className="card empty"><p>No hay productos que coincidan.</p></div>
      ) : cat === 'Todas' && !q.trim() ? (
        // Vista tipo Amazon: una fila deslizable por categoría
        <>
          {list.some((p) => p.destacado) && (
            <ProductCarousel title="⭐ Destacados" products={list.filter((p) => p.destacado)} />
          )}
          {cats.filter((c) => c !== 'Todas').map((c) => (
            <ProductCarousel
              key={c}
              title={<>{iconoDe(c, categorias)} {c}</>}
              products={list.filter((p) => p.categoria === c)}
              action={<button className="link see-all" onClick={() => setCat(c)}>Ver todo</button>}
            />
          ))}
        </>
      ) : (
        <div className="products-grid">{list.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      )}
    </div>
  )
}
