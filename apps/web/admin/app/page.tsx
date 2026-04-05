'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Shield } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="text-center">
        <Shield className="w-16 h-16 text-primary animate-pulse mx-auto mb-4" />
        <p className="text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}
