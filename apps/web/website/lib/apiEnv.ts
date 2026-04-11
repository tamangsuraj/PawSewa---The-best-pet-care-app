/** Public REST API base (must include `/api/v1`). Prefer ngrok/deployed URL for cross-network access. */
export function getWebsiteApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'development') {
    const dev = process.env.NEXT_PUBLIC_DEV_API_BASE_URL?.trim();
    if (dev) return dev.replace(/\/+$/, '');
  }
  return '';
}

export const ngrokBrowserBypassHeaders: Record<string, string> = {
  'ngrok-skip-browser-warning': 'true',
};
