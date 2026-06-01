'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { PageShell } from '@/components/layout/PageShell';
import { PawSewaLogo } from '@/components/PawSewaLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: trimmed });
      setSent(true);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        ax.response?.data?.message ?? ax.message ?? 'Could not send reset email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell className="flex min-h-dvh flex-col items-center justify-center bg-[#f3ebe2]/40">
      <div className="w-full max-w-md px-4 py-10">
        <div className="mb-8 flex flex-col items-center gap-2">
          <PawSewaLogo variant="nav" height={44} />
          <h1 className="mt-2 font-display text-2xl font-semibold text-[#2c241c]">
            {sent ? 'Check your inbox' : 'Reset your password'}
          </h1>
          <p className="text-sm text-[#2c241c]/60">
            {sent
              ? `We sent a reset link to ${email}`
              : 'Enter your email and we\'ll send a reset link.'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#703418]/10 bg-white p-8 shadow-sm">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-sm text-[#2c241c]/70">
                Check your email for the reset link. It may take a minute to arrive.
              </p>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(''); }}
                className="mt-2 text-sm font-semibold text-[#703418] underline-offset-2 hover:underline"
              >
                Try a different address
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2c241c]">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#703418]/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full rounded-xl border-2 border-transparent bg-[#f3ebe2]/70 py-3 pl-10 pr-4 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-[#703418]/40 focus:border-[#703418] focus:ring-2 focus:ring-[#703418]/20"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#703418] py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#5c2c14] disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#703418] underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
