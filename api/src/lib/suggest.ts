import type { PaymentMethod, TxKind } from './types.js';

/** Um lançamento do histórico com o mesmo nome. */
export interface HistoryRow {
  id: number;
  name: string;
  kind: TxKind;
  paymentMethod: PaymentMethod | null;
  isFixed: boolean;
  categoryId: number | null;
  categoryName: string | null;
  personId: number | null;
  amount: string;
  occurredOn: string;
}

export interface NameSummary {
  /** como foi digitado da última vez */
  name: string;
  uses: number;
  lastUsedOn: string;
  lastAmount: string;
  /** valores mais frequentes, para preencher o formulário (empate: o mais recente) */
  fill: {
    kind: TxKind;
    paymentMethod: PaymentMethod | null;
    isFixed: boolean;
    categoryId: number | null;
    personId: number | null;
  };
  /** categorias usadas com esse nome, da mais usada para a menos usada */
  categories: { id: number; name: string; uses: number }[];
  /** fatia da categoria mais usada entre os lançamentos categorizados (0 a 1); null se não há nenhuma */
  confidence: number | null;
}

/** Valor mais frequente (empate: o mais recente). `sorted` deve estar em ordem cronológica e não vazio. */
function mode<T>(sorted: HistoryRow[], pick: (r: HistoryRow) => T): T {
  const stats = new Map<string, { value: T; count: number; last: number }>();
  sorted.forEach((r, i) => {
    const value = pick(r);
    const key = String(value);
    stats.set(key, { value, count: (stats.get(key)?.count ?? 0) + 1, last: i });
  });
  let best: { value: T; count: number; last: number } | undefined;
  for (const s of stats.values()) {
    if (!best || s.count > best.count || (s.count === best.count && s.last > best.last)) best = s;
  }
  return best!.value;
}

/** Resume o histórico de um mesmo nome (ao menos 1 lançamento) em valores sugeridos. */
export function summarizeHistory(rows: HistoryRow[]): NameSummary {
  if (rows.length === 0) throw new Error('summarizeHistory: histórico vazio');
  const sorted = [...rows].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.id - b.id);
  const latest = sorted[sorted.length - 1]!;

  const catStats = new Map<number, { id: number; name: string; uses: number; last: number }>();
  sorted.forEach((r, i) => {
    if (r.categoryId === null) return;
    const s = catStats.get(r.categoryId);
    catStats.set(r.categoryId, { id: r.categoryId, name: r.categoryName ?? '', uses: (s?.uses ?? 0) + 1, last: i });
  });
  const ranked = [...catStats.values()].sort((a, b) => b.uses - a.uses || b.last - a.last);
  const categorized = ranked.reduce((a, c) => a + c.uses, 0);

  return {
    name: latest.name,
    uses: sorted.length,
    lastUsedOn: latest.occurredOn,
    lastAmount: latest.amount,
    fill: {
      kind: mode(sorted, (r) => r.kind),
      paymentMethod: mode(sorted, (r) => r.paymentMethod),
      isFixed: mode(sorted, (r) => r.isFixed),
      categoryId: ranked[0]?.id ?? null,
      personId: mode(sorted, (r) => r.personId),
    },
    categories: ranked.map(({ id, name, uses }) => ({ id, name, uses })),
    confidence: ranked[0] ? ranked[0].uses / categorized : null,
  };
}
