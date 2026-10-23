import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import VerifyEmail from './VerifyEmail'
import ClientFields, { ClientData, TipoSelector, datosNegocio, emptyClient } from '../components/ClientFields'
import type { ClientTipo } from '../lib/types'
import { errMsg, supabase } from '../lib/supabase'

export default function Register() {
  const [data, setData] = useState<ClientData>(emptyClient)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [elegido, setElegido] = useState(false)
  const elegir = (tipo: ClientTipo) => { setData((d) => ({ ...d, tipo })); setElegido(true); setError(null) }
  const nav = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!data.email) return setError('El correo es obligatorio')
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (password !== password2) return setError('Las contraseñas no coinciden')
    if (data.tipo === 'empresa' && !data.empresa.trim()) return setError('Escribe el nombre de tu empresa')
    if (!data.pos) return setError(data.tipo === 'empresa' ? 'Marca en el mapa la ubicación de tu empresa' : 'Marca en el mapa dónde te entregamos')

    // Toda cuenta nueva es de CLIENTE. Solo el administrador puede convertirla en Delivery.
    const neg = datosNegocio(data)
    const meta = {
      tipo: neg.tipo, nombre: data.nombre, apellido: data.apellido, numero: data.numero, empresa: neg.empresa ?? '',
      descripcion_empresa: neg.descripcion_empresa ?? '', direccion: data.direccion, referencia: data.referencia,
      latitude: data.pos.lat, longitude: data.pos.lng,
    }

    setBusy(true)
    const { data: res, error } = await supabase.auth.signUp({
      email: data.email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/tienda`,
        // El trigger handle_new_user crea el perfil (y la ficha del cliente si tiene ubicación)
        data: meta,
      },
    })
    setBusy(false)
    if (error) return setError(errMsg(error))
    if (res.session) nav('/tienda')
    else setDone(true)
  }

  // Paso 2: escribir el código que llegó al correo
  if (done) return <VerifyEmail email={data.email} />

  return (
    <div className="container page medium">
      <form className="card form" onSubmit={submit}>
        <h1>Crear cuenta de cliente</h1>
        <p className="muted">Elige el tipo de cuenta. Te llevamos los pedidos por la ruta más rápida.</p>
        <TipoSelector value={elegido ? data.tipo : null} onChange={elegir} />
        {!elegido ? (
          <p className="center muted">👆 Selecciona una opción para continuar</p>
        ) : (
        <>
        <ClientFields value={data} onChange={setData} />
        <fieldset>
          <legend>Acceso</legend>
          <div className="grid-2">
            <label>Contraseña *<input type="password" name="new-password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label>Repetir contraseña *<input type="password" name="confirm-password" autoComplete="new-password" required value={password2} onChange={(e) => setPassword2(e.target.value)} /></label>
          </div>
        </fieldset>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-yellow btn-lg block" disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear mi cuenta'}</button>
        </>
        )}
        <p className="center">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </form>
    </div>
  )
}
