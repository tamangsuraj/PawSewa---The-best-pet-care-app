'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { User, Mail, Phone, Shield, Dog, Calendar } from 'lucide-react';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <PawSewaLogoSpinner size={64} className="mx-auto mb-4" />
          <p className="text-paw-bark/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <PageShell>
      <PageContent className="max-w-4xl py-12">
        <div className="paw-surface-card mb-8 p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-paw-bark to-paw-ink flex items-center justify-center shadow-paw-glow shrink-0">
              <User className="w-10 h-10 text-paw-cream" />
            </div>
            <div>
              <p className="paw-eyebrow mb-1">Your space</p>
              <h1 className="font-display text-3xl font-semibold text-paw-ink tracking-tight">
                Welcome back, {user.name}
              </h1>
              <p className="text-paw-bark/70 mt-1">
                {user.role === 'pet_owner' 
                  ? 'Manage your pets and appointments'
                  : user.role === 'veterinarian'
                  ? 'Customer Dashboard - Professional features coming soon'
                  : 'Customer Dashboard View'
                }
              </p>
            </div>
          </div>

          {/* Role Notice for Non-Pet Owners */}
          {user.role !== 'pet_owner' && (
            <div className="mb-6 p-4 rounded-2xl border border-paw-teal/20 bg-paw-teal/5">
              <p className="text-sm text-paw-ink">
                <strong>Note:</strong> You&apos;re viewing the customer dashboard.{' '}
                {user.role === 'veterinarian' && ' Professional veterinarian features are available in the admin panel.'}
                {user.role === 'admin' && ' Admin features are available in the admin panel.'}
              </p>
            </div>
          )}

          {/* User Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-paw-sand/60 rounded-2xl border border-paw-bark/8 p-4 flex items-center gap-3">
              <Mail className="w-6 h-6 text-paw-teal-mid shrink-0" />
              <div>
                <p className="text-xs text-paw-bark/55">Email</p>
                <p className="font-medium text-paw-ink">{user.email}</p>
              </div>
            </div>

            {user.phone && (
              <div className="bg-paw-sand/60 rounded-2xl border border-paw-bark/8 p-4 flex items-center gap-3">
                <Phone className="w-6 h-6 text-paw-teal-mid shrink-0" />
                <div>
                  <p className="text-xs text-paw-bark/55">Phone</p>
                  <p className="font-medium text-paw-ink">{user.phone}</p>
                </div>
              </div>
            )}

            <div className="bg-paw-sand/60 rounded-2xl border border-paw-bark/8 p-4 flex items-center gap-3">
              <Shield className="w-6 h-6 text-paw-teal-mid shrink-0" />
              <div>
                <p className="text-xs text-paw-bark/55">Role</p>
                <p className="font-medium text-paw-ink capitalize">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            onClick={() => router.push('/my-pets')}
            className="paw-surface-card cursor-pointer p-6"
          >
            <Dog className="w-12 h-12 text-paw-teal-mid mb-4" aria-hidden />
            <h3 className="font-display text-xl font-semibold text-paw-ink mb-2">My Pets</h3>
            <p className="text-paw-bark/70 text-sm">View and manage your registered pets</p>
          </div>

          <div
            onClick={() => router.push('/book-appointment')}
            className="paw-surface-card cursor-pointer border-2 border-[#703418]/15 p-6 transition-shadow hover:shadow-md"
          >
            <Calendar className="mb-4 h-12 w-12 text-[#703418]" aria-hidden />
            <h3 className="font-display mb-2 text-xl font-semibold text-[#703418]">Appointments</h3>
            <p className="text-sm text-paw-bark/75">
              Book a visit (same flow as the app) or view history in My appointments.
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push('/my-service-requests');
              }}
              className="mt-4 text-sm font-semibold text-[#0d9488] underline-offset-2 hover:underline"
            >
              My appointments →
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-6 text-center">
          <p className="text-emerald-900 font-medium text-sm">
            You are signed in and ready to use PawSewa.
          </p>
        </div>
      </PageContent>
    </PageShell>
  );
}
