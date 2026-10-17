import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, profile } = useAuth()
  if (loading || (user && !profile)) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) {
    return (
      <div className="container page">
        <div className="card empty">
          <h2>Acceso restringido</h2>
          <p>Esta sección es solo para administradores.</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

/** Administradores y repartidores (delivery) */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { user, isStaff, loading, profile } = useAuth()
  if (loading || (user && !profile)) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (!isStaff) {
    return (
      <div className="container page">
        <div className="card empty">
          <h2>Acceso restringido</h2>
          <p>Esta sección es para el personal de reparto. Pide a un administrador que te asigne el rol Delivery.</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
