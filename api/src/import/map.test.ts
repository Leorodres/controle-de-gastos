import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRow } from './map.js';
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
  valor: 116.66,
};

function ok(raw: RawRow) {
  const r = mapRow(raw);
  assert.ok(r.ok, r.ok ? '' : r.reason);
  return r.row;
}

test('saída vira expense e extrai a parcela', () => {
  const { tx } = ok(base);
  assert.equal(tx.kind, 'expense');
  assert.equal(tx.paymentMethod, 'credit');
  assert.equal(tx.name, 'Colchao');
  assert.equal(tx.nameNormalized, 'colchao');
  assert.equal(tx.installmentNo, 3);
  assert.equal(tx.installmentTotal, 12);
  assert.equal(tx.sourceRef, 'Base!R2');
});

test('entrada no crédito é reimbursement; entrada sem "pago com" é income', () => {
  assert.equal(ok({ ...base, tipo: 'Entrada', name: 'Pag Bia Crédito' }).tx.kind, 'reimbursement');
  assert.equal(ok({ ...base, tipo: 'Entrada', pago: null, name: 'Salário RP', fixo: 'Sim' }).tx.kind, 'income');
});

test('pagamento de crédito vira card_payment', () => {
  assert.equal(ok({ ...base, tipo: 'Pagamento de Crédito' }).tx.kind, 'card_payment');
});

test('fração de centavo é arredondada para cima e registrada', () => {
  const row = ok({ ...base, valor: 573.345 });
  assert.equal(row.tx.amount, '573.35');
  assert.ok(Math.abs(row.flags.roundingDelta + 0.005) < 1e-6);
});

test('valores desconhecidos são recusados com motivo', () => {
  assert.equal(mapRow({ ...base, tipo: 'Transferência' }).ok, false);
  assert.equal(mapRow({ ...base, pago: 'Pix' }).ok, false);
  assert.equal(mapRow({ ...base, valor: 0 }).ok, false);
});

test('"Fixo?" vazio é sinalizado e assume não fixo', () => {
  const row = ok({ ...base, fixo: null });
  assert.equal(row.tx.isFixed, false);
  assert.equal(row.flags.fixedMissing, true);
});

test('nome ausente vira "(sem nome)"', () => {
  const row = ok({ ...base, name: null, nameIssue: 'error' });
  assert.equal(row.tx.name, '(sem nome)');
  assert.equal(row.tx.rawName, null);
});
