import type { PaymentMethod, TxKind } from './types'

export const KIND_LABEL: Record<TxKind, string> = {
  expense: 'Gasto',
  income: 'Entrada',
  reimbursement: 'Repasse recebido',
  card_payment: 'Pagamento de fatura',
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  credit: 'Crédito',
  debit: 'Débito',
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "13.07" ou 13.07 -> "R$ 13,07" */
export function formatMoney(amount: string | number): string {
  return brl.format(Number(amount))
}

/** "2026-10-08" -> "08/10/2026" (sem usar Date, para não sofrer com fuso horário) */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Data de hoje no fuso do aparelho, no formato AAAA-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "13.07" -> "13,07": como o valor aparece nos campos de texto. */
export const toInputAmount = (amount: string): string => amount.replace('.', ',')
