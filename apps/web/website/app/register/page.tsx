'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';
import { PageShell } from '@/components/layout/PageShell';
import Link from 'next/link';
import Image from 'next/image';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const registerSchema = z
  .object({
    name: z.string().min(1, 'Full name is required'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /[^A-Za-z0-9]/,
        'Password must include at least one special character',
      ),
    confirmPassword: z.string(),
    phone: z
      .string()
      .optional()
      .transform((val) => (val ?? '').trim())
      .refine(
        (val) => !val || /^\d{10}$/.test(val),
        'Phone number must be exactly 10 digits',
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { loginWithToken, user, isLoading: authLoading } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });

  // Google Login Hook - MUST be called before any conditional returns
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      setError('');
      clearErrors();

      try {
        // Get user info from Google using access token
        const userInfoResponse = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );

        const googleUser = userInfoResponse.data;

        // Send user info to backend
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
            setError('This is the customer website. Only pet owners can register here.');
            return;
          }

          loginWithToken({ token, ...userData });

          router.push('/dashboard');
        }
      } catch (err: unknown) {
        console.error('Google sign-up error:', err);
        const ax = err as { response?: { data?: { message?: string } } };
        setError(ax.response?.data?.message || 'Google sign-up failed');
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      setError('Google sign-up failed');
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

  const onSubmit = async (values: RegisterFormValues) => {
    setError('');
    setIsLoading(true);

    try {
      // Call the API directly instead of using register from context
      // because we need to redirect to OTP verification, not dashboard
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          phone: values.phone,
          role: 'pet_owner', // Force pet_owner role
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Redirect to OTP verification page with email
      router.push(`/verify-otp?email=${encodeURIComponent(values.email)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageShell className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[46%] relative items-center justify-center p-12 overflow-hidden bg-gradient-to-br from-paw-bark via-paw-ink to-paw-umber">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_30%,rgba(13,148,136,0.22),transparent_55%)]"
          aria-hidden
        />
        <div className="relative text-center text-paw-cream max-w-md paw-hero-stagger flex flex-col items-center gap-0">
          <div className="mx-auto mb-8 flex justify-center px-4 py-2 bg-transparent">
            <PawSewaLogo variant="hero" height={100} />
          </div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-paw-cream/75 mb-2">
            PawSewa · pet care
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight mb-4">
            Welcome to PawSewa
          </h1>
          <p className="text-lg text-paw-cream/85 leading-relaxed font-sans">
            Clinical rigor and editorial warmth — one home for every companion.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-[54%] flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <p className="paw-eyebrow-center mb-3">Create account</p>
            <h2 className="font-display text-3xl font-semibold text-paw-ink tracking-tight mb-2">
              Join the family
            </h2>
            <p className="text-paw-bark/70 text-sm">Profiles, shop, and vets — unified.</p>
          </div>

          <div className="paw-surface-card p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50/90 border border-red-200/80 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Registration Failed</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                label="Full Name"
                type="text"
                placeholder="John Doe"
                {...registerField('name')}
                required
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Input
                label="Email"
                type="email"
                placeholder="john@example.com"
                {...registerField('email')}
                required
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                {...registerField('password')}
                required
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                {...registerField('confirmPassword')}
                required
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div>
              <Input
                label="Phone (Optional)"
                type="tel"
                placeholder="9876543210 (10 digits)"
                {...registerField('phone')}
                maxLength={10}
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading || isSubmitting}
            >
              {isLoading || isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-paw-cream/90 text-paw-bark/50 font-medium tracking-widest">OR</span>
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
              <Image
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                width={20}
                height={20}
                className="h-5 w-5"
              />
            )}
            <span className="font-medium text-gray-700">Continue with Google</span>
          </button>

          <p className="mt-6 text-center text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-paw-teal-mid font-semibold hover:underline">
              Login here
            </Link>
          </p>

          {/* Vet Contact Note */}
          <div className="mt-4 p-4 bg-paw-sand/50 rounded-2xl border border-paw-bark/8 text-center">
            <p className="text-sm text-paw-bark/80">
              Are you a Vet?{' '}
              <Link href="/contact" className="text-paw-teal-mid font-semibold hover:underline">
                Contact us
              </Link>
              {' '}to join our professional network.
            </p>
          </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
