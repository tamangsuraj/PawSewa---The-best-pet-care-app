'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';
import { PageShell } from '@/components/layout/PageShell';
import Link from 'next/link';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  // Login only checks presence; strength rules apply on register, not here.
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithToken, user, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  // Google Login Hook - MUST be called before any conditional returns
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      setFormError('');
      clearErrors();
      
      try {
        // Get user info from Google using access token
        const userInfoResponse = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );

        const googleUser = userInfoResponse.data;
        const displayName =
          googleUser.name?.trim() ||
          googleUser.email?.split('@')[0] ||
          'User';

        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/google`,
          {
            googleToken: tokenResponse.access_token,
            email: googleUser.email,
            name: displayName,
            googleId: googleUser.sub,
          }
        );

        if (response.data.success) {
          const { token, user: userData } = response.data.data;
          
          // Only allow pet_owner
          if (userData.role !== 'pet_owner') {
            setFormError('This is the customer website. Only pet owners can login here.');
            return;
          }

          // Update auth context + localStorage in one place
          loginWithToken({ token, ...userData });
          
          router.push('/dashboard');
        }
      } catch (err: any) {
        console.error('Google login error:', err);
        setFormError(err.response?.data?.message || 'Google login failed');
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      setFormError('Google login failed');
      setIsGoogleLoading(false);
    },
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <PawSewaLogoSpinner size={64} className="mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is logged in (will redirect)
  if (user) {
    return null;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setFormError('');
    try {
      await login(values.email, values.password);

      // Check user role after login
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);

        // Only allow pet_owner on customer website
        if (userData.role !== 'pet_owner') {
          // Clear the login
          localStorage.removeItem('token');
          localStorage.removeItem('user');

          // Show appropriate error message
          if (userData.role === 'admin') {
            setFormError(
              'Admin accounts cannot login here. Please use the Admin Panel at http://localhost:3002',
            );
          } else {
            setFormError(
              `This is the customer website. ${
                userData.role === 'veterinarian'
                  ? 'Veterinarians'
                  : userData.role === 'shop_owner'
                  ? 'Shop owners'
                  : userData.role === 'care_service'
                  ? 'Care service providers'
                  : 'Riders'
              } should use the Staff Mobile App.`,
            );
          }
          return;
        }
      }

      router.push('/dashboard');
    } catch (err: any) {
      setFormError(err.message || 'Login failed');
    }
  };

  return (
    <PageShell className="flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="paw-card-glass rounded-[1.5rem] p-8 sm:p-10 shadow-paw-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-5 rounded-2xl bg-white/80 px-5 py-4 border border-paw-bark/10 shadow-sm">
              <PawSewaLogo variant="nav" height={56} blendWhiteMatte />
            </div>
            <p className="paw-eyebrow-center text-[0.65rem] mb-3">Member access</p>
            <h2 className="font-display text-3xl sm:text-[2rem] font-semibold text-paw-ink tracking-tight mb-2">
              Welcome back
            </h2>
            <p className="text-paw-bark/70 text-sm">Sign in to your PawSewa home</p>
          </div>

          {formError && (
            <div className="mb-6 p-4 bg-red-50/90 border border-red-200/80 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Login Failed</p>
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                label="Email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                required
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[42px] text-gray-500 hover:text-paw-teal-mid transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-paw-bark focus:ring-paw-teal-mid rounded border-paw-bark/20"
                />
                <span className="text-gray-600">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-paw-teal-mid font-medium hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/90 text-paw-bark/50 font-medium tracking-widest">OR</span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={() => {
              clearErrors();
              handleGoogleLogin();
            }}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-full border-2 border-paw-bark/15 bg-white/90 hover:bg-white hover:border-paw-bark/25 shadow-sm transition-all disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <div className="w-5 h-5 border-2 border-paw-bark border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="w-5 h-5"
              />
            )}
            <span className="font-medium text-gray-700">Continue with Google</span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
          </div>

          {/* Register Link */}
          <p className="text-center text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="text-paw-teal-mid font-semibold hover:underline">
              Create one now
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-paw-bark/45 mt-8 tracking-wide">
          By continuing, you agree to PawSewa&apos;s{' '}
          <Link href="/terms" className="text-paw-teal-mid underline underline-offset-2">
            Terms
          </Link>{' '}
          &amp;{' '}
          <Link href="/privacy" className="text-paw-teal-mid underline underline-offset-2">
            Privacy
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
