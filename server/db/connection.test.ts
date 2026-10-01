// @vitest-environment node

import { testDatabase } from '../testDatabase';
import path from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getDatabaseConfig } from '../config/database';
import * as schema from './schema';

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const describeWithDatabase = describe.sequential;
const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function expectPostgresTriggerError(operation: Promise<unknown>, expectedMessage: RegExp): Promise<void> {
  try {
    await operation;
    expect.unreachable('Expected the database trigger to reject the operation.');
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    expect(cause).toBeInstanceOf(Error);
    expect((cause as Error).message).toMatch(expectedMessage);
    expect((cause as Error & { code?: string }).code).toBe('P0001');
  }
}

describeWithDatabase('PostgreSQL schema constraints', () => {
  let embedded: Awaited<ReturnType<typeof testDatabase>> | undefined;
  let pool!: Pool;
  let db!: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      embedded = await testDatabase(); pool = embedded.pool; db = embedded.db;
    } else {
      if (testDatabaseUrl === process.env.DATABASE_URL) throw new Error('Integration tests require a separate test database.');
      const config = getDatabaseConfig({ ...process.env, DATABASE_URL: testDatabaseUrl, DATABASE_SSL_MODE: process.env.TEST_DATABASE_SSL_MODE || 'disable' });
      pool = new Pool(config); db = drizzle(pool, { schema }); await migrate(db, { migrationsFolder });
    }
  }, 30000);

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        audit_logs,
        usage_ledger,
        asset_bookmarks,
        assets,
        generation_jobs,
        quota_periods,
        template_user_permissions,
        templates,
        account_tokens,
        sessions,
        application_settings,
        users
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    if (embedded) await embedded.close(); else if (pool) await pool.end();
  });

  it('defaults new users to USER without API access or quota', async () => {
    const [user] = await db.insert(schema.users).values({
      username: 'new.user',
      email: 'new.user@example.test',
      displayName: 'New User',
    }).returning();

    expect(user).toMatchObject({
      role: 'USER',
      apiAccess: false,
      monthlyQuota: 0,
      status: 'PENDING',
      mustChangePassword: true,
      sessionVersion: 1,
    });
  });

  it('enforces case-insensitive identity uniqueness', async () => {
    await db.insert(schema.users).values({
      username: 'employee',
      email: 'employee@example.test',
      displayName: 'Employee',
    });

    await expect(db.insert(schema.users).values({
      username: 'EMPLOYEE',
      email: 'other@example.test',
      displayName: 'Duplicate',
    })).rejects.toBeDefined();
  });

  it('rejects quota periods whose reserved and consumed units exceed the quota', async () => {
    const [user] = await db.insert(schema.users).values({
      username: 'quota.user',
      email: 'quota.user@example.test',
      displayName: 'Quota User',
    }).returning({ id: schema.users.id });

    await expect(db.insert(schema.quotaPeriods).values({
      userId: user.id,
      periodStart: '2026-09-01',
      periodEnd: '2026-10-01',
      quotaUnits: 1,
      reservedUnits: 1,
      consumedUnits: 1,
    })).rejects.toBeDefined();
  });

  it('prevents demotion of the last active SUPER_ADMIN', async () => {
    const [admin] = await db.insert(schema.users).values({
      username: 'super.admin',
      email: 'super.admin@example.test',
      displayName: 'Super Admin',
      passwordHash: 'not-a-real-test-hash',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    }).returning({ id: schema.users.id });

    await expectPostgresTriggerError(
      db.update(schema.users).set({ role: 'USER' }).where(eq(schema.users.id, admin.id)),
      /last active SUPER_ADMIN/i,
    );
  });

  it('prevents hard deletion of users', async () => {
    const [user] = await db.insert(schema.users).values({
      username: 'retained.user',
      email: 'retained.user@example.test',
      displayName: 'Retained User',
    }).returning({ id: schema.users.id });

    await expectPostgresTriggerError(
      db.delete(schema.users).where(eq(schema.users.id, user.id)),
      /cannot be deleted/i,
    );
  });

  it('keeps audit records immutable', async () => {
    const [entry] = await db.insert(schema.auditLogs).values({
      action: 'TEST_EVENT',
      entityType: 'test',
      outcome: 'SUCCESS',
    }).returning({ id: schema.auditLogs.id });

    await expectPostgresTriggerError(
      db.update(schema.auditLogs).set({ action: 'CHANGED' }).where(eq(schema.auditLogs.id, entry.id)),
      /append-only/i,
    );
  });
});
