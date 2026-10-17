import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

/* Íconos SVG ligeros (heredan el color del texto) */
const I = {
  store: <path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6" />,
  orders: <path d="M9 5h10M9 12h10M9 19h10M4 5h.01M4 12h.01M4 19h.01" />,
  truck: <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  cart: <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />,
  chevron: <path d="M6 9l6 6 6-6" />,
}
function Icon({ d, size = 18 }: { d: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
  )
}

const ROLE_LABEL = { admin: 'Administrador', delivery: 'Delivery', cliente: 'Cliente' } as const

export default function Navbar() {
  const { user, isAdmin, isDelivery, profile, client, signOut } = useAuth()
  const { count } = useCart()
  const [open, setOpen] = useState(false)       // menú móvil
  const [menu, setMenu] = useState(false)       // menú del usuario
  const menuRef = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => { setOpen(false); setMenu(false) }, [loc.pathname])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const nombre = client ? `${client.nombre} ${client.apellido ?? ''}`.trim() : profile?.nombre || user?.email || ''
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'U'
  const role = profile?.role ?? 'cliente'

  const salir = async () => {
    setMenu(false)
    await signOut()
    nav('/')
  }

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <img src="/logo-light.png?v=2" alt="FT" className="brand-logo" />
          <span><b>Productos</b></span>
        </Link>

        <button className={`burger ${open ? 'is-open' : ''}`} aria-label="Menú" onClick={() => setOpen(!open)}>
          <span /><span /><span />
        </button>

        <nav className={`nav-main ${open ? 'open' : ''}`}>
          <div className="nav-pills">
            <NavLink to="/tienda" className="nav-pill"><Icon d={I.store} />Tienda</NavLink>
            {user && !isDelivery && <NavLink to="/mis-pedidos" className="nav-pill"><Icon d={I.orders} />Mis pedidos</NavLink>}
            {(isDelivery || isAdmin) && <NavLink to="/delivery" className="nav-pill"><Icon d={I.truck} />Entregas</NavLink>}
            {isAdmin && <NavLink to="/admin" className="nav-pill nav-pill-admin"><Icon d={I.shield} />Panel admin</NavLink>}
          </div>

          <div className="nav-actions">
            <NavLink to="/carrito" className="cart-btn" aria-label="Carrito">
              <Icon d={I.cart} size={22} />
              {count > 0 && <span className="cart-badge">{count}</span>}
              <span className="cart-text">Carrito</span>
            </NavLink>

            {user ? (
              <div className="user-menu" ref={menuRef}>
                <button className={`user-btn ${menu ? 'active' : ''}`} onClick={() => setMenu(!menu)} aria-expanded={menu}>
                  <span className="avatar">{iniciales}</span>
                  <span className="user-name">{nombre.split(' ')[0]}</span>
                  <Icon d={I.chevron} size={16} />
                </button>

                {menu && (
                  <div className="user-dropdown">
                    <div className="ud-head">
                      <span className="avatar lg">{iniciales}</span>
                      <div>
                        <b>{nombre}</b>
                        <small>{user.email}</small>
                        <span className={`role-chip role-${role}`}>{ROLE_LABEL[role]}</span>
                      </div>
                    </div>
                    <Link to="/perfil" className="ud-item"><Icon d={I.user} />Mi perfil</Link>
                    {!isDelivery && <Link to="/mis-pedidos" className="ud-item"><Icon d={I.orders} />Mis pedidos</Link>}
                    {(isDelivery || isAdmin) && <Link to="/delivery" className="ud-item"><Icon d={I.truck} />Mis entregas</Link>}
                    {isAdmin && <Link to="/admin" className="ud-item"><Icon d={I.shield} />Panel admin</Link>}
                    <button className="ud-logout" onClick={salir}><Icon d={I.logout} />Cerrar sesión</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-btns">
                <NavLink to="/login" className="nav-pill">Entrar</NavLink>
                <Link to="/registro" className="btn btn-yellow btn-sm pill-cta">Crear cuenta</Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
