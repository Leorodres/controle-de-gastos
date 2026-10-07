import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, parseInstallment } from './normalize.js';

test('normalizeName tira acento, caixa e espaços extras', () => {
  assert.equal(normalizeName('  Colchão   3 '), 'colchao 3');
  assert.equal(normalizeName('UBER'), normalizeName('uber '));
  assert.equal(normalizeName('Salário RP'), 'salario rp');
});

test('parseInstallment reconhece parcelas no fim do nome', () => {
  assert.deepEqual(parseInstallment('Colchao 3/12'), { name: 'Colchao', installmentNo: 3, installmentTotal: 12 });
  assert.deepEqual(parseInstallment('Placa de video 10/10'), { name: 'Placa de video', installmentNo: 10, installmentTotal: 10 });
  assert.deepEqual(parseInstallment('Steam 2/2'), { name: 'Steam', installmentNo: 2, installmentTotal: 2 });
  assert.deepEqual(parseInstallment('placa bea 6/10'), { name: 'placa bea', installmentNo: 6, installmentTotal: 10 });
  assert.deepEqual(parseInstallment('Fone 1/2 '), { name: 'Fone', installmentNo: 1, installmentTotal: 2 });
});

test('parseInstallment ignora datas e casos inválidos', () => {
  for (const s of ['Dany vai pagar 15/09', 'Leh vai pagar 20/09', 'Pix 1/1', '3/12', 'Uber ida', 'Cama 13/12']) {
    const r = parseInstallment(s);
    assert.equal(r.installmentNo, null, s);
    assert.equal(r.installmentTotal, null, s);
  }
});
