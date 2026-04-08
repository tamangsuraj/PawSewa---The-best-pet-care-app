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

  // If already authenticated, redirect to dashboard (must be before any conditional returns)
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex justify-center rounded-xl border border-[#5c2d12]/25 bg-[#faf8f5] p-3">
            <PawSewaLogoSpinner size={64} />
          </div>
          <p className="text-sm font-medium text-[#5c2d12]/80">Loading…</p>
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
      const message = err instanceof Error ? err.message : 'Invalid Admin Credentials';
      setSubmitError(message);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border-2 border-[#5c2d12]/35 bg-white p-8 shadow-[0_8px_30px_rgba(44,36,28,0.08)]">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center rounded-xl mb-4 border-2 border-[#5c2d12]/30 bg-[#faf8f5] px-4 py-3">
              <PawSewaLogo variant="nav" height={48} />
            </div>
            <h1 className="text-3xl font-bold text-[#3d1f0d] mb-2">Admin Portal</h1>
            <p className="text-[#5c2d12]/75">PawSewa Control Room</p>
          </div>

          {/* Error Alert */}
          {submitError && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{submitError}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#3d1f0d] mb-2">
                Admin Email
              </label>
              <input
                type="email"
                placeholder="admin@pawsewa.com"
                {...register('email')}
                className="w-full px-4 py-3 rounded-lg border-2 border-[#5c2d12]/35 bg-white text-[#2c1810] placeholder:text-[#5c2d12]/45 focus:outline-none focus:ring-2 focus:ring-[#5c2d12]/25 focus:border-[#5c2d12]"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-[#3d1f0d] mb-2">
                Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter admin password"
                {...register('password')}
                className="w-full px-4 py-3 rounded-lg border-2 border-[#5c2d12]/35 bg-white text-[#2c1810] placeholder:text-[#5c2d12]/45 focus:outline-none focus:ring-2 focus:ring-[#5c2d12]/25 focus:border-[#5c2d12] pr-12"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-11 text-[#5c2d12]/60 hover:text-[#3d1f0d]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg border-2 border-[#4a2510] bg-[#5c2d12] py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#4a2510] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
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

          {/* Security Notice */}
          <div className="mt-6 rounded-lg border-2 border-[#5c2d12]/25 bg-[#faf8f5] p-4">
            <p className="flex items-center justify-center gap-2 text-center text-xs text-[#5c2d12]/80">
              <Shield className="h-4 w-4 shrink-0 text-[#5c2d12]" />
              <span>Authorized Personnel Only — All Access Logged</span>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-[#5c2d12]/55">
          PawSewa Admin Portal (c) 2026
        </p>
      </div>
    </div>
  );
}
