import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from './api'
import App from './App'
import { categories, people, transaction } from './test/fixtures'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  listPeople: vi.fn(),
  listCategories: vi.fn(),
  listTransactions: vi.fn(),
  suggest: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listPeople).mockResolvedValue(people)
  vi.mocked(api.listCategories).mockResolvedValue(categories)
  vi.mocked(api.suggest).mockResolvedValue([])
  vi.mocked(api.listTransactions).mockResolvedValue({ items: [transaction()], total: 1, limit: 30, offset: 0 })
})

describe('App', () => {
  it('carrega e mostra o formulário de novo lançamento', async () => {
    render(<App />)
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Novo lançamento' })).toBeInTheDocument()
  })

  it('lançar mostra o aviso e recarrega pessoas e categorias', async () => {
    vi.mocked(api.createTransaction).mockResolvedValue([transaction({ name: 'Uber', amount: '24.10' })])
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText(/^Nome/), 'Uber')
    await user.type(screen.getByLabelText(/^Valor/), '24,10')
    await user.click(screen.getByRole('button', { name: 'Lançar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Lançado: Uber')
    await waitFor(() => expect(api.listCategories).toHaveBeenCalledTimes(2))
  })

  it('aba Lançamentos lista, e tocar num item abre a edição; apagar volta para a lista', async () => {
    vi.mocked(api.deleteTransaction).mockResolvedValue({ deleted: 1 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
    await user.click(await screen.findByRole('button', { name: /Spotify/ }))
    expect(screen.getByRole('heading', { name: 'Editar lançamento' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Descrição/)).toHaveValue('pagamento da Leh')

    await user.click(screen.getByRole('button', { name: 'Apagar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Apagado')
    expect(await screen.findByRole('heading', { name: 'Lançamentos' })).toBeInTheDocument()
  })

  it('o filtro "sem categoria" pede só esses gastos à API', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
    await user.click(await screen.findByLabelText('Só gastos sem categoria'))
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ uncategorized: true, offset: 0 })),
    )
  })

  it('se a API estiver fora do ar, mostra o erro e deixa tentar de novo', async () => {
    vi.mocked(api.listPeople).mockRejectedValueOnce(new api.ApiError(0, 'Não consegui falar com o servidor. A API está no ar?'))
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não consegui falar com o servidor')
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { name: 'Novo lançamento' })).toBeInTheDocument()
  })
})
