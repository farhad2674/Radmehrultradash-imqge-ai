import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import { getDatabase } from './server/db/client';
import { generationJobs, users } from './server/db/schema';
import { initDiskStorage, getDataDir, getUploadsDir, getTemplatesFromDisk, saveTemplateToDisk, deleteTemplateFromDisk,
  getAssetsFromDisk, saveAssetToDisk, deleteAssetFromDisk, getSettingsFromDisk, saveSettingsToDisk,
  saveImageBase64ToDisk, getStorageStats, importFullBackup } from './server/diskStore';
import { SecurityService, asyncRoute, HttpError, strictBody, stringField, passwordField, credentialPassword, uuidField, quotaField,
  identity, requireSession, adminOnly, protectCsrf, requireSameOrigin, setSessionCookie, csrfToken } from './server/security';
import { canViewAsset, canViewTemplate, contentBackup, sanitizeBackup, ensureImageAccess, safeImageUrl, validateAsset, validateTemplate } from './server/contentSecurity';
import * as providers from './server/providers';

export function createApp(security = new SecurityService(getDatabase()), provider = providers) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' });
    if (process.env.NODE_ENV === 'production') {
      res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      if (!req.secure) return res.status(400).json({ error: 'HTTPS required.' });
    }
    next();
  });
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', requireSameOrigin);
  app.use(express.json({ limit: '15mb', strict: true }));
  const auth = express.Router();
  auth.post('/login', asyncRoute(async (req, res) => {
    strictBody(req.body, ['email', 'password']);
    const email = stringField(req.body.email, 254).toLowerCase();
    const password = typeof req.body.password === 'string' && req.body.password.length > 0 && Buffer.byteLength(req.body.password) <= 1024 ? req.body.password : null;
    if (!password) throw new HttpError(400, 'Invalid credentials.');
    await security.throttle(req.ip || '', email);
    const user = await security.login(email, password);
    const token = await security.createSession(user);
    setSessionCookie(res, token);
    res.json({ user: await security.publicUser(user), csrfToken: csrfToken(token) });
  }));
  auth.post('/register', asyncRoute(async (req, res) => {
    strictBody(req.body, ['email', 'name', 'password', 'department']);
    await security.throttle(req.ip || '', stringField(req.body.email, 254).toLowerCase());
    const user = await security.createAccount(req.body);
    const token = await security.createSession(user);
    setSessionCookie(res, token);
    res.status(201).json({ user: await security.publicUser(user), csrfToken: csrfToken(token) });
  }));
  app.use('/api/auth', auth);
  // Default deny: every subsequent API route requires a live PostgreSQL session and CSRF for mutations.
  app.use('/api', requireSession(security), protectCsrf);
  app.get('/api/auth/me', asyncRoute(async (_req, res) => res.json({ user: await security.publicUser(identity(res).user), csrfToken: csrfToken(identity(res).token) })));
  app.post('/api/auth/logout', asyncRoute(async (_req, res) => {
    await security.logout(identity(res)); setSessionCookie(res); res.json({ success: true });
  }));
  app.post('/api/auth/password', asyncRoute(async (req, res) => {
    strictBody(req.body, ['currentPassword', 'newPassword']);
    await security.changePassword(identity(res).user, credentialPassword(req.body.currentPassword), passwordField(req.body.newPassword));
    setSessionCookie(res); res.json({ success: true });
  }));
  const visibleTemplates = (res: Response) => contentBackup(getTemplatesFromDisk().filter(t => canViewTemplate(t, identity(res).user)), []).templates;
  const visibleAssets = (res: Response) => contentBackup([], getAssetsFromDisk().filter(a => canViewAsset(a, identity(res).user))).assets;
  app.get('/api/storage/init', asyncRoute(async (_req, res) => {
    const user = identity(res).user;
    const isAdmin = user.role === 'SUPER_ADMIN';
    res.json({ templates: visibleTemplates(res), assets: visibleAssets(res), users: isAdmin ? await security.listUsers() : [await security.publicUser(user)],
      auditLogs: isAdmin ? await security.logs() : [], settings: getSettingsFromDisk(), ...(isAdmin ? { stats: getStorageStats() } : {}) });
  }));
  app.get('/api/templates', (_req, res) => res.json(visibleTemplates(res)));
  app.post('/api/templates', adminOnly, asyncRoute(async (req, res) => {
    const template = validateTemplate(req.body);
    if (template.thumbnailUrl) ensureImageAccess(template.thumbnailUrl, identity(res).user, visibleTemplates(res));
    if (template.referenceImageUrl) ensureImageAccess(template.referenceImageUrl, identity(res).user, visibleTemplates(res));
    saveTemplateToDisk({ ...template, author: identity(res).user.displayName });
    await security.audit('TEMPLATE_SAVED', identity(res).user.id, template.id);
    res.json({ success: true, templates: visibleTemplates(res) });
  }));
  app.delete('/api/templates/:id', adminOnly, asyncRoute(async (req, res) => {
    deleteTemplateFromDisk(req.params.id); await security.audit('TEMPLATE_DELETED', identity(res).user.id, req.params.id);
    res.json({ success: true, templates: visibleTemplates(res) });
  }));
  app.get('/api/assets', (_req, res) => res.json(visibleAssets(res)));
  app.post('/api/assets', asyncRoute(async (req, res) => {
    const asset = validateAsset(req.body, identity(res).user);
    ensureImageAccess(asset.imageUrl, identity(res).user);
    const existing = getAssetsFromDisk().find(a => a.id === asset.id);
    if (existing) throw new HttpError(409, 'Asset identifier already exists.');
    saveAssetToDisk(asset);
    await security.audit('ASSET_SAVED', identity(res).user.id, asset.id);
    res.json({ success: true, assets: visibleAssets(res) });
  }));
  app.delete('/api/assets/:id', asyncRoute(async (req, res) => {
    if (!visibleAssets(res).some(a => a.id === req.params.id)) throw new HttpError(404, 'Asset not found.');
    deleteAssetFromDisk(req.params.id); await security.audit('ASSET_DELETED', identity(res).user.id, req.params.id);
    res.json({ success: true, assets: visibleAssets(res) });
  }));
  app.use('/api/users', adminOnly);
  app.get('/api/users', asyncRoute(async (_req, res) => res.json(await security.listUsers())));
  app.post('/api/users', asyncRoute(async (req, res) => {
    await security.createAccount(req.body, identity(res).user.id);
    res.json({ success: true, users: await security.listUsers() });
  }));
  app.patch('/api/users/:id/permissions', asyncRoute(async (req, res) => {
    strictBody(req.body, ['role', 'status', 'apiAccess']);
    if (!['USER', 'SUPER_ADMIN'].includes(req.body.role) || !['ACTIVE', 'DISABLED'].includes(req.body.status) || typeof req.body.apiAccess !== 'boolean') throw new HttpError(400, 'Invalid permissions.');
    await security.updatePermissions(uuidField(req.params.id), { role: req.body.role, status: req.body.status, apiAccess: req.body.apiAccess }, identity(res).user.id);
    res.json({ success: true, users: await security.listUsers() });
  }));
  app.put('/api/users/:id/limit', asyncRoute(async (req, res) => {
    strictBody(req.body, ['limit']);
    await security.changeQuota(uuidField(req.params.id), quotaField(req.body.limit), identity(res).user.id);
    res.json({ success: true, users: await security.listUsers() });
  }));
  app.post('/api/users/:id/reset', asyncRoute(async (req, res) => {
    const id = uuidField(req.params.id);
    const [user] = await security.db.select().from(users).where(eq(users.id, id));
    if (!user) throw new HttpError(404, 'Account not found.');
    await security.changeQuota(id, user.monthlyQuota, identity(res).user.id, true);
    res.json({ success: true, users: await security.listUsers() });
  }));
  app.post('/api/users/reset-all', asyncRoute(async (_req, res) => {
    for (const user of await security.db.select().from(users)) await security.changeQuota(user.id, user.monthlyQuota, identity(res).user.id, true);
    res.json({ success: true, users: await security.listUsers() });
  }));
  app.post('/api/users/:id/increment', (_req, res) => res.status(410).json({ error: 'Usage is accounted for by the server.' }));
  app.get('/api/audit-logs', adminOnly, asyncRoute(async (_req, res) => res.json(await security.logs())));
  app.post('/api/audit-logs', adminOnly, (_req, res) => res.status(410).json({ error: 'Audit records are generated by the server.' }));
  app.post('/api/upload-image', asyncRoute(async (req, res) => {
    strictBody(req.body, ['base64Data', 'mimeType']);
    let imageUrl: string;
    try { imageUrl = saveImageBase64ToDisk(req.body.base64Data, req.body.mimeType || 'image/png', identity(res).user.id); }
    catch { throw new HttpError(400, 'Invalid image. Use PNG, JPEG, or WebP up to 10 MB.'); }
    await security.audit('IMAGE_UPLOADED', identity(res).user.id);
    res.json({ success: true, imageUrl });
  }));
  app.get('/api/storage/stats', adminOnly, (_req, res) => res.json(getStorageStats()));
  app.put('/api/settings', adminOnly, asyncRoute(async (req, res) => {
    strictBody(req.body, ['defaultLimit', 'workspaceName']);
    const settings = { defaultLimit: quotaField(req.body.defaultLimit), workspaceName: stringField(req.body.workspaceName, 150) };
    saveSettingsToDisk(settings); await security.audit('SETTINGS_CHANGED', identity(res).user.id);
    res.json({ success: true, settings });
  }));
  app.get('/api/storage/backup/export', adminOnly, (_req, res) => res.json(contentBackup(getTemplatesFromDisk(), getAssetsFromDisk())));
  app.post('/api/storage/backup/import', adminOnly, asyncRoute(async (req, res) => {
    strictBody(req.body, ['version', 'exportedAt', 'templates', 'assets']);
    if (!Array.isArray(req.body.templates) || !Array.isArray(req.body.assets) || req.body.templates.length > 10000 || req.body.assets.length > 10000) throw new HttpError(400, 'Invalid content backup.');
    const templates = req.body.templates.map(validateTemplate);
    const assets = await Promise.all(req.body.assets.map(async (asset: any) => {
      const ownerId = uuidField(asset.ownerUserId);
      const [owner] = await security.db.select().from(users).where(eq(users.id, ownerId));
      if (!owner) throw new HttpError(400, 'Backup asset owner is unavailable.');
      const validated = validateAsset(asset, owner);
      ensureImageAccess(validated.imageUrl, owner);
      return validated;
    }));
    importFullBackup({ templates, assets }); await security.audit('CONTENT_RESTORED', identity(res).user.id);
    res.json({ success: true });
  }));
  app.post('/api/openrouter/generate', asyncRoute(async (req, res) => {
    strictBody(req.body, ['prompt', 'model', 'referenceImageUrl', 'aspectRatio', 'resolution', 'templateId']);
    const prompt = stringField(req.body.prompt, 20000);
    const aspectRatio = req.body.aspectRatio || '16:9';
    if (!['1:1', '16:9', '4:3', '3:4', '9:16'].includes(aspectRatio)) throw new HttpError(400, 'Invalid aspect ratio.');
    if (req.body.resolution && !['1K', '2K', '4K'].includes(req.body.resolution)) throw new HttpError(400, 'Invalid resolution.');
    if (req.body.templateId) {
      const template = visibleTemplates(res).find(t => t.id === req.body.templateId);
      if (!template) throw new HttpError(404, 'Template not found.');
      if (template.requireApproval && identity(res).user.role !== 'SUPER_ADMIN') throw new HttpError(403, 'Template requires administrator approval.');
    }
    const referenceImageUrl = req.body.referenceImageUrl ? safeImageUrl(req.body.referenceImageUrl, true) : undefined;
    if (referenceImageUrl) ensureImageAccess(referenceImageUrl, identity(res).user, visibleTemplates(res));
    if (!identity(res).user.apiAccess) throw new HttpError(403, 'API access is not enabled for this account.');
    if (!process.env.OPENROUTER_API_KEY?.trim()) throw new HttpError(503, 'Image provider is not configured.');
    let selectedModel: string;
    try { selectedModel = await provider.imageProviderModel(Boolean(referenceImageUrl)); }
    catch { throw new HttpError(502, 'Provider model selection failed.'); }
    const job = await security.reserve(identity(res).user.id, 'image', selectedModel, prompt, aspectRatio);
    void (async () => {
      try {
        const imageUrl = await provider.generateImage({ prompt, aspectRatio, referenceImageUrl, resolution: req.body.resolution, selectedModel }, job.userId);
        await security.settle(job.id, true, { imageUrl });
      } catch {
        // Raw provider errors may contain authorization headers or echoed credentials.
        try { await security.settle(job.id, false); } catch { console.warn('Generation settlement failed; reservation retained.'); }
      }
    })();
    res.status(202).json({ taskId: job.id });
  }));
  app.get('/api/openrouter/status', asyncRoute(async (req, res) => {
    const taskId = uuidField(req.query.taskId);
    const [job] = await security.db.select().from(generationJobs).where(and(eq(generationJobs.id, taskId), eq(generationJobs.userId, identity(res).user.id)));
    if (!job) throw new HttpError(404, 'Generation task not found.');
    const status = job.status === 'SUCCEEDED' ? 'COMPLETED' : ['FAILED', 'CANCELLED', 'EXPIRED'].includes(job.status) ? 'FAILED' : 'PROCESSING';
    res.json({ status, imageUrl: status === 'COMPLETED' ? job.requestMetadata.imageUrl : undefined, error: status === 'FAILED' ? 'Provider request failed.' : null });
  }));
  // Preserve the legacy URL for existing clients; both routes use OpenRouter.
  app.post(['/api/openrouter/optimize-prompt', '/api/gemini/optimize-prompt'], adminOnly, asyncRoute(async (req, res) => {
    strictBody(req.body, ['basePrompt', 'category', 'model']);
    const prompt = stringField(req.body.basePrompt, 20000);
    const category = req.body.category ? stringField(req.body.category, 150) : 'Smart Appliance';
    const model = req.body.model ? stringField(req.body.model, 150) : 'nano-banana-2';
    if (!identity(res).user.apiAccess) throw new HttpError(403, 'API access is not enabled for this account.');
    if (!process.env.OPENROUTER_API_KEY?.trim()) throw new HttpError(503, 'Prompt provider is not configured.');
    let selectedModel: string;
    try { selectedModel = await provider.promptProviderModel(); }
    catch { throw new HttpError(502, 'Provider model selection failed.'); }
    const job = await security.reserve(identity(res).user.id, 'prompt', selectedModel, prompt, '1:1');
    let optimizedPrompt: string;
    try { optimizedPrompt = await provider.optimizePrompt(prompt, category, model, selectedModel); }
    catch { await security.settle(job.id, false); throw new HttpError(502, 'Provider request failed.'); }
    await security.settle(job.id, true); res.json({ optimizedPrompt: sanitizeBackup(optimizedPrompt) });
  }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  // Images require authentication; only a single image basename is ever eligible for serving.
  app.use('/uploads', requireSession(security), asyncRoute(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const url = `/uploads${req.path}`;
    if (!/^\/uploads\/[\w-]+\.(png|jpg|jpeg|webp)$/.test(url)) throw new HttpError(404, 'Image not found.');
    ensureImageAccess(url, identity(res).user, visibleTemplates(res));
    const filename = path.join(getUploadsDir(), req.path.slice(1));
    if (!fs.existsSync(filename) || fs.lstatSync(filename).isSymbolicLink()) throw new HttpError(404, 'Image not found.');
    res.sendFile(filename);
  }));
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof HttpError ? error.status : error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 500) console.warn('Request failed.');
    res.status(status).json({ error: error instanceof HttpError ? error.message : status === 413 ? 'Request too large.' : status === 400 ? 'Invalid JSON request.' : 'Request failed.' });
  });
  return app;
}

export function privateFileGuard(req: Request, res: Response, next: NextFunction) {
  let decoded: string;
  try { decoded = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
  for (const directory of [getDataDir(), getUploadsDir(), path.resolve('server'), path.resolve('build')]) {
    const relative = path.relative(process.cwd(), directory).replaceAll(path.sep, '/');
    const prefix = relative && !relative.startsWith('../') ? `/${relative}` : null;
    const fsPrefix = `/@fs${directory.replaceAll(path.sep, '/')}`;
    if ((prefix && (decoded === prefix || decoded.startsWith(prefix + '/'))) || decoded === fsPrefix || decoded.startsWith(fsPrefix + '/')) return res.sendStatus(404);
  }
  next();
}

export async function startServer() {
  if (process.env.NODE_ENV === 'production' && (!process.env.APP_URL || !/^https:\/\//.test(process.env.APP_URL))) throw new Error('Production APP_URL must use HTTPS.');
  await getDatabase().select({ id: users.id }).from(users).limit(1); // Fail closed if PostgreSQL or migrations are unavailable.
  initDiskStorage();
  const app = createApp();
  if (process.env.NODE_ENV !== 'production') {
    app.use(privateFileGuard);
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/assets', express.static(path.join(distPath, 'assets'), { dotfiles: 'deny', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  return app.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('RadmehrAI Studio server started.'));
}
