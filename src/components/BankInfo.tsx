import { useState } from 'react'
import { CUENTA_BANCARIA as C } from '../lib/config'
import { fmtMoney } from '../lib/format'

/** Tarjeta con los datos de la cuenta para pagar por transferencia. */
export default function BankInfo({ total, pedido }: { total?: number; pedido?: number }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(C.numero)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* sin portapapeles */ }
  }
  return (
    <div className="bank-card">
      <div className="bank-top">
        <span className="bank-name">🏦 {C.banco}</span>
        <span className="bank-type">{C.tipo}</span>
      </div>
      <div className="bank-number">
        <span>{C.numero}</span>
        <button type="button" onClick={copy}>{copied ? '✓ Copiado' : 'Copiar'}</button>
      </div>
      <div className="bank-row"><small>Titular</small><b>{C.titular}</b></div>
      {total != null && <div className="bank-row"><small>Monto a transferir</small><b>{fmtMoney(total)}</b></div>}
      <p className="bank-note">
        Haz la transferencia y envía el comprobante por WhatsApp{pedido ? ` indicando el pedido #${pedido}` : ''}.
        Tu pedido se despacha al confirmar el pago.
      </p>
    </div>
  )
}
