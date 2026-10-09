import { createPool } from '../db.js';
import { runMigrations } from '../lib/migrate.js';

async function main(): Promise<void> {
  const pool = createPool();
  try {
    const applied = await runMigrations(pool);
    for (const name of applied) console.log(`aplicada: ${name}`);
    console.log(applied.length === 0 ? 'banco já está atualizado' : `${applied.length} migration(s) aplicada(s)`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
