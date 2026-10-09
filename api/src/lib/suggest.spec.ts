import { summarizeHistory, type HistoryRow } from './suggest.js';

let seq = 0;
function row(over: Partial<HistoryRow>): HistoryRow {
  return {
    id: ++seq, name: 'Uber', kind: 'expense', paymentMethod: 'credit', isFixed: false,
    categoryId: 1, categoryName: 'Transporte', personId: 1, amount: '10.00', occurredOn: '2026-01-01', ...over,
  };
}

describe('summarizeHistory', () => {
  it('usa o valor mais frequente de cada campo', () => {
    const s = summarizeHistory([
      row({ occurredOn: '2026-01-01', categoryId: 1, categoryName: 'Transporte' }),
      row({ occurredOn: '2026-01-02', categoryId: 1, categoryName: 'Transporte' }),
      row({ occurredOn: '2026-01-03', categoryId: 2, categoryName: 'Uber' }),
    ]);
    expect(s.fill.categoryId).toBe(1);
    expect(s.categories).toEqual([{ id: 1, name: 'Transporte', uses: 2 }, { id: 2, name: 'Uber', uses: 1 }]);
    expect(s.confidence).toBeCloseTo(2 / 3);
    expect(s.uses).toBe(3);
  });

  it('empate desempata pelo mais recente, independente da ordem de entrada', () => {
    const rows = [
      row({ occurredOn: '2026-03-01', categoryId: 2, categoryName: 'Lanche' }),
      row({ occurredOn: '2026-01-01', categoryId: 1, categoryName: 'Rolê' }),
    ];
    expect(summarizeHistory(rows).fill.categoryId).toBe(2);
    expect(summarizeHistory([...rows].reverse()).fill.categoryId).toBe(2);
  });

  it('última data, valor e nome vêm do lançamento mais recente', () => {
    const s = summarizeHistory([
      row({ occurredOn: '2026-05-01', name: 'uber', amount: '20.00' }),
      row({ occurredOn: '2026-02-01', name: 'UBER', amount: '99.00' }),
    ]);
    expect(s.name).toBe('uber');
    expect(s.lastAmount).toBe('20.00');
    expect(s.lastUsedOn).toBe('2026-05-01');
  });

  it('sem categoria no histórico: não sugere categoria e confiança é null', () => {
    const s = summarizeHistory([row({ categoryId: null, categoryName: null })]);
    expect(s.fill.categoryId).toBeNull();
    expect(s.categories).toEqual([]);
    expect(s.confidence).toBeNull();
  });

  it('pessoa nula (ex.: assinaturas) também é um valor sugerido', () => {
    const s = summarizeHistory([row({ personId: null }), row({ personId: null }), row({ personId: 3 })]);
    expect(s.fill.personId).toBeNull();
  });
});
