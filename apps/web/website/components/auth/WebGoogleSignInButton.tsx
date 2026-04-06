'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

type Props = {
  onError: (message: string) => void;
  clearOtherErrors?: () => void;
};

/**
 * Must render only when wrapped by GoogleOAuthProvider (see OptionalGoogleOAuthProvider + isGoogleSignInConfigured).
 */
export function WebGoogleSignInButton({ onError, clearOtherErrors }: Props) {
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      onError('');
      clearOtherErrors?.();

      try {
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });

        const googleUser = userInfoResponse.data;
        const displayName =
          googleUser.name?.trim() || googleUser.email?.split('@')[0] || 'User';

        const base = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await axios.post(`${base}/auth/google`, {
          googleToken: tokenResponse.access_token,
          email: googleUser.email,
          name: displayName,
          googleId: googleUser.sub,
        });

        if (response.data.success) {
          const { token, user: userData } = response.data.data;
          if (userData.role !== 'pet_owner') {
            onError('This is the customer website. Only pet owners can sign in here.');
            return;
          }
          loginWithToken({ token, ...userData });
          router.push('/dashboard');
        }
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { message?: string } } };
        onError(ax.response?.data?.message || 'Google sign-in failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      onError('Google sign-in failed');
      setLoading(false);
    },
  });

  return (
    <button
      type="button"
      onClick={() => {
        clearOtherErrors?.();
        handleGoogleLogin();
      }}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[#703418]/20 bg-white/90 px-4 py-3.5 shadow-sm transition-all hover:border-[#703418]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2 disabled:opacity-50"
    >
      {loading ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#703418] border-t-transparent" />
      ) : (
        <Image
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt=""
          width={20}
          height={20}
          className="h-5 w-5"
        />
      )}
      <span className="font-medium text-[#2c241c]">Continue with Google</span>
    </button>
  );
}
