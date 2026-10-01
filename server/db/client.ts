import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getDatabaseConfig } from '../config/database';
import * as schema from './schema';

let pool: Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;

export function getDatabasePool(): Pool {
  if (!pool) {
    const config = getDatabaseConfig();
    pool = new Pool(config);
  }
  return pool;
}

export function getDatabase(): NodePgDatabase<typeof schema> {
  if (!database) {
    database = drizzle(getDatabasePool(), { schema });
  }
  return database;
}

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
  database = null;
}
