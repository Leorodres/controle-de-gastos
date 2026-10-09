import { Controller, Get, Inject } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    await this.pool.query('SELECT 1');
    return { status: 'ok' };
  }
}
