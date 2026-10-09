import { useEffect, useState } from 'react'
import { listCategories, listPeople } from './api'
import { TransactionForm } from './components/TransactionForm'
import { TransactionList } from './components/TransactionList'
import { describeError } from './errors'
import type { Category, Person, Transaction } from './types'

type Tab = 'add' | 'list'

// App é o componente raiz: guarda o que é compartilhado (pessoas, categorias, aba atual,
// lançamento em edição) e distribui para os filhos por props.
export default function App() {
  const [tab, setTab] = useState<Tab>('add')
  const [people, setPeople] = useState<Person[] | null>(null) // null = ainda carregando
  const [categories, setCategories] = useState<Category[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [refreshKey, setRefreshKey] = useState(0) // mudar este número manda a lista recarregar
  const [toast, setToast] = useState<string | null>(null)

  // Carrega pessoas e categorias. Roda na montagem e sempre que refreshKey muda
  // (assim a ordem "mais usadas primeiro" se atualiza depois de cada lançamento).
  useEffect(() => {
    let cancelled = false
    Promise.all([listPeople(), listCategories()])
      .then(([p, c]) => {
        if (cancelled) return
        setPeople(p)
        setCategories(c)
        setLoadError(null)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(describeError(err)[0] ?? 'Erro ao carregar')
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  // Some com o aviso depois de 3 segundos.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const reload = () => setRefreshKey((k) => k + 1)

  function saved(message: string) {
    setToast(message)
    setEditing(null)
    reload()
  }

  function deleted() {
    setToast('Apagado')
    setEditing(null)
    reload()
  }

  function startEdit(tx: Transaction) {
    setEditing(tx)
    setTab('list')
  }

  let content
  if (loadError && people === null) {
    content = (
      <div className="card">
        <p className="error-box" role="alert">
          {loadError}
        </p>
        <button type="button" className="btn" onClick={reload}>
          Tentar de novo
        </button>
      </div>
    )
  } else if (people === null) {
    content = <p className="muted center">Carregando…</p>
  } else if (editing) {
    // `key` faz o React criar um formulário NOVO (estado zerado) quando o lançamento muda.
    content = (
      <TransactionForm
        key={editing.id}
        people={people}
        categories={categories}
        editing={editing}
        onSaved={saved}
        onDeleted={deleted}
        onCancel={() => setEditing(null)}
      />
    )
  } else if (tab === 'add') {
    content = <TransactionForm people={people} categories={categories} onSaved={saved} />
  } else {
    content = <TransactionList refreshKey={refreshKey} onEdit={startEdit} />
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Gastos</h1>
      </header>

      <main className="content">{content}</main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <nav className="tabs" aria-label="Navegação">
        <button
          type="button"
          className={tab === 'add' && !editing ? 'tab tab-on' : 'tab'}
          onClick={() => {
            setEditing(null)
            setTab('add')
          }}
        >
          Novo
        </button>
        <button
          type="button"
          className={tab === 'list' || editing ? 'tab tab-on' : 'tab'}
          onClick={() => {
            setEditing(null)
            setTab('list')
          }}
        >
          Lançamentos
        </button>
      </nav>
    </div>
  )
}
