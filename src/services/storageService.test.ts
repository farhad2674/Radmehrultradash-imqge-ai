import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storageService } from './storageService';
import { authService, clearSession } from './authService';
const response = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value }) as Response;
beforeEach(() => { clearSession(); vi.stubGlobal('fetch', vi.fn()); });
describe('server-backed storage', () => {
  it('loads permitted data without persistent browser caches', async () => {
    const payload = { templates: [], assets: [], users: [], auditLogs: [] };
    localStorage.setItem('radmehrai_disk_users', '[{"role":"Admin"}]');
    vi.mocked(fetch).mockResolvedValue(response(payload));
    expect(await storageService.initStorage()).toEqual(payload);
    expect(localStorage.length).toBe(0);
  });
  it('fails closed on offline or unauthorized responses', async () => {
    localStorage.setItem('isAuthenticated', 'true');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({ error: 'Authentication required.' }, 401));
    await expect(storageService.initStorage()).rejects.toThrow('offline');
    await expect(storageService.initStorage()).rejects.toThrow('Authentication required.');
    expect(localStorage.length).toBe(0);
  });
  it('uses same-origin cookies and an in-memory CSRF token for mutations', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ user: { id: 'u' }, csrfToken: 'csrf-test' })).mockResolvedValueOnce(response({ templates: [] }));
    await authService.current();
    await storageService.deleteTemplate('template/with space');
    const [url, options] = vi.mocked(fetch).mock.calls[1];
    expect(url).toBe('/api/templates/template%2Fwith%20space');
    expect(options.credentials).toBe('same-origin');
    expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('csrf-test');
    expect(localStorage.length).toBe(0);
  });
  it('reports failed mutations instead of pretending to save', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ error: 'Administrator permission required.' }, 403));
    await expect(storageService.saveTemplate({ id: 'x' } as never)).rejects.toThrow('Administrator permission required.');
  });
});
