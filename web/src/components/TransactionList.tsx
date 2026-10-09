import { useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useTransactions } from '../hooks/useTransactions'
import type { Transaction } from '../types'
import { TransactionItem } from './TransactionItem'

interface Props {
  refreshKey: number
  onEdit: (tx: Transaction) => void
}

export function TransactionList({ refreshKey, onEdit }: Props) {
  const [search, setSearch] = useState('')
  const [uncategorized, setUncategorized] = useState(false)
  const q = useDebouncedValue(search.trim(), 300)
  const { items, total, loading, error, hasMore, loadMore } = useTransactions(q, uncategorized, refreshKey)

  return (
    <section className="card">
      <h2>Lançamentos</h2>

      <div className="filters">
        <input
          type="search"
          placeholder="Buscar por nome"
          aria-label="Buscar por nome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="check">
          <input type="checkbox" checked={uncategorized} onChange={(e) => setUncategorized(e.target.checked)} />
          Só gastos sem categoria
        </label>
      </div>

      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}

      <ul className="list">
        {items.map((tx) => (
          <TransactionItem key={tx.id} tx={tx} onEdit={onEdit} />
        ))}
      </ul>

      {!loading && !error && items.length === 0 && <p className="muted">Nenhum lançamento encontrado.</p>}
      {loading && <p className="muted">Carregando…</p>}

      {hasMore && !loading && (
        <button type="button" className="btn" onClick={loadMore}>
          Carregar mais ({items.length} de {total})
        </button>
      )}
    </section>
  )
}
