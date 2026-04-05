'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';

function CareBookingContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const id = searchParams.get('id');

  return (
    <PageShell className="flex min-h-screen flex-col items-center justify-center">
      <PageContent compact className="max-w-md pb-16 pt-10">
      <div className="paw-surface-card w-full p-10 text-center">
        {success === '1' ? (
          <>
            <CheckCircle className="w-16 h-16 text-paw-teal-mid mx-auto mb-6" />
            <h1 className="font-display text-2xl font-semibold text-paw-ink mb-2">Booking confirmed</h1>
            <p className="text-paw-bark/75 text-center mb-6">
              Your appointment has been booked. {id && `Reference: ${id}`}
            </p>
            <Link href="/" className="paw-cta-primary inline-block">
              Back to home
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold text-paw-ink mb-4">Care bookings</h1>
            <p className="text-paw-bark/70 mb-6">View and manage your care bookings.</p>
            <Link href="/" className="text-paw-teal-mid font-semibold hover:underline">
              Back to home
            </Link>
          </>
        )}
      </div>
      </PageContent>
    </PageShell>
  );
}

export default function CareBookingSuccessPage() {
  return (
    <Suspense
      fallback={
        <PageShell className="flex min-h-screen items-center justify-center">
          <p className="text-paw-bark">Loading...</p>
        </PageShell>
      }
    >
      <CareBookingContent />
    </Suspense>
  );
}
