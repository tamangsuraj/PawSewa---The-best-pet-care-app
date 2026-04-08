export const ADMIN_TOKEN_KEY = 'admin-token';
export const ADMIN_USER_KEY = 'admin-user';

export function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ADMIN_TOKEN_KEY);
  const token = typeof raw === 'string' ? raw.trim() : '';
  return token && token !== 'undefined' && token !== 'null' ? token : null;
}

export function clearStoredAdminAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export function getStoredAdminUser<T = unknown>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

