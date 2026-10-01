import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';
afterEach(cleanup);
vi.mock('./components/ApplianceParticleMorphCanvas', () => ({ ApplianceParticleMorphCanvas: () => null }));
it('ignores forged browser authentication, roles, and cached personnel', async () => {
  localStorage.setItem('isAuthenticated', 'true'); localStorage.setItem('currentUserRole', 'Admin');
  localStorage.setItem('currentUserEmail', 'farhad@example.test');
  localStorage.setItem('radmehrai_disk_users', '[{"role":"Admin"}]');
  sessionStorage.setItem('isAuthenticated', 'true');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false, json: async () => ({ error: 'Authentication required.' }) }));
  render(<App />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in to RadmehrAI' })).toBeVisible());
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('shows the server identity and hides admin tools for an ordinary user', async () => {
  const user = { id: 'user-1', name: 'Test Member', email: 'member@example.test', role: 'Viewer', status: 'Active', generationLimit: 0, completedGenerations: 0, apiAccess: false };
  localStorage.setItem('currentUserRole', 'Admin');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ user, csrfToken: 'csrf' }) }).mockResolvedValue({ status: 200, ok: true, json: async () => ({ templates: [], assets: [], users: [user], auditLogs: [] }) }));
  render(<App />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Available Templates' })).toBeVisible());
  expect(screen.queryByRole('button', { name: 'User Management' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Create New Template' })).toBeNull();
  expect(screen.queryByText('Enterprise AI Admin')).toBeNull();
  expect(screen.getAllByText('member@example.test').length).toBeGreaterThan(0);
});
