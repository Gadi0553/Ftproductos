import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Cada vez que se abre una página o módulo, la vista empieza desde arriba. */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Evita que el navegador "recuerde" la posición anterior al recargar o volver
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    // por si el contenido (mapas, imágenes) termina de cargar después
    const t = setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 60)
    return () => clearTimeout(t)
  }, [pathname])

  return null
}
