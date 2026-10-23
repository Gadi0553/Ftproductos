import LocationPicker from './LocationPicker'
import ZoneNotice from './ZoneNotice'
import { useZonasActivas } from '../lib/zonas'
import type { ClientTipo, LatLng } from '../lib/types'

export interface ClientData {
  tipo: ClientTipo
  nombre: string
  apellido: string
  numero: string
  email: string
  empresa: string
  descripcion_empresa: string
  direccion: string
  referencia: string
  pos: LatLng | null
}

export const emptyClient: ClientData = {
  tipo: 'basico',
  nombre: '', apellido: '', numero: '', email: '', empresa: '',
  descripcion_empresa: '', direccion: '', referencia: '', pos: null,
}

/** Datos listos para guardar en la tabla clients según el tipo elegido. */
export function datosNegocio(d: ClientData) {
  const esEmpresa = d.tipo === 'empresa'
  const empresa = esEmpresa ? d.empresa.trim() || null : null
  return {
    tipo: d.tipo,
    empresa,
    local: empresa,
    descripcion_empresa: esEmpresa ? d.descripcion_empresa.trim() || null : null,
  }
}

const TIPOS: { value: ClientTipo; icon: string; titulo: string; texto: string }[] = [
  { value: 'basico', icon: '👤', titulo: 'Usuario básico', texto: 'Para personas sin negocio. Solo tus datos y dónde te entregamos.' },
  { value: 'empresa', icon: '🏪', titulo: 'Empresa o negocio', texto: 'Para colmados, tiendas y negocios. Incluye los datos de tu empresa.' },
]

/** Selector de tipo de cuenta (dos tarjetas). */
export function TipoSelector({ value, onChange }: { value: ClientTipo | null; onChange: (t: ClientTipo) => void }) {
  return (
    <div className="tipo-select" role="radiogroup" aria-label="Tipo de cuenta">
      {TIPOS.map((t) => (
        <button
          key={t.value}
          type="button"
          role="radio"
          aria-checked={value === t.value}
          className={`tipo-card ${value === t.value ? 'on' : ''}`}
          onClick={() => onChange(t.value)}
        >
          <span className="tipo-icon">{t.icon}</span>
          <b>{t.titulo}</b>
          <small>{t.texto}</small>
          <span className="tipo-check">{value === t.value ? '✓' : ''}</span>
        </button>
      ))}
    </div>
  )
}

interface Props {
  value: ClientData
  onChange: (v: ClientData) => void
  showEmail?: boolean
}

/** Campos del perfil del cliente + lugar de entrega. Cambian según el tipo (básico / empresa). */
export default function ClientFields({ value, onChange, showEmail = true }: Props) {
  const { zonas } = useZonasActivas()
  const set = <K extends keyof ClientData>(k: K, v: ClientData[K]) => onChange({ ...value, [k]: v })
  const esEmpresa = value.tipo === 'empresa'

  return (
    <>
      <fieldset>
        <legend>Datos personales</legend>
        <div className="grid-2">
          <label>Nombre *<input required name="given-name" autoComplete="given-name" value={value.nombre} onChange={(e) => set('nombre', e.target.value)} /></label>
          <label>Apellido *<input required name="family-name" autoComplete="family-name" value={value.apellido} onChange={(e) => set('apellido', e.target.value)} /></label>
          <label>Teléfono *
            <input required type="tel" name="tel" autoComplete="tel" placeholder="809-000-0000" value={value.numero} onChange={(e) => set('numero', e.target.value)} />
          </label>
          {showEmail && (
            <label>Correo
              <input type="email" name="email" autoComplete="email" value={value.email} onChange={(e) => set('email', e.target.value)} />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>{esEmpresa ? 'Tu empresa / negocio' : 'Lugar de entrega'}</legend>
        {esEmpresa && (
          <>
            <div className="grid-2">
              <label>Nombre de la empresa *
                <input required name="organization" autoComplete="organization" value={value.empresa} onChange={(e) => set('empresa', e.target.value)} placeholder="Ej. Colmado La Esquina" />
              </label>
              <label>Punto de referencia
                <input value={value.referencia} onChange={(e) => set('referencia', e.target.value)} placeholder="Frente al parque, portón azul…" />
              </label>
            </div>
            <label>Descripción de la empresa
              <textarea rows={3} value={value.descripcion_empresa} onChange={(e) => set('descripcion_empresa', e.target.value)}
                placeholder="¿A qué se dedica tu negocio? Horario de recepción, etc." />
            </label>
          </>
        )}
        <div className={esEmpresa ? '' : 'grid-2'}>
          <label>Dirección
            <input name="street-address" autoComplete="street-address" value={value.direccion} onChange={(e) => set('direccion', e.target.value)} placeholder="Se completa al marcar el mapa" />
          </label>
          {!esEmpresa && (
            <label>Punto de referencia
              <input value={value.referencia} onChange={(e) => set('referencia', e.target.value)} placeholder="Casa verde, al lado del colmado…" />
            </label>
          )}
        </div>
        <div className="label">{esEmpresa ? 'Ubicación de la empresa en el mapa *' : '¿Dónde te entregamos? Márcalo en el mapa *'}</div>
        <LocationPicker
          value={value.pos}
          zonas={zonas}
          onChange={(pos, addr) => onChange({ ...value, pos, direccion: addr ?? value.direccion })}
        />
        <ZoneNotice pos={value.pos} zonas={zonas} />
      </fieldset>
    </>
  )
}
