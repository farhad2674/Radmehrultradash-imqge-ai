import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull, sql, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import argon2 from 'argon2';
import * as schema from './db/schema';
import { PersonnelUser } from '../src/types';

export type Database = NodePgDatabase<typeof schema>;
export type Account = typeof schema.users.$inferSelect;
export interface Identity { user: Account; sessionId: string; token: string }
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { Promise.resolve(handler(req, res)).catch(next); };
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const csrfToken = (token: string) => digest(`csrf:${token}`);
export const hashPassword = (password: string) => argon2.hash(password, {
  type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1,
});
export function strictBody(body: unknown, fields: string[]): asserts body is Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) {
    throw new HttpError(400, 'Invalid request fields.');
  }
}
export function stringField(value: unknown, max = 200, min = 1): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new HttpError(400, 'Invalid request value.');
  return value.trim();
}
export function credentialPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value) > 1024) throw new HttpError(400, 'Invalid credentials.');
  return value;
}
export function passwordField(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value) > 1024) throw new HttpError(400, 'Use a password of at least 12 characters (maximum 1024 bytes).');
  return value;
}
export function uuidField(value: unknown): string {
  const id = stringField(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(400, 'Invalid identifier.');
  return id;
}
export function quotaField(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 100000) throw new HttpError(400, 'Invalid quota.');
  return Number(value);
}
export function monthPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) };
}
const IDLE_MS = 8 * 3600 * 1000;
const ABSOLUTE_MS = 24 * 3600 * 1000;

export class SecurityService {
  constructor(public db: Database) {}
  async audit(action: string, actorUserId?: string, entityId?: string) {
    await this.db.insert(schema.auditLogs).values({ action, actorUserId, entityType: 'security', entityId, outcome: 'SUCCESS' });
  }
  async throttle(ip: string, email: string) {
    const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
    for (const [identity, limit] of [[`ip:${ip}`, 30], [`email:${email}`, 10]] as const) {
      const key = `${bucket}:${digest(identity)}`;
      const [attempt] = await this.db.insert(schema.authRateLimits).values({ key, attempts: 1, expiresAt: new Date((bucket + 1) * 15 * 60 * 1000) })
        .onConflictDoUpdate({ target: schema.authRateLimits.key, set: { attempts: sql`${schema.authRateLimits.attempts} + 1` } }).returning();
      if (attempt.attempts > limit) throw new HttpError(429, 'Too many authentication attempts. Try again later.');
    }
    await this.db.delete(schema.authRateLimits).where(sql`${schema.authRateLimits.expiresAt} < now()`);
  }
  async createAccount(body: unknown, creator?: string) {
    strictBody(body, ['email', 'name', 'password', 'department']);
    const email = stringField(body.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Invalid email address.');
    const passwordHash = await hashPassword(passwordField(body.password));
    const [user] = await this.db.insert(schema.users).values({
      username: email, email, displayName: stringField(body.name, 120), department: body.department ? stringField(body.department, 120) : null,
      passwordHash, role: 'USER', status: 'ACTIVE', apiAccess: false, monthlyQuota: 0, mustChangePassword: false, createdBy: creator,
    }).onConflictDoNothing().returning();
    if (!user) throw new HttpError(409, 'Unable to create account with these details.');
    await this.audit('ACCOUNT_CREATED', creator ?? user.id, user.id);
    return user;
  }
  async login(email: string, password: string) {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).limit(1);
    // A real hash calculation also runs for unknown accounts to reduce timing-based enumeration.
    const valid = user?.passwordHash ? await argon2.verify(user.passwordHash, password).catch(() => false) : (await hashPassword(password), false);
    if (!valid || !user || user.status !== 'ACTIVE') throw new HttpError(401, 'Invalid email or password.');
    return user;
  }
  async createSession(user: Account) {
    return this.db.transaction(async tx => {
      const [current] = await tx.select().from(schema.users).where(eq(schema.users.id, user.id)).for('update');
      if (!current || current.status !== 'ACTIVE' || current.sessionVersion !== user.sessionVersion) throw new HttpError(401, 'Please sign in again.');
      const token = randomBytes(32).toString('base64url');
      await tx.insert(schema.sessions).values({ userId: user.id, tokenHash: digest(token), sessionVersion: current.sessionVersion,
        idleExpiresAt: new Date(Date.now() + IDLE_MS), absoluteExpiresAt: new Date(Date.now() + ABSOLUTE_MS) });
      await tx.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
      await tx.insert(schema.auditLogs).values({ actorUserId: user.id, action: 'LOGIN', entityType: 'session', outcome: 'SUCCESS' });
      return token;
    });
  }
  async authenticate(token: string): Promise<Identity | null> {
    if (!/^[\w-]{43}$/.test(token)) return null;
    const now = new Date();
    const [record] = await this.db.select({ user: schema.users, session: schema.sessions }).from(schema.sessions)
      .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id)).where(and(
        eq(schema.sessions.tokenHash, digest(token)), isNull(schema.sessions.revokedAt), gt(schema.sessions.idleExpiresAt, now),
        gt(schema.sessions.absoluteExpiresAt, now), eq(schema.users.status, 'ACTIVE'), eq(schema.sessions.sessionVersion, schema.users.sessionVersion),
      )).limit(1);
    if (!record) return null;
    await this.db.update(schema.sessions).set({ lastSeenAt: now, idleExpiresAt: new Date(Math.min(now.getTime() + IDLE_MS, record.session.absoluteExpiresAt.getTime())) })
      .where(and(eq(schema.sessions.id, record.session.id), isNull(schema.sessions.revokedAt)));
    return { user: record.user, sessionId: record.session.id, token };
  }
  async publicUser(user: Account): Promise<PersonnelUser> {
    const [period] = await this.db.select().from(schema.quotaPeriods).where(and(eq(schema.quotaPeriods.userId, user.id), eq(schema.quotaPeriods.periodStart, monthPeriod().periodStart)));
    return { id: user.id, name: user.displayName, email: user.email, role: user.role === 'SUPER_ADMIN' ? 'Admin' : 'Viewer',
      status: user.status === 'ACTIVE' ? 'Active' : user.status === 'DISABLED' ? 'Suspended' : 'Invited', department: user.department || '',
      avatar: '', lastActive: user.lastLoginAt?.toISOString() || '', generationLimit: user.monthlyQuota,
      completedGenerations: (period?.consumedUnits || 0) + (period?.reservedUnits || 0), allowUnlimited: false, apiAccess: user.apiAccess };
  }
  async listUsers() { return Promise.all((await this.db.select().from(schema.users)).map(user => this.publicUser(user))); }
  async updatePermissions(id: string, patch: Pick<Account, 'role' | 'status' | 'apiAccess'>, actor: string) {
    await this.db.transaction(async tx => {
      const result = await tx.update(schema.users).set({ ...patch, sessionVersion: sql`${schema.users.sessionVersion} + 1`, updatedAt: new Date(), disabledAt: patch.status === 'DISABLED' ? new Date() : null })
        .where(eq(schema.users.id, id)).returning();
      if (!result.length) throw new HttpError(404, 'Account not found.');
      await tx.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.userId, id));
      await tx.insert(schema.auditLogs).values({ actorUserId: actor, subjectUserId: id, action: 'PERMISSIONS_CHANGED', entityType: 'user', outcome: 'SUCCESS' });
    });
  }
  async changePassword(user: Account, oldPassword: string, newPassword: string) {
    if (!user.passwordHash || !await argon2.verify(user.passwordHash, oldPassword).catch(() => false)) throw new HttpError(401, 'Invalid current password.');
    const passwordHash = await hashPassword(passwordField(newPassword));
    await this.db.transaction(async tx => {
      const [changed] = await tx.update(schema.users).set({ passwordHash, mustChangePassword: false, sessionVersion: sql`${schema.users.sessionVersion} + 1`, updatedAt: new Date() })
        .where(and(eq(schema.users.id, user.id), eq(schema.users.sessionVersion, user.sessionVersion))).returning();
      if (!changed) throw new HttpError(401, 'Please sign in again.');
      await tx.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.userId, user.id));
      await tx.insert(schema.auditLogs).values({ actorUserId: user.id, action: 'PASSWORD_CHANGED', entityType: 'user', outcome: 'SUCCESS' });
    });
  }
  async logout(identity: Identity) {
    await this.db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, identity.sessionId));
    await this.audit('LOGOUT', identity.user.id);
  }
  async reserve(userId: string, provider: string, model: string, prompt: string, aspectRatio: string) {
    return this.db.transaction(async tx => {
      // Serialize permission changes and reservations for this user. No provider call happens inside this transaction.
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).for('update');
      if (!user || user.status !== 'ACTIVE' || !user.apiAccess || user.mustChangePassword) throw new HttpError(403, 'API access is not enabled for this account.');
      const period = monthPeriod();
      await tx.insert(schema.quotaPeriods).values({ userId, ...period, quotaUnits: user.monthlyQuota }).onConflictDoNothing();
      const [reserved] = await tx.update(schema.quotaPeriods).set({ reservedUnits: sql`${schema.quotaPeriods.reservedUnits} + 1`, updatedAt: new Date() }).where(and(
        eq(schema.quotaPeriods.userId, userId), eq(schema.quotaPeriods.periodStart, period.periodStart),
        sql`${schema.quotaPeriods.reservedUnits} + ${schema.quotaPeriods.consumedUnits} < ${schema.quotaPeriods.quotaUnits}`,
      )).returning();
      if (!reserved) throw new HttpError(429, 'Monthly API quota reached.');
      const [job] = await tx.insert(schema.generationJobs).values({ userId, quotaPeriodId: reserved.id, idempotencyKey: randomBytes(24).toString('hex'),
        provider, providerModel: model, promptSnapshot: prompt, aspectRatio, status: 'PROCESSING', startedAt: new Date(), expiresAt: new Date(Date.now() + 10 * 60 * 1000) }).returning();
      await tx.insert(schema.usageLedger).values({ userId, quotaPeriodId: reserved.id, generationJobId: job.id, eventType: 'RESERVATION_CREATED', reservedDelta: 1 });
      return job;
    });
  }
  async settle(jobId: string, success: boolean, metadata: Record<string, unknown> = {}) {
    await this.db.transaction(async tx => {
      const [job] = await tx.update(schema.generationJobs).set({ status: success ? 'SUCCEEDED' : 'FAILED', completedAt: new Date(), requestMetadata: metadata,
        errorMessage: success ? null : 'Provider request failed.' }).where(and(eq(schema.generationJobs.id, jobId), eq(schema.generationJobs.status, 'PROCESSING'))).returning();
      if (!job) return;
      // Count all dispatched calls, including ambiguous failures, against quota to prevent retry-based overspending.
      await tx.update(schema.quotaPeriods).set({ reservedUnits: sql`${schema.quotaPeriods.reservedUnits} - 1`, consumedUnits: sql`${schema.quotaPeriods.consumedUnits} + 1` }).where(eq(schema.quotaPeriods.id, job.quotaPeriodId));
      await tx.insert(schema.usageLedger).values({ userId: job.userId, quotaPeriodId: job.quotaPeriodId, generationJobId: job.id, eventType: 'RESERVATION_CONSUMED', reservedDelta: -1, consumedDelta: 1 });
      await tx.insert(schema.auditLogs).values({ actorUserId: job.userId, action: success ? 'PROVIDER_COMPLETED' : 'PROVIDER_FAILED', entityType: 'generation', entityId: job.id, outcome: success ? 'SUCCESS' : 'FAILURE' });
    });
  }
  async changeQuota(id: string, quota: number, actor: string, reset = false) {
    await this.db.transaction(async tx => {
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, id)).for('update');
      if (!user) throw new HttpError(404, 'Account not found.');
      const period = monthPeriod();
      const [existing] = await tx.select().from(schema.quotaPeriods).where(and(eq(schema.quotaPeriods.userId, id), eq(schema.quotaPeriods.periodStart, period.periodStart))).for('update');
      if (existing && (reset ? existing.reservedUnits : existing.reservedUnits + existing.consumedUnits) > quota) throw new HttpError(409, 'Quota is below usage already reserved or consumed.');
      await tx.update(schema.users).set({ monthlyQuota: quota, updatedAt: new Date() }).where(eq(schema.users.id, id));
      if (existing) {
        await tx.update(schema.quotaPeriods).set({ quotaUnits: quota, ...(reset ? { consumedUnits: 0 } : {}), updatedAt: new Date() }).where(eq(schema.quotaPeriods.id, existing.id));
        if (reset && existing.consumedUnits > 0) await tx.insert(schema.usageLedger).values({ userId: id, quotaPeriodId: existing.id, actorUserId: actor, eventType: 'ADMIN_ADJUSTMENT', consumedDelta: -existing.consumedUnits, reason: 'Quota reset' });
      }
      await tx.insert(schema.auditLogs).values({ actorUserId: actor, subjectUserId: id, action: reset ? 'QUOTA_RESET' : 'QUOTA_CHANGED', entityType: 'user', outcome: 'SUCCESS' });
    });
  }
  async logs() {
    return (await this.db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(500)).map(log => ({
      id: log.id, timestamp: log.createdAt.toISOString(), time: log.createdAt.toISOString(), user: log.actorUserId || 'System', action: log.action,
      type: 'Security Block' as const, details: `${log.entityType}: ${log.entityId || ''} (${log.outcome})`,
    }));
  }
}

export function cookieName() { return process.env.NODE_ENV === 'production' ? '__Host-radmehr_session' : 'radmehr_session'; }
export function readSessionCookie(req: Request) {
  const matches = (req.headers.cookie || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${cookieName()}=`));
  return matches.length === 1 ? matches[0].slice(cookieName().length + 1) : '';
}
export function setSessionCookie(res: Response, token?: string) {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: ABSOLUTE_MS };
  if (token) res.cookie(cookieName(), token, options);
  else res.clearCookie(cookieName(), { httpOnly: options.httpOnly, secure: options.secure, sameSite: options.sameSite, path: options.path });
}
export function identity(res: Response): Identity { return res.locals.identity; }
export const adminOnly: RequestHandler = (_req, res, next) => {
  if (identity(res).user.role !== 'SUPER_ADMIN') return next(new HttpError(403, 'Administrator permission required.'));
  next();
};
export function requireSession(security: SecurityService): RequestHandler {
  return (req, res, next) => {
    security.authenticate(readSessionCookie(req)).then(current => {
      if (!current) return next(new HttpError(401, 'Authentication required.'));
      res.locals.identity = current;
      next();
    }).catch(next);
  };
}
export const protectCsrf: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const supplied = req.get('X-CSRF-Token') || '';
  const expected = csrfToken(identity(res).token);
  if (! /^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return next(new HttpError(403, 'Invalid CSRF token.'));
  next();
};
export function requireSameOrigin(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : `${req.protocol}://${req.get('host')}`;
  if ((req.get('origin') && req.get('origin') !== expected) || req.get('sec-fetch-site') === 'cross-site') return next(new HttpError(403, 'Cross-origin request rejected.'));
  if (req.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return next(new HttpError(415, 'JSON request required.'));
  next();
}
