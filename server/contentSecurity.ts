import { ApplianceTemplate, GeneratedAsset } from '../src/types';
import { Account, HttpError, strictBody, stringField } from './security';
import { getImageOwner } from './diskStore';

const templateFields = ['id', 'name', 'category', 'model', 'description', 'basePrompt', 'variableMode', 'promptConfig', 'defaultVariableValue', 'defaultApplianceObject', 'defaultTitleOverlay', 'defaultEnvironment', 'defaultMoodLighting', 'defaultColorMaterial', 'referenceImageUrl', 'resolution', 'thumbnailUrl', 'isPublic', 'requireApproval', 'fieldPermissions', 'tags', 'createdAt', 'author'];
const assetFields = ['id', 'templateId', 'templateName', 'prompt', 'model', 'imageUrl', 'aspectRatio', 'createdAt', 'timeAgo', 'likes', 'bookmarked', 'unitsUsed', 'creator', 'ownerUserId'];
const allowedImageHosts = () => new Set((process.env.REMOTE_IMAGE_HOSTS || 'images.unsplash.com').split(',').map(host => host.trim()).filter(Boolean));
export function safeImageUrl(value: unknown, allowData = false): string {
  const url = stringField(value, allowData ? 14 * 1024 * 1024 : 2048);
  if (allowData && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(url)) return url;
  if (/^\/uploads\/[\w-]+\.(png|jpg|jpeg|webp)$/.test(url)) return url;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new HttpError(400, 'Invalid image URL.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !allowedImageHosts().has(parsed.hostname)) throw new HttpError(400, 'Image source is not approved.');
  return parsed.href;
}
export function ensureImageAccess(url: string, user: Account, templates: ApplianceTemplate[] = []) {
  if (!url.startsWith('/uploads/')) return;
  if (getImageOwner(url.slice('/uploads/'.length)) === user.id) return;
  if (templates.some(t => canViewTemplate(t, user) && (t.thumbnailUrl === url || t.referenceImageUrl === url))) return;
  throw new HttpError(404, 'Image not found.');
}
export const canViewTemplate = (template: ApplianceTemplate, user: Account) => user.role === 'SUPER_ADMIN' || template.isPublic === true;
export const canViewAsset = (asset: GeneratedAsset, user: Account) => asset.ownerUserId === user.id;
export function validateTemplate(body: unknown): ApplianceTemplate {
  strictBody(body, templateFields);
  stringField(body.id, 150); stringField(body.name, 150); stringField(body.basePrompt, 20000);
  if (typeof body.isPublic !== 'boolean' || typeof body.requireApproval !== 'boolean') throw new HttpError(400, 'Invalid template visibility.');
  if (body.promptConfig) {
    strictBody(body.promptConfig, ['applianceObject', 'environmentPlace', 'moodLighting', 'colorMaterial', 'titleOverlay']);
    if (Object.values(body.promptConfig).some(v => typeof v !== 'string' || v.length > 20000)) throw new HttpError(400, 'Invalid prompt configuration.');
  }
  strictBody(body.fieldPermissions, ['text1', 'targetAudience', 'styleReferenceImg', 'applianceObject', 'environment', 'lighting']);
  if (Object.values(body.fieldPermissions).some(v => typeof v !== 'boolean')) throw new HttpError(400, 'Invalid field permissions.');
  if (!Array.isArray(body.tags) || body.tags.length > 30 || body.tags.some(tag => typeof tag !== 'string' || tag.length > 100)) throw new HttpError(400, 'Invalid template tags.');
  for (const [key, value] of Object.entries(body)) {
    if (['isPublic', 'requireApproval', 'fieldPermissions', 'promptConfig', 'tags'].includes(key) || value === undefined) continue;
    if (typeof value !== 'string' || value.length > 20000) throw new HttpError(400, 'Invalid template field.');
  }
  if (body.thumbnailUrl) safeImageUrl(body.thumbnailUrl);
  if (body.referenceImageUrl) safeImageUrl(body.referenceImageUrl);
  return body as unknown as ApplianceTemplate;
}
export function validateAsset(body: unknown, user: Account): GeneratedAsset {
  strictBody(body, assetFields);
  stringField(body.id, 150); stringField(body.prompt, 20000); stringField(body.model, 150); stringField(body.aspectRatio, 20);
  safeImageUrl(body.imageUrl);
  if (body.creator) strictBody(body.creator, ['name', 'email', 'role', 'avatar']);
  if (body.ownerUserId && body.ownerUserId !== user.id) throw new HttpError(400, 'Invalid asset owner.');
  return { id: body.id, templateId: typeof body.templateId === 'string' ? body.templateId : undefined,
    templateName: typeof body.templateName === 'string' ? body.templateName.slice(0, 150) : undefined,
    prompt: body.prompt, model: body.model, imageUrl: body.imageUrl, aspectRatio: body.aspectRatio,
    ownerUserId: user.id, creator: { name: user.displayName, email: user.email, role: user.role, avatar: '' },
    createdAt: new Date().toISOString(), timeAgo: 'Just now', likes: 0, bookmarked: false, unitsUsed: 1 };
}
export function sanitizeBackup(value: unknown): any {
  if (Array.isArray(value)) return value.map(sanitizeBackup);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/secret|password|token|api.?key|authorization|credential|session/i.test(key)).map(([key, item]) => [key, sanitizeBackup(item)]));
  if (typeof value === 'string') {
    for (const name of ['GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'DATABASE_URL']) {
      const secret = process.env[name];
      if (secret && secret.length >= 8) value = (value as string).split(secret).join('[redacted]');
    }
  }
  return value;
}
export function contentBackup(templates: ApplianceTemplate[], assets: GeneratedAsset[]) {
  const pick = (value: any, fields: string[]) => Object.fromEntries(fields.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
  return sanitizeBackup({ version: '3-content-only', exportedAt: new Date().toISOString(),
    templates: templates.map(t => pick(t, templateFields)), assets: assets.map(a => pick(a, assetFields)) });
}
