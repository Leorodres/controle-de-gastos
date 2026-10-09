import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';
import { escapeLike, normalizeName, parseInstallment } from '../lib/normalize.js';
import { summarizeHistory, type HistoryRow } from '../lib/suggest.js';

const MATCH = ['exact', 'prefix', 'contains', 'similar'] as const;

@Injectable()
export class SuggestionsService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  /**
   * Nomes já usados que casam com o que foi digitado (igual, começa com, contém, parecido),
   * cada um com os valores mais frequentes para preencher o formulário.
   */
  async suggest(q: string, limit: number) {
    // "Colchão 4/12" busca por "colchao"; acento e caixa não importam
    const needle = normalizeName(parseInstallment(q).name);
    if (needle === '') return { query: q, suggestions: [] };

    // contains/similar só a partir de 3 letras; com 1-2 letras só "começa com"
    const fuzzy = needle.length >= 3;
    const candidates = await this.pool.query<{ name_normalized: string; rank: number }>(
      `SELECT name_normalized,
              CASE WHEN name_normalized = $1 THEN 0
                   WHEN name_normalized LIKE $2 || '%' THEN 1
                   WHEN name_normalized LIKE '%' || $2 || '%' THEN 2
                   ELSE 3 END AS rank
         FROM transactions
        WHERE name_normalized <> '(sem nome)'
          AND (name_normalized LIKE $2 || '%'
               OR ($4::boolean AND (name_normalized LIKE '%' || $2 || '%' OR name_normalized % $1)))
        GROUP BY name_normalized
        ORDER BY rank, similarity(name_normalized, $1) DESC, count(*) DESC, max(occurred_on) DESC
        LIMIT $3`,
      [needle, escapeLike(needle), limit, fuzzy],
    );
    if (candidates.rows.length === 0) return { query: q, suggestions: [] };

    const history = await this.pool.query<{
      id: number; name: string; name_normalized: string; kind: HistoryRow['kind'];
      payment_method: HistoryRow['paymentMethod']; is_fixed: boolean; category_id: number | null;
      category_name: string | null; person_id: number | null; amount: string; occurred_on: string;
    }>(
      `SELECT t.id, t.name, t.name_normalized, t.kind, t.payment_method, t.is_fixed, t.category_id,
              c.name AS category_name, t.person_id, t.amount::text AS amount, t.occurred_on
         FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.name_normalized = ANY($1::text[])`,
      [candidates.rows.map((c) => c.name_normalized)],
    );
    const byName = new Map<string, HistoryRow[]>();
    for (const h of history.rows) {
      const row: HistoryRow = {
        id: h.id, name: h.name, kind: h.kind, paymentMethod: h.payment_method, isFixed: h.is_fixed,
        categoryId: h.category_id, categoryName: h.category_name, personId: h.person_id,
        amount: h.amount, occurredOn: h.occurred_on,
      };
      const list = byName.get(h.name_normalized);
      if (list) list.push(row);
      else byName.set(h.name_normalized, [row]);
    }

    return {
      query: q,
      suggestions: candidates.rows.map((c) => ({
        match: MATCH[c.rank],
        nameNormalized: c.name_normalized,
        ...summarizeHistory(byName.get(c.name_normalized) ?? []),
      })),
    };
  }
}
