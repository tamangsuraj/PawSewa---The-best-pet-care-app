'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';
import { MailCheck } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';

export const dynamic = 'force-dynamic';

export default function VerifyOTPPage() {
  const router = useRouter();
  const { loginWithToken } = useAuth();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
    } else {
      router.push('/register');
    }
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/users/verify-otp', {
        email,
        otp,
      });

      if (response.data.success) {
        setSuccess('Email verified successfully! Redirecting to dashboard...');

        const userData = response.data.data;
        loginWithToken(userData);

        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setResending(true);

    try {
      const response = await api.post('/users/resend-otp', {
        email,
      });

      if (response.data.success) {
        setSuccess('New verification code sent to your email!');
        setOtp('');
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <PageShell className="flex min-h-screen items-center justify-center">
      <PageContent compact className="max-w-md py-10">
      <div className="paw-surface-card w-full p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-paw-teal/10 text-paw-teal-mid">
            <MailCheck className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          </div>
          <p className="paw-eyebrow-center mb-2">Almost there</p>
          <h1 className="font-display text-3xl font-semibold text-paw-ink tracking-tight mb-2">
            Verify your email
          </h1>
          <p className="text-paw-bark/70 text-sm">We sent a 6-digit code to</p>
          <p className="text-paw-bark font-semibold mt-1">{email}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl mb-4 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl mb-4 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-paw-bark/80 mb-2">
              Verification code
            </label>
            <Input
              id="otp"
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              required
              className="text-center text-2xl tracking-[0.35em] font-semibold"
            />
            <p className="text-xs text-paw-bark/50 mt-2">Code expires in 10 minutes</p>
          </div>

          <Button type="submit" disabled={loading || otp.length !== 6} className="w-full" variant="primary">
            {loading ? 'Verifying...' : 'Verify email'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-paw-bark/60 mb-2">Didn&apos;t receive the code?</p>
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={resending}
            className="text-paw-teal-mid hover:text-paw-teal font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend code'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-sm text-paw-bark/60 hover:text-paw-bark transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
      </PageContent>
    </PageShell>
  );
}
