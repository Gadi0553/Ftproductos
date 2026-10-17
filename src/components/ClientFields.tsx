import LocationPicker from './LocationPicker'
import ZoneNotice from './ZoneNotice'
import { useZonasActivas } from '../lib/zonas'
import type { LatLng } from '../lib/types'

export interface ClientData {
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
  nombre: '', apellido: '', numero: '', email: '', empresa: '',
  descripcion_empresa: '', direccion: '', referencia: '', pos: null,
}

interface Props {
  value: ClientData
  onChange: (v: ClientData) => void
  showEmail?: boolean
}

/** Campos del perfil del cliente + ubicación de su empresa. */
export default function ClientFields({ value, onChange, showEmail = true }: Props) {
  const { zonas } = useZonasActivas()
  const set = <K extends keyof ClientData>(k: K, v: ClientData[K]) => onChange({ ...value, [k]: v })

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
        <legend>Tu empresa / negocio</legend>
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
        <label>Dirección
          <input name="street-address" autoComplete="street-address" value={value.direccion} onChange={(e) => set('direccion', e.target.value)} placeholder="Se completa al marcar el mapa" />
        </label>
        <div className="label">Ubicación de la empresa en el mapa *</div>
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
