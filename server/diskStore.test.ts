// @vitest-environment node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('diskStore', () => {
  let rootDir: string;
  let dataDir: string;
  let uploadsDir: string;
  const originalDataDir = process.env.DATA_DIR;
  const originalUploadsDir = process.env.UPLOADS_DIR;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'radmehr-disk-store-'));
    dataDir = path.join(rootDir, 'data');
    uploadsDir = path.join(rootDir, 'uploads');
    process.env.DATA_DIR = dataDir;
    process.env.UPLOADS_DIR = uploadsDir;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = originalUploadsDir;
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('initializes isolated JSON storage and characterizes template CRUD', async () => {
    const store = await import('./diskStore');
    store.initDiskStorage();

    expect(fs.existsSync(path.join(dataDir, 'templates.json'))).toBe(true);
    expect(fs.existsSync(uploadsDir)).toBe(true);
    expect(store.getTemplatesFromDisk()).toEqual([]);
    expect(store.getAssetsFromDisk()).toEqual([]);

    const template: import('../src/types').ApplianceTemplate = {
      id: 'template-1',
      name: 'Original',
      category: 'Smart Kitchen',
      model: 'nano-banana-2',
      description: 'Test template',
      basePrompt: '{{OBJECT}}',
      thumbnailUrl: '/test.png',
      isPublic: true,
      requireApproval: false,
      fieldPermissions: { text1: true, targetAudience: false, styleReferenceImg: false },
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      author: 'Test',
    };

    expect(store.saveTemplateToDisk(template)).toHaveLength(1);
    expect(store.saveTemplateToDisk({ ...template, name: 'Updated' })[0].name).toBe('Updated');
    expect(store.deleteTemplateFromDisk(template.id)).toEqual([]);
  });

  it('characterizes asset saving and user usage increment/reset', async () => {
    const store = await import('./diskStore');
    store.initDiskStorage();
    const user: import('../src/types').PersonnelUser = {
      id: 'user-1',
      name: 'User',
      email: 'user@example.com',
      role: 'Viewer',
      status: 'Active',
      avatar: '',
      lastActive: 'Now',
      generationLimit: 10,
      completedGenerations: 0,
    };
    const asset: import('../src/types').GeneratedAsset = {
      id: 'asset-1',
      prompt: 'Prompt',
      model: 'nano-banana-2',
      imageUrl: '/uploads/image.png',
      aspectRatio: '1:1',
      creator: { name: 'User', role: 'Viewer', email: user.email, avatar: '' },
      createdAt: '2026-01-01T00:00:00.000Z',
      timeAgo: 'Now',
      likes: 0,
      bookmarked: false,
      unitsUsed: 1,
    };

    store.saveUserToDisk(user);
    expect(store.saveAssetToDisk(asset)).toEqual([asset]);
    expect(store.incrementUserUsageOnDisk(user.email)[0].completedGenerations).toBe(1);
    expect(store.resetUserUsageOnDisk(user.id)[0].completedGenerations).toBe(0);
  });

  it('retains only the latest 500 audit entries', async () => {
    const store = await import('./diskStore');
    store.initDiskStorage();

    for (let index = 0; index < 505; index += 1) {
      store.appendLogToDisk({
        id: `log-${index}`,
        time: 'Now',
        timestamp: '2026-01-01T00:00:00.000Z',
        user: 'Test',
        action: 'Generated Image',
        type: 'Generated Image',
        details: 'Test',
      });
    }

    const logs = store.getLogsFromDisk();
    expect(logs).toHaveLength(500);
    expect(logs[0].id).toBe('log-504');
    expect(logs.at(-1)?.id).toBe('log-5');
  });

  it('exports only workspace content and ignores account fields', async () => {
    const store = await import('./diskStore'); store.initDiskStorage();
    const backup = store.exportFullBackup();
    expect(backup).toMatchObject({ version: '3-content-only', templates: [], assets: [] });
    expect(backup).not.toHaveProperty('users'); expect(backup).not.toHaveProperty('settings');
    expect(store.importFullBackup(backup)).toBe(true);
  });
  it('rejects a private data directory beneath uploads', async () => {
    process.env.DATA_DIR = path.join(uploadsDir, 'data');
    await expect(import('./diskStore')).rejects.toThrow('DATA_DIR must be separate');
  });
});
