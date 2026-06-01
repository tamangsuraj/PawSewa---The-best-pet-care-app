import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';

export default function NotFoundPage() {
  return (
    <PageShell className="flex min-h-dvh flex-col items-center justify-center">
      <div className="px-4 text-center">
        <p className="font-display text-8xl font-bold text-[#703418]/15">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-[#2c241c]">Page not found</h1>
        <p className="mt-2 text-sm text-[#2c241c]/60">
          We couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-block rounded-xl bg-[#703418] px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#5c2c14]"
          >
            Go home
          </Link>
          <Link
            href="/shop"
            className="inline-block rounded-xl border-2 border-[#703418]/25 px-6 py-3 text-sm font-semibold text-[#703418] transition-colors hover:bg-[#703418]/5"
          >
            Browse shop
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
