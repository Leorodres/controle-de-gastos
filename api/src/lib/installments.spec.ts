import { addMonths, expandInstallments, isValidIsoDate } from './installments.js';

describe('isValidIsoDate', () => {
  it('valida datas reais', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    for (const s of ['2026-02-29', '2026-13-01', '2026-00-10', '26-01-01', '2026-1-1', 'ontem']) {
      expect(isValidIsoDate(s), s).toBe(false);
    }
  });
});

describe('addMonths', () => {
  it('vira o ano e ajusta fim de mês', () => {
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-31', 12)).toBe('2027-12-31');
    expect(addMonths('2026-05-10', 0)).toBe('2026-05-10');
  });
});

describe('expandInstallments', () => {
  it('cria uma parcela por mês a partir da atual', () => {
    const all = expandInstallments('2026-01-31', 4);
    expect(all.map((p) => p.no)).toEqual([1, 2, 3, 4]);
    expect(all.map((p) => p.occurredOn)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);

    expect(expandInstallments('2026-10-05', 12, 10)).toEqual([
      { no: 10, occurredOn: '2026-10-05' },
      { no: 11, occurredOn: '2026-11-05' },
      { no: 12, occurredOn: '2026-12-05' },
    ]);
    expect(expandInstallments('2026-10-05', 12, 12)).toEqual([{ no: 12, occurredOn: '2026-10-05' }]);
  });
});
