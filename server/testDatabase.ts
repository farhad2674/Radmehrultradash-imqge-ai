import EmbeddedPostgres from 'embedded-postgres';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createServer } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as schema from './db/schema';

export async function testDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'radmehr-test-pg-'));
  const socket = createServer();
  await new Promise<void>((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  const postgres = new EmbeddedPostgres({ databaseDir: path.join(directory, 'pg'), user: 'test', password: 'test-only', port,
    persistent: false, postgresFlags: ['-h', '127.0.0.1', '-k', directory], onLog: () => {}, onError: () => {} });
  await postgres.initialise(); await postgres.start();
  const pool = new Pool({ host: '127.0.0.1', port, user: 'test', password: 'test-only', database: 'postgres', max: 25 });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'server/db/migrations') });
  return { db, pool, async close() { await pool.end(); await postgres.stop(); fs.rmSync(directory, { recursive: true, force: true }); } };
}
