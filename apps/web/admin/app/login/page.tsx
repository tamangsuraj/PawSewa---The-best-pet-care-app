'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

/** Brand brown — used for accents only; page stays light. */
const brown = {
  solid: '#5c2d12',
  dark: '#4a2510',
  muted: '#6b4423',
};

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-stone-100 to-white">
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex justify-center rounded-2xl border p-4 shadow-sm"
            style={{ borderColor: `${brown.solid}33`, backgroundColor: '#fff' }}
          >
            <PawSewaLogoSpinner size={64} />
          </div>
          <p className="text-stone-600 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError('');
    try {
      await login(values.email, values.password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      console.error('Login error:', err);
      const msg = err instanceof Error ? err.message : 'Invalid Admin Credentials';
      setSubmitError(msg);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b from-stone-100 via-white to-stone-50 p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* White card + brown accents */}
        <div
          className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-black/5"
          style={{ boxShadow: '0 25px 50px -12px rgba(92, 45, 18, 0.12)' }}
        >
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center rounded-2xl mb-5 border px-5 py-3.5 bg-stone-50/80"
              style={{ borderColor: `${brown.solid}2e` }}
            >
              <PawSewaLogo variant="nav" height={48} />
            </div>
            <h1
              className="text-3xl font-bold tracking-tight mb-2"
              style={{ color: brown.dark }}
            >
              Admin Portal
            </h1>
            <p className="text-stone-600 text-sm sm:text-base">PawSewa Control Room</p>
          </div>

          {submitError && (
            <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-800">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-sm font-medium text-stone-700 mb-2"
              >
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                placeholder="admin@pawsewa.com"
                autoComplete="email"
                {...register('email')}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5c2d12]/25 focus:border-[#5c2d12] transition-shadow"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="relative">
              <label
                htmlFor="admin-password"
                className="block text-sm font-medium text-stone-700 mb-2"
              >
                Password
              </label>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter admin password"
                autoComplete="current-password"
                {...register('password')}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5c2d12]/25 focus:border-[#5c2d12]"
              />
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[2.375rem] text-stone-500 hover:text-stone-800 p-1 rounded-md"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" style={{ color: brown.muted }} />
                ) : (
                  <Eye className="w-5 h-5" style={{ color: brown.muted }} />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#5c2d12] hover:bg-[#4a2510] text-white py-3.5 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Access Control Room</span>
                </>
              )}
            </button>
          </form>

          <div
            className="mt-6 p-4 rounded-xl border flex items-center justify-center gap-2 text-center"
            style={{
              backgroundColor: '#faf8f5',
              borderColor: `${brown.solid}25`,
            }}
          >
            <Shield className="w-4 h-4 flex-shrink-0" style={{ color: brown.solid }} />
            <p className="text-xs text-stone-600 leading-snug">
              Authorized personnel only — all access logged
            </p>
          </div>
        </div>

        <p className="text-center text-stone-500 text-sm mt-8">
          PawSewa Admin Portal © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
