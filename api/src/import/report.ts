import type pg from 'pg';
import { normalizeName } from '../lib/normalize.js';
import type { MappedRow, TxKind } from './map.js';
import type { DashReference, SkippedRow } from './parse.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (n: number): string => brl.format(n);
const TOLERANCE = 0.05; // frações de centavo da planilha são arredondadas (ver seção 3)
const LIST_LIMIT = 25;

const KIND_LABEL: Record<TxKind, string> = {
  income: 'income (entradas do dono)',
  expense: 'expense (gastos)',
  reimbursement: 'reimbursement (repasses recebidos)',
  card_payment: 'card_payment (pagamento de fatura)',
};

function table(headers: string[], rows: (string | number)[][]): string {
  const head = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`;
  return `${head}\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`;
}

function limited(items: string[], limit = LIST_LIMIT): string {
  const shown = items.slice(0, limit).join('\n');
  return items.length > limit ? `${shown}\n- … e mais ${items.length - limit}` : shown;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

// ---------------------------------------------------------------- conferência com a aba Dash

interface Check {
  label: string;
  esperado: number;
  obtido: number;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCE;

async function reconcile(client: pg.PoolClient, dash: DashReference): Promise<{ checks: Check[]; notes: string[] }> {
  const checks: Check[] = [];
  const notes: string[] = [];

  const monthly = await client.query<{ month: number; entradas: string; saidas: string }>(
    `SELECT EXTRACT(MONTH FROM t.occurred_on)::int AS month,
            COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'income'), 0)  AS entradas,
            COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'expense'), 0) AS saidas
       FROM transactions t JOIN people p ON p.id = t.person_id
      WHERE p.is_owner AND EXTRACT(YEAR FROM t.occurred_on) = $1
      GROUP BY 1`,
    [dash.year],
  );
  const byMonth = new Map(monthly.rows.map((r) => [r.month, { e: Number(r.entradas), s: Number(r.saidas) }]));

  if (dash.yearTotals) {
    const e = [...byMonth.values()].reduce((a, v) => a + v.e, 0);
    const s = [...byMonth.values()].reduce((a, v) => a + v.s, 0);
    checks.push({ label: `${dash.year} — entradas do ano`, esperado: dash.yearTotals.entradas, obtido: e });
    checks.push({ label: `${dash.year} — saídas do ano`, esperado: dash.yearTotals.saidas, obtido: s });
  }
  for (const m of dash.months) {
    const got = byMonth.get(m.month) ?? { e: 0, s: 0 };
    const mm = String(m.month).padStart(2, '0');
    checks.push({ label: `${dash.year}-${mm} — entradas`, esperado: m.entradas, obtido: got.e });
    checks.push({ label: `${dash.year}-${mm} — saídas`, esperado: m.saidas, obtido: got.s });
  }

  if (dash.credit) {
    const { year, month, rows } = dash.credit;
    const res = await client.query<{
      person: string | null;
      is_owner: boolean | null;
      kind: string;
      category: string | null;
      pm: string | null;
      total: string;
    }>(
      `SELECT p.name AS person, p.is_owner, t.kind::text AS kind, c.name AS category,
              t.payment_method::text AS pm, SUM(t.amount) AS total
         FROM transactions t
         LEFT JOIN people p ON p.id = t.person_id
         LEFT JOIN categories c ON c.id = t.category_id
        WHERE EXTRACT(YEAR FROM t.occurred_on) = $1 AND EXTRACT(MONTH FROM t.occurred_on) = $2
        GROUP BY 1, 2, 3, 4, 5`,
      [year, month],
    );
    const sum = (f: (r: (typeof res.rows)[number]) => boolean): number =>
      res.rows.filter(f).reduce((a, r) => a + Number(r.total), 0);

    const tag = `${year}-${String(month).padStart(2, '0')} crédito`;
    for (const row of rows) {
      const key = normalizeName(row.label);
      let pagamentos: number;
      let gastos: number;
      if (key === 'assinaturas') {
        pagamentos = sum((r) => r.kind === 'reimbursement' && r.pm === 'credit' && r.person === null);
        gastos = sum((r) => r.kind === 'expense' && r.pm === 'credit' && r.person === null && r.category === 'Assinatura');
      } else {
        const person = res.rows.find((r) => r.person !== null && normalizeName(r.person) === key);
        if (!person) {
          notes.push(`Dash Mês: "${row.label}" não corresponde a nenhuma pessoa importada neste mês; linha não conferida.`);
          continue;
        }
        const mine = (r: (typeof res.rows)[number]): boolean => r.person !== null && normalizeName(r.person) === key;
        const payKind = person.is_owner ? 'card_payment' : 'reimbursement';
        pagamentos = sum((r) => mine(r) && r.kind === payKind && r.pm === 'credit');
        gastos = sum((r) => mine(r) && r.kind === 'expense' && r.pm === 'credit');
      }
      checks.push({ label: `${tag} — ${row.label}: pagamentos`, esperado: row.pagamentos, obtido: pagamentos });
      checks.push({ label: `${tag} — ${row.label}: gastos`, esperado: row.gastos, obtido: gastos });
    }
  }
  return { checks, notes };
}

// ---------------------------------------------------------------- autopreenchimento

function mostFrequentCategory(rows: MappedRow[]): { category: string; count: number } | null {
  const sorted = [...rows].filter((r) => r.tx.category).sort((a, b) => a.tx.occurredOn.localeCompare(b.tx.occurredOn));
  const stats = new Map<string, { count: number; last: number }>();
  sorted.forEach((r, i) => {
    const s = stats.get(r.tx.category as string) ?? { count: 0, last: 0 };
    stats.set(r.tx.category as string, { count: s.count + 1, last: i });
  });
  let best: { category: string; count: number; last: number } | null = null;
  for (const [category, s] of stats) {
    if (!best || s.count > best.count || (s.count === best.count && s.last > best.last)) best = { category, ...s };
  }
  return best ? { category: best.category, count: best.count } : null;
}

function autofillSimulation(rows: MappedRow[]) {
  const expenses = rows.filter((r) => r.tx.kind === 'expense' && r.flags.nameIssue === null);
  const byName = groupBy(expenses, (r) => r.tx.nameNormalized);
  const categorized = expenses.filter((r) => r.tx.category);

  let covered = 0;
  let correct = 0;
  for (const r of categorized) {
    const others = (byName.get(r.tx.nameNormalized) ?? []).filter((o) => o !== r);
    const guess = mostFrequentCategory(others);
    if (!guess) continue;
    covered++;
    if (guess.category === r.tx.category) correct++;
  }

  const suggestions = expenses
    .filter((r) => !r.tx.category)
    .map((r) => ({ row: r, guess: mostFrequentCategory(byName.get(r.tx.nameNormalized) ?? []) }));

  return { total: categorized.length, covered, correct, suggestions };
}

// ---------------------------------------------------------------- relatório

export interface ReportInput {
  client: pg.PoolClient;
  file: string;
  owner: string;
  rows: MappedRow[];
  skipped: SkippedRow[];
  blankRows: number;
  dash: DashReference | null;
}

export async function buildReport(input: ReportInput): Promise<{ markdown: string; summary: string[] }> {
  const { rows, skipped, blankRows, dash } = input;
  const out: string[] = [];
  const summary: string[] = [];
  const pct = (a: number, b: number): string => (b === 0 ? '—' : `${((a / b) * 100).toFixed(0)}%`);

  out.push(`# Relatório de importação`, '', `Arquivo: \`${input.file}\` · dono: **${input.owner}**`, '');

  // 1. resumo
  const dates = rows.map((r) => r.tx.occurredOn).sort();
  const byKind = groupBy(rows, (r) => r.tx.kind);
  out.push('## 1. Resumo', '');
  out.push(
    table(
      ['Tipo', 'Linhas', 'Total'],
      (Object.keys(KIND_LABEL) as TxKind[]).map((k) => {
        const list = byKind.get(k) ?? [];
        return [KIND_LABEL[k], list.length, money(list.reduce((a, r) => a + Number(r.tx.amount), 0))];
      }),
    ),
    '',
    `- Importadas: **${rows.length}** · período ${dates[0] ?? '—'} a ${dates[dates.length - 1] ?? '—'}`,
    `- Linhas em branco ignoradas (só fórmulas): ${blankRows} · linhas recusadas: ${skipped.length}`,
    `- Pessoas: ${[...new Set(rows.map((r) => r.tx.person).filter(Boolean))].join(', ')}`,
    `- Categorias: ${[...new Set(rows.map((r) => r.tx.category).filter(Boolean))].join(', ')}`,
    '',
  );
  summary.push(`${rows.length} lançamentos importados (${dates[0]} a ${dates[dates.length - 1]}), ${skipped.length} recusados`);
  if (skipped.length) {
    out.push('**Linhas recusadas** (corrija na planilha ou me avise):', '', limited(skipped.map((s) => `- Base!R${s.sheetRow}: ${s.reason}`)), '');
  }

  // 2. conferência
  out.push('## 2. Conferência com a aba Dash', '');
  if (!dash) {
    out.push('Não encontrei a aba Dash no formato esperado; conferência não realizada.', '');
    summary.push('conferência com a aba Dash: não realizada');
  } else {
    const { checks, notes } = await reconcile(input.client, dash);
    const bad = checks.filter((c) => !near(c.esperado, c.obtido));
    out.push(
      `Os totais que a planilha calculou foram comparados com o que está no banco (ano ${dash.year}` +
        (dash.credit ? `, crédito de ${dash.credit.year}-${String(dash.credit.month).padStart(2, '0')}` : '') +
        `). Tolerância de ${money(TOLERANCE)} por causa de frações de centavo.`,
      '',
      `**${checks.length - bad.length} de ${checks.length} conferem.**`,
      '',
    );
    if (bad.length) {
      out.push(
        table(
          ['Item', 'Planilha', 'Banco', 'Diferença'],
          bad.map((c) => [c.label, money(c.esperado), money(c.obtido), money(c.obtido - c.esperado)]),
        ),
        '',
      );
    }
    for (const n of notes) out.push(`- ${n}`);
    if (notes.length) out.push('');
    summary.push(
      bad.length === 0
        ? `conferência com a aba Dash: ${checks.length}/${checks.length} totais conferem`
        : `conferência com a aba Dash: ${bad.length} DIVERGÊNCIA(S) de ${checks.length} — veja o relatório`,
    );
  }

  // 3. qualidade
  out.push('## 3. Qualidade dos dados', '');

  const rounded = rows.filter((r) => Math.abs(r.flags.roundingDelta) > 1e-6);
  if (rounded.length) {
    const drift = rounded.reduce((a, r) => a + r.flags.roundingDelta, 0);
    const names = [...new Set(rounded.map((r) => r.tx.rawName))].join(', ');
    out.push(
      `**Frações de centavo:** ${rounded.length} linha(s) tinham valor com mais de 2 casas (${names}) e foram arredondadas para centavos; diferença acumulada ${money(drift)}.`,
      '',
    );
  }

  const badNames = rows.filter((r) => r.flags.nameIssue);
  out.push(`**Nomes problemáticos (${badNames.length}):**`, '');
  const issueLabel = { missing: 'nome vazio', error: 'nome com erro de fórmula (#REF!)', numeric: 'nome é só um número' } as const;
  out.push(
    badNames.length
      ? limited(badNames.map((r) => `- Base!R${r.sheetRow} · ${r.tx.occurredOn} · ${money(Number(r.tx.amount))} · ${issueLabel[r.flags.nameIssue!]}${r.tx.rawName ? ` ("${r.tx.rawName}")` : ''}`))
      : '- nenhum',
    '',
  );

  const autofill = autofillSimulation(rows);
  const uncategorized = autofill.suggestions;
  out.push(`**Gastos sem categoria (${uncategorized.length}):**`, '');
  out.push(
    uncategorized.length
      ? limited(
          uncategorized.map(({ row, guess }) => {
            const hint = guess ? ` → sugestão: **${guess.category}** (${guess.count}× no histórico)` : ' → sem histórico para sugerir';
            return `- Base!R${row.sheetRow} · ${row.tx.occurredOn} · ${row.tx.rawName ?? '(sem nome)'} · ${money(Number(row.tx.amount))}${hint}`;
          }),
        )
      : '- nenhum',
    '',
  );
  const reimbNoCat = rows.filter((r) => r.tx.kind === 'reimbursement' && !r.tx.category).length;
  if (reimbNoCat) out.push(`Obs.: ${reimbNoCat} repasse(s) recebido(s) também estão sem categoria (não é obrigatória para esse tipo).`, '');

  const variants = [...groupBy(rows, (r) => r.tx.nameNormalized)]
    .map(([key, list]) => ({ key, forms: [...new Set(list.map((r) => r.tx.name))] }))
    .filter((v) => v.forms.length > 1);
  out.push(`**Mesmo nome escrito de formas diferentes (${variants.length}):** o autopreenchimento já trata como o mesmo nome; aqui só para você saber.`, '');
  out.push(variants.length ? limited(variants.map((v) => `- ${v.forms.map((f) => `"${f}"`).join(' / ')}`), 12) : '- nenhum', '');

  const dupKey = (r: MappedRow): string => [r.tx.occurredOn, r.tx.kind, r.tx.nameNormalized, r.tx.person ?? '', r.tx.amount].join('|');
  const dups = [...groupBy(rows, dupKey).values()].filter((l) => l.length > 1);
  out.push(`**Linhas idênticas (${dups.length} grupo(s)):** podem ser legítimas (duas corridas iguais no mesmo dia); confira.`, '');
  out.push(
    dups.length
      ? limited(dups.map((l) => `- ${l[0]!.tx.occurredOn} · ${l[0]!.tx.rawName} · ${money(Number(l[0]!.tx.amount))} · linhas ${l.map((r) => `R${r.sheetRow}`).join(', ')}`))
      : '- nenhuma',
    '',
  );

  const installments = rows.filter((r) => r.tx.installmentNo !== null);
  const plans = [...groupBy(installments, (r) => `${r.tx.nameNormalized}|${r.tx.installmentTotal}|${r.tx.person ?? ''}`)].map(([, list]) => ({
    name: list[0]!.tx.name,
    total: list[0]!.tx.installmentTotal!,
    person: list[0]!.tx.person ?? '—',
    seen: [...new Set(list.map((r) => r.tx.installmentNo!))].sort((a, b) => a - b),
  }));
  out.push(`**Parcelamentos reconhecidos pelo nome (${plans.length} compras, ${installments.length} linhas):** confira se são mesmo parcelas e não datas.`, '');
  out.push(
    plans.length
      ? table(
          ['Compra', 'Pessoa', 'Parcelas', 'Vistas na planilha'],
          plans.map((p) => [p.name, p.person, p.total, p.seen.join(', ')]),
        )
      : '- nenhum',
    '',
  );
  const notRecognized = rows.filter((r) => r.tx.installmentNo === null && r.tx.rawName && /\d\s*\/\s*\d/.test(r.tx.rawName));
  if (notRecognized.length) {
    out.push(`**Têm "N/M" no nome mas NÃO foram tratados como parcela (${notRecognized.length}):**`, '');
    out.push(limited([...new Set(notRecognized.map((r) => `- "${r.tx.rawName}" (Base!R${r.sheetRow})`))]), '');
  }

  const noPerson = rows.filter((r) => r.tx.kind === 'expense' && !r.tx.person);
  const noFixed = rows.filter((r) => r.flags.fixedMissing);
  out.push(
    `**Outros:** ${noPerson.length} gasto(s) sem pessoa (${[...new Set(noPerson.map((r) => r.tx.category ?? 'sem categoria'))].join(', ')}); ${noFixed.length} linha(s) com "Fixo?" vazio (assumido "não").`,
    '',
  );

  // 4. autopreenchimento
  out.push('## 4. Teste do autopreenchimento por nome', '');
  out.push(
    `Simulação: para cada gasto já categorizado, preveja a categoria olhando **só os outros gastos com o mesmo nome**.`,
    '',
    `- Gastos categorizados: ${autofill.total}`,
    `- Com algum outro lançamento de mesmo nome (cobertura): ${autofill.covered} (${pct(autofill.covered, autofill.total)})`,
    `- Dentre esses, categoria prevista correta: ${autofill.correct} (${pct(autofill.correct, autofill.covered)})`,
    '',
    `Os demais precisam ser preenchidos na primeira vez que o nome aparece; depois o sistema aprende.`,
    '',
  );
  summary.push(
    `autopreenchimento por nome: cobre ${pct(autofill.covered, autofill.total)} dos gastos, acerta ${pct(autofill.correct, autofill.covered)} dos cobertos`,
  );
  summary.push(`gastos sem categoria: ${uncategorized.length}`);

  return { markdown: out.join('\n'), summary };
}
