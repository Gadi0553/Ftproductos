import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loading } from '../../components/Guards'
import { presentacionTexto } from '../../lib/format'
import { errMsg, supabase, uploadProductImage } from '../../lib/supabase'
import { Product, UNIDADES, Unidad, Variant } from '../../lib/types'
import { esJugo, useCategorias } from '../../lib/categorias'

type VariantDraft = Omit<Variant, 'id' | 'product_id'> & { id?: string; key: string }

const newVariant = (nombre = '', unidad: Unidad = 'unidad', cantidad = 1): VariantDraft => ({
  key: Math.random().toString(36).slice(2),
  nombre, unidad_medida: unidad, cantidad, precio: 0, stock: 0, sku: '', activo: true,
})

type Preset = { label: string; v: [string, Unidad, number] }

/** Plantillas rápidas para jugos */
const PRESETS_JUGO: Preset[] = [
  { label: 'Vaso 12 oz', v: ['Vaso 12 oz', 'onza', 12] },
  { label: 'Botella 500 ml', v: ['Botella 500 ml', 'ml', 500] },
  { label: 'Litro', v: ['Litro', 'litro', 1] },
  { label: 'Medio galón', v: ['Medio galón', 'galon', 0.5] },
  { label: 'Galón', v: ['Galón', 'galon', 1] },
  { label: 'Caja 12 und', v: ['Caja 12 unidades', 'caja', 12] },
]

/** Plantillas rápidas para productos de colmado */
const PRESETS_COLMADO: Preset[] = [
  { label: 'Unidad', v: ['Unidad', 'unidad', 1] },
  { label: 'Libra', v: ['Libra', 'lb', 1] },
  { label: '½ libra', v: ['Media libra', 'media_libra', 1] },
  { label: '¼ libra', v: ['Cuarto de libra', 'cuarto_libra', 1] },
  { label: 'Funda', v: ['Funda', 'funda', 1] },
  { label: 'Sobre', v: ['Sobrecito', 'sobre', 1] },
  { label: 'Paquete', v: ['Paquete', 'paquete', 1] },
  { label: 'Lata', v: ['Lata', 'lata', 1] },
  { label: 'Botella', v: ['Botella', 'botella', 1] },
  { label: 'Jumbo', v: ['Jumbo', 'jumbo', 1] },
  { label: 'Six pack', v: ['Six pack', 'six_pack', 1] },
  { label: 'Caja', v: ['Caja', 'caja', 12] },
  { label: 'Docena', v: ['Docena', 'docena', 1] },
  { label: 'Cartón 30 huevos', v: ['Cartón de 30', 'carton', 30] },
  { label: 'Galón', v: ['Galón', 'galon', 1] },
  { label: 'Saco', v: ['Saco', 'saco', 1] },
]

const emptyProduct = {
  nombre: '', descripcion: '', categoria: '', sabor: '', marca: '', ingredientes: '',
  es_natural: false, sin_azucar: false, requiere_refrigeracion: false, vida_util_dias: '' as number | '',
  destacado: false, activo: true, imagenes: [] as string[],
}

export default function ProductForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const [p, setP] = useState(emptyProduct)
  const [variants, setVariants] = useState<VariantDraft[]>([newVariant('Unidad', 'unidad', 1)])
  const { categorias, reload: reloadCats } = useCategorias()
  const [newCat, setNewCat] = useState<{ nombre: string; icono: string } | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  const [loading, setLoading] = useState(!!id)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [folder] = useState(() => id ?? `nuevo-${Date.now()}`)

  useEffect(() => {
    if (!id) return
    supabase.from('products').select('*, product_variants(*)').eq('id', id).maybeSingle().then(({ data }) => {
      const prod = data as Product | null
      if (prod) {
        setP({
          nombre: prod.nombre, descripcion: prod.descripcion ?? '', categoria: prod.categoria, sabor: prod.sabor ?? '', marca: prod.marca ?? '',
          ingredientes: prod.ingredientes ?? '', es_natural: prod.es_natural, sin_azucar: prod.sin_azucar,
          requiere_refrigeracion: prod.requiere_refrigeracion, vida_util_dias: prod.vida_util_dias ?? '',
          destacado: prod.destacado, activo: prod.activo, imagenes: prod.imagenes ?? [],
        })
        setVariants((prod.product_variants ?? []).map((v) => ({ ...v, key: v.id })))
      }
      setLoading(false)
    })
  }, [id])

  const set = <K extends keyof typeof emptyProduct>(k: K, v: (typeof emptyProduct)[K]) => setP((s) => ({ ...s, [k]: v }))
  const setV = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  const removeV = (v: VariantDraft) => {
    if (v.id) setRemoved((r) => [...r, v.id!])
    setVariants((vs) => vs.filter((x) => x.key !== v.key))
  }

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setError(null)
    try {
      const urls: string[] = []
      for (const f of files) {
        if (f.size > 5 * 1024 * 1024) throw new Error(`"${f.name}" pesa más de 5 MB`)
        urls.push(await uploadProductImage(f, folder))
      }
      setP((s) => ({ ...s, imagenes: [...s.imagenes, ...urls] }))
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const moveImg = (i: number, dir: -1 | 1) =>
    setP((s) => {
      const a = [...s.imagenes]
      const j = i + dir
      if (j < 0 || j >= a.length) return s
      ;[a[i], a[j]] = [a[j], a[i]]
      return { ...s, imagenes: a }
    })

  const crearCategoria = async () => {
    if (!newCat?.nombre.trim()) return
    const nombre = newCat.nombre.trim()
    const { error } = await supabase.from('categorias').insert({ nombre, icono: newCat.icono || '📦' })
    if (error && !/duplicate|unique/i.test(error.message)) return setError(errMsg(error))
    await reloadCats()
    set('categoria', nombre)
    setNewCat(null)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!p.categoria) return setError('Elige una categoría')
    if (!variants.length) return setError('Agrega al menos una presentación (unidad, litro, galón…)')
    if (variants.some((v) => !v.nombre.trim())) return setError('Cada presentación necesita un nombre')
    setBusy(true)
    try {
      const row = {
        ...p,
        descripcion: p.descripcion || null,
        sabor: p.sabor || null,
        marca: p.marca || null,
        ingredientes: p.ingredientes || null,
        vida_util_dias: p.vida_util_dias === '' ? null : Number(p.vida_util_dias),
      }
      let pid = id
      if (id) {
        const { error } = await supabase.from('products').update(row).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('products').insert(row).select('id').single()
        if (error) throw error
        pid = (data as { id: string }).id
      }
      if (removed.length) {
        const { error } = await supabase.from('product_variants').delete().in('id', removed)
        if (error) throw error
      }
      for (const v of variants) {
        const vrow = {
          product_id: pid, nombre: v.nombre, unidad_medida: v.unidad_medida, cantidad: Number(v.cantidad),
          precio: Number(v.precio), stock: Math.max(0, Math.floor(Number(v.stock))), sku: v.sku || null, activo: v.activo,
        }
        const { error } = v.id
          ? await supabase.from('product_variants').update(vrow).eq('id', v.id)
          : await supabase.from('product_variants').insert(vrow)
        if (error) throw error
      }
      nav('/admin/productos')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  return (
    <form className="form" onSubmit={save}>
      <Link to="/admin/productos" className="back">← Productos</Link>
      <h1>{id ? 'Editar producto' : 'Nuevo producto'}</h1>

      <div className="card">
        <h3>Información general</h3>
        <div className="grid-2">
          <label>Nombre *<input required value={p.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej. Arroz Selecto, Salami Induveca, Jugo de Chinola" /></label>
          <label>Categoría *
            <select required value={p.categoria} onChange={(e) => {
              if (e.target.value === '__nueva__') return setNewCat({ nombre: '', icono: '📦' })
              set('categoria', e.target.value)
            }}>
              <option value="" disabled>Elige una categoría…</option>
              {categorias.map((c) => <option key={c.id} value={c.nombre}>{c.icono} {c.nombre}</option>)}
              {p.categoria && !categorias.some((c) => c.nombre === p.categoria) && <option value={p.categoria}>{p.categoria}</option>}
              <option value="__nueva__">＋ Crear nueva categoría…</option>
            </select>
          </label>
          {newCat && (
            <div className="newcat">
              <input className="newcat-icon" value={newCat.icono} maxLength={4} onChange={(e) => setNewCat({ ...newCat, icono: e.target.value })} />
              <input autoFocus placeholder="Nombre de la nueva categoría" value={newCat.nombre} onChange={(e) => setNewCat({ ...newCat, nombre: e.target.value })} />
              <button type="button" className="btn btn-sm btn-yellow" onClick={crearCategoria}>Crear</button>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setNewCat(null)}>✕</button>
            </div>
          )}
          <label>Marca<input value={p.marca} onChange={(e) => set('marca', e.target.value)} placeholder="Ej. Induveca, Brugal, Ace, Rica…" /></label>
          <label>Sabor / variedad<input value={p.sabor} onChange={(e) => set('sabor', e.target.value)} placeholder={esJugo(p.categoria) ? 'Chinola, naranja, mango…' : 'Ej. Rojas, integral, light, 1 litro…'} /></label>
          <label>Vida útil (días)<input type="number" min={0} value={p.vida_util_dias} onChange={(e) => set('vida_util_dias', e.target.value === '' ? '' : Number(e.target.value))} /></label>
        </div>
        <label>Descripción<textarea rows={3} value={p.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></label>
        <label>Ingredientes / detalles<input value={p.ingredientes} onChange={(e) => set('ingredientes', e.target.value)} /></label>
        <div className="checks">
          <label className="check"><input type="checkbox" checked={p.es_natural} onChange={(e) => set('es_natural', e.target.checked)} /> 100% natural</label>
          <label className="check"><input type="checkbox" checked={p.sin_azucar} onChange={(e) => set('sin_azucar', e.target.checked)} /> Sin azúcar añadida</label>
          <label className="check"><input type="checkbox" checked={p.requiere_refrigeracion} onChange={(e) => set('requiere_refrigeracion', e.target.checked)} /> Requiere refrigeración</label>
          <label className="check"><input type="checkbox" checked={p.destacado} onChange={(e) => set('destacado', e.target.checked)} /> Destacado en inicio</label>
          <label className="check"><input type="checkbox" checked={p.activo} onChange={(e) => set('activo', e.target.checked)} /> Visible en la tienda</label>
        </div>
      </div>

      <div className="card">
        <div className="row-between">
          <h3>Imágenes</h3>
          <label className="btn btn-outline file-btn">
            {uploading ? 'Subiendo…' : '+ Subir imágenes'}
            <input type="file" accept="image/*" multiple hidden onChange={onFiles} disabled={uploading} />
          </label>
        </div>
        <small className="muted">La primera imagen es la principal. Máximo 5 MB por imagen.</small>
        <div className="img-grid">
          {p.imagenes.map((u, i) => (
            <div key={u} className="img-item">
              <img src={u} alt="" />
              {i === 0 && <span className="tag">Principal</span>}
              <div className="img-actions">
                <button type="button" onClick={() => moveImg(i, -1)}>◀</button>
                <button type="button" onClick={() => moveImg(i, 1)}>▶</button>
                <button type="button" onClick={() => set('imagenes', p.imagenes.filter((x) => x !== u))}>✕</button>
              </div>
            </div>
          ))}
          {!p.imagenes.length && <div className="no-img">🖼️</div>}
        </div>
      </div>

      <div className="card">
        <h3>Presentaciones, precios e inventario</h3>
        <p className="muted">Vende el mismo producto en varias medidas: por unidad, libra, funda, sobre, paquete, caja, litro, galón…</p>
        <div className="presets">
          {(esJugo(p.categoria) ? PRESETS_JUGO : PRESETS_COLMADO).map((x) => (
            <button key={x.label} type="button" className="chip-btn" onClick={() => setVariants((vs) => [...vs, newVariant(...x.v)])}>
              + {x.label}
            </button>
          ))}
        </div>
        <div className="variants">
          {variants.map((v) => (
            <div key={v.key} className="variant-row">
              <label>Nombre<input value={v.nombre} onChange={(e) => setV(v.key, { nombre: e.target.value })} placeholder="Galón" /></label>
              <label>Unidad
                <select value={v.unidad_medida} onChange={(e) => setV(v.key, { unidad_medida: e.target.value as Unidad })}>
                  {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </label>
              <label>Cantidad<input type="number" step="0.01" min={0} value={v.cantidad} onChange={(e) => setV(v.key, { cantidad: Number(e.target.value) })} /></label>
              <label>Precio (RD$)<input type="number" step="0.01" min={0} value={v.precio} onChange={(e) => setV(v.key, { precio: Number(e.target.value) })} /></label>
              <label>Stock<input type="number" min={0} value={v.stock} onChange={(e) => setV(v.key, { stock: Number(e.target.value) })} /></label>
              <label>SKU<input value={v.sku ?? ''} onChange={(e) => setV(v.key, { sku: e.target.value })} /></label>
              <label className="check"><input type="checkbox" checked={v.activo} onChange={(e) => setV(v.key, { activo: e.target.checked })} /> Activa</label>
              <small className="muted">{presentacionTexto(v.unidad_medida, v.cantidad)}</small>
              <button type="button" className="icon-btn" title="Quitar" onClick={() => removeV(v)}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-outline" onClick={() => setVariants((vs) => [...vs, newVariant()])}>+ Presentación personalizada</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      <div className="row">
        <button className="btn btn-primary btn-lg" disabled={busy || uploading}>{busy ? 'Guardando…' : 'Guardar producto'}</button>
        <Link to="/admin/productos" className="btn btn-outline btn-lg">Cancelar</Link>
      </div>
    </form>
  )
}
