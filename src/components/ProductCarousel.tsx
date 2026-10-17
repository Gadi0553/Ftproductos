import { MouseEvent as RMouseEvent, PointerEvent as RPointerEvent, ReactNode, useEffect, useRef, useState } from 'react'
import ProductCard from './ProductCard'
import type { Product } from '../lib/types'

interface Props {
  title: ReactNode
  products: Product[]
  action?: ReactNode
}

/**
 * Fila horizontal de productos estilo Amazon:
 * se desliza con el dedo, arrastrando con el mouse o con las flechas.
 * Muestra 5 productos en computadora y 2 en el teléfono.
 */
export default function ProductCarousel({ title, products, action }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false })
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [dragging, setDragging] = useState(false)

  const update = () => {
    const el = track.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    update()
    const el = track.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [products.length])

  const page = (dir: 1 | -1) => {
    const el = track.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  // Arrastrar con el mouse (en el teléfono se usa el deslizamiento nativo)
  const onPointerDown = (e: RPointerEvent) => {
    if (e.pointerType !== 'mouse' || !track.current) return
    drag.current = { down: true, startX: e.clientX, startLeft: track.current.scrollLeft, moved: false }
  }
  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current
    if (!d.down || !track.current) return
    const dx = e.clientX - d.startX
    if (!d.moved && Math.abs(dx) > 6) { d.moved = true; setDragging(true) }
    if (d.moved) track.current.scrollLeft = d.startLeft - dx
  }
  const endDrag = () => {
    if (!drag.current.down) return
    drag.current.down = false
    setDragging(false)
    setTimeout(() => { drag.current.moved = false }, 0) // el click (si lo hay) llega antes
  }
  // Si se arrastró, no abrir el producto al soltar
  const onClickCapture = (e: RMouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = false
    }
  }

  if (!products.length) return null

  return (
    <section className="carousel">
      <div className="carousel-head">
        <h2>{title}</h2>
        <div className="carousel-tools">
          {action}
          <button className="car-arrow" aria-label="Anterior" disabled={!canPrev} onClick={() => page(-1)}>‹</button>
          <button className="car-arrow" aria-label="Siguiente" disabled={!canNext} onClick={() => page(1)}>›</button>
        </div>
      </div>
      <div className="carousel-wrap">
        {canPrev && <div className="car-fade left" />}
        <div
          ref={track}
          className={`carousel-track ${dragging ? 'dragging' : ''}`}
          onScroll={update}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClickCapture={onClickCapture}
          onDragStart={(e) => e.preventDefault()}
        >
          {products.map((p) => (
            <div key={p.id} className="carousel-item"><ProductCard product={p} /></div>
          ))}
        </div>
        {canNext && <div className="car-fade right" />}
      </div>
    </section>
  )
}
