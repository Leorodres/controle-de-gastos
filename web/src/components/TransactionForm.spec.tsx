import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '../api'
import { categories, people, suggestion, transaction } from '../test/fixtures'
import { TransactionForm } from './TransactionForm'

// Troca só as funções que falam com a rede; ApiError continua o de verdade.
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  suggest: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}))

const field = (label: RegExp) => screen.getByLabelText(label)

function setup(props: Partial<React.ComponentProps<typeof TransactionForm>> = {}) {
  const onSaved = vi.fn()
  const user = userEvent.setup()
  render(<TransactionForm people={people} categories={categories} onSaved={onSaved} {...props} />)
  return { user, onSaved }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.suggest).mockResolvedValue([])
})

describe('autopreenchimento', () => {
  it('um toque na sugestão preenche tipo, pagamento, categoria, pessoa e último valor', async () => {
    vi.mocked(api.suggest).mockResolvedValue([suggestion()])
    const { user } = setup()

    await user.type(field(/^Nome/), 'ub')
    await user.click(await screen.findByRole('button', { name: /Uber/ }))

    expect(field(/^Nome/)).toHaveValue('Uber')
    expect(field(/^Categoria/)).toHaveValue('6')
    expect(field(/^Valor/)).toHaveValue('21,50')
    expect(field(/^Pagamento/)).toHaveValue('credit')
    expect(field(/^Pessoa/)).toHaveValue('1')
    // depois de escolher, a lista de sugestões some
    expect(screen.queryByLabelText('Nomes já usados')).toBeNull()
  })

  it('não sobrescreve um valor que você já digitou', async () => {
    vi.mocked(api.suggest).mockResolvedValue([suggestion()])
    const { user } = setup()
    await user.type(field(/^Valor/), '99')
    await user.type(field(/^Nome/), 'ub')
    await user.click(await screen.findByRole('button', { name: /Uber/ }))
    expect(field(/^Valor/)).toHaveValue('99')
  })

  it('categoria duvidosa fica em branco e oferece as alternativas', async () => {
    vi.mocked(api.suggest).mockResolvedValue([
      suggestion({
        name: 'Abbraccio',
        nameNormalized: 'abbraccio',
        confidence: 0.5,
        fill: { kind: 'expense', paymentMethod: 'credit', isFixed: false, categoryId: 1, personId: 1 },
        categories: [{ id: 1, name: 'Lanche', uses: 3 }, { id: 2, name: 'Rolê', uses: 3 }],
      }),
    ])
    const { user } = setup()

    await user.type(field(/^Nome/), 'abb')
    await user.click(await screen.findByRole('button', { name: /Abbraccio/ }))

    expect(field(/^Categoria/)).toHaveValue('')
    expect(screen.getByText(/categorias diferentes/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Rolê · 3×/ }))
    expect(field(/^Categoria/)).toHaveValue('2')
  })
})

describe('envio', () => {
  it('manda o corpo certo, avisa e limpa o formulário', async () => {
    vi.mocked(api.createTransaction).mockResolvedValue([transaction({ name: 'Uber', amount: '24.10' })])
    const { user, onSaved } = setup()

    await user.type(field(/^Nome/), 'Uber')
    await user.type(field(/^Valor/), '24,10')
    await user.selectOptions(field(/^Categoria/), '6')
    await user.type(field(/^Descrição/), '  corrida do aeroporto ')
    await user.click(screen.getByRole('button', { name: 'Lançar' }))

    await waitFor(() => expect(api.createTransaction).toHaveBeenCalledTimes(1))
    expect(api.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Uber', amount: '24,10', kind: 'expense', paymentMethod: 'credit',
        isFixed: false, categoryId: 6, personId: 1, description: 'corrida do aeroporto',
      }),
      undefined,
    )
    expect(onSaved).toHaveBeenCalledWith(expect.stringMatching(/Lançado: Uber/))
    await waitFor(() => expect(field(/^Nome/)).toHaveValue(''))
    expect(field(/^Valor/)).toHaveValue('')
  })

  it('não chama a API quando faltam campos', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Lançar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o nome.')
    expect(api.createTransaction).not.toHaveBeenCalled()
  })

  it('compra parcelada envia total e parcela atual', async () => {
    vi.mocked(api.createTransaction).mockResolvedValue(Array.from({ length: 9 }, (_, i) => transaction({ id: i + 1 })))
    const { user, onSaved } = setup()

    await user.type(field(/^Nome/), 'Colchão')
    await user.type(field(/^Valor/), '116,66')
    await user.click(screen.getByLabelText('Compra parcelada'))
    await user.type(field(/^Nº de parcelas/), '12')
    await user.clear(field(/^Parcela atual/))
    await user.type(field(/^Parcela atual/), '4')
    await user.click(screen.getByRole('button', { name: 'Lançar' }))

    await waitFor(() => expect(api.createTransaction).toHaveBeenCalled())
    expect(vi.mocked(api.createTransaction).mock.calls[0]?.[1]).toEqual({ total: 12, current: 4 })
    expect(onSaved).toHaveBeenCalledWith('Lançadas 9 parcelas de Colchão')
  })

  it('mostra os erros que a API devolve', async () => {
    vi.mocked(api.createTransaction).mockRejectedValue(
      new api.ApiError(400, 'Dados inválidos', [{ path: 'amount', message: 'valor deve ser maior que zero' }]),
    )
    const { user } = setup()
    await user.type(field(/^Nome/), 'Uber')
    await user.type(field(/^Valor/), '10')
    await user.click(screen.getByRole('button', { name: 'Lançar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Valor: valor deve ser maior que zero')
  })

  it('parcelamento não aparece para entradas', async () => {
    const { user } = setup()
    expect(screen.getByLabelText('Compra parcelada')).toBeInTheDocument()
    await user.selectOptions(field(/^Tipo/), 'income')
    expect(screen.queryByLabelText('Compra parcelada')).toBeNull()
  })
})

describe('edição', () => {
  const installmentTx = transaction({ name: 'Colchao', installment: { no: 5, total: 12, groupId: 'g1' } })

  it('carrega os dados e salva com PATCH', async () => {
    vi.mocked(api.updateTransaction).mockResolvedValue(transaction())
    const { user, onSaved } = setup({ editing: transaction() })

    expect(field(/^Nome/)).toHaveValue('Spotify')
    expect(field(/^Descrição/)).toHaveValue('pagamento da Leh')
    await user.selectOptions(field(/^Categoria/), '2')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(api.updateTransaction).toHaveBeenCalled())
    expect(api.updateTransaction).toHaveBeenCalledWith(10, expect.objectContaining({ categoryId: 2, description: 'pagamento da Leh' }))
    expect(onSaved).toHaveBeenCalled()
  })

  it('apaga esta parcela e as seguintes depois de confirmar', async () => {
    vi.mocked(api.deleteTransaction).mockResolvedValue({ deleted: 8 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDeleted = vi.fn()
    const { user } = setup({ editing: installmentTx, onDeleted })

    await user.click(screen.getByRole('button', { name: 'Apagar esta e as seguintes' }))
    await waitFor(() => expect(api.deleteTransaction).toHaveBeenCalledWith(10, 'following'))
    expect(onDeleted).toHaveBeenCalled()
  })

  it('não apaga se a confirmação for recusada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { user } = setup({ editing: transaction() })
    await user.click(screen.getByRole('button', { name: 'Apagar' }))
    expect(api.deleteTransaction).not.toHaveBeenCalled()
  })

  it('lançamento sem grupo de parcelas não oferece "apagar as seguintes"', () => {
    setup({ editing: transaction() })
    expect(screen.queryByRole('button', { name: 'Apagar esta e as seguintes' })).toBeNull()
  })
})
