'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';

type OrderRow = Record<string, unknown> & { _id?: string; status?: string };

function MyOrdersBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [list, setList] = useState<OrderRow[]>([]);
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
      setErr(null);
      try {
        const res = await api.get('/orders/my');
        const data = res.data?.data;
        const rows = Array.isArray(data) ? (data as OrderRow[]) : [];
        if (!cancelled) {
          setList(rows);
        }
      } catch {
        if (!cancelled) {
          setErr('Could not load orders.');
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

  const visible = useMemo(() => {
    if (filter === 'active') {
      return list.filter((o) => (o.status?.toString() ?? 'pending') !== 'delivered');
    }
    if (filter === 'history') {
      return list.filter((o) => o.status?.toString() === 'delivered');
    }
    return list;
  }, [list, filter]);

  const title =
    filter === 'active' ? 'Current orders' : filter === 'history' ? 'Order history' : 'My orders';

  if (authLoading || loading) {
    return (
      <PageShell className="flex min-h-dvh items-center justify-center">
        <PawSewaLogoSpinner size={56} className="mx-auto" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageContent className="max-w-2xl py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold text-[#703418]">{title}</h1>
          <Link href="/shop" className="text-sm font-semibold text-[#004D4D] hover:underline">
            Back to shop
          </Link>
        </div>
        {err ? (
          <p className="text-red-600">{err}</p>
        ) : visible.length === 0 ? (
          <p className="text-paw-bark/70">No orders in this view yet.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((o) => {
              const id = o._id?.toString() ?? '';
              const st = o.status?.toString() ?? '—';
              return (
                <li
                  key={id || Math.random().toString()}
                  className="rounded-2xl border border-paw-bark/10 bg-white p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-paw-ink">Order</p>
                  <p className="text-xs text-paw-bark/60 mt-1 font-mono">{id}</p>
                  <p className="mt-2 text-sm text-paw-bark/80 capitalize">{st.replace(/_/g, ' ')}</p>
                </li>
              );
            })}
          </ul>
        )}
      </PageContent>
    </PageShell>
  );
}

export default function MyOrdersPage() {
  return (
    <Suspense
      fallback={
        <PageShell className="flex min-h-dvh items-center justify-center">
          <PawSewaLogoSpinner size={56} />
        </PageShell>
      }
    >
      <MyOrdersBody />
    </Suspense>
  );
}
