import type { Category, Person, Suggestion, Transaction } from '../types'

export const people: Person[] = [
  { id: 1, name: 'Leonardo', isOwner: true },
  { id: 2, name: 'Beatriz', isOwner: false },
]

export const categories: Category[] = [
  { id: 6, name: 'Uber', uses: 25 },
  { id: 1, name: 'Lanche', uses: 20 },
  { id: 2, name: 'Rolê', uses: 15 },
]

export function suggestion(over: Partial<Suggestion> = {}): Suggestion {
  return {
    match: 'exact',
    nameNormalized: 'uber',
    name: 'Uber',
    uses: 12,
    lastUsedOn: '2026-09-30',
    lastAmount: '21.50',
    fill: { kind: 'expense', paymentMethod: 'credit', isFixed: false, categoryId: 6, personId: 1 },
    categories: [{ id: 6, name: 'Uber', uses: 11 }, { id: 1, name: 'Lanche', uses: 1 }],
    confidence: 0.92,
    ...over,
  }
}

export function transaction(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 10,
    occurredOn: '2026-10-08',
    name: 'Spotify',
    description: 'pagamento da Leh',
    amount: '21.90',
    kind: 'expense',
    paymentMethod: 'credit',
    isFixed: true,
    category: { id: 6, name: 'Assinatura' },
    person: { id: 1, name: 'Leonardo' },
    installment: null,
    source: 'manual',
    sourceRef: null,
    ...over,
  }
}
