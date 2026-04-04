'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';

function CareBookingContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const id = searchParams.get('id');

  return (
    <PageShell className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="paw-card-glass w-full max-w-md rounded-[1.75rem] border border-paw-bark/10 p-10 text-center shadow-paw-lg">
        {success === '1' ? (
          <>
            <CheckCircle className="w-16 h-16 text-paw-teal-mid mx-auto mb-6" />
            <h1 className="font-display text-2xl font-semibold text-paw-ink mb-2">Booking confirmed</h1>
            <p className="text-paw-bark/75 text-center mb-6">
              Your appointment has been booked. {id && `Reference: ${id}`}
            </p>
            <Link
              href="/"
              className="inline-block py-3 px-8 rounded-full bg-paw-bark text-paw-cream font-semibold hover:bg-paw-ink shadow-paw"
            >
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
