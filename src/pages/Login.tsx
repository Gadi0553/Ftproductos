import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errMsg, supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/tienda'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      // Cuenta sin confirmar: llevar a la pantalla del código
      if (/not confirmed/i.test(error.message)) {
        await supabase.auth.resend({ type: 'signup', email })
        return nav(`/verificar?email=${encodeURIComponent(email)}`)
      }
      return setError(errMsg(error))
    }
    nav(from, { replace: true })
  }

  const reset = async () => {
    if (!email) return setError('Escribe tu correo para enviarte el enlace')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/perfil` })
    if (error) setError(errMsg(error))
    else setInfo('Te enviamos un correo para restablecer tu contraseña')
  }

  return (
    <div className="container page narrow">
      <form className="card form" onSubmit={submit}>
        <h1>Iniciar sesión</h1>
        <label>Correo<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Contraseña<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <div className="alert alert-error">{error}</div>}
        {info && <div className="alert alert-ok">{info}</div>}
        <button className="btn btn-primary block btn-lg" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="link" onClick={reset}>¿Olvidaste tu contraseña?</button>
        <p className="center">¿No tienes cuenta? <Link to="/registro">Regístrate aquí</Link></p>
      </form>
    </div>
  )
}
