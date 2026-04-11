import { getWebsiteApiBase } from './apiEnv';

/** Socket.io origin: same host as REST, without `/api/v1` (matches mobile ApiConfig socket URL). */
export function getSocketUrlFromApiBase(): string {
  const raw = getWebsiteApiBase();
  const u = raw.replace(/\/$/, '');
  return u.replace(/\/api\/v1$/i, '');
}

export function apiBaseIncludesNgrok(): boolean {
  const raw = getWebsiteApiBase().toLowerCase();
  return raw.includes('ngrok');
}
