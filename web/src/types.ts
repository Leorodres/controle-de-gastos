// Tipos que espelham as respostas da API (api/src/transactions etc.).
// Em TypeScript, `interface` descreve o formato de um objeto: só existe na hora de compilar.

export type TxKind = 'income' | 'expense' | 'reimbursement' | 'card_payment'
export type PaymentMethod = 'credit' | 'debit'

export interface Person {
  id: number
  name: string
  isOwner: boolean
}

export interface Category {
  id: number
  name: string
  uses: number
}

export interface Transaction {
  id: number
  occurredOn: string // AAAA-MM-DD
  name: string
  description: string | null
  amount: string // "13.07" (texto, para não perder centavos)
  kind: TxKind
  paymentMethod: PaymentMethod | null
  isFixed: boolean
  category: { id: number; name: string } | null
  person: { id: number; name: string } | null
  installment: { no: number; total: number; groupId: string | null } | null
  source: string
  sourceRef: string | null
}

export interface TransactionPage {
  items: Transaction[]
  total: number
  limit: number
  offset: number
}

/** Um nome já usado, com o que a API sugere para preencher o formulário. */
export interface Suggestion {
  match: 'exact' | 'prefix' | 'contains' | 'similar'
  nameNormalized: string
  name: string
  uses: number
  lastUsedOn: string
  lastAmount: string
  fill: {
    kind: TxKind
    paymentMethod: PaymentMethod | null
    isFixed: boolean
    categoryId: number | null
    personId: number | null
  }
  categories: { id: number; name: string; uses: number }[]
  /** 0 a 1: fatia da categoria mais usada; null se esse nome nunca teve categoria */
  confidence: number | null
}

/** Corpo do POST/PATCH /transactions (campos que o formulário edita). */
export interface TransactionInput {
  occurredOn: string
  name: string
  amount: string
  kind: TxKind
  paymentMethod: PaymentMethod | null
  isFixed: boolean
  categoryId: number | null
  personId: number | null
  description: string | null
}

export interface Installments {
  total: number
  current: number
}
