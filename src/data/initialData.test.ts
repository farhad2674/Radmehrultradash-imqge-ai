import { describe, expect, it } from 'vitest';
import templates from '../../data/templates.json';
import {
  INITIAL_ASSETS,
  INITIAL_AUDIT_LOGS,
  INITIAL_TEMPLATES,
  INITIAL_USERS,
} from './initialData';

describe('initial application data', () => {
  it('keeps empty collection fallbacks for templates, assets, and audit logs', () => {
    expect(INITIAL_TEMPLATES).toEqual([]);
    expect(INITIAL_ASSETS).toEqual([]);
    expect(INITIAL_AUDIT_LOGS).toEqual([]);
  });

  it('keeps the existing seed user domain shape', () => {
    expect(INITIAL_USERS).toHaveLength(1);
    expect(INITIAL_USERS[0]).toMatchObject({
      id: 'user-farhad',
      role: 'Admin',
      status: 'Active',
      generationLimit: 50,
      completedGenerations: 24,
      allowUnlimited: false,
    });
  });

  it('keeps checked-in template IDs unique and essential fields valid', () => {
    const ids = new Set<string>();
    for (const template of templates) {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.category).toBeTruthy();
      expect(template.basePrompt).toBeTruthy();
      expect(template.thumbnailUrl).toBeTruthy();
      expect(ids.has(template.id)).toBe(false);
      ids.add(template.id);
    }
  });
});
