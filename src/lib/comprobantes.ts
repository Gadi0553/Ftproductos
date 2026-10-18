import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const COMPROBANTES_BUCKET = 'comprobantes'
export const COMPROBANTE_MAX_MB = 6
export const COMPROBANTE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'

export const esPdf = (path?: string | null) => !!path && /\.pdf$/i.test(path)

/** Revisa tipo y tamaño. Devuelve un mensaje de error o null si está bien. */
export function validarComprobante(file: File): string | null {
  const okTipo = /^image\//.test(file.type) || file.type === 'application/pdf'
  if (!okTipo) return 'Sube una imagen (foto o captura de pantalla) o un PDF.'
  if (file.size > COMPROBANTE_MAX_MB * 1024 * 1024) return `El archivo pesa más de ${COMPROBANTE_MAX_MB} MB.`
  return null
}

/** Sube el comprobante a la carpeta privada del cliente y devuelve su ruta. */
export async function subirComprobante(file: File, userId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(COMPROBANTES_BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}

/** Sube el archivo y lo asocia al pedido (deja constancia en la bitácora). */
export async function adjuntarComprobante(orderId: string, file: File, userId: string) {
  const path = await subirComprobante(file, userId)
  const { error } = await supabase.rpc('set_order_comprobante', { p_order: orderId, p_path: path })
  if (error) throw error
  return path
}

/** URL temporal (1 hora) para ver un comprobante del bucket privado. */
export function useComprobanteUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    setUrl(null); setError(false)
    if (!path) return
    let vivo = true
    supabase.storage.from(COMPROBANTES_BUCKET).createSignedUrl(path, 3600).then(({ data, error }) => {
      if (!vivo) return
      if (error || !data) setError(true)
      else setUrl(data.signedUrl)
    })
    return () => { vivo = false }
  }, [path])
  return { url, error }
}
