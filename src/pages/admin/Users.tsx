import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fmtDate } from '../../lib/format'
import { errMsg, supabase } from '../../lib/supabase'
import { Profile, Role, ROLES } from '../../lib/types'

/** Gestión de usuarios: rol (cliente / delivery / administrador) y eliminación. */
export default function AdminUsers() {
  const { user } = useAuth()
  const [list, setList] = useState<Profile[]>([])
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Role | 'todos'>('todos')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () =>
    supabase.from('profiles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setList((data as Profile[]) ?? []))
  useEffect(() => { load() }, [])

  const setRole = async (p: Profile, role: Role) => {
    setMsg(null)
    if (p.id === user?.id && role !== 'admin') {
      return setMsg({ ok: false, text: 'No puedes quitarte el rol de administrador a ti mismo' })
    }
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    if (error) setMsg({ ok: false, text: errMsg(error) })
    else setMsg({ ok: true, text: `${p.nombre || p.email} ahora es ${ROLES.find((r) => r.value === role)?.label}` })
    load()
  }

  const remove = async (p: Profile) => {
    if (p.id === user?.id) return
    const ok = confirm(
      `¿Eliminar definitivamente a ${p.nombre || p.email}?\n\n` +
      'Se borrará su cuenta y su ficha de cliente. Los pedidos que haya hecho se conservan en el historial de ventas.',
    )
    if (!ok) return
    setBusyId(p.id)
    setMsg(null)
    const { error } = await supabase.rpc('admin_delete_user', { p_user: p.id })
    setBusyId(null)
    if (error) {
      const missing = /admin_delete_user|function/i.test(error.message)
      return setMsg({
        ok: false,
        text: missing
          ? 'Falta activar la función de borrado: ejecuta supabase/migration_03_admin_delete_user.sql en el SQL Editor de Supabase.'
          : errMsg(error),
      })
    }
    setMsg({ ok: true, text: `Usuario ${p.nombre || p.email} eliminado` })
    load()
  }

  const shown = list.filter((p) =>
    (filtro === 'todos' || p.role === filtro) &&
    `${p.email} ${p.nombre}`.toLowerCase().includes(q.toLowerCase()))

  const count = (r: Role) => list.filter((p) => p.role === r).length

  return (
    <>
      <h1>Usuarios y permisos</h1>
      <div className="roles-help">
        {ROLES.map((r) => (
          <div key={r.value} className={`role-card role-${r.value}`}>
            <b>{r.label} ({count(r.value)})</b>
            <small>{r.desc}</small>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Buscar por correo o nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as Role | 'todos')}>
          <option value="todos">Todos los roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`}>{msg.text}</div>}

      <div className="card">
        <table className="table">
          <thead><tr><th>Usuario</th><th>Registrado</th><th>Rol</th><th /></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.nombre || '—'}</b> {p.id === user?.id && <span className="tag">Tú</span>}
                  <br /><small className="muted">{p.email}</small>
                </td>
                <td><small>{fmtDate(p.created_at)}</small></td>
                <td>
                  <select className={`role-select role-${p.role}`} value={p.role} onChange={(e) => setRole(p, e.target.value as Role)}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td className="right">
                  {p.id !== user?.id && (
                    <button className="btn btn-sm btn-danger" disabled={busyId === p.id} onClick={() => remove(p)}>
                      {busyId === p.id ? 'Eliminando…' : '🗑 Eliminar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="muted center">No hay usuarios con ese filtro.</p>}
      </div>
    </>
  )
}
