import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

export interface CartItem {
  variantId: string
  productId: string
  nombre: string
  presentacion: string
  precio: number
  imagen: string | null
  cantidad: number
  stock: number
}

interface CartState {
  items: CartItem[]
  count: number
  total: number
  add: (item: Omit<CartItem, 'cantidad'>, qty?: number) => void
  setQty: (variantId: string, qty: number) => void
  remove: (variantId: string) => void
  clear: () => void
}

const KEY = 'ft_cart_v1'
const CartContext = createContext<CartState>({} as CartState)

function readCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      /* almacenamiento no disponible */
    }
  }, [items])

  const value = useMemo<CartState>(() => ({
    items,
    count: items.reduce((a, i) => a + i.cantidad, 0),
    total: items.reduce((a, i) => a + i.cantidad * i.precio, 0),
    add: (item, qty = 1) =>
      setItems((prev) => {
        const found = prev.find((i) => i.variantId === item.variantId)
        if (found) {
          return prev.map((i) =>
            i.variantId === item.variantId ? { ...i, cantidad: Math.min(i.cantidad + qty, item.stock) } : i,
          )
        }
        return [...prev, { ...item, cantidad: Math.min(qty, item.stock) }]
      }),
    setQty: (variantId, qty) =>
      setItems((prev) =>
        prev.map((i) => (i.variantId === variantId ? { ...i, cantidad: Math.max(1, Math.min(qty, i.stock)) } : i)),
      ),
    remove: (variantId) => setItems((prev) => prev.filter((i) => i.variantId !== variantId)),
    clear: () => setItems([]),
  }), [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
