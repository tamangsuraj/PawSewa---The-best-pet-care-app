'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Eye, EyeOff, Heart, Stethoscope, Truck } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { WebGoogleSignInButton } from '@/components/auth/WebGoogleSignInButton';
import { isGoogleSignInConfigured } from '@/components/OptionalGoogleOAuthProvider';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PAW_CAT_HERO } from '@/lib/pawImageAssets';

const loginSchema = z.object({
  email:    z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginFormValues = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: Stethoscope, text: 'Book verified vets, home or clinic' },
  { icon: Truck,       text: 'Premium supplies delivered fast'    },
  { icon: Heart,       text: 'Full health history for every pet'  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, sendLoginOtp, verifyOtpLogin, user, isLoading: authLoading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError]       = useState('');
  const [otpMode, setOtpMode]           = useState(false);
  const [otpSent, setOtpSent]           = useState(false);
  const [otpCode, setOtpCode]           = useState('');
  const [otpBusy, setOtpBusy]           = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard');
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paw-cream">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-paw-bark/20 border-t-paw-bark animate-spin" />
          <p className="text-sm text-paw-bark/60">Loading…</p>
        </div>
      </div>
    );
  }

  if (user) return null;

  // ── handlers ────────────────────────────────────────────────────────────
  const onSubmit = async (values: LoginFormValues) => {
    setFormError('');
    try {
      await login(values.email, values.password);
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userData = JSON.parse(savedUser) as { role: string };
        if (userData.role !== 'pet_owner') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          const adminBase = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL?.trim() || '';
          setFormError(
            userData.role === 'admin'
              ? `Admin accounts sign in at the Admin Panel${adminBase ? ` (${adminBase})` : ''}.`
              : 'This website is for pet owners only. Partners use the PawSewa mobile app.',
          );
          return;
        }
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleSendOtp = async () => {
    setFormError('');
    const email = getValues('email');
    if (!email?.trim()) { setFormError('Enter your email address first.'); return; }
    setOtpBusy(true);
    try {
      await sendLoginOtp(email.trim());
      setOtpSent(true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Could not send code');
    } finally { setOtpBusy(false); }
  };

  const handleVerifyOtp = async () => {
    setFormError('');
    const email = getValues('email')?.trim();
    const code  = otpCode.trim();
    if (!email || code.length !== 6) { setFormError('Enter the 6-digit code from your email.'); return; }
    setOtpBusy(true);
    try {
      await verifyOtpLogin(email, code);
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userData = JSON.parse(savedUser) as { role: string };
        if (userData.role !== 'pet_owner') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setFormError('This website is for pet owners only.');
          return;
        }
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Invalid OTP');
    } finally { setOtpBusy(false); }
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_1fr] bg-paw-cream">

      {/* ── Left panel: brand visual ─────────────────────────────────────── */}
      <div className="relative hidden lg:flex flex-col overflow-hidden bg-gradient-to-br from-paw-bark via-[#5c2c14] to-paw-ink">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-paw-teal-mid/20 blur-[80px]" />
        <div className="pointer-events-none absolute -left-10 bottom-20 h-64 w-64 rounded-full bg-paw-bark/50 blur-[60px]" />

        {/* Pet photo with overlay */}
        <div className="absolute inset-0">
          <Image
            src={PAW_CAT_HERO}
            alt="Cat — PawSewa"
            fill
            className="object-cover opacity-20 mix-blend-luminosity"
            sizes="50vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-paw-ink/80 via-paw-ink/20 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative flex flex-col justify-between h-full px-10 py-12">
          <PawSewaLogo variant="nav" height={52} invertOnDark />

          <div className="space-y-6">
            <h2 className="font-display text-4xl font-semibold text-white leading-tight">
              Your pet's health,<br />at your fingertips.
            </h2>
            <ul className="space-y-3.5">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-white/80 text-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Testimonial */}
          <div className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
            <p className="text-sm leading-relaxed text-white/80 italic">
              "PawSewa got a vet to our home within two hours. The tracking made it completely stress-free."
            </p>
            <div className="mt-3 flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-paw-teal-mid/30 flex items-center justify-center text-xs font-bold text-white">
                PS
              </div>
              <p className="text-xs font-medium text-white/60">Priya S. — Dog owner, Kathmandu</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: form ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-5 py-12 sm:px-10">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <PawSewaLogo variant="nav" height={52} />
        </div>

        <div className="w-full max-w-sm space-y-7">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-paw-ink">
              Welcome back
            </h1>
            <p className="text-sm text-paw-bark/60">
              Sign in to manage your pets and bookings.
            </p>
          </div>

          {/* Error */}
          {formError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={(e) => {
              if (otpMode) { e.preventDefault(); return; }
              void handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-paw-ink">Email</label>
              <input
                type="email"
                placeholder="you@email.com"
                autoComplete="email"
                className="paw-input"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {!otpMode ? (
              <>
                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-paw-ink">Password</label>
                    <Link href="/forgot-password" className="text-xs font-medium text-paw-teal-mid hover:underline">
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="paw-input pr-10"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-paw-bark/40 hover:text-paw-bark/70 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-600">{errors.password.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="paw-cta-primary w-full justify-center py-3"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Signing in…
                    </span>
                  ) : 'Sign in'}
                </button>
              </>
            ) : (
              /* OTP flow */
              <div className="space-y-3 rounded-2xl border border-paw-bark/12 bg-paw-haze/50 p-4">
                <p className="text-xs text-paw-bark/65">
                  We'll email a 6-digit code — same account as the PawSewa app.
                </p>
                {!otpSent ? (
                  <button
                    type="button"
                    disabled={otpBusy}
                    onClick={handleSendOtp}
                    className="paw-cta-primary w-full justify-center py-3 text-sm"
                  >
                    {otpBusy ? 'Sending…' : 'Send sign-in code'}
                  </button>
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="paw-input text-center text-xl tracking-[0.35em] font-bold"
                    />
                    <button
                      type="button"
                      disabled={otpBusy || otpCode.length !== 6}
                      onClick={handleVerifyOtp}
                      className="paw-cta-primary w-full justify-center py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {otpBusy ? 'Verifying…' : 'Verify & sign in'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtpCode(''); }}
                      className="w-full text-center text-xs text-paw-teal-mid hover:underline"
                    >
                      Resend code
                    </button>
                  </>
                )}
              </div>
            )}
          </form>

          {/* OTP toggle */}
          <button
            type="button"
            onClick={() => { setOtpMode((v) => !v); setOtpSent(false); setOtpCode(''); setFormError(''); clearErrors(); }}
            className="w-full text-center text-sm font-medium text-paw-teal-mid hover:underline"
          >
            {otpMode ? '← Use password instead' : 'Sign in with email code'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-paw-bark/10" />
            <span className="text-xs font-medium text-paw-bark/40 uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-paw-bark/10" />
          </div>

          {/* Google */}
          {isGoogleSignInConfigured() ? (
            <WebGoogleSignInButton onError={setFormError} clearOtherErrors={clearErrors} />
          ) : (
            <p className="rounded-2xl border border-dashed border-paw-bark/15 bg-paw-haze/60 px-4 py-3 text-center text-xs text-paw-bark/55">
              Google sign-in not configured.{' '}
              <code className="rounded bg-white/80 px-1 font-mono text-[10px]">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> is unset.
            </p>
          )}

          {/* Register */}
          <p className="text-center text-sm text-paw-bark/60">
            No account?{' '}
            <Link href="/register" className="font-semibold text-paw-ink hover:underline">
              Create one free
            </Link>
          </p>

          <p className="text-center text-[11px] text-paw-bark/35">
            By continuing you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-2 hover:text-paw-bark/60">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-paw-bark/60">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
