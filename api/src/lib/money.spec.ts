import { parseAmount } from './money.js';

describe('parseAmount', () => {
  it('aceita número e texto com ponto ou vírgula', () => {
    expect(parseAmount(116.66)).toBe('116.66');
    expect(parseAmount(50)).toBe('50.00');
    expect(parseAmount('116,66')).toBe('116.66');
    expect(parseAmount('116.6')).toBe('116.60');
    expect(parseAmount(' 7 ')).toBe('7.00');
    expect(parseAmount(0.1 + 0.2)).toBe('0.30'); // ruído de ponto flutuante não conta como 3ª casa
    expect(parseAmount(19.99)).toBe('19.99');
  });

  it.each([0, -5, '0', '0,00', 573.345, '573,345', '1.234,56', 'abc', '', null, undefined, NaN, Infinity, 1e10])(
    'recusa valor inválido: %s',
    (v) => {
      expect(parseAmount(v)).toBeNull();
    },
  );
});
