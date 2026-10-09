// Lógica do formulário SEM React: estado inicial, validação e conversão para o corpo da API.
// Manter isso fora do componente deixa o componente enxuto e a lógica fácil de testar.

import { todayIso, toInputAmount } from './format'
import type { Installments, PaymentMethod, Person, Transaction, TransactionInput, TxKind } from './types'

/**
 * Tudo que o usuário digita fica como texto, porque <input> e <select> sempre devolvem string.
 * A conversão para número/null acontece só na hora de enviar (toInput).
 */
export interface FormState {
  occurredOn: string
  name: string
  amount: string
  kind: TxKind
  paymentMethod: PaymentMethod | ''
  isFixed: boolean
  categoryId: string // '' = sem categoria
  personId: string // '' = sem pessoa
  description: string
  installmentsOn: boolean
  installmentsTotal: string
  installmentsCurrent: string
}

export const MAX_DESCRIPTION = 200

export function emptyForm(owner?: Person): FormState {
  return {
    occurredOn: todayIso(),
    name: '',
    amount: '',
    kind: 'expense',
    paymentMethod: 'credit',
    isFixed: false,
    categoryId: '',
    personId: owner ? String(owner.id) : '',
    description: '',
    installmentsOn: false,
    installmentsTotal: '',
    installmentsCurrent: '1',
  }
}

export function formFromTransaction(tx: Transaction): FormState {
  return {
    occurredOn: tx.occurredOn,
    name: tx.name,
    amount: toInputAmount(tx.amount),
    kind: tx.kind,
    paymentMethod: tx.paymentMethod ?? '',
    isFixed: tx.isFixed,
    categoryId: tx.category ? String(tx.category.id) : '',
    personId: tx.person ? String(tx.person.id) : '',
    description: tx.description ?? '',
    installmentsOn: false,
    installmentsTotal: '',
    installmentsCurrent: '1',
  }
}

/** Depois de lançar, limpa o que muda a cada gasto e mantém data, tipo, pagamento e pessoa. */
export function afterSave(f: FormState): FormState {
  return {
    ...emptyForm(),
    occurredOn: f.occurredOn,
    kind: f.kind,
    paymentMethod: f.paymentMethod,
    personId: f.personId,
  }
}

const AMOUNT_RE = /^\d{1,10}([.,]\d{1,2})?$/

/** Devolve as mensagens de erro (lista vazia = válido). A API valida de novo; isto é só para avisar rápido. */
export function validate(f: FormState): string[] {
  const problems: string[] = []
  if (f.name.trim() === '') problems.push('Informe o nome.')
  if (!f.occurredOn) problems.push('Informe a data.')
  const amount = f.amount.trim()
  if (!AMOUNT_RE.test(amount) || Number(amount.replace(',', '.')) <= 0) {
    problems.push('Informe um valor maior que zero, com até 2 casas decimais (ex.: 24,90).')
  }
  if (f.description.length > MAX_DESCRIPTION) problems.push(`A descrição passa de ${MAX_DESCRIPTION} caracteres.`)
  if (f.installmentsOn) {
    const total = Number(f.installmentsTotal)
    const current = Number(f.installmentsCurrent)
    if (!Number.isInteger(total) || total < 2 || total > 60) problems.push('O número de parcelas deve ser de 2 a 60.')
    else if (!Number.isInteger(current) || current < 1 || current > total) {
      problems.push('A parcela atual deve ser de 1 até o número de parcelas.')
    }
  }
  return problems
}

export function toInput(f: FormState): TransactionInput {
  return {
    occurredOn: f.occurredOn,
    name: f.name.trim(),
    amount: f.amount.trim(),
    kind: f.kind,
    paymentMethod: f.paymentMethod === '' ? null : f.paymentMethod,
    isFixed: f.isFixed,
    categoryId: f.categoryId === '' ? null : Number(f.categoryId),
    personId: f.personId === '' ? null : Number(f.personId),
    description: f.description.trim() === '' ? null : f.description.trim(),
  }
}

/** Só existe parcelamento para gasto novo; na edição ele não se aplica. */
export function toInstallments(f: FormState): Installments | undefined {
  if (!f.installmentsOn || f.kind !== 'expense') return undefined
  return { total: Number(f.installmentsTotal), current: Number(f.installmentsCurrent) }
}
