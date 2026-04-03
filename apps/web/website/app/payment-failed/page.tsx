'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { XCircle } from 'lucide-react';

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
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment not completed</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/checkout"
            className="inline-block px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Try again
          </Link>
          <Link
            href="/shop"
            className="inline-block px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to shop
          </Link>
        </div>
      </div>
    </main>
  );
}
