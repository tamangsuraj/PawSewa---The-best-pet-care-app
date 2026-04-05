'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';

function matchesKind(serviceType: string, kind: string) {
  const t = serviceType.toLowerCase();
  if (kind === 'grooming') {
    return ['grooming', 'bathing', 'spa', 'wash'].some((k) => t.includes(k));
  }
  if (kind === 'training') {
    return t.includes('training');
  }
  return true;
}

function MyCareRequestsBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kind = searchParams.get('kind') || 'grooming';
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
        const res = await api.get('/care/my-requests');
        const data = res.data?.data;
        const list = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
        if (!cancelled) {
          setRows(list);
        }
      } catch {
        if (!cancelled) {
          setErr('Could not load care requests.');
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

  const filtered = useMemo(() => {
    return rows.filter((r) => matchesKind(r.serviceType?.toString() ?? '', kind));
  }, [rows, kind]);

  const title = kind === 'training' ? 'Training history' : 'Grooming sessions';

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
          <h1 className="font-display text-2xl font-semibold text-[#703418]">{title}</h1>
          <Link href="/pet-care-plus" className="text-sm font-semibold text-[#004D4D] hover:underline">
            Pet Care+
          </Link>
        </div>
        {err ? <p className="text-red-600">{err}</p> : null}
        {!err && filtered.length === 0 ? (
          <p className="text-paw-bark/70">No entries in this view yet.</p>
        ) : null}
        <ul className="space-y-3">
          {filtered.map((r, i) => {
            const st = r.status?.toString() ?? '—';
            const svc = r.serviceType?.toString() ?? 'Care';
            return (
              <li
                key={r._id?.toString() ?? `c-${i}`}
                className="rounded-2xl border border-paw-bark/10 bg-white p-4 shadow-sm"
              >
                <p className="font-semibold text-paw-ink">{svc}</p>
                <p className="text-sm text-paw-bark/70 mt-1">{st}</p>
              </li>
            );
          })}
        </ul>
      </PageContent>
    </PageShell>
  );
}

export default function MyCareRequestsPage() {
  return (
    <Suspense
      fallback={
        <PageShell className="flex min-h-dvh items-center justify-center">
          <PawSewaLogoSpinner size={56} />
        </PageShell>
      }
    >
      <MyCareRequestsBody />
    </Suspense>
  );
}
