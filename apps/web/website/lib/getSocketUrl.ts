import { getWebsiteApiBase, getWebsiteSocketUrl, websiteApiUsesNgrokProxy } from './apiEnv';

/** Socket.io origin: same host as REST, without `/api/v1` (matches mobile ApiConfig socket URL). */
export function getSocketUrlFromApiBase(): string {
  const direct = getWebsiteSocketUrl();
  if (direct) return direct;
  const raw = getWebsiteApiBase().replace(/\/$/, '');
  if (!raw || raw === '/api/v1') return '';
  return raw.replace(/\/api\/v1$/i, '');
}

export function apiBaseIncludesNgrok(): boolean {
  return websiteApiUsesNgrokProxy();
}
