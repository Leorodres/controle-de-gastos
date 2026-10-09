import { formatDate, formatMoney, toInputAmount, todayIso } from './format'

describe('format', () => {
  it('formatMoney usa o padrão brasileiro', () => {
    // o Intl usa espaço não separável entre "R$" e o número, por isso o \s
    expect(formatMoney('13.07')).toMatch(/^R\$\s13,07$/)
    expect(formatMoney(1234.5)).toMatch(/^R\$\s1\.234,50$/)
  })

  it('formatDate troca AAAA-MM-DD por DD/MM/AAAA', () => {
    expect(formatDate('2026-10-08')).toBe('08/10/2026')
  })

  it('todayIso usa o dia local, com zeros à esquerda', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('toInputAmount troca ponto por vírgula', () => {
    expect(toInputAmount('21.50')).toBe('21,50')
  })
})
