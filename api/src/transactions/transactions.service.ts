import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';
import { withTransaction } from '../db.js';
import { expandInstallments } from '../lib/installments.js';
import { escapeLike, normalizeName, parseInstallment } from '../lib/normalize.js';
import type { PaymentMethod, TxKind } from '../lib/types.js';
import type { CreateTransactionInput, ListQuery, PatchTransactionInput } from './transactions.schemas.js';

interface Row {
  id: number;
  occurred_on: string;
  name: string;
  description: string | null;
  amount: string;
  kind: TxKind;
  payment_method: PaymentMethod | null;
  is_fixed: boolean;
  category_id: number | null;
  category_name: string | null;
  person_id: number | null;
  person_name: string | null;
  installment_no: number | null;
  installment_total: number | null;
  installment_group_id: string | null;
  source: string;
  source_ref: string | null;
}

const SELECT = `
  SELECT t.id, t.occurred_on, t.name, t.description, t.amount::text AS amount, t.kind, t.payment_method, t.is_fixed,
         t.category_id, c.name AS category_name, t.person_id, p.name AS person_name,
         t.installment_no, t.installment_total, t.installment_group_id, t.source, t.source_ref
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN people p ON p.id = t.person_id`;

function toApi(r: Row) {
  return {
    id: r.id,
    occurredOn: r.occurred_on,
    name: r.name,
    description: r.description,
    amount: r.amount,
    kind: r.kind,
    paymentMethod: r.payment_method,
    isFixed: r.is_fixed,
    category: r.category_id === null ? null : { id: r.category_id, name: r.category_name },
    person: r.person_id === null ? null : { id: r.person_id, name: r.person_name },
    installment:
      r.installment_no === null
        ? null
        : { no: r.installment_no, total: r.installment_total, groupId: r.installment_group_id },
    source: r.source,
    sourceRef: r.source_ref,
  };
}

const notFound = () => new NotFoundException({ error: 'not_found', message: 'lançamento não encontrado' });

@Injectable()
export class TransactionsService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  private async fetchByIds(db: pg.Pool | pg.PoolClient, ids: number[]) {
    const { rows } = await db.query<Row>(`${SELECT} WHERE t.id = ANY($1::bigint[]) ORDER BY t.occurred_on, t.id`, [ids]);
    return rows.map(toApi);
  }

  async list(f: ListQuery) {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown): void => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (f.from) add('t.occurred_on >= ?', f.from);
    if (f.to) add('t.occurred_on <= ?', f.to);
    if (f.kind) add('t.kind = ?', f.kind);
    if (f.categoryId) add('t.category_id = ?', f.categoryId);
    if (f.personId) add('t.person_id = ?', f.personId);
    if (f.q) add(`t.name_normalized LIKE '%' || ? || '%'`, escapeLike(normalizeName(f.q)));
    if (f.uncategorized) where.push(`t.category_id IS NULL AND t.kind = 'expense'`);
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = await this.pool.query<{ n: number }>(`SELECT count(*) AS n FROM transactions t ${clause}`, params);
    const { rows } = await this.pool.query<Row>(
      `${SELECT} ${clause} ORDER BY t.occurred_on DESC, t.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, f.limit, f.offset],
    );
    return { items: rows.map(toApi), total: total.rows[0]!.n, limit: f.limit, offset: f.offset };
  }

  async get(id: number) {
    const [item] = await this.fetchByIds(this.pool, [id]);
    if (!item) throw notFound();
    return item;
  }

  async create(b: CreateTransactionInput) {
    const parsed = parseInstallment(b.name);

    // Compra parcelada: gera as parcelas. Sem `installments`, "Colchao 3/12" vira só essa parcela.
    const plan = b.installments
      ? (() => {
          const groupId = randomUUID();
          const total = b.installments.total;
          return expandInstallments(b.occurredOn, total, b.installments.current ?? 1).map((i) => ({
            occurredOn: i.occurredOn,
            no: i.no as number | null,
            total: total as number | null,
            groupId: groupId as string | null,
          }));
        })()
      : [{ occurredOn: b.occurredOn, no: parsed.installmentNo, total: parsed.installmentTotal, groupId: null as string | null }];

    const items = await withTransaction(this.pool, async (client) => {
      const ids: number[] = [];
      for (const p of plan) {
        const r = await client.query<{ id: number }>(
          `INSERT INTO transactions
             (occurred_on, name, name_normalized, raw_name, amount, kind, payment_method, is_fixed,
              category_id, person_id, installment_no, installment_total, installment_group_id, description, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'manual')
           RETURNING id`,
          [
            p.occurredOn, parsed.name, normalizeName(parsed.name), b.name, b.amount, b.kind,
            b.paymentMethod ?? null, b.isFixed, b.categoryId ?? null, b.personId ?? null,
            p.no, p.total, p.groupId, b.description ?? null,
          ],
        );
        ids.push(r.rows[0]!.id);
      }
      return this.fetchByIds(client, ids);
    });
    return { items };
  }

  async patch(id: number, b: PatchTransactionInput) {
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (col: string, value: unknown): void => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (b.occurredOn !== undefined) set('occurred_on', b.occurredOn);
    if (b.name !== undefined) {
      const p = parseInstallment(b.name);
      set('name', p.name);
      set('name_normalized', normalizeName(p.name));
      if (p.installmentNo !== null) {
        set('installment_no', p.installmentNo);
        set('installment_total', p.installmentTotal);
      }
    }
    if (b.amount !== undefined) set('amount', b.amount);
    if (b.kind !== undefined) set('kind', b.kind);
    if (b.paymentMethod !== undefined) set('payment_method', b.paymentMethod);
    if (b.isFixed !== undefined) set('is_fixed', b.isFixed);
    if (b.categoryId !== undefined) set('category_id', b.categoryId);
    if (b.personId !== undefined) set('person_id', b.personId);
    if (b.description !== undefined) set('description', b.description);
    sets.push('updated_at = now()');

    params.push(id);
    const r = await this.pool.query(`UPDATE transactions SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    if (r.rowCount === 0) throw notFound();
    return this.get(id);
  }

  /** scope "this": só este lançamento. scope "following": esta parcela e as seguintes do mesmo parcelamento. */
  async remove(id: number, scope: 'this' | 'following') {
    const found = await this.pool.query<{ installment_group_id: string | null; installment_no: number | null }>(
      'SELECT installment_group_id, installment_no FROM transactions WHERE id = $1',
      [id],
    );
    const row = found.rows[0];
    if (!row) throw notFound();

    if (scope === 'following') {
      if (!row.installment_group_id) {
        throw new BadRequestException({
          error: 'no_group',
          message: 'este lançamento não faz parte de um parcelamento criado pelo sistema',
        });
      }
      const r = await this.pool.query('DELETE FROM transactions WHERE installment_group_id = $1 AND installment_no >= $2', [
        row.installment_group_id,
        row.installment_no,
      ]);
      return { deleted: r.rowCount };
    }
    const r = await this.pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    return { deleted: r.rowCount };
  }
}
