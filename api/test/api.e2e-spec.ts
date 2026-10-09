import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { PG_POOL } from '../src/database/database.module.js';
import { createTestDb } from './helpers/test-db.js';

let app: INestApplication;
let pool: pg.Pool;
let drop: () => Promise<void>;
let personId: number;
let otherPersonId: number;
const cat: Record<string, number> = {};

type Method = 'get' | 'post' | 'patch' | 'delete';
async function call(method: Method, url: string, payload?: object) {
  const req = request(app.getHttpServer())[method](url);
  const res = await (payload ? req.send(payload) : req);
  return { status: res.status, body: res.body };
}

const tx = (over: Record<string, unknown> = {}) => ({
  occurredOn: '2026-10-01', name: 'Uber', amount: 13.07, kind: 'expense', paymentMethod: 'credit', personId, ...over,
});

beforeAll(async () => {
  ({ pool, drop } = await createTestDb());
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(pool)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();

  personId = (await call('post', '/people', { name: 'Leonardo' })).body.id;
  otherPersonId = (await call('post', '/people', { name: 'Beatriz' })).body.id;
  for (const n of ['Transporte', 'Lanche', 'Rolê']) cat[n] = (await call('post', '/categories', { name: n })).body.id;
});

afterAll(async () => {
  await app.close();
  await drop();
});

describe('infra', () => {
  it('health', async () => {
    expect((await call('get', '/health')).body).toEqual({ status: 'ok' });
  });

  it('rota inexistente e JSON malformado seguem o formato de erro da API', async () => {
    const nf = await call('get', '/nao-existe');
    expect(nf.status).toBe(404);
    expect(nf.body.error).toBe('not_found');

    const bad = await request(app.getHttpServer()).post('/transactions').set('content-type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('bad_request');
  });
});

describe('pessoas e categorias', () => {
  it('duplicado dá 409', async () => {
    expect((await call('post', '/people', { name: 'Leonardo' })).status).toBe(409);
    expect((await call('post', '/categories', { name: 'Lanche' })).status).toBe(409);
    const names = (await call('get', '/people')).body.items.map((p: { name: string }) => p.name);
    expect([...names].sort()).toEqual(['Beatriz', 'Leonardo']);
  });
});

describe('lançamentos', () => {
  it('cria, lê, edita e apaga', async () => {
    const created = await call('post', '/transactions', tx({ amount: '13,07', categoryId: cat.Transporte, description: '  corrida do aeroporto ' }));
    expect(created.status).toBe(201);
    const item = created.body.items[0];
    expect(item.amount).toBe('13.07');
    expect(item.occurredOn).toBe('2026-10-01');
    expect(item.category).toEqual({ id: cat.Transporte, name: 'Transporte' });
    expect(item.description).toBe('corrida do aeroporto');
    expect(item.source).toBe('manual');

    expect((await call('get', `/transactions/${item.id}`)).body.name).toBe('Uber');

    const patched = await call('patch', `/transactions/${item.id}`, { amount: 15, categoryId: null, name: 'Uber ida', description: null });
    expect(patched.body.amount).toBe('15.00');
    expect(patched.body.category).toBeNull();
    expect(patched.body.name).toBe('Uber ida');
    expect(patched.body.description).toBeNull();

    expect((await call('delete', `/transactions/${item.id}`)).body).toEqual({ deleted: 1 });
    expect((await call('get', `/transactions/${item.id}`)).status).toBe(404);
    expect((await call('delete', `/transactions/${item.id}`)).status).toBe(404);
    expect((await call('patch', `/transactions/${item.id}`, { amount: 1 })).status).toBe(404);
  });

  it('descrição vazia vira null e descrição longa demais é recusada', async () => {
    const empty = await call('post', '/transactions', tx({ description: '   ' }));
    expect(empty.body.items[0].description).toBeNull();
    const long = await call('post', '/transactions', tx({ description: 'x'.repeat(201) }));
    expect(long.status).toBe(400);
  });

  it.each([
    ['data inexistente', { occurredOn: '2026-02-30' }],
    ['data fora do formato', { occurredOn: '01/10/2026' }],
    ['valor negativo', { amount: -1 }],
    ['3 casas decimais', { amount: 10.123 }],
    ['nome em branco', { name: '   ' }],
    ['tipo inválido', { kind: 'saida' }],
    ['campo que não existe', { valor: 10 }],
    ['parcelamento em entrada', { kind: 'income', installments: { total: 3 } }],
    ['current maior que total', { installments: { total: 3, current: 4 } }],
  ])('validação: %s dá 400', async (_label, over) => {
    const r = await call('post', '/transactions', tx(over));
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('validation');
    expect(r.body.issues.length).toBeGreaterThan(0);
  });

  it('PATCH sem campos dá 400; id inválido dá 400', async () => {
    expect((await call('patch', '/transactions/1', {})).status).toBe(400);
    expect((await call('get', '/transactions/abc')).status).toBe(400);
  });

  it('categoria ou pessoa inexistente dá 422 e não grava nada', async () => {
    const before = (await call('get', '/transactions')).body.total;
    expect((await call('post', '/transactions', tx({ categoryId: 99999 }))).status).toBe(422);
    expect((await call('post', '/transactions', tx({ personId: 99999 }))).status).toBe(422);
    expect((await call('get', '/transactions')).body.total).toBe(before);
  });

  it('compra parcelada gera as parcelas e permite apagar "desta em diante"', async () => {
    const r = await call('post', '/transactions', tx({
      name: 'Colchão 3/12', occurredOn: '2026-01-31', amount: 116.66, installments: { total: 6, current: 3 },
    }));
    expect(r.status).toBe(201);
    const items = r.body.items;
    expect(items.map((i: { installment: { no: number } }) => i.installment.no)).toEqual([3, 4, 5, 6]);
    expect(items.map((i: { occurredOn: string }) => i.occurredOn)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(items.every((i: { name: string; installment: { total: number; groupId: string } }) =>
      i.name === 'Colchão' && i.installment.total === 6 && i.installment.groupId === items[0].installment.groupId)).toBe(true);

    // apaga a parcela 5 e as seguintes (5 e 6); ficam 3 e 4
    expect((await call('delete', `/transactions/${items[2].id}?scope=following`)).body).toEqual({ deleted: 2 });
    expect((await call('get', '/transactions?q=colchao')).body.total).toBe(2);
  });

  it('nome com sufixo vira parcela única; "following" sem grupo é recusado', async () => {
    const r = await call('post', '/transactions', tx({ name: 'Placa de video 4/10', amount: 573.35 }));
    const item = r.body.items[0];
    expect(item.name).toBe('Placa de video');
    expect(item.installment).toEqual({ no: 4, total: 10, groupId: null });
    expect((await call('delete', `/transactions/${item.id}?scope=following`)).status).toBe(400);
    expect((await call('get', '/transactions?q=PLACA')).body.total).toBe(1); // busca ignora caixa
  });

  it('listagem: filtros, paginação e sem categoria', async () => {
    await call('post', '/transactions', tx({ name: 'Salário', kind: 'income', paymentMethod: null, amount: 5000, occurredOn: '2026-09-05' }));
    await call('post', '/transactions', tx({ name: 'Lanche Bia', personId: otherPersonId, categoryId: cat.Lanche, amount: 30, occurredOn: '2026-09-10' }));

    expect((await call('get', '/transactions?kind=income')).body.total).toBe(1);
    expect((await call('get', `/transactions?personId=${otherPersonId}`)).body.total).toBe(1);
    expect((await call('get', '/transactions?from=2026-09-01&to=2026-09-30')).body.total).toBe(2);

    const unc = (await call('get', '/transactions?uncategorized=true')).body;
    expect(unc.total).toBeGreaterThanOrEqual(1);
    expect(unc.items.every((i: { category: unknown; kind: string }) => i.category === null && i.kind === 'expense')).toBe(true);

    const page = (await call('get', '/transactions?limit=1&offset=1')).body;
    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThan(1);
    const dates = (await call('get', '/transactions?limit=500')).body.items.map((i: { occurredOn: string }) => i.occurredOn);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe('sugestões', () => {
  it('exato, prefixo, aproximado e valores de preenchimento', async () => {
    // garantia extra: só zera a tabela se for mesmo o banco temporário
    const { rows } = await pool.query<{ db: string }>('SELECT current_database() AS db');
    expect(rows[0]!.db).toMatch(/^gastos_test_/);
    await pool.query('TRUNCATE transactions');

    const add = (name: string, over: Record<string, unknown>) => call('post', '/transactions', tx({ name, ...over }));
    await add('Uber', { occurredOn: '2026-01-01', categoryId: cat.Transporte, amount: 12 });
    await add('uber', { occurredOn: '2026-02-01', categoryId: cat.Transporte, amount: 14 });
    await add('Uber', { occurredOn: '2026-03-01', categoryId: cat.Rolê, amount: 21.5 });
    await add('Ubatuba', { occurredOn: '2026-03-02', categoryId: cat.Rolê });
    await add('Spotify', { occurredOn: '2026-03-03', categoryId: cat.Lanche, isFixed: true, personId: undefined });

    const exact = (await call('get', '/suggestions?q=UBER')).body.suggestions;
    expect(exact[0].match).toBe('exact');
    expect(exact[0].uses).toBe(3);
    expect(exact[0].fill.categoryId).toBe(cat.Transporte);
    expect(exact[0].lastAmount).toBe('21.50');
    expect(exact[0].categories.map((c: { name: string }) => c.name)).toEqual(['Transporte', 'Rolê']);
    expect(exact[0].fill.paymentMethod).toBe('credit');

    const prefix = (await call('get', '/suggestions?q=ub')).body.suggestions.map((s: { nameNormalized: string }) => s.nameNormalized);
    expect([...prefix].sort()).toEqual(['ubatuba', 'uber']);

    const typo = (await call('get', '/suggestions?q=ubber')).body.suggestions;
    expect(typo[0].nameNormalized).toBe('uber');
    expect(typo[0].match).toBe('similar');

    const withInstallment = (await call('get', '/suggestions?q=Uber%204/12')).body.suggestions;
    expect(withInstallment[0].nameNormalized).toBe('uber');

    const spotify = (await call('get', '/suggestions?q=spo')).body.suggestions[0];
    expect(spotify.fill.isFixed).toBe(true);
    expect(spotify.fill.personId).toBeNull();

    expect((await call('get', '/suggestions?q=zzzzzz')).body.suggestions).toEqual([]);
    expect((await call('get', '/suggestions')).status).toBe(400);
    // % e _ digitados não viram curinga
    expect((await call('get', '/suggestions?q=%25')).body.suggestions).toEqual([]);
  });
});
