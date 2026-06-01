'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Home, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';

interface Booking {
  _id?: string;
  status?: string;
  serviceType?: string;
  checkIn?: string;
  checkOut?: string;
  totalAmount?: number;
  hostelId?: { _id?: string; name?: string; serviceType?: string };
  petId?: { _id?: string; name?: string; species?: string };
  createdAt?: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:   { label: 'Pending',    color: 'bg-amber-100 text-amber-800',    icon: Clock         },
  confirmed: { label: 'Confirmed',  color: 'bg-blue-100 text-blue-800',      icon: CheckCircle   },
  active:    { label: 'Active',     color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle  },
  completed: { label: 'Completed',  color: 'bg-gray-100 text-gray-700',      icon: CheckCircle   },
  cancelled: { label: 'Cancelled',  color: 'bg-red-100 text-red-700',        icon: XCircle       },
};

function fmtDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyCareBookingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/care-bookings/my');
        const data = res.data?.data;
        if (!cancelled) setRows(Array.isArray(data) ? (data as Booking[]) : []);
      } catch {
        if (!cancelled) setErr('Could not load bookings. Please refresh.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
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
          <h1 className="font-display text-2xl font-semibold text-[#703418]">Care bookings</h1>
          <Link href="/pet-care-plus" className="text-sm font-semibold text-[#0d9488] hover:underline">
            Pet Care+
          </Link>
        </div>

        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
        )}

        {!err && rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#703418]/15 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3ebe2]">
              <Home className="h-7 w-7 text-[#703418]/40" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold text-[#2c241c]">No bookings yet</p>
              <p className="mt-1 text-sm text-[#2c241c]/55">
                Boarding, grooming, and daycare bookings appear here.
              </p>
            </div>
            <Link
              href="/pet-care-plus"
              className="rounded-full bg-[#703418] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5c2c14] transition-colors"
            >
              Explore Care+
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((r, i) => {
              const st = r.status ?? 'pending';
              const meta = STATUS_META[st] ?? { label: st.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-700', icon: Clock };
              const Icon = meta.icon;
              const name = r.hostelId?.name ?? r.serviceType ?? 'Booking';
              const pet = r.petId?.name;
              const checkIn = fmtDate(r.checkIn);
              const checkOut = fmtDate(r.checkOut);

              return (
                <li
                  key={r._id ?? `b-${i}`}
                  className="rounded-2xl border border-[#703418]/10 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#2c241c]">{name}</p>
                      {r.hostelId?.serviceType && (
                        <p className="mt-0.5 text-xs text-[#2c241c]/50 capitalize">
                          {r.hostelId.serviceType}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      {meta.label}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    {pet && (
                      <p className="text-[#2c241c]/75">
                        <span className="font-medium">Pet:</span> {pet}
                      </p>
                    )}
                    {(checkIn || checkOut) && (
                      <div className="flex items-center gap-1.5 text-xs text-[#2c241c]/60">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#703418]/50" strokeWidth={1.75} />
                        {checkIn && <span>Check-in: {checkIn}</span>}
                        {checkOut && <span className="ml-2">Check-out: {checkOut}</span>}
                      </div>
                    )}
                  </div>

                  {r.totalAmount != null && (
                    <div className="mt-3 border-t border-[#703418]/8 pt-3">
                      <p className="font-bold text-[#703418]">
                        Rs. {Number(r.totalAmount).toLocaleString('en-NP')}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PageContent>
    </PageShell>
  );
}
