import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabaseConfigured = !!url && !!anonKey && !anonKey.startsWith('PEGA_AQUI')

export const supabase = createClient(url || 'https://example.supabase.co', anonKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const PRODUCT_BUCKET = 'productos'

export async function uploadProductImage(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(PRODUCT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error
  return supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl
}

const TRADUCCIONES: [RegExp, string][] = [
  [/email rate limit exceeded|over_email_send_rate_limit/i,
    'Se alcanzó el límite de correos de confirmación de Supabase. Espera unos minutos e inténtalo de nuevo (el administrador puede desactivar la confirmación por correo o configurar su propio SMTP).'],
  [/Error sending confirmation email|sending .*email/i,
    'No pudimos enviar el correo de confirmación en este momento. Inténtalo de nuevo en unos minutos; si sigue pasando, avisa al administrador.'],
  [/rate limit/i, 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.'],
  [/User already registered/i, 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.'],
  [/Invalid login credentials/i, 'Correo o contraseña incorrectos'],
  [/Email not confirmed/i, 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.'],
  [/Password should be at least/i, 'La contraseña debe tener al menos 6 caracteres'],
  [/Unable to validate email address|invalid format/i, 'El correo no es válido'],
]

export function errMsg(e: unknown): string {
  if (!e) return 'Error desconocido'
  let m = 'Error desconocido'
  if (typeof e === 'string') m = e
  else if (typeof e === 'object' && e && 'message' in e) m = String((e as { message: unknown }).message)
  const t = TRADUCCIONES.find(([re]) => re.test(m))
  return t ? t[1] : m
}
