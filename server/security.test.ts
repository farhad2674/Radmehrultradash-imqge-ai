// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { testDatabase } from './testDatabase';
import { SecurityService, hashPassword } from './security';
import { users, sessions, quotaPeriods, generationJobs } from './db/schema';

const password = 'a-long-valid-test-password';
const origin = 'http://127.0.0.1';
const image = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64');
let database: Awaited<ReturnType<typeof testDatabase>>;
let security: SecurityService;
let app: ReturnType<typeof import('../server').createApp>;
let store: typeof import('./diskStore');
let root: string;
let adminId: string;
let userId: string;
let otherId: string;
let provider: { imageProviderModel: () => Promise<string>; promptProviderModel: () => Promise<string>; generateImage: ReturnType<typeof vi.fn<typeof import('./providers').generateImage>>; optimizePrompt: ReturnType<typeof vi.fn<typeof import('./providers').optimizePrompt>> };
const oldEnv = { ...process.env };
async function login(email = 'user@example.test') {
  const response = await request(app).post('/api/auth/login').set('Origin', origin).send({ email, password }).expect(200);
  return { cookie: response.headers['set-cookie'][0].split(';')[0], csrf: response.body.csrfToken };
}
function call(method: 'get'|'post'|'put'|'patch'|'delete', route: string, session: { cookie: string; csrf: string }) {
  return request(app)[method](route).set('Cookie', session.cookie).set('X-CSRF-Token', session.csrf).set('Origin', origin).set('Content-Type', 'application/json');
}
describe.sequential('security integration with real PostgreSQL', () => {
  let passwordHash: string;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'radmehr-security-'));
    process.env.DATA_DIR = path.join(root, 'data'); process.env.UPLOADS_DIR = path.join(root, 'uploads');
    process.env.NODE_ENV = 'test'; process.env.APP_URL = origin;
    process.env.OPENROUTER_API_KEY = 'secret-canary-never-return-this'; process.env.GEMINI_API_KEY = 'gemini-secret-canary-value';
    database = await testDatabase(); security = new SecurityService(database.db);
    passwordHash = await hashPassword(password);
    store = await import('./diskStore');
    const { createApp } = await import('../server');
    provider = { imageProviderModel: async () => 'test-provider', promptProviderModel: async () => 'test-prompt-provider', generateImage: vi.fn<typeof import('./providers').generateImage>(), optimizePrompt: vi.fn<typeof import('./providers').optimizePrompt>() };
    app = createApp(security, provider);
  }, 30000);
  beforeEach(async () => {
    await database.pool.query('TRUNCATE audit_logs, usage_ledger, assets, generation_jobs, quota_periods, sessions, account_tokens, template_user_permissions, templates, application_settings, auth_rate_limits, users CASCADE');
    fs.rmSync(process.env.DATA_DIR!, { recursive: true, force: true }); store.initDiskStorage();
    provider.generateImage.mockReset(); provider.optimizePrompt.mockReset();
    const [admin, user, other] = await database.db.insert(users).values([
      { username: 'admin', email: 'admin@example.test', displayName: 'Admin', role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash, apiAccess: true, monthlyQuota: 2, mustChangePassword: false },
      { username: 'user', email: 'user@example.test', displayName: 'User', status: 'ACTIVE', passwordHash, apiAccess: true, monthlyQuota: 1, mustChangePassword: false },
      { username: 'other', email: 'other@example.test', displayName: 'Other', status: 'ACTIVE', passwordHash, apiAccess: false, monthlyQuota: 0, mustChangePassword: false },
    ]).returning();
    adminId = admin.id; userId = user.id; otherId = other.id;
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { if (database) await database.close(); if (root) fs.rmSync(root, { recursive: true, force: true }); process.env = oldEnv; });

  it('denies anonymous access across all protected route groups', async () => {
    for (const route of ['/api/storage/init','/api/users','/api/templates','/api/assets','/api/audit-logs','/api/storage/stats','/api/storage/backup/export','/api/openrouter/status']) await request(app).get(route).expect(401);
    for (const route of ['/api/users','/api/templates','/api/assets','/api/audit-logs','/api/storage/backup/import','/api/openrouter/generate','/api/openrouter/optimize-prompt','/api/gemini/optimize-prompt','/api/upload-image']) await request(app).post(route).set('Origin', origin).send({}).expect(401);
    await request(app).get('/uploads/data/users.json').expect(401);
  });
  it('verifies passwords and rejects client roles and privilege fields', async () => {
    await request(app).post('/api/auth/login').send({ email: 'admin@example.test', password: 'anything' }).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'user@example.test', password, role: 'Admin' }).expect(400);
    for (const extra of [{ role: 'Admin' }, { apiAccess: true }, { monthlyQuota: 100 }, { status: 'ACTIVE' }, { passwordHash: 'forged' }]) {
      await request(app).post('/api/auth/register').send({ email: 'new@example.test', name: 'New', password, ...extra }).expect(400);
    }
    const created = await request(app).post('/api/auth/register').send({ email: 'new@example.test', name: 'New', password }).expect(201);
    expect(created.body.user).toMatchObject({ role: 'Viewer', apiAccess: false, generationLimit: 0 });
    const [saved] = await database.db.select().from(users).where(eq(users.email, 'new@example.test'));
    expect(saved.passwordHash).toMatch(/^\$argon2id\$/); expect(saved.passwordHash).not.toContain(password);
    expect(created.body).not.toHaveProperty('passwordHash');
  });
  it('uses opaque HttpOnly cookies and hashed database sessions', async () => {
    const session = await login();
    const result = await request(app).post('/api/auth/login').send({ email: 'user@example.test', password }).expect(200);
    expect(result.headers['set-cookie'][0]).toContain('HttpOnly'); expect(result.headers['set-cookie'][0]).toContain('SameSite=Strict');
    const records = await database.db.select().from(sessions);
    expect(records[0].tokenHash).not.toBe(session.cookie.split('=')[1]);
    await call('get', '/api/auth/me', session).expect(200);
    await request(app).get('/api/users').set('Cookie', 'isAuthenticated=true; currentUserRole=Admin').expect(401);
  });
  it('rejects ordinary users on every admin route', async () => {
    const session = await login();
    for (const route of ['/api/users','/api/audit-logs','/api/storage/stats','/api/storage/backup/export']) await call('get', route, session).expect(403);
    for (const route of ['/api/users','/api/templates','/api/audit-logs','/api/storage/backup/import','/api/openrouter/optimize-prompt','/api/gemini/optimize-prompt',`/api/users/${userId}/reset`,`/api/users/${userId}/increment`,'/api/users/reset-all']) await call('post', route, session).send({}).expect(403);
    await call('put', `/api/users/${userId}/limit`, session).send({ limit: 1000 }).expect(403);
    await call('patch', `/api/users/${userId}/permissions`, session).send({ role: 'SUPER_ADMIN', status: 'ACTIVE', apiAccess: true }).expect(403);
    const result = await call('get', '/api/storage/init', session).expect(200);
    expect(result.body.users).toHaveLength(1); expect(result.body.users[0].id).toBe(userId); expect(result.body.auditLogs).toEqual([]); expect(result.body.stats).toBeUndefined();
  });
  it('enforces CSRF and cross-origin protection', async () => {
    const session = await login();
    await request(app).post('/api/auth/logout').set('Cookie', session.cookie).send({}).expect(403);
    await request(app).post('/api/auth/logout').set('Cookie', session.cookie).set('X-CSRF-Token', session.csrf).set('Origin', 'https://evil.test').send({}).expect(403);
    await request(app).post('/api/auth/login').set('Origin', 'https://evil.test').send({ email: 'user@example.test', password }).expect(403);
    await request(app).post('/api/auth/login').type('form').send({ email: 'user@example.test', password }).expect(415);
    await call('get', '/api/auth/me', session).expect(200);
  });
  it('revokes the existing session on logout', async () => {
    const session = await login();
    await call('post', '/api/auth/logout', session).send({}).expect(200);
    await call('get', '/api/auth/me', session).expect(401);
  });
  it('revokes every existing session on suspension and permission changes', async () => {
    const admin = await login('admin@example.test'); const first = await login(); const second = await login();
    await call('patch', `/api/users/${userId}/permissions`, admin).send({ role: 'USER', status: 'DISABLED', apiAccess: false }).expect(200);
    await call('get', '/api/auth/me', first).expect(401); await call('get', '/api/auth/me', second).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'user@example.test', password }).expect(401);
    const other = await login('other@example.test');
    await call('patch', `/api/users/${otherId}/permissions`, admin).send({ role: 'USER', status: 'ACTIVE', apiAccess: true }).expect(200);
    await call('get', '/api/auth/me', other).expect(401);
  });
  it('revokes sessions on password change and rejects the old password', async () => {
    const session = await login(); const second = await login();
    await call('post', '/api/auth/password', session).send({ currentPassword: password, newPassword: 'a-different-long-password' }).expect(200);
    await call('get', '/api/auth/me', session).expect(401); await call('get', '/api/auth/me', second).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'user@example.test', password }).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'user@example.test', password: 'a-different-long-password' }).expect(200);
  });
  it('rejects expired sessions', async () => {
    const session = await login();
    await database.db.update(sessions).set({ idleExpiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, userId));
    await call('get', '/api/auth/me', session).expect(401);
  });
  it('keeps uploads and asset metadata private to their owner', async () => {
    const session = await login(); const other = await login('other@example.test');
    const upload = await call('post', '/api/upload-image', session).send({ base64Data: image, mimeType: 'image/png' }).expect(200);
    const asset = { id: 'asset-one', prompt: 'test', model: 'test', aspectRatio: '1:1', imageUrl: upload.body.imageUrl, creator: { name: 'Fake', role: 'Admin', email: 'admin@example.test', avatar: '' } };
    const saved = await call('post', '/api/assets', session).send(asset).expect(200);
    expect(saved.body.assets[0]).toMatchObject({ ownerUserId: userId, creator: { name: 'User', email: 'user@example.test', role: 'USER' } });
    const list = await call('get', '/api/assets', other).expect(200); expect(list.body).toEqual([]);
    await call('delete', '/api/assets/asset-one', other).expect(404);
    await call('get', upload.body.imageUrl, other).expect(404); await call('get', upload.body.imageUrl, session).expect(200);
    await call('post', '/api/assets', other).send({ ...asset, id: 'stolen' }).expect(404);
    await call('get', '/uploads/data/users.json', session).expect(404);
  });
  it('filters private templates and denies generation from them', async () => {
    store.saveTemplateToDisk({ id: 'private', isPublic: false, name: 'Private' } as never);
    const session = await login();
    const result = await call('get', '/api/templates', session).expect(200); expect(result.body).toEqual([]);
    await call('post', '/api/openrouter/generate', session).send({ prompt: 'test', templateId: 'private' }).expect(404);
    expect(provider.generateImage).not.toHaveBeenCalled();
  });
  it('blocks calls without API permission and quota before provider dispatch', async () => {
    const other = await login('other@example.test');
    await call('post', '/api/openrouter/generate', other).send({ prompt: 'test' }).expect(403);
    await database.db.update(users).set({ monthlyQuota: 0 }).where(eq(users.id, userId));
    const session = await login();
    await call('post', '/api/openrouter/generate', session).send({ prompt: 'test' }).expect(429);
    expect(provider.generateImage).not.toHaveBeenCalled();
  });
  it('optimizes prompts with only OpenRouter and preserves quota accounting for both URLs', async () => {
    const geminiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const admin = await login('admin@example.test');
      provider.optimizePrompt.mockResolvedValue('Polished {{OBJECT}} with studio lighting');
      for (const route of ['/api/openrouter/optimize-prompt', '/api/gemini/optimize-prompt']) {
        const result = await call('post', route, admin).send({ basePrompt: '{{OBJECT}}', category: 'Kitchen', model: 'nano-banana-2' }).expect(200);
        expect(result.body.optimizedPrompt).toBe('Polished {{OBJECT}} with studio lighting');
      }
      expect(provider.optimizePrompt).toHaveBeenCalledWith('{{OBJECT}}', 'Kitchen', 'nano-banana-2', 'test-prompt-provider');
      const [period] = await database.db.select().from(quotaPeriods).where(eq(quotaPeriods.userId, adminId));
      expect(period).toMatchObject({ reservedUnits: 0, consumedUnits: 2 });
      await call('post', '/api/openrouter/optimize-prompt', admin).send({ basePrompt: '{{OBJECT}}' }).expect(429);
      expect(provider.optimizePrompt).toHaveBeenCalledTimes(2);
    } finally {
      if (geminiKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = geminiKey;
    }
  });
  it('does not accept a Gemini key in place of the single required OpenRouter key', async () => {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = ' ';
    try {
      const admin = await login('admin@example.test');
      await call('post', '/api/openrouter/generate', admin).send({ prompt: 'test' }).expect(503);
      await call('post', '/api/openrouter/optimize-prompt', admin).send({ basePrompt: 'test' }).expect(503);
      expect(provider.generateImage).not.toHaveBeenCalled();
      expect(provider.optimizePrompt).not.toHaveBeenCalled();
      expect(await database.db.select().from(generationJobs)).toHaveLength(0);
    } finally {
      if (openRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = openRouterKey;
    }
  });
  it('reserves quota atomically under parallel generation and hides another user’s job', async () => {
    const session = await login(); const other = await login('other@example.test');
    let resolve!: (value: string) => void;
    provider.generateImage.mockImplementation(() => new Promise<string>(r => { resolve = r; }));
    const results = await Promise.all(Array.from({ length: 12 }, () => call('post', '/api/openrouter/generate', session).send({ prompt: 'test' })));
    expect(results.filter(r => r.status === 202)).toHaveLength(1); expect(results.filter(r => r.status === 429)).toHaveLength(11);
    expect(provider.generateImage).toHaveBeenCalledTimes(1);
    const jobId = results.find(r => r.status === 202)!.body.taskId;
    await call('get', `/api/openrouter/status?taskId=${jobId}`, other).expect(404);
    const [period] = await database.db.select().from(quotaPeriods).where(eq(quotaPeriods.userId, userId));
    expect(period).toMatchObject({ reservedUnits: 1, consumedUnits: 0 });
    resolve('/uploads/test.png');
    await vi.waitFor(async () => { const [job] = await database.db.select().from(generationJobs).where(eq(generationJobs.id, jobId)); expect(job.status).toBe('SUCCEEDED'); });
    await Promise.all([security.settle(jobId, true), security.settle(jobId, true)]);
    const [settled] = await database.db.select().from(quotaPeriods).where(eq(quotaPeriods.userId, userId));
    expect(settled).toMatchObject({ reservedUnits: 0, consumedUnits: 1 });
  });
  it('sanitizes provider failures and excludes secrets and credentials from backups', async () => {
    const session = await login(); const admin = await login('admin@example.test');
    const logs = vi.spyOn(console, 'warn').mockImplementation(() => {});
    provider.generateImage.mockRejectedValue(new Error(`Authorization Bearer ${process.env.OPENROUTER_API_KEY}`));
    const job = await call('post', '/api/openrouter/generate', session).send({ prompt: 'test' }).expect(202);
    await vi.waitFor(async () => { const result = await call('get', `/api/openrouter/status?taskId=${job.body.taskId}`, session); expect(result.body.error).toBe('Provider request failed.'); expect(JSON.stringify(result.body)).not.toContain(process.env.OPENROUTER_API_KEY); });
    store.saveTemplateToDisk({ id: 'old', basePrompt: process.env.OPENROUTER_API_KEY, passwordHash: 'private-hash', apiKey: process.env.GEMINI_API_KEY, name: 'Old', isPublic: false } as never);
    const backup = await call('get', '/api/storage/backup/export', admin).expect(200);
    expect(backup.body.users).toBeUndefined(); expect(backup.body.sessions).toBeUndefined();
    expect(JSON.stringify(backup.body)).not.toMatch(/secret-canary|private-hash|passwordHash|apiKey/);
    expect(JSON.stringify(logs.mock.calls)).not.toContain(process.env.OPENROUTER_API_KEY);
    await call('post', '/api/storage/backup/import', admin).send({ templates: [], assets: [], users: [{ role: 'Admin' }] }).expect(400);
  });
  it('requires HTTPS and secure host-only cookies in production', async () => {
    process.env.NODE_ENV = 'production'; process.env.APP_URL = 'https://studio.example.test'; process.env.TRUST_PROXY = '1';
    try {
      const { createApp } = await import('../server'); const production = createApp(security, provider);
      await request(production).get('/api/health').expect(400);
      const result = await request(production).post('/api/auth/login').set('X-Forwarded-Proto', 'https').set('Origin', process.env.APP_URL).send({ email: 'user@example.test', password }).expect(200);
      expect(result.headers['set-cookie'][0]).toMatch(/^__Host-radmehr_session=/); expect(result.headers['set-cookie'][0]).toContain('Secure');
      expect(result.headers['set-cookie'][0]).not.toContain('Domain='); expect(result.headers['strict-transport-security']).toBeTruthy();
    } finally { process.env.NODE_ENV = 'test'; process.env.APP_URL = origin; delete process.env.TRUST_PROXY; }
  });
  it('changes quotas and resets an existing period without zero-delta ledger records', async () => {
    const job = await security.reserve(userId, 'image', 'test', 'test', '1:1');
    await security.changeQuota(userId, 3, adminId);
    await security.changeQuota(userId, 3, adminId, true);
    await security.settle(job.id, true);
    await security.changeQuota(userId, 2, adminId, true);
    const [period] = await database.db.select().from(quotaPeriods).where(eq(quotaPeriods.userId, userId));
    expect(period).toMatchObject({ quotaUnits: 2, reservedUnits: 0, consumedUnits: 0 });
  });
  it('protects configured private paths from Vite development serving', async () => {
    const oldData = process.env.DATA_DIR; const oldUploads = process.env.UPLOADS_DIR;
    const directory = fs.mkdtempSync(path.join(process.cwd(), 'runtime-security-fixture-'));
    process.env.DATA_DIR = path.join(directory, 'custom-data'); process.env.UPLOADS_DIR = path.join(directory, 'custom-images');
    fs.mkdirSync(process.env.DATA_DIR); fs.mkdirSync(process.env.UPLOADS_DIR);
    fs.writeFileSync(path.join(process.env.DATA_DIR, 'database.json'), 'private-canary');
    fs.writeFileSync(path.join(process.env.UPLOADS_DIR, 'private.png'), 'private-canary');
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    try {
      const express = (await import('express')).default;
      const testApp = express();
      testApp.use((await import('../server')).privateFileGuard); testApp.use(vite.middlewares);
      for (const file of [path.join(process.env.DATA_DIR, 'database.json'), path.join(process.env.UPLOADS_DIR, 'private.png')]) {
        const relative = '/' + path.relative(process.cwd(), file);
        await request(testApp).get(relative).expect(404);
        await request(testApp).get('/@fs' + file).expect(404);
      }
      const rawVite = express(); rawVite.use(vite.middlewares);
      const raw = await request(rawVite).get('/@fs' + path.join(process.env.DATA_DIR, 'database.json'));
      expect(raw.status).toBe(403); expect(raw.text).not.toContain('private-canary');
    } finally {
      await vite.close(); fs.rmSync(directory, { recursive: true, force: true });
      process.env.DATA_DIR = oldData; process.env.UPLOADS_DIR = oldUploads;
    }
  });
  it('rejects unsafe remote sources and invalid image uploads', async () => {
    const session = await login();
    for (const referenceImageUrl of ['http://127.0.0.1/private', 'https://169.254.169.254/', 'https://evil.test/image.png']) await call('post', '/api/openrouter/generate', session).send({ prompt: 'test', referenceImageUrl }).expect(400);
    await call('post', '/api/upload-image', session).send({ base64Data: Buffer.from('<script>bad()</script>').toString('base64'), mimeType: 'text/html' }).expect(400);
    expect(provider.generateImage).not.toHaveBeenCalled();
  });
  it('throttles login attempts using shared PostgreSQL counters', async () => {
    await database.pool.query("INSERT INTO auth_rate_limits(key, attempts, expires_at) VALUES ($1, 30, now() + interval '15 minutes')", [`${Math.floor(Date.now() / 900000)}:${(await import('./security')).digest('ip:::ffff:127.0.0.1')}`]);
    // The account limit is independent of source address and deterministic across processes.
    for (let i = 0; i < 10; i++) await security.throttle('unique-ip', 'throttled@example.test');
    await expect(security.throttle('different-ip', 'throttled@example.test')).rejects.toMatchObject({ status: 429 });
  });
});
