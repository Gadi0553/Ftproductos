import { FormEvent, useEffect, useState } from 'react'
import ClientFields, { ClientData, TipoSelector, datosNegocio, emptyClient } from '../components/ClientFields'
import { useAuth } from '../context/AuthContext'
import { errMsg, supabase } from '../lib/supabase'

export default function Profile() {
  const { user, client, refresh, isAdmin, isDelivery, isStaff } = useAuth()
  const [data, setData] = useState<ClientData>(emptyClient)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [newPass, setNewPass] = useState('')

  useEffect(() => {
    if (client) {
      setData({
        tipo: client.tipo ?? (client.empresa || client.local ? 'empresa' : 'basico'),
        nombre: client.nombre ?? '',
        apellido: client.apellido ?? '',
        numero: client.numero ?? '',
        email: client.email ?? user?.email ?? '',
        empresa: client.empresa ?? client.local ?? '',
        descripcion_empresa: client.descripcion_empresa ?? '',
        direccion: client.direccion ?? '',
        referencia: client.referencia ?? '',
        pos: { lat: client.latitude, lng: client.longitude },
      })
    } else if (user) {
      setData((d) => ({ ...d, email: user.email ?? '' }))
    }
  }, [client, user])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (data.tipo === 'empresa' && !data.empresa.trim()) return setMsg({ ok: false, text: 'Escribe el nombre de tu empresa' })
    if (!data.pos) return setMsg({ ok: false, text: 'Marca en el mapa el lugar de entrega' })
    setBusy(true)
    setMsg(null)
    const row = {
      user_id: user.id,
      nombre: data.nombre,
      apellido: data.apellido,
      numero: data.numero,
      email: user.email,
      ...datosNegocio(data),
      direccion: data.direccion,
      referencia: data.referencia,
      latitude: data.pos.lat,
      longitude: data.pos.lng,
    }
    const { error } = client
      ? await supabase.from('clients').update(row).eq('id', client.id)
      : await supabase.from('clients').insert(row)
    setBusy(false)
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    await refresh()
    setMsg({ ok: true, text: 'Perfil guardado correctamente' })
  }

  const changePass = async () => {
    if (newPass.length < 6) return setMsg({ ok: false, text: 'La contraseña debe tener al menos 6 caracteres' })
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setMsg(error ? { ok: false, text: errMsg(error) } : { ok: true, text: 'Contraseña actualizada' })
    setNewPass('')
  }

  return (
    <div className="container page medium">
      <form className="card form" onSubmit={save}>
        <h1>Mi perfil {isAdmin && <span className="tag">Administrador</span>}{isDelivery && <span className="tag">Delivery</span>}</h1>
        {!client && !isStaff && <div className="alert alert-warn">Completa tus datos y el lugar de entrega para poder comprar.</div>}
        <div className="label">Tipo de cuenta</div>
        <TipoSelector value={data.tipo} onChange={(tipo) => setData({ ...data, tipo })} />
        <ClientFields value={data} onChange={setData} showEmail={false} />
        {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`}>{msg.text}</div>}
        <button className="btn btn-primary btn-lg block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar perfil'}</button>
      </form>

      <div className="card form">
        <h3>Cambiar contraseña</h3>
        <div className="row">
          <input type="password" placeholder="Nueva contraseña" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          <button type="button" className="btn btn-outline" onClick={changePass}>Actualizar</button>
        </div>
        <small className="muted">Correo de acceso: {user?.email}</small>
      </div>
    </div>
  )
}
