// Único lugar que sabe como falar com o back-end. Os componentes chamam estas funções
// e não precisam saber de URL, JSON ou status HTTP.

import type {
  Category,
  Installments,
  Person,
  Suggestion,
  Transaction,
  TransactionInput,
  TransactionPage,
} from './types'

// Em desenvolvimento o Vite encaminha /api para o Nest (vite.config.ts); em produção, o nginx.
const BASE = '/api'

export interface ApiIssue {
  path: string
  message: string
}

/** Erro devolvido pela API (status HTTP + mensagem + lista de campos inválidos, se houver). */
export class ApiError extends Error {
  status: number
  issues: ApiIssue[]

  constructor(status: number, message: string, issues: ApiIssue[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.issues = issues
  }
}

async function request<T>(path: string, options: { method?: string; json?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method: options.method ?? 'GET',
      headers: options.json !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      signal: options.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err // cancelado de propósito
    throw new ApiError(0, 'Não consegui falar com o servidor. A API está no ar?')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const fallback = body?.error === 'validation' ? 'Dados inválidos' : `Erro ${res.status}`
    throw new ApiError(res.status, body?.message ?? fallback, body?.issues ?? [])
  }
  return body as T
}

export const listPeople = () => request<{ items: Person[] }>('/people').then((r) => r.items)

export const listCategories = () => request<{ items: Category[] }>('/categories').then((r) => r.items)

export interface ListParams {
  q?: string
  uncategorized?: boolean
  limit: number
  offset: number
}

export function listTransactions(params: ListParams): Promise<TransactionPage> {
  const qs = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) })
  if (params.q) qs.set('q', params.q)
  if (params.uncategorized) qs.set('uncategorized', 'true')
  return request<TransactionPage>(`/transactions?${qs}`)
}

export const suggest = (q: string, signal?: AbortSignal) =>
  request<{ suggestions: Suggestion[] }>(`/suggestions?q=${encodeURIComponent(q)}&limit=5`, { signal }).then(
    (r) => r.suggestions,
  )

/** Cria o lançamento; com `installments`, a API cria todas as parcelas e devolve a lista. */
export const createTransaction = (input: TransactionInput, installments?: Installments) =>
  request<{ items: Transaction[] }>('/transactions', {
    method: 'POST',
    json: installments ? { ...input, installments } : input,
  }).then((r) => r.items)

export const updateTransaction = (id: number, input: TransactionInput) =>
  request<Transaction>(`/transactions/${id}`, { method: 'PATCH', json: input })

/** scope "following": apaga esta parcela e as seguintes do mesmo parcelamento. */
export const deleteTransaction = (id: number, scope: 'this' | 'following' = 'this') =>
  request<{ deleted: number }>(`/transactions/${id}?scope=${scope}`, { method: 'DELETE' })
