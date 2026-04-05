'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';

export default function MyCareBookingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/care-bookings/my');
        const data = res.data?.data;
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setRows(list as Record<string, unknown>[]);
        }
      } catch {
        if (!cancelled) {
          setErr('Could not load hostel bookings.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || loading) {
    return (
      <PageShell className="flex min-h-dvh items-center justify-center">
        <PawSewaLogoSpinner size={56} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageContent className="max-w-2xl py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold text-[#703418]">Hostel bookings</h1>
          <Link href="/pet-care-plus" className="text-sm font-semibold text-[#004D4D] hover:underline">
            Pet Care+
          </Link>
        </div>
        {err ? <p className="text-red-600">{err}</p> : null}
        {!err && rows.length === 0 ? (
          <p className="text-paw-bark/70">No bookings yet.</p>
        ) : null}
        <ul className="space-y-3">
          {rows.map((r, i) => {
            const st = r.status?.toString() ?? '—';
            const h = r.hostelId as Record<string, unknown> | undefined;
            const title = (h && typeof h === 'object' ? h.name?.toString() : null) ?? 'Booking';
            return (
              <li
                key={r._id?.toString() ?? `b-${i}`}
                className="rounded-2xl border border-paw-bark/10 bg-white p-4 shadow-sm"
              >
                <p className="font-semibold text-paw-ink">{title}</p>
                <p className="text-sm text-paw-bark/70 mt-1">{st}</p>
              </li>
            );
          })}
        </ul>
      </PageContent>
    </PageShell>
  );
}
