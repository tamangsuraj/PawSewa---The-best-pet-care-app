/**
 * Single source of truth for admin → Node API wiring.
 * Backend default port is 3000; REST prefix is /api/v1 (not :5000, not /api alone).
 */
function trimSlash(s: string) {
  return s.replace(/\/+$/, '');
}

/**
 * REST base URL, e.g. http://localhost:3000/api/v1
 * In production, NEXT_PUBLIC_API_URL must be set (deployed or ngrok URL + /api/v1).
 */
export function getAdminApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return trimSlash(raw);
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000/api/v1';
  }
  return '';
}

/**
 * Socket.io origin (no path). Prefer NEXT_PUBLIC_SOCKET_URL; else derive from API URL host.
 */
/** ngrok free tier may return an HTML interstitial unless this header is sent. */
export function getNgrokBrowserBypassHeaders(): Record<string, string> {
  const base = getAdminApiBaseUrl().toLowerCase();
  if (base.includes('ngrok')) {
    return { 'ngrok-skip-browser-warning': 'true' };
  }
  return {};
}

export function getAdminSocketUrl(): string {
  const socketEnv = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (socketEnv) return trimSlash(socketEnv);

  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) {
    try {
      const u = new URL(api);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'http://localhost:3000';
}
