import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { createPool } from '../../src/db.js';
import { runMigrations } from '../../src/lib/migrate.js';

const TEST_DB_PREFIX = 'gastos_test_';

/**
 * Cria um banco temporário (gastos_test_xxxx), aplica as migrations e entrega o pool.
 * Os testes e2e nunca tocam no banco real: `drop()` remove o temporário.
 * Precisa de um usuário com permissão CREATEDB (o do docker-compose tem).
 */
export async function createTestDb(): Promise<{ pool: pg.Pool; drop: () => Promise<void> }> {
  const name = `${TEST_DB_PREFIX}${randomBytes(4).toString('hex')}`;
  const admin = createPool({ database: 'postgres', max: 1 });
  await admin.query(`CREATE DATABASE ${name}`);

  const dropDb = async (): Promise<void> => {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  };

  // `database` explícito: o pg lê PGDATABASE na hora de conectar, então mexer na variável de ambiente não basta.
  const pool = createPool({ database: name });

  // Trava de segurança: se por qualquer motivo a conexão não for o banco temporário, aborta antes de escrever.
  const { rows } = await pool.query<{ db: string }>('SELECT current_database() AS db');
  if (rows[0]?.db !== name || !name.startsWith(TEST_DB_PREFIX)) {
    await pool.end();
    await dropDb();
    throw new Error(`teste abortado: conectou em "${rows[0]?.db}" em vez de "${name}"`);
  }

  await runMigrations(pool);
  return {
    pool,
    drop: async () => {
      if (!pool.ended) await pool.end(); // o app já pode ter fechado o pool no shutdown
      await dropDb();
    },
  };
}
