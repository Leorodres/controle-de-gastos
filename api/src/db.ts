import pg from 'pg';

// bigint (ids, contagens) volta como number e date como "AAAA-MM-DD", sem fuso horário.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);

export function createPool(overrides: pg.PoolConfig = {}): pg.Pool {
  const url = process.env.DATABASE_URL;
  return new pg.Pool({ ...(url ? { connectionString: url } : {}), ...overrides });
}

// Executa fn dentro de uma transação (COMMIT se terminar, ROLLBACK se lançar erro).
export async function withTransaction<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
