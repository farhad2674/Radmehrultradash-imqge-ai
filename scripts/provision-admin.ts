import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { eq, sql } from 'drizzle-orm';
import { closeDatabase, getDatabase } from '../server/db/client';
import { users, auditLogs } from '../server/db/schema';
import { hashPassword, passwordField, stringField } from '../server/security';

// Reads the password without terminal echo. It never accepts a password in command arguments.
async function readPassword(): Promise<string> {
  if (!stdin.isTTY) throw new Error('Interactive terminal required.');
  stdout.write('Password (at least 12 characters): ');
  stdin.setRawMode(true); stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); stdout.write('\n'); };
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { cleanup(); reject(new Error('Cancelled.')); return; }
        if (char === '\r' || char === '\n') { cleanup(); resolve(value); return; }
        if (char === '\u007f') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}
try {
  const reader = createInterface({ input: stdin, output: stdout });
  const email = stringField(await reader.question('First admin email: '), 254).toLowerCase();
  const name = stringField(await reader.question('Display name: '), 120);
  reader.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  const passwordHash = await hashPassword(passwordField(await readPassword()));
  await getDatabase().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('radmehr_ai_super_admin_membership'))`);
    if ((await tx.select({ id: users.id }).from(users).where(eq(users.role, 'SUPER_ADMIN'))).length) throw new Error('An administrator already exists.');
    const [admin] = await tx.insert(users).values({ username: email, email, displayName: name, passwordHash, role: 'SUPER_ADMIN', status: 'ACTIVE', mustChangePassword: false, apiAccess: false, monthlyQuota: 0 }).returning();
    await tx.insert(auditLogs).values({ actorUserId: admin.id, action: 'FIRST_ADMIN_PROVISIONED', entityType: 'user', entityId: admin.id, outcome: 'SUCCESS' });
  });
  console.log('First administrator provisioned. Sign in, then configure API access and finite quotas.');
} catch { console.error('Provisioning failed. Check inputs, migrations, and whether an admin already exists.'); process.exitCode = 1; }
finally { await closeDatabase(); }
