import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';

@Injectable()
export class CategoriesService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  /** Da mais usada para a menos usada: a ordem natural para um seletor no formulário. */
  async list() {
    const { rows } = await this.pool.query<{ id: number; name: string; uses: number }>(
      `SELECT c.id, c.name, count(t.id)::int AS uses
         FROM categories c LEFT JOIN transactions t ON t.category_id = c.id
        GROUP BY c.id ORDER BY uses DESC, c.name`,
    );
    return { items: rows };
  }

  async create(name: string) {
    const { rows } = await this.pool.query<{ id: number; name: string }>(
      'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
      [name],
    );
    return rows[0]!;
  }
}
