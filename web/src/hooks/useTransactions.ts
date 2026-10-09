import { useEffect, useState } from 'react'
import { listTransactions } from '../api'
import { describeError } from '../errors'
import type { Transaction } from '../types'

const PAGE_SIZE = 30

interface Result {
  key: string // qual pedido (filtro + refreshKey) gerou este resultado
  items: Transaction[]
  total: number
  error: string | null
}

/**
 * Lista paginada de lançamentos. Recarrega do zero quando o filtro muda
 * ou quando `refreshKey` muda (o App incrementa depois de salvar/apagar).
 */
export function useTransactions(q: string, uncategorized: boolean, refreshKey: number) {
  const key = `${q}|${uncategorized}|${refreshKey}`
  const [result, setResult] = useState<Result | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false // se o filtro mudar antes da resposta chegar, ignoramos a resposta velha
    listTransactions({ q, uncategorized, limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (!cancelled) setResult({ key, items: page.items, total: page.total, error: null })
      })
      .catch((err) => {
        if (!cancelled) setResult({ key, items: [], total: 0, error: describeError(err)[0] ?? 'Erro' })
      })
    return () => {
      cancelled = true
    }
  }, [q, uncategorized, key])

  async function loadMore() {
    if (!result) return
    setLoadingMore(true)
    try {
      const page = await listTransactions({ q, uncategorized, limit: PAGE_SIZE, offset: result.items.length })
      setResult((r) => r && { ...r, items: [...r.items, ...page.items], total: page.total })
    } catch (err) {
      setResult((r) => r && { ...r, error: describeError(err)[0] ?? 'Erro' })
    } finally {
      setLoadingMore(false)
    }
  }

  const items = result?.items ?? [] // enquanto recarrega, continua mostrando o que já tinha
  // "carregando" não precisa de estado próprio: é só o resultado ainda não ser do pedido atual
  const loading = result?.key !== key || loadingMore
  return {
    items,
    total: result?.total ?? 0,
    loading,
    error: result?.key === key ? result.error : null,
    loadMore,
    hasMore: items.length < (result?.total ?? 0),
  }
}
