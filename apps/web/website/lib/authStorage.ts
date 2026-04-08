export const AUTH_TOKEN_KEY = 'token';
export const AUTH_USER_KEY = 'user';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const t = localStorage.getItem(AUTH_TOKEN_KEY);
  const token = typeof t === 'string' ? t.trim() : '';
  return token && token !== 'undefined' && token !== 'null' ? token : null;
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

