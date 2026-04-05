'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();

type Props = { children: React.ReactNode };

/**
 * Wraps with GoogleOAuthProvider only when a web client ID is configured.
 * Avoids runtime errors from an empty clientId during local dev.
 */
export function OptionalGoogleOAuthProvider({ children }: Props) {
  if (!clientId) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn(
        '[PawSewa] NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset — set it to your Web OAuth client ID (same project as backend GOOGLE_CLIENT_ID).'
      );
    }
    return <>{children}</>;
  }
  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(clientId);
}
