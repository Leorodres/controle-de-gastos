import { escapeLike, normalizeName, parseInstallment } from './normalize.js';

describe('normalizeName', () => {
  it('tira acento, caixa e espaços extras', () => {
    expect(normalizeName('  Colchão   3 ')).toBe('colchao 3');
    expect(normalizeName('UBER')).toBe(normalizeName('uber '));
    expect(normalizeName('Salário RP')).toBe('salario rp');
  });
});

describe('parseInstallment', () => {
  it('reconhece parcelas no fim do nome', () => {
    expect(parseInstallment('Colchao 3/12')).toEqual({ name: 'Colchao', installmentNo: 3, installmentTotal: 12 });
    expect(parseInstallment('Placa de video 10/10')).toEqual({ name: 'Placa de video', installmentNo: 10, installmentTotal: 10 });
    expect(parseInstallment('Steam 2/2')).toEqual({ name: 'Steam', installmentNo: 2, installmentTotal: 2 });
    expect(parseInstallment('placa bea 6/10')).toEqual({ name: 'placa bea', installmentNo: 6, installmentTotal: 10 });
    expect(parseInstallment('Fone 1/2 ')).toEqual({ name: 'Fone', installmentNo: 1, installmentTotal: 2 });
  });

  it.each(['Dany vai pagar 15/09', 'Leh vai pagar 20/09', 'Pix 1/1', '3/12', 'Uber ida', 'Cama 13/12'])(
    'ignora datas e casos inválidos: %s',
    (s) => {
      const r = parseInstallment(s);
      expect(r.installmentNo).toBeNull();
      expect(r.installmentTotal).toBeNull();
    },
  );
});

describe('escapeLike', () => {
  it('escapa curingas do LIKE', () => {
    expect(escapeLike('50%_off\\x')).toBe('50\\%\\_off\\\\x');
  });
});
