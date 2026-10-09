import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { transaction } from '../test/fixtures'
import { TransactionItem } from './TransactionItem'

describe('TransactionItem', () => {
  it('mostra nome, descrição, data, categoria, pessoa e valor', () => {
    render(<ul><TransactionItem tx={transaction()} onEdit={() => {}} /></ul>)
    expect(screen.getByText('Spotify')).toBeInTheDocument()
    expect(screen.getByText('pagamento da Leh')).toBeInTheDocument()
    expect(screen.getByText(/08\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/Assinatura/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s21,90/)).toHaveTextContent('−')
  })

  it('a descrição longa fica inteira no title (o CSS corta com "…")', () => {
    const long = 'x'.repeat(150)
    render(<ul><TransactionItem tx={transaction({ description: long })} onEdit={() => {}} /></ul>)
    expect(screen.getByTitle(long)).toHaveClass('item-desc')
  })

  it('sem descrição, não cria a linha', () => {
    const { container } = render(<ul><TransactionItem tx={transaction({ description: null })} onEdit={() => {}} /></ul>)
    expect(container.querySelector('.item-desc')).toBeNull()
  })

  it('mostra a parcela e destaca gasto sem categoria', () => {
    render(<ul><TransactionItem tx={transaction({ category: null, installment: { no: 3, total: 12, groupId: 'g' } })} onEdit={() => {}} /></ul>)
    expect(screen.getByText('3/12')).toBeInTheDocument()
    expect(screen.getByText('Sem categoria')).toHaveClass('warn')
  })

  it('entrada recebe sinal de + e etiqueta do tipo', () => {
    render(<ul><TransactionItem tx={transaction({ kind: 'income', category: null })} onEdit={() => {}} /></ul>)
    expect(screen.getByText('Entrada')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s21,90/)).toHaveTextContent('+')
    expect(screen.getByText('Sem categoria')).not.toHaveClass('warn')
  })

  it('chama onEdit ao tocar no item', async () => {
    const onEdit = vi.fn()
    const tx = transaction()
    render(<ul><TransactionItem tx={tx} onEdit={onEdit} /></ul>)
    await userEvent.click(screen.getByRole('button'))
    expect(onEdit).toHaveBeenCalledWith(tx)
  })
})
