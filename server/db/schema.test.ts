import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDatabaseConfig } from '../config/database';
import {
  accountStatusEnum,
  applicationSettings,
  assetBookmarks,
  assets,
  auditLogs,
  generationJobs,
  quotaPeriods,
  sessions,
  templateUserPermissions,
  templates,
  usageLedger,
  userRoleEnum,
  users,
} from './schema';

describe('PostgreSQL foundation schema', () => {
  it('defines the accepted role and account states', () => {
    expect(userRoleEnum.enumValues).toEqual(['SUPER_ADMIN', 'USER']);
    expect(accountStatusEnum.enumValues).toEqual(['PENDING', 'ACTIVE', 'DISABLED']);
  });

  it('defines every approved Phase 1 table', () => {
    expect([
      users,
      sessions,
      templates,
      templateUserPermissions,
      quotaPeriods,
      generationJobs,
      assets,
      assetBookmarks,
      usageLedger,
      auditLogs,
      applicationSettings,
    ].map(getTableName)).toEqual([
      'users',
      'sessions',
      'templates',
      'template_user_permissions',
      'quota_periods',
      'generation_jobs',
      'assets',
      'asset_bookmarks',
      'usage_ledger',
      'audit_logs',
      'application_settings',
    ]);
  });
});

describe('database configuration', () => {
  it('requires an explicit database URL only when PostgreSQL is requested', () => {
    expect(() => getDatabaseConfig({})).toThrow('DATABASE_URL is required');
  });

  it('parses pool and verified TLS settings', () => {
    expect(getDatabaseConfig({
      DATABASE_URL: 'postgresql://user:pass@db.example.test/app',
      DATABASE_SSL_MODE: 'verify-full',
      DATABASE_POOL_MAX: '5',
      DATABASE_IDLE_TIMEOUT_MS: '20000',
      DATABASE_CONNECT_TIMEOUT_MS: '8000',
    })).toEqual({
      connectionString: 'postgresql://user:pass@db.example.test/app',
      maxConnections: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 8_000,
      ssl: { rejectUnauthorized: true },
    });
  });
});
