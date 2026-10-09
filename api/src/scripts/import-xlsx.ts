import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type pg from 'pg';
import { createPool } from '../db.js';
import { mapRow, type MappedRow } from '../import/map.js';
import { readWorkbook } from '../import/parse.js';
import { buildReport } from '../import/report.js';

const USAGE = `uso: npm run import -- <Gastos.xlsx> [--owner Leonardo] [--replace] [--report reports/import-report.md]

  --owner    nome (como está na coluna Pessoa) de quem usa o sistema; padrão: Leonardo
  --replace  apaga os lançamentos importados antes (source=xlsx) e importa de novo;
             lançamentos cadastrados manualmente nunca são tocados`;

async function upsertNamed(client: pg.PoolClient, table: 'people' | 'categories', names: string[]): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const name of names) {
    const r = await client.query<{ id: string }>(
      `INSERT INTO ${table} (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [name],
    );
    ids.set(name, Number(r.rows[0]!.id));
  }
  return ids;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      owner: { type: 'string', default: 'Leonardo' },
      replace: { type: 'boolean', default: false },
      report: { type: 'string', default: 'reports/import-report.md' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const file = positionals[0];
  if (values.help || !file) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const data = await readWorkbook(file);
  const skipped = [...data.skipped];
  const mapped: MappedRow[] = [];
  for (const raw of data.rows) {
    const r = mapRow(raw);
    if (r.ok) mapped.push(r.row);
    else skipped.push({ sheetRow: r.sheetRow, reason: r.reason });
  }
  skipped.sort((a, b) => a.sheetRow - b.sheetRow);

  const people = [...new Set(mapped.map((m) => m.tx.person).filter((p): p is string => p !== null))];
  const owner = values.owner as string;
  if (!people.includes(owner)) {
    throw new Error(`Dono "${owner}" não aparece na coluna Pessoa. Pessoas encontradas: ${people.join(', ')}. Use --owner.`);
  }
  const categories = [...new Set(mapped.map((m) => m.tx.category).filter((c): c is string => c !== null))];

  const pool = createPool();
  const client = await pool.connect();
  try {
    const exists = await client.query<{ t: string | null }>(`SELECT to_regclass('public.transactions') AS t`);
    if (!exists.rows[0]?.t) throw new Error('Tabelas não encontradas. Rode antes: npm run migrate');

    await client.query('BEGIN');
    try {
      const prev = await client.query<{ n: string }>(`SELECT count(*) AS n FROM transactions WHERE source = 'xlsx'`);
      const prevCount = Number(prev.rows[0]!.n);
      if (prevCount > 0) {
        if (!values.replace) {
          throw new Error(`Já existem ${prevCount} lançamentos importados da planilha. Use --replace para refazer a importação.`);
        }
        await client.query(`DELETE FROM transactions WHERE source = 'xlsx'`);
        console.log(`removidos ${prevCount} lançamentos da importação anterior`);
      }

      const personIds = await upsertNamed(client, 'people', people);
      const categoryIds = await upsertNamed(client, 'categories', categories);
      await client.query('UPDATE people SET is_owner = false WHERE is_owner');
      await client.query('UPDATE people SET is_owner = true WHERE name = $1', [owner]);

      for (const { tx } of mapped) {
        await client.query(
          `INSERT INTO transactions
             (occurred_on, name, name_normalized, raw_name, amount, kind, payment_method, is_fixed,
              category_id, person_id, installment_no, installment_total, description, source, source_ref)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'xlsx',$14)`,
          [
            tx.occurredOn, tx.name, tx.nameNormalized, tx.rawName, tx.amount, tx.kind, tx.paymentMethod, tx.isFixed,
            tx.category ? categoryIds.get(tx.category) : null,
            tx.person ? personIds.get(tx.person) : null,
            tx.installmentNo, tx.installmentTotal, tx.description, tx.sourceRef,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const report = await buildReport({
      client, file: path.basename(file), owner, rows: mapped, skipped, blankRows: data.blankRows, dash: data.dash,
    });
    const reportPath = values.report as string;
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, report.markdown, 'utf8');

    console.log('');
    for (const line of report.summary) console.log(`• ${line}`);
    console.log(`\nrelatório completo: ${reportPath}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`erro: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
