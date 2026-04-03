'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

function CareBookingContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const id = searchParams.get('id');

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {success === '1' ? (
        <>
          <CheckCircle className="w-20 h-20 text-primary mb-6" />
          <h1 className="text-2xl font-bold text-primary mb-2">Booking Confirmed</h1>
          <p className="text-gray-600 text-center mb-6">
            Your appointment has been booked. {id && `Reference: ${id}`}
          </p>
          <Link href="/" className="py-3 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90">
            Back to Home
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-primary mb-4">Care Bookings</h1>
          <p className="text-gray-600 mb-6">View and manage your care bookings.</p>
          <Link href="/" className="text-primary font-semibold">Back to Home</Link>
        </>
      )}
    </div>
  );
}

export default function CareBookingSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center text-primary">Loading...</div>}>
      <CareBookingContent />
    </Suspense>
  );
}
