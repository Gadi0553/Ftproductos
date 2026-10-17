import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { errMsg, supabase } from '../lib/supabase'

const LEN = 8 // Supabase envía códigos de 8 dígitos
const ESPERA = 60 // segundos para poder reenviar

/** Pantalla para escribir el código de confirmación que llega al correo. */
export default function VerifyEmail({ email: emailProp }: { email?: string }) {
  const [params] = useSearchParams()
  const [email, setEmail] = useState(emailProp ?? params.get('email') ?? '')
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [wait, setWait] = useState(ESPERA)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const nav = useNavigate()

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  useEffect(() => { inputs.current[0]?.focus() }, [])

  const code = digits.join('')

  const verify = async (token = code) => {
    if (token.length < LEN || !email) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
    setBusy(false)
    if (error) {
      setDigits(Array(LEN).fill(''))
      inputs.current[0]?.focus()
      return setError(/expired|invalid/i.test(error.message)
        ? 'El código no es válido o ya expiró. Revisa el correo más reciente o pide uno nuevo.'
        : errMsg(error))
    }
    nav('/tienda', { replace: true })
  }

  const setAt = (i: number, v: string) => {
    const d = v.replace(/\D/g, '')
    if (!d) {
      const next = [...digits]; next[i] = ''; setDigits(next); return
    }
    const next = [...digits]
    d.split('').slice(0, LEN - i).forEach((c, k) => { next[i + k] = c })
    setDigits(next)
    const pos = Math.min(i + d.length, LEN - 1)
    inputs.current[pos]?.focus()
    if (next.every(Boolean)) verify(next.join(''))
  }

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < LEN - 1) inputs.current[i + 1]?.focus()
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    setAt(0, e.clipboardData.getData('text'))
  }

  const resend = async () => {
    if (!email) return setError('Escribe tu correo')
    setError(null)
    setInfo(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) return setError(errMsg(error))
    setInfo('Te enviamos un código nuevo. Revisa también la carpeta de spam o promociones.')
    setWait(ESPERA)
  }

  const submit = (e: FormEvent) => { e.preventDefault(); verify() }

  return (
    <div className="container page narrow">
      <form className="card form verify-card" onSubmit={submit}>
        <div className="verify-icon">✉️</div>
        <h1>Confirma tu correo</h1>
        {emailProp || params.get('email') ? (
          <p className="muted center">Enviamos un código de {LEN} dígitos a<br /><b>{email}</b></p>
        ) : (
          <label>Correo<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        )}

        <div className="otp">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el }}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={LEN}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={onPaste}
              aria-label={`Dígito ${i + 1}`}
            />
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {info && <div className="alert alert-ok">{info}</div>}

        <button className="btn btn-shine btn-lg block" disabled={busy || code.length < LEN}>
          {busy ? 'Verificando…' : 'Confirmar mi cuenta'}
        </button>

        <p className="center muted">
          ¿No te llegó?{' '}
          {wait > 0
            ? <span>Puedes pedir otro en <b>{wait}s</b></span>
            : <button type="button" className="link" onClick={resend}>Reenviar código</button>}
        </p>
        <p className="center"><Link to="/login">Volver a iniciar sesión</Link></p>
      </form>
    </div>
  )
}
