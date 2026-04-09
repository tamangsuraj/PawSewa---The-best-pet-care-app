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
/**
 * Ngrok free tier may return an HTML interstitial unless this header is sent.
 * Only applies when the configured API base URL is an Ngrok host (not localhost).
 */
export function isAdminApiUsingNgrok(): boolean {
  const base = getAdminApiBaseUrl().toLowerCase();
  return base.includes('ngrok');
}

/** ngrok-skip-browser-warning: only for Ngrok API URLs (matches backend CORS allowlist). */
export function getNgrokBrowserBypassHeaders(): Record<string, string> {
  if (!isAdminApiUsingNgrok()) return {};
  return { 'ngrok-skip-browser-warning': 'true' };
}

/**
 * Dev-only: warn if NEXT_PUBLIC_API_URL points at Ngrok but is missing /api/v1 suffix.
 */
export function warnIfNgrokApiUrlMisconfigured(): void {
  if (process.env.NODE_ENV !== 'development') return;
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return;
  if (!raw.toLowerCase().includes('ngrok')) return;
  const normalized = raw.replace(/\/+$/, '');
  if (!normalized.endsWith('/api/v1')) {
    console.warn(
      '[PawSewa Admin] NEXT_PUBLIC_API_URL should end with /api/v1 and match your tunnel (e.g. https://xxx.ngrok-free.dev/api/v1).',
    );
  }
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
