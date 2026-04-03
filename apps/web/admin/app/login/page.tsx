'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-[#5c2d12]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex justify-center rounded-xl bg-white/10 p-3 border border-white/20">
            <PawSewaLogoSpinner size={64} imageClassName="brightness-0 invert" />
          </div>
          <p className="text-white/80">Loading...</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError('');
    try {
      await login(values.email, values.password);
      router.replace('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setSubmitError(err.message || 'Invalid Admin Credentials');
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#5c2d12] p-4">
      <div className="w-full max-w-md">
        {/* Login Card - darker brown card on brown background */}
        <div className="bg-[#4a2510] rounded-2xl shadow-2xl p-8 border border-[#6b3d1a]">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center rounded-xl bg-white/10 mb-4 border border-white/30 px-4 py-3">
              <PawSewaLogo variant="nav" height={48} className="brightness-0 invert" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
            <p className="text-white/80">PawSewa Control Room</p>
          </div>

          {/* Error Alert */}
          {submitError && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-400/50 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-200">{submitError}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Admin Email
              </label>
              <input
                type="email"
                placeholder="admin@pawsewa.com"
                {...register('email')}
                className="w-full px-4 py-3 bg-[#3d1f0d] border border-[#6b3d1a] rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-300">{errors.email.message}</p>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter admin password"
                {...register('password')}
                className="w-full px-4 py-3 bg-[#3d1f0d] border border-[#6b3d1a] rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 pr-12"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-300">{errors.password.message}</p>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-11 text-white/70 hover:text-white"
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
              className="w-full bg-[#703418] text-white py-3 rounded-lg font-semibold hover:bg-[#85471f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 border border-white/20"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Authenticating...</span>
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
          <div className="mt-6 p-4 bg-[#3d1f0d]/80 rounded-lg border border-[#6b3d1a]">
            <p className="text-xs text-white/70 text-center flex items-center justify-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Authorized Personnel Only - All Access Logged</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-sm mt-6">
          PawSewa Admin Portal © 2026
        </p>
      </div>
    </div>
  );
}
