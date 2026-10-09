import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../database/database.module.js';

@Injectable()
export class PeopleService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async list() {
    const { rows } = await this.pool.query<{ id: number; name: string; is_owner: boolean }>(
      'SELECT id, name, is_owner FROM people ORDER BY is_owner DESC, name',
    );
    return { items: rows.map((r) => ({ id: r.id, name: r.name, isOwner: r.is_owner })) };
  }

  async create(name: string) {
    const { rows } = await this.pool.query<{ id: number; name: string; is_owner: boolean }>(
      'INSERT INTO people (name) VALUES ($1) RETURNING id, name, is_owner',
      [name],
    );
    const r = rows[0]!;
    return { id: r.id, name: r.name, isOwner: r.is_owner };
  }
}
