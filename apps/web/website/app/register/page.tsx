'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Heart,
  PawPrint,
  ShoppingBag,
  Stethoscope,
  User,
} from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { WebGoogleSignInButton } from '@/components/auth/WebGoogleSignInButton';
import { isGoogleSignInConfigured } from '@/components/OptionalGoogleOAuthProvider';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getWebsiteApiBase, ngrokBrowserBypassHeaders } from '@/lib/apiEnv';
import { PAW_CAT_HERO } from '@/lib/pawImageAssets';

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z
  .object({
    name:            z.string().min(2, 'Full name is required (min 2 chars)'),
    email:           z.string().email('Enter a valid email address'),
    password:        z.string()
                       .min(8, 'At least 8 characters')
                       .regex(/[^A-Za-z0-9]/, 'Add at least one special character'),
    confirmPassword: z.string(),
    phone:           z.string().optional()
                       .transform((v) => (v ?? '').trim())
                       .refine((v) => !v || /^\d{10}$/.test(v), '10 digits required'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormValues = z.infer<typeof schema>;

// ─── Password strength ────────────────────────────────────────────────────────
function pwStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'bg-paw-sand' };
  let s = 0;
  if (pw.length >= 8)              s++;
  if (pw.length >= 12)             s++;
  if (/[A-Z]/.test(pw))           s++;
  if (/[0-9]/.test(pw))           s++;
  if (/[^A-Za-z0-9]/.test(pw))   s++;
  if (s <= 1) return { score: s, label: 'Weak',   color: 'bg-rose-500' };
  if (s <= 2) return { score: s, label: 'Fair',   color: 'bg-amber-400' };
  if (s <= 3) return { score: s, label: 'Good',   color: 'bg-sky-500'   };
  return             { score: s, label: 'Strong', color: 'bg-emerald-500' };
}

const FEATURES = [
  { icon: Stethoscope, text: 'Book verified vets for home or clinic'  },
  { icon: PawPrint,    text: 'Full health history for every pet'       },
  { icon: ShoppingBag, text: 'Shop 100+ curated supplies'             },
  { icon: Heart,       text: 'Emergency help when it matters most'    },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [error,         setError]         = useState('');
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [showPw,        setShowPw]        = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const {
    register: field,
    handleSubmit,
    control,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' });
  const strength = pwStrength(passwordValue ?? '');

  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard');
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paw-cream">
        <div className="h-10 w-10 rounded-full border-2 border-paw-bark/20 border-t-paw-bark animate-spin" />
      </div>
    );
  }
  if (user) return null;

  const onSubmit = async (values: FormValues) => {
    setError('');
    setIsSubmitting(true);
    try {
      const apiBase = getWebsiteApiBase();
      const res = await fetch(`${apiBase}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ngrokBrowserBypassHeaders },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          phone: values.phone || undefined,
          role: 'pet_owner',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      router.push(`/verify-otp?email=${encodeURIComponent(values.email)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_1fr] bg-paw-cream">

      {/* ── Left panel: brand ────────────────────────────────────────────── */}
      <div className="relative hidden lg:flex flex-col overflow-hidden bg-gradient-to-br from-paw-bark via-[#5c2c14] to-paw-ink">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-paw-teal-mid/20 blur-[80px]" />
        <div className="pointer-events-none absolute -left-10 bottom-20 h-64 w-64 rounded-full bg-paw-bark/50 blur-[60px]" />

        {/* Photo overlay */}
        <div className="absolute inset-0">
          <Image
            src={PAW_CAT_HERO}
            alt="PawSewa"
            fill
            className="object-cover opacity-15 mix-blend-luminosity"
            sizes="50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-paw-ink/70 via-paw-ink/10 to-transparent" />
        </div>

        <div className="relative flex flex-col justify-between h-full px-10 py-12">
          <PawSewaLogo variant="nav" height={52} invertOnDark />

          <div className="space-y-7">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50 mb-3">
                Join PawSewa
              </p>
              <h2 className="font-display text-4xl font-semibold text-white leading-tight">
                Care starts with<br />knowing your pet.
              </h2>
            </div>

            <ul className="space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="paw-feature-pill w-fit">
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust note */}
          <div className="rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex -space-x-1.5">
                {['A', 'S', 'R'].map((l) => (
                  <div key={l} className="h-7 w-7 rounded-full border-2 border-white/20 bg-paw-teal-mid/60 flex items-center justify-center text-xs font-bold text-white">
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/60 font-medium">1,200+ pet owners</p>
            </div>
            <p className="text-sm text-white/75 italic">
              "Setting up my pets' profiles took two minutes. Everything I need is in one place."
            </p>
          </div>
        </div>
      </div>

      {/* ── Right panel: form ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-5 py-12 sm:px-10">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <PawSewaLogo variant="nav" height={52} />
        </div>

        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-paw-ink">
              Create your account
            </h1>
            <p className="text-sm text-paw-bark/60">
              Free forever. No credit card required.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-paw-ink">Full name</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Your full name"
                  autoComplete="name"
                  className="paw-input pr-9"
                  {...field('name')}
                />
                {!errors.name && (passwordValue?.length ?? 0) >= 0 && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    {/* checkmark appears after field is touched with no error */}
                  </span>
                )}
              </div>
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-paw-ink">Email address</label>
              <input
                type="email"
                placeholder="you@email.com"
                autoComplete="email"
                className="paw-input"
                {...field('email')}
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-paw-ink">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min 8 chars + special char"
                  autoComplete="new-password"
                  className="paw-input pr-10"
                  {...field('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-paw-bark/40 hover:text-paw-bark/70"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>

              {/* Strength bar */}
              {passwordValue && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= strength.score ? strength.color : 'bg-paw-sand'
                        }`}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <p className={`text-xs font-medium ${
                      strength.score <= 1 ? 'text-rose-600' :
                      strength.score <= 2 ? 'text-amber-600' :
                      strength.score <= 3 ? 'text-sky-600'   : 'text-emerald-600'
                    }`}>
                      {strength.label} password
                    </p>
                  )}
                </div>
              )}
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-paw-ink">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className="paw-input pr-10"
                  {...field('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-paw-bark/40 hover:text-paw-bark/70"
                  tabIndex={-1}
                >
                  {showConfirmPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-paw-ink">
                Phone <span className="text-paw-bark/40 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                autoComplete="tel"
                maxLength={10}
                className="paw-input"
                {...field('phone')}
              />
              {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="paw-cta-primary w-full justify-center py-3"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creating account…
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-paw-bark/10" />
            <span className="text-xs font-medium text-paw-bark/40 uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-paw-bark/10" />
          </div>

          {/* Google */}
          {isGoogleSignInConfigured() ? (
            <WebGoogleSignInButton onError={setError} clearOtherErrors={clearErrors} />
          ) : (
            <p className="rounded-2xl border border-dashed border-paw-bark/15 bg-paw-haze/60 px-4 py-3 text-center text-xs text-paw-bark/55">
              Google sign-in not configured.{' '}
              <code className="rounded bg-white/80 px-1 font-mono text-[10px]">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> is unset.
            </p>
          )}

          {/* Sign in link */}
          <p className="text-center text-sm text-paw-bark/60">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-paw-ink hover:underline">
              Sign in
            </Link>
          </p>

          {/* Vet note */}
          <div className="rounded-2xl border border-paw-bark/10 bg-paw-haze/50 px-4 py-3 text-center">
            <p className="text-xs text-paw-bark/60">
              Are you a veterinarian or partner?{' '}
              <Link href="/about" className="font-semibold text-paw-teal-mid hover:underline">
                Learn about joining our network
              </Link>
            </p>
          </div>

          <p className="text-center text-[11px] text-paw-bark/35">
            By creating an account you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-2 hover:text-paw-bark/60">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-paw-bark/60">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
