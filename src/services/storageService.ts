import { ApplianceTemplate, GeneratedAsset, PersonnelUser, AuditLogEntry } from '../types';
import { apiJson, clearBrowserAuth } from './authService';
export interface StorageStats {
  storageType: string; status: string; dataDirectory?: string; uploadsDirectory?: string;
  imagesStored: number; imagesDiskSizeKB: number; databaseDiskSizeKB: number;
  templatesCount: number; assetsCount: number; usersCount: number; logsCount: number; serverTime?: string;
}
export interface InitialDataPayload {
  templates: ApplianceTemplate[]; assets: GeneratedAsset[]; users: PersonnelUser[]; auditLogs: AuditLogEntry[];
  settings?: { defaultLimit: number; workspaceName: string }; stats?: StorageStats;
}
const body = (value: unknown) => ({ method: 'POST', body: JSON.stringify(value) });
async function persistImage(value?: string): Promise<string | undefined> {
  if (!value?.startsWith('data:')) return value;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
  if (!match) throw new Error('Use PNG, JPEG, or WebP images.');
  return (await apiJson<{ imageUrl: string }>('/api/upload-image', body({ mimeType: match[1], base64Data: match[2] }))).imageUrl;
}
export const storageService = {
  async initStorage(): Promise<InitialDataPayload> { clearBrowserAuth(); return apiJson('/api/storage/init'); },
  async saveTemplate(value: ApplianceTemplate): Promise<ApplianceTemplate[]> { const template = { ...value, thumbnailUrl: await persistImage(value.thumbnailUrl), referenceImageUrl: await persistImage(value.referenceImageUrl) }; return (await apiJson<{templates: ApplianceTemplate[]}>('/api/templates', body(template))).templates; },
  async deleteTemplate(id: string): Promise<ApplianceTemplate[]> { return (await apiJson<{templates: ApplianceTemplate[]}>(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' })).templates; },
  async saveAsset(value: GeneratedAsset): Promise<GeneratedAsset[]> { return (await apiJson<{assets: GeneratedAsset[]}>('/api/assets', body(value))).assets; },
  async updateUserLimit(id: string, limit: number): Promise<PersonnelUser[]> { return (await apiJson<{users: PersonnelUser[]}>(`/api/users/${id}/limit`, { method: 'PUT', body: JSON.stringify({ limit }) })).users; },
  async resetUserUsage(id: string): Promise<PersonnelUser[]> { return (await apiJson<{users: PersonnelUser[]}>(`/api/users/${id}/reset`, body({}))).users; },
  async resetAllUsage(): Promise<PersonnelUser[]> { return (await apiJson<{users: PersonnelUser[]}>('/api/users/reset-all', body({}))).users; },
  getStorageStats: (): Promise<StorageStats> => apiJson('/api/storage/stats'),
  exportBackup: (): Promise<unknown> => apiJson('/api/storage/backup/export'),
  async importBackup(value: unknown): Promise<boolean> { await apiJson('/api/storage/backup/import', body(value)); return true; },
};
