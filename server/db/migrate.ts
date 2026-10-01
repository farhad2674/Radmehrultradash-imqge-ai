import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDatabase, getDatabase } from './client';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

try {
  await migrate(getDatabase(), {
    migrationsFolder: path.join(currentDirectory, 'migrations'),
  });
  console.log('PostgreSQL migrations completed successfully.');
} catch (error) {
  console.error('PostgreSQL migration failed. Check database configuration.');
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
