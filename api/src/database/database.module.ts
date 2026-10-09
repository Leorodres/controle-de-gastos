import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type pg from 'pg';
import { createPool } from '../db.js';

export const PG_POOL = 'PG_POOL';

/** Disponibiliza o pool do Postgres (token PG_POOL) para todos os módulos. */
@Global()
@Module({
  providers: [{ provide: PG_POOL, useFactory: () => createPool() }],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    if (!this.pool.ended) await this.pool.end();
  }
}
