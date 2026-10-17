import { NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="admin">
      <aside className="admin-side">
        <h4>Administración</h4>
        <NavLink end to="/admin">📊 Resumen</NavLink>
        <NavLink to="/admin/pedidos">📦 Pedidos y entregas</NavLink>
        <NavLink to="/admin/productos">🧃 Productos</NavLink>
        <NavLink to="/admin/categorias">🏷️ Categorías</NavLink>
        <NavLink to="/admin/clientes">🏢 Clientes y rutas</NavLink>
        <NavLink to="/admin/zonas">🗺️ Zonas de venta</NavLink>
        <NavLink to="/admin/usuarios">🔐 Usuarios</NavLink>
        <NavLink to="/admin/qr">📱 Código QR</NavLink>
      </aside>
      <section className="admin-main">
        <Outlet />
      </section>
    </div>
  )
}
