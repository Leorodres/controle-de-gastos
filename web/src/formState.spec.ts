import { afterSave, emptyForm, toInput, toInstallments, validate, type FormState } from './formState'
import { people, transaction } from './test/fixtures'
import { formFromTransaction } from './formState'

const owner = people[0]
const valid = (over: Partial<FormState> = {}): FormState => ({ ...emptyForm(owner), name: 'Uber', amount: '24,10', ...over })

describe('emptyForm', () => {
  it('começa como gasto no crédito, para o dono, na data de hoje', () => {
    const f = emptyForm(owner)
    expect(f.kind).toBe('expense')
    expect(f.paymentMethod).toBe('credit')
    expect(f.personId).toBe('1')
    expect(f.occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('validate', () => {
  it('aceita um lançamento completo', () => {
    expect(validate(valid())).toEqual([])
    expect(validate(valid({ amount: '24.10' }))).toEqual([])
    expect(validate(valid({ amount: '50' }))).toEqual([])
  })

  it('pede nome e valor', () => {
    expect(validate(valid({ name: '  ' }))).toContain('Informe o nome.')
    for (const amount of ['', '0', '0,00', '-5', 'abc', '10,123']) {
      expect(validate(valid({ amount })).join(' ')).toMatch(/valor maior que zero/)
    }
  })

  it('confere os números do parcelamento', () => {
    const on = { installmentsOn: true }
    expect(validate(valid({ ...on, installmentsTotal: '12', installmentsCurrent: '4' }))).toEqual([])
    expect(validate(valid({ ...on, installmentsTotal: '1' })).join(' ')).toMatch(/2 a 60/)
    expect(validate(valid({ ...on, installmentsTotal: '12', installmentsCurrent: '13' })).join(' ')).toMatch(/parcela atual/)
  })

  it('ignora o parcelamento quando está desligado', () => {
    expect(validate(valid({ installmentsOn: false, installmentsTotal: 'xx' }))).toEqual([])
  })
})

describe('toInput / toInstallments', () => {
  it('converte texto em null/número e limpa espaços', () => {
    const input = toInput(valid({ name: ' Uber ', paymentMethod: '', categoryId: '6', personId: '', description: '  ' }))
    expect(input).toMatchObject({ name: 'Uber', amount: '24,10', paymentMethod: null, categoryId: 6, personId: null, description: null })
  })

  it('só gera parcelas para gasto com a opção ligada', () => {
    const f = valid({ installmentsOn: true, installmentsTotal: '12', installmentsCurrent: '4' })
    expect(toInstallments(f)).toEqual({ total: 12, current: 4 })
    expect(toInstallments({ ...f, kind: 'income' })).toBeUndefined()
    expect(toInstallments({ ...f, installmentsOn: false })).toBeUndefined()
  })
})

describe('afterSave / formFromTransaction', () => {
  it('mantém data, tipo, pagamento e pessoa e limpa o resto', () => {
    const f = afterSave(valid({ occurredOn: '2026-01-02', kind: 'income', paymentMethod: 'debit', personId: '2', categoryId: '6', description: 'x' }))
    expect(f).toMatchObject({ occurredOn: '2026-01-02', kind: 'income', paymentMethod: 'debit', personId: '2', name: '', amount: '', categoryId: '', description: '' })
  })

  it('carrega um lançamento existente para edição', () => {
    const f = formFromTransaction(transaction())
    expect(f).toMatchObject({ name: 'Spotify', amount: '21,90', categoryId: '6', personId: '1', description: 'pagamento da Leh', isFixed: true })
  })
})
