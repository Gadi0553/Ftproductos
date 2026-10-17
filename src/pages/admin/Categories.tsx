import { useEffect, useState } from 'react'
import { useCategorias } from '../../lib/categorias'
import { errMsg, supabase } from '../../lib/supabase'
import type { Categoria } from '../../lib/types'

type Draft = { id?: string; nombre: string; icono: string; descripcion: string; orden: number; activo: boolean }
const ICONOS = ['🧃', '🥤', '💧', '🍺', '🥃', '🍚', '🫒', '🧂', '🥫', '🍝', '🥓', '🥚', '🍞', '🍌', '🍅', '🍗', '☕', '🍬', '🧽', '🧴', '🧻', '🍼', '🐾', '💊', '🔥', '📱', '🧊', '🥛', '🧀', '🍫', '🥜', '🛒', '📦']

/** Gestión de categorías: el admin las crea, renombra, ordena, oculta o elimina. */
export default function Categories() {
  const { categorias, reload } = useCategorias(false)
  const [conteo, setConteo] = useState<Record<string, number>>({})
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('products').select('categoria').then(({ data }) => {
      const m: Record<string, number> = {}
      ;((data as { categoria: string }[]) ?? []).forEach((r) => { m[r.categoria] = (m[r.categoria] ?? 0) + 1 })
      setConteo(m)
    })
  }, [categorias])

  const save = async () => {
    if (!draft?.nombre.trim()) return
    setBusy(true)
    setMsg(null)
    const row = { nombre: draft.nombre.trim(), icono: draft.icono || '📦', descripcion: draft.descripcion || null, orden: draft.orden, activo: draft.activo }
    try {
      if (draft.id) {
        const anterior = categorias.find((c) => c.id === draft.id)?.nombre
        const { error } = await supabase.from('categorias').update(row).eq('id', draft.id)
        if (error) throw error
        // Si cambió el nombre, se actualizan los productos de esa categoría
        if (anterior && anterior !== row.nombre) {
          const { error: e2 } = await supabase.from('products').update({ categoria: row.nombre }).eq('categoria', anterior)
          if (e2) throw e2
        }
      } else {
        const { error } = await supabase.from('categorias').insert(row)
        if (error) throw error
      }
      setMsg({ ok: true, text: `Categoría "${row.nombre}" guardada` })
      setDraft(null)
      reload()
    } catch (e) {
      setMsg({ ok: false, text: /duplicate|unique/i.test(errMsg(e)) ? 'Ya existe una categoría con ese nombre' : errMsg(e) })
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (c: Categoria) => {
    await supabase.from('categorias').update({ activo: !c.activo }).eq('id', c.id)
    reload()
  }

  const remove = async (c: Categoria) => {
    if (conteo[c.nombre]) {
      return setMsg({ ok: false, text: `"${c.nombre}" tiene ${conteo[c.nombre]} producto(s). Muévelos a otra categoría u ocúltala en vez de eliminarla.` })
    }
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return
    const { error } = await supabase.from('categorias').delete().eq('id', c.id)
    if (error) setMsg({ ok: false, text: errMsg(error) })
    reload()
  }

  return (
    <>
      <div className="row-between">
        <h1>Categorías de productos</h1>
        {!draft && (
          <button className="btn btn-yellow" onClick={() => setDraft({ nombre: '', icono: '📦', descripcion: '', orden: 50, activo: true })}>
            + Nueva categoría
          </button>
        )}
      </div>
      <p className="muted">Organiza todo lo que vendes en tu colmado. Las categorías visibles aparecen como filtros en la tienda.</p>
      {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`}>{msg.text}</div>}

      {draft && (
        <div className="card form">
          <h3>{draft.id ? `Editar: ${draft.nombre}` : 'Nueva categoría'}</h3>
          <div className="grid-2">
            <label>Nombre *<input autoFocus value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Ej. Productos de belleza" /></label>
            <label>Orden en la tienda<input type="number" value={draft.orden} onChange={(e) => setDraft({ ...draft, orden: Number(e.target.value) })} /></label>
          </div>
          <label>Descripción<input value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} placeholder="Qué incluye esta categoría" /></label>
          <div className="label">Ícono: <span style={{ fontSize: '1.6rem' }}>{draft.icono}</span></div>
          <div className="icon-picker">
            {ICONOS.map((i) => (
              <button key={i} type="button" className={i === draft.icono ? 'active' : ''} onClick={() => setDraft({ ...draft, icono: i })}>{i}</button>
            ))}
            <input className="newcat-icon" value={draft.icono} maxLength={4} onChange={(e) => setDraft({ ...draft, icono: e.target.value })} title="O escribe/pega otro emoji" />
          </div>
          <label className="check"><input type="checkbox" checked={draft.activo} onChange={(e) => setDraft({ ...draft, activo: e.target.checked })} /> Visible en la tienda</label>
          <div className="row">
            <button className="btn btn-primary" disabled={busy || !draft.nombre.trim()} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
            <button className="btn btn-outline" onClick={() => setDraft(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="cat-grid">
        {categorias.map((c) => (
          <div key={c.id} className={`cat-card ${c.activo ? '' : 'off'}`}>
            <span className="cat-icon">{c.icono}</span>
            <div className="grow">
              <b>{c.nombre}</b>
              <small className="muted">{c.descripcion || '—'}</small>
              <small><b>{conteo[c.nombre] ?? 0}</b> producto(s) · orden {c.orden}</small>
            </div>
            <div className="cat-actions">
              <button className={`btn btn-sm ${c.activo ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggle(c)}>{c.activo ? 'Visible' : 'Oculta'}</button>
              <button className="btn btn-sm btn-outline" onClick={() => setDraft({ id: c.id, nombre: c.nombre, icono: c.icono, descripcion: c.descripcion ?? '', orden: c.orden, activo: c.activo })}>Editar</button>
              <button className="icon-btn" title="Eliminar" onClick={() => remove(c)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
