import { mapRow, type MappedRow } from './map.js';
import type { RawRow } from './parse.js';

const base: RawRow = {
  sheetRow: 2,
  date: '2026-01-05',
  tipo: 'Saída',
  name: 'Colchao 3/12',
  nameIssue: null,
  pago: 'Crédito',
  fixo: 'Não',
  categoria: 'Conta',
  pessoa: 'Leonardo',
  descricao: null,
  valor: 116.66,
};

function ok(raw: RawRow): MappedRow {
  const r = mapRow(raw);
  if (!r.ok) throw new Error(r.reason);
  return r.row;
}

describe('mapRow', () => {
  it('saída vira expense e extrai a parcela', () => {
    const { tx } = ok(base);
    expect(tx.kind).toBe('expense');
    expect(tx.paymentMethod).toBe('credit');
    expect(tx.name).toBe('Colchao');
    expect(tx.nameNormalized).toBe('colchao');
    expect(tx.installmentNo).toBe(3);
    expect(tx.installmentTotal).toBe(12);
    expect(tx.sourceRef).toBe('Base!R2');
  });

  it('entrada no crédito é reimbursement; entrada sem "pago com" é income', () => {
    expect(ok({ ...base, tipo: 'Entrada', name: 'Pag Bia Crédito' }).tx.kind).toBe('reimbursement');
    expect(ok({ ...base, tipo: 'Entrada', pago: null, name: 'Salário RP', fixo: 'Sim' }).tx.kind).toBe('income');
  });

  it('pagamento de crédito vira card_payment', () => {
    expect(ok({ ...base, tipo: 'Pagamento de Crédito' }).tx.kind).toBe('card_payment');
  });

  it('fração de centavo é arredondada para cima e registrada', () => {
    const row = ok({ ...base, valor: 573.345 });
    expect(row.tx.amount).toBe('573.35');
    expect(row.flags.roundingDelta).toBeCloseTo(-0.005, 6);
  });

  it('valores desconhecidos são recusados com motivo', () => {
    expect(mapRow({ ...base, tipo: 'Transferência' }).ok).toBe(false);
    expect(mapRow({ ...base, pago: 'Pix' }).ok).toBe(false);
    expect(mapRow({ ...base, valor: 0 }).ok).toBe(false);
  });

  it('"Fixo?" vazio é sinalizado e assume não fixo', () => {
    const row = ok({ ...base, fixo: null });
    expect(row.tx.isFixed).toBe(false);
    expect(row.flags.fixedMissing).toBe(true);
  });

  it('nome ausente vira "(sem nome)"', () => {
    const row = ok({ ...base, name: null, nameIssue: 'error' });
    expect(row.tx.name).toBe('(sem nome)');
    expect(row.tx.rawName).toBeNull();
  });

  it('descrição é opcional, é limpa e tem limite', () => {
    expect(ok(base).tx.description).toBeNull();
    expect(ok({ ...base, descricao: '  pagamento   da Leh ' }).tx.description).toBe('pagamento da Leh');
    expect(ok({ ...base, descricao: '   ' }).tx.description).toBeNull();
    const tooLong = mapRow({ ...base, descricao: 'x'.repeat(201) });
    expect(tooLong.ok).toBe(false);
  });
});
