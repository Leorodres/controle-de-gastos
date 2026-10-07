import pg from 'pg';

/**
 * Conexão via variáveis padrão do libpq (PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT)
 * ou, se existir, DATABASE_URL.
 */
export function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  return new pg.Pool(url ? { connectionString: url } : {});
}
