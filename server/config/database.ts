export type DatabaseSslMode = 'disable' | 'require' | 'verify-full';

export interface DatabaseConfig {
  connectionString: string;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  ssl: false | { rejectUnauthorized: boolean };
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseSslMode(value: string | undefined, nodeEnv: string | undefined): DatabaseSslMode {
  const fallback: DatabaseSslMode = nodeEnv === 'production' ? 'verify-full' : 'disable';
  const mode = value || fallback;
  if (mode !== 'disable' && mode !== 'require' && mode !== 'verify-full') {
    throw new Error('DATABASE_SSL_MODE must be disable, require, or verify-full.');
  }
  return mode;
}

export function getDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is required when PostgreSQL is used.');
  }

  const sslMode = parseSslMode(env.DATABASE_SSL_MODE, env.NODE_ENV);
  return {
    connectionString,
    maxConnections: parsePositiveInteger(env.DATABASE_POOL_MAX, 10, 'DATABASE_POOL_MAX'),
    idleTimeoutMillis: parsePositiveInteger(env.DATABASE_IDLE_TIMEOUT_MS, 30_000, 'DATABASE_IDLE_TIMEOUT_MS'),
    connectionTimeoutMillis: parsePositiveInteger(env.DATABASE_CONNECT_TIMEOUT_MS, 10_000, 'DATABASE_CONNECT_TIMEOUT_MS'),
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: sslMode === 'verify-full' },
  };
}
