'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[PawSewa] Unhandled error:', error);
  }, [error]);

  return (
    <PageShell className="flex min-h-dvh flex-col items-center justify-center">
      <div className="max-w-md px-4 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-100">
          <svg className="h-10 w-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-semibold text-[#2c241c]">Something went wrong</h2>
        <p className="mt-2 text-sm text-[#2c241c]/60">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[11px] text-[#2c241c]/35">ref: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-block rounded-xl bg-[#703418] px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#5c2c14]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-block rounded-xl border-2 border-[#703418]/25 px-6 py-3 text-sm font-semibold text-[#703418] transition-colors hover:bg-[#703418]/5"
          >
            Go home
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
