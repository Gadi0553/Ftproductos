import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loading } from '../../components/Guards'
import { fmtMoney } from '../../lib/format'
import { errMsg, supabase } from '../../lib/supabase'
import type { Product } from '../../lib/types'

export default function AdminProducts() {
  const [list, setList] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = async () => {
    const { data } = await supabase.from('products').select('*, product_variants(*)').order('created_at', { ascending: false })
    setList((data as Product[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggle = async (p: Product) => {
    await supabase.from('products').update({ activo: !p.activo }).eq('id', p.id)
    load()
  }

  const del = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) alert(errMsg(error))
    load()
  }

  const shown = list.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <div className="row-between">
        <h1>Productos</h1>
        <Link to="/admin/productos/nuevo" className="btn btn-yellow">+ Nuevo producto</Link>
      </div>
      <input className="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <Loading /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th></th><th>Producto</th><th>Presentaciones</th><th>Stock</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {shown.map((p) => {
                const vs = p.product_variants ?? []
                const stock = vs.reduce((a, v) => a + v.stock, 0)
                return (
                  <tr key={p.id}>
                    <td>{p.imagenes[0] ? <img className="thumb" src={p.imagenes[0]} alt="" /> : <div className="no-img sm">🧃</div>}</td>
                    <td><b>{p.nombre}</b><br /><small className="muted">{p.categoria}{p.sabor ? ` · ${p.sabor}` : ''}</small></td>
                    <td>{vs.map((v) => <div key={v.id}><small>{v.nombre}: {fmtMoney(v.precio)}</small></div>)}</td>
                    <td className={stock < 10 ? 'bad' : ''}>{stock}</td>
                    <td>
                      <button className={`status ${p.activo ? 'status-entregado' : 'status-cancelado'}`} onClick={() => toggle(p)}>
                        {p.activo ? 'Visible' : 'Oculto'}
                      </button>
                    </td>
                    <td className="right nowrap">
                      <Link className="btn btn-sm btn-outline" to={`/admin/productos/${p.id}`}>Editar</Link>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => del(p)}>Eliminar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!shown.length && <p className="muted center">No hay productos.</p>}
        </div>
      )}
    </>
  )
}
