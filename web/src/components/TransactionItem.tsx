import { KIND_LABEL, formatDate, formatMoney } from '../format'
import type { Transaction } from '../types'

interface Props {
  tx: Transaction
  onEdit: (tx: Transaction) => void
}

// "+" para o que entra, "−" para o que sai
const SIGN: Record<Transaction['kind'], string> = { expense: '−', income: '+', reimbursement: '+', card_payment: '−' }

export function TransactionItem({ tx, onEdit }: Props) {
  const uncategorizedExpense = tx.kind === 'expense' && !tx.category

  return (
    <li>
      <button type="button" className="item" onClick={() => onEdit(tx)}>
        <span className="item-main">
          <span className="item-name">
            {tx.name}
            {tx.installment && (
              <span className="badge">
                {tx.installment.no}/{tx.installment.total}
              </span>
            )}
            {tx.kind !== 'expense' && <span className="badge badge-kind">{KIND_LABEL[tx.kind]}</span>}
          </span>

          {/* A descrição sempre aparece, em uma linha só; se não couber, o CSS corta com "…". O texto inteiro fica no title e na edição. */}
          {tx.description && (
            <span className="item-desc" title={tx.description}>
              {tx.description}
            </span>
          )}

          <span className="item-meta">
            {formatDate(tx.occurredOn)} ·{' '}
            <span className={uncategorizedExpense ? 'warn' : undefined}>{tx.category?.name ?? 'Sem categoria'}</span>
            {tx.person ? ` · ${tx.person.name}` : ''}
          </span>
        </span>

        <span className={`amount amount-${tx.kind}`}>
          {SIGN[tx.kind]} {formatMoney(tx.amount)}
        </span>
      </button>
    </li>
  )
}
