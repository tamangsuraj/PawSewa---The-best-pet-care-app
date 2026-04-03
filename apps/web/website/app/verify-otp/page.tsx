'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';

export const dynamic = 'force-dynamic';

export default function VerifyOTPPage() {
  const router = useRouter();
  const { loginWithToken } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Read URL params on the client only (avoids Next prerender issues).
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
    } else {
      router.push('/register');
    }
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/users/verify-otp', {
        email,
        otp,
      });

      if (response.data.success) {
        setSuccess('Email verified successfully! Redirecting to dashboard...');
        
        // Login with the token received
        const userData = response.data.data;
        loginWithToken(userData);
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setResending(true);

    try {
      const response = await api.post('/users/resend-otp', {
        email,
      });

      if (response.data.success) {
        setSuccess('New verification code sent to your email!');
        setOtp(''); // Clear the OTP input
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5E6CA] to-[#A67B5B] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🐾</div>
          <h1 className="text-3xl font-bold text-[#703418] mb-2">Verify Your Email</h1>
          <p className="text-gray-600">
            We've sent a 6-digit code to
          </p>
          <p className="text-[#703418] font-semibold mt-1">{email}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
              Verification Code
            </label>
            <Input
              id="otp"
              type="text"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              required
              className="text-center text-2xl tracking-widest font-bold"
            />
            <p className="text-xs text-gray-500 mt-2">
              Code expires in 10 minutes
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Didn't receive the code?
          </p>
          <button
            onClick={handleResendOTP}
            disabled={resending}
            className="text-[#703418] hover:text-[#A67B5B] font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend Code'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-gray-600 hover:text-[#703418] transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
