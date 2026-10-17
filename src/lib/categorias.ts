import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Categoria } from './types'

/** Categorías de productos (configurables por el administrador). */
export function useCategorias(soloActivas = true) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    let q = supabase.from('categorias').select('*').order('orden').order('nombre')
    if (soloActivas) q = q.eq('activo', true)
    const { data } = await q
    setCategorias((data as Categoria[]) ?? [])
    setLoading(false)
  }, [soloActivas])
  useEffect(() => { load() }, [load])
  return { categorias, loading, reload: load }
}

export const iconoDe = (nombre: string, cats: Categoria[]) => cats.find((c) => c.nombre === nombre)?.icono ?? '📦'

/** ¿La categoría es de bebidas tipo jugo? (para mostrar presentaciones de jugos) */
export const esJugo = (cat: string) => /jugo|batido|limonada/i.test(cat)
