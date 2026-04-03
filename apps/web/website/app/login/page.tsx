'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';
import Link from 'next/link';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /[^A-Za-z0-9]/,
      'Password must include at least one special character',
    ),
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-white to-secondary p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4 rounded-xl bg-secondary/40 px-4 py-3 border border-primary/15">
              <PawSewaLogo variant="nav" height={48} />
            </div>
            <h2 className="text-3xl font-bold text-primary mb-2">Welcome Back</h2>
            <p className="text-gray-600">Login to your PawSewa account</p>
          </div>

          {/* Error Alert */}
          {formError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
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
                className="absolute right-3 top-[42px] text-gray-500 hover:text-primary transition-colors"
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
                  className="w-4 h-4 text-primary focus:ring-primary rounded"
                />
                <span className="text-gray-600">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-primary hover:underline">
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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
          </div>

          {/* Register Link */}
          <p className="text-center text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create one now
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          By continuing, you agree to PawSewa's{' '}
          <Link href="/terms" className="underline">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
