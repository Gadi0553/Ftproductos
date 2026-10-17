import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import ScrollToTop from './components/ScrollToTop'
import { RequireAdmin, RequireAuth, RequireStaff } from './components/Guards'
import { supabaseConfigured } from './lib/supabase'
import Home from './pages/Home'
import Store from './pages/Store'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import MyOrders from './pages/MyOrders'
import OrderDetail from './pages/OrderDetail'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import AdminProducts from './pages/admin/Products'
import ProductForm from './pages/admin/ProductForm'
import AdminOrders from './pages/admin/Orders'
import AdminOrderDelivery from './pages/admin/OrderDelivery'
import AdminClients from './pages/admin/Clients'
import ClientRoute from './pages/admin/ClientRoute'
import AdminUsers from './pages/admin/Users'
import DeliveryHome from './pages/delivery/DeliveryHome'
import QrCode from './pages/admin/QrCode'
import Zones from './pages/admin/Zones'
import Categories from './pages/admin/Categories'
import Invoice from './pages/Invoice'
import VerifyEmail from './pages/VerifyEmail'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      {!supabaseConfigured && (
        <div className="config-warning">
          Falta configurar <code>VITE_SUPABASE_ANON_KEY</code> en el archivo <code>.env</code> (Supabase › Project Settings › API).
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tienda" element={<Store />} />
          <Route path="/producto/:id" element={<ProductDetail />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/verificar" element={<VerifyEmail />} />
          <Route path="/perfil" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/mis-pedidos" element={<RequireAuth><MyOrders /></RequireAuth>} />
          <Route path="/mis-pedidos/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/factura/:id" element={<RequireAuth><Invoice /></RequireAuth>} />

          <Route path="/delivery" element={<RequireStaff><div className="container page"><DeliveryHome /></div></RequireStaff>} />
          <Route path="/delivery/:id" element={<RequireStaff><div className="container page"><AdminOrderDelivery /></div></RequireStaff>} />

          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<Dashboard />} />
            <Route path="productos" element={<AdminProducts />} />
            <Route path="productos/nuevo" element={<ProductForm />} />
            <Route path="productos/:id" element={<ProductForm />} />
            <Route path="pedidos" element={<AdminOrders />} />
            <Route path="pedidos/:id" element={<AdminOrderDelivery />} />
            <Route path="clientes" element={<AdminClients />} />
            <Route path="clientes/:id/ruta" element={<ClientRoute />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="qr" element={<QrCode />} />
            <Route path="zonas" element={<Zones />} />
            <Route path="categorias" element={<Categories />} />
          </Route>

          <Route path="*" element={<div className="container page"><div className="card empty"><h2>Página no encontrada</h2></div></div>} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container">© {new Date().getFullYear()} FT Productos · Jugos naturales con entrega a tu negocio</div>
      </footer>
    </>
  )
}
