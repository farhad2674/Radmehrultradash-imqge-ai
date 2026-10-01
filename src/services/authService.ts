import { PersonnelUser } from '../types';
let csrf = '';
export interface AuthSession { user: PersonnelUser; csrfToken: string }
export function clearBrowserAuth() {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of ['isAuthenticated', 'currentUserEmail', 'currentUserName', 'currentUserRole', 'currentUserDepartment', 'radmehrai_disk_templates', 'radmehrai_disk_assets', 'radmehrai_disk_users', 'radmehrai_disk_logs']) storage.removeItem(key);
  }
}
export function clearSession() { csrf = ''; clearBrowserAuth(); }
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase())) {
    headers.set('Content-Type', 'application/json');
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  const response = await fetch(input, { ...init, headers, credentials: 'same-origin' });
  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('session-expired'));
  }
  return response;
}
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
async function acceptSession(path: string, init?: RequestInit): Promise<AuthSession> {
  const session = await apiJson<AuthSession>(path, init);
  csrf = session.csrfToken;
  clearBrowserAuth();
  return session;
}
export const authService = {
  current: () => acceptSession('/api/auth/me'),
  login: (email: string, password: string) => acceptSession('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => acceptSession('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  async logout() { await apiJson('/api/auth/logout', { method: 'POST', body: '{}' }); clearSession(); },
  async changePassword(currentPassword: string, newPassword: string) {
    await apiJson('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    clearSession(); window.dispatchEvent(new Event('session-expired'));
  },
};
