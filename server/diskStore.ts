import 'dotenv/config';
import fs from 'fs';
import { contentBackup } from './contentSecurity';
import { randomUUID } from 'node:crypto';
import path from 'path';
import { ApplianceTemplate, GeneratedAsset, PersonnelUser, AuditLogEntry } from '../src/types';
import { INITIAL_TEMPLATES, INITIAL_ASSETS, INITIAL_USERS, INITIAL_AUDIT_LOGS } from '../src/data/initialData';

import { getDataDir, getUploadsDir } from './storagePaths';
export { getDataDir, getUploadsDir } from './storagePaths';

const DATA_DIR = getDataDir();
const UPLOADS_DIR = getUploadsDir();

// File paths
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const ASSETS_FILE = path.join(DATA_DIR, 'assets.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure directories exist
export function initDiskStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
      console.log(`[DiskStorage] Created data directory at: ${DATA_DIR}`);
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      console.log(`[DiskStorage] Created uploads directory at: ${UPLOADS_DIR}`);
    }

    // Seed default files if they don't exist
    if (!fs.existsSync(TEMPLATES_FILE)) {
      writeJsonFile(TEMPLATES_FILE, INITIAL_TEMPLATES);
    }
    if (!fs.existsSync(ASSETS_FILE)) {
      writeJsonFile(ASSETS_FILE, INITIAL_ASSETS);
    }
    if (!fs.existsSync(USERS_FILE)) {
      writeJsonFile(USERS_FILE, INITIAL_USERS);
    }
    if (!fs.existsSync(LOGS_FILE)) {
      writeJsonFile(LOGS_FILE, INITIAL_AUDIT_LOGS);
    }
    if (!fs.existsSync(SETTINGS_FILE)) {
      writeJsonFile(SETTINGS_FILE, { defaultLimit: 0, workspaceName: 'RadmehrAI Appliance Studio' });
    }

  } catch (err) {
    throw new Error('Unable to initialize private storage.', { cause: err });
  }
}

// Generic safe JSON read
function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch (e) {
    throw new Error('Unable to read private storage.', { cause: e });
  }
  return fallback;
}

// Generic safe JSON write
function writeJsonFile<T>(filePath: string, data: T): boolean {
  try {
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(temporary, filePath);
    return true;
  } catch (e) {
    throw new Error('Unable to write private storage.', { cause: e });
  }
}

// --- TEMPLATES CRUD ---
export function getTemplatesFromDisk(): ApplianceTemplate[] {
  return readJsonFile<ApplianceTemplate[]>(TEMPLATES_FILE, INITIAL_TEMPLATES);
}

export function saveTemplateToDisk(template: ApplianceTemplate): ApplianceTemplate[] {
  const current = getTemplatesFromDisk();
  const existingIdx = current.findIndex((t) => t.id === template.id);
  let updated: ApplianceTemplate[];
  if (existingIdx >= 0) {
    updated = current.map((t) => (t.id === template.id ? template : t));
  } else {
    updated = [template, ...current];
  }
  writeJsonFile(TEMPLATES_FILE, updated);
  return updated;
}

export function deleteTemplateFromDisk(templateId: string): ApplianceTemplate[] {
  const current = getTemplatesFromDisk();
  const updated = current.filter((t) => t.id !== templateId);
  writeJsonFile(TEMPLATES_FILE, updated);
  return updated;
}

// --- ASSETS CRUD ---
export function getAssetsFromDisk(): GeneratedAsset[] {
  return readJsonFile<GeneratedAsset[]>(ASSETS_FILE, INITIAL_ASSETS);
}

export function saveAssetToDisk(asset: GeneratedAsset): GeneratedAsset[] {
  const current = getAssetsFromDisk();
  const updated = [asset, ...current];
  writeJsonFile(ASSETS_FILE, updated);
  return updated;
}

export function deleteAssetFromDisk(assetId: string): GeneratedAsset[] {
  const current = getAssetsFromDisk();
  const updated = current.filter((a) => a.id !== assetId);
  writeJsonFile(ASSETS_FILE, updated);
  return updated;
}

// --- USERS & LIMITS CRUD ---
export function getUsersFromDisk(): PersonnelUser[] {
  return readJsonFile<PersonnelUser[]>(USERS_FILE, INITIAL_USERS);
}

export function saveUserToDisk(user: PersonnelUser): PersonnelUser[] {
  const current = getUsersFromDisk();
  const existingIdx = current.findIndex((u) => u.id === user.id);
  let updated: PersonnelUser[];
  if (existingIdx >= 0) {
    updated = current.map((u) => (u.id === user.id ? user : u));
  } else {
    updated = [user, ...current];
  }
  writeJsonFile(USERS_FILE, updated);
  return updated;
}

export function updateUserLimitOnDisk(userId: string, limit: number, allowUnlimited?: boolean): PersonnelUser[] {
  const current = getUsersFromDisk();
  const updated = current.map((u) => 
    u.id === userId ? { ...u, generationLimit: limit, allowUnlimited: !!allowUnlimited } : u
  );
  writeJsonFile(USERS_FILE, updated);
  return updated;
}

export function incrementUserUsageOnDisk(userEmailOrId: string): PersonnelUser[] {
  const current = getUsersFromDisk();
  const updated = current.map((u) => {
    if (u.email === userEmailOrId || u.id === userEmailOrId) {
      return {
        ...u,
        completedGenerations: (u.completedGenerations || 0) + 1,
        lastActive: 'Just now',
      };
    }
    return u;
  });
  writeJsonFile(USERS_FILE, updated);
  return updated;
}

export function resetUserUsageOnDisk(userId: string): PersonnelUser[] {
  const current = getUsersFromDisk();
  const updated = current.map((u) => (u.id === userId ? { ...u, completedGenerations: 0 } : u));
  writeJsonFile(USERS_FILE, updated);
  return updated;
}

export function batchResetAllUsageOnDisk(): PersonnelUser[] {
  const current = getUsersFromDisk();
  const updated = current.map((u) => ({ ...u, completedGenerations: 0 }));
  writeJsonFile(USERS_FILE, updated);
  return updated;
}

// --- AUDIT LOGS ---
export function getLogsFromDisk(): AuditLogEntry[] {
  return readJsonFile<AuditLogEntry[]>(LOGS_FILE, INITIAL_AUDIT_LOGS);
}

export function appendLogToDisk(log: AuditLogEntry): AuditLogEntry[] {
  const current = getLogsFromDisk();
  const updated = [log, ...current.slice(0, 499)]; // retain last 500 logs
  writeJsonFile(LOGS_FILE, updated);
  return updated;
}

// --- SETTINGS ---
export function getSettingsFromDisk(): { defaultLimit: number; workspaceName: string } {
  return readJsonFile(SETTINGS_FILE, { defaultLimit: 50, workspaceName: 'RadmehrAI Appliance Studio' });
}

export function saveSettingsToDisk(settings: { defaultLimit: number; workspaceName: string }) {
  writeJsonFile(SETTINGS_FILE, settings);
  return settings;
}

// --- IMAGE SAVING TO DISK ---
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_OWNERS_FILE = path.join(DATA_DIR, 'image-owners.json');
export function getImageOwner(filename: string): string | undefined {
  return readJsonFile<Record<string, string>>(IMAGE_OWNERS_FILE, {})[filename];
}
export function saveImageBase64ToDisk(base64Data: string, mimeType = 'image/png', ownerUserId?: string): string {
  const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  const ext = extensions[mimeType];
  if (!ext || typeof base64Data !== 'string') throw new Error('Unsupported image.');
  const clean = base64Data.replace(/^data:image\/[\w+.-]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean) || clean.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4) throw new Error('Invalid image data.');
  const buffer = Buffer.from(clean, 'base64');
  const valid = ext === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
    ext === 'jpg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 :
    buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (!valid || buffer.length > MAX_IMAGE_BYTES) throw new Error('Invalid image data.');
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `img_${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer, { mode: 0o600 });
  if (ownerUserId) {
    const owners = readJsonFile<Record<string, string>>(IMAGE_OWNERS_FILE, {});
    writeJsonFile(IMAGE_OWNERS_FILE, { ...owners, [filename]: ownerUserId });
  }
  return `/uploads/${filename}`;
}

// --- DISK USAGE & STATS ---
export function getStorageStats() {
  try {
    let imagesCount = 0;
    let imagesTotalBytes = 0;
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      imagesCount = files.length;
      for (const file of files) {
        const stats = fs.statSync(path.join(UPLOADS_DIR, file));
        imagesTotalBytes += stats.size;
      }
    }

    let dbTotalBytes = 0;
    const dbFiles = [TEMPLATES_FILE, ASSETS_FILE, USERS_FILE, LOGS_FILE, SETTINGS_FILE];
    for (const f of dbFiles) {
      if (fs.existsSync(f)) {
        dbTotalBytes += fs.statSync(f).size;
      }
    }

    return {
      storageType: 'Node.js Local Disk & File-Store (Parspack PaaS Optimized)',
      status: 'ONLINE',
      dataDirectory: DATA_DIR,
      uploadsDirectory: UPLOADS_DIR,
      imagesStored: imagesCount,
      imagesDiskSizeKB: Math.round(imagesTotalBytes / 1024),
      databaseDiskSizeKB: Math.round(dbTotalBytes / 1024),
      templatesCount: getTemplatesFromDisk().length,
      assetsCount: getAssetsFromDisk().length,
      usersCount: getUsersFromDisk().length,
      logsCount: getLogsFromDisk().length,
      serverTime: new Date().toISOString(),
    };
  } catch (e) {
    return {
      storageType: 'Node.js Local Disk',
      status: 'PARTIAL',
      imagesStored: 0,
      imagesDiskSizeKB: 0,
      databaseDiskSizeKB: 0,
    };
  }
}

// --- FULL BACKUP EXPORT & IMPORT ---
// Content-only backups never include accounts, sessions, password hashes, tokens, or provider configuration.
export function exportFullBackup() {
  return contentBackup(getTemplatesFromDisk(), getAssetsFromDisk());
}
export function importFullBackup(backupData: { templates?: ApplianceTemplate[]; assets?: GeneratedAsset[] }): boolean {
  if (backupData.templates) writeJsonFile(TEMPLATES_FILE, backupData.templates);
  if (backupData.assets) writeJsonFile(ASSETS_FILE, backupData.assets);
  return true;
}
