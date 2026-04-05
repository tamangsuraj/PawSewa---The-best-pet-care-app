'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';

export const dynamic = 'force-dynamic';

export default function PaymentFailedPage() {
  const [reason, setReason] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReason(params.get('reason') || '');
  }, []);

  const message =
    reason === 'missing_pidx'
      ? 'Payment could not be verified. Please try again from checkout.'
      : reason
        ? `Payment did not complete: ${reason}`
        : 'Payment was cancelled or could not be completed.';

  return (
    <PageShell className="flex flex-col items-center justify-center">
      <PageContent compact className="max-w-md pb-16 pt-10">
      <div className="paw-surface-card w-full p-8 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-red-600" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-paw-ink mb-2">Payment not completed</h1>
        <p className="text-paw-bark/75 mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/checkout" className="paw-cta-primary inline-block">
            Try again
          </Link>
          <Link href="/shop" className="paw-cta-secondary inline-block">
            Back to shop
          </Link>
        </div>
      </div>
      </PageContent>
    </PageShell>
  );
}
