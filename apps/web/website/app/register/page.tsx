'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';
import Link from 'next/link';
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
  const { register, user, isLoading: authLoading } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register: registerField,
    handleSubmit,
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
      
      try {
        // Get user info from Google using access token
        const userInfoResponse = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );

        const googleUser = userInfoResponse.data;

        // Send user info to backend
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/google`,
          { 
            googleToken: tokenResponse.access_token,
            email: googleUser.email,
            name: googleUser.name,
            googleId: googleUser.sub
          }
        );

        if (response.data.success) {
          const { token, user: userData } = response.data.data;
          
          // Only allow pet_owner
          if (userData.role !== 'pet_owner') {
            setError('This is the customer website. Only pet owners can register here.');
            return;
          }

          // Save to localStorage
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(userData));
          
          router.push('/dashboard');
        }
      } catch (err: any) {
        console.error('Google sign-up error:', err);
        setError(err.response?.data?.message || 'Google sign-up failed');
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
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-accent items-center justify-center p-12">
        <div className="text-center text-white">
          <div className="mx-auto mb-8 flex justify-center rounded-2xl bg-white/10 p-6 border border-white/20 backdrop-blur-sm">
            <PawSewaLogo variant="hero" height={112} className="brightness-0 invert" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Welcome to PawSewa</h1>
          <p className="text-xl text-secondary">
            The best pet care platform for you and your furry friends
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-primary mb-2">Join the PawSewa Family</h2>
            <p className="text-gray-600">Create your account and start caring for your pets</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
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
              <span className="px-4 bg-white text-gray-500">OR</span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            onClick={() => handleGoogleLogin()}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="w-5 h-5"
              />
            )}
            <span className="font-medium text-gray-700">Continue with Google</span>
          </button>

          <p className="mt-6 text-center text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Login here
            </Link>
          </p>

          {/* Vet Contact Note */}
          <div className="mt-4 p-4 bg-secondary/30 rounded-lg text-center">
            <p className="text-sm text-gray-700">
              Are you a Vet?{' '}
              <Link href="/contact" className="text-primary font-medium hover:underline">
                Contact us
              </Link>
              {' '}to join our professional network.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
