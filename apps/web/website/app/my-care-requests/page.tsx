'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Calendar, CheckCircle, Clock, Scissors, XCircle } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';

interface CareRequest {
  _id?: string;
  status?: string;
  serviceType?: string;
  scheduledDate?: string;
  totalAmount?: number;
  hostelId?: { name?: string };
  petId?: { name?: string };
  notes?: string;
  createdAt?: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:   { label: 'Pending',    color: 'bg-amber-100 text-amber-800',    icon: Clock       },
  confirmed: { label: 'Confirmed',  color: 'bg-blue-100 text-blue-800',      icon: CheckCircle },
  completed: { label: 'Completed',  color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled',  color: 'bg-red-100 text-red-700',        icon: XCircle     },
};

function matchesKind(serviceType: string, kind: string) {
  const t = serviceType.toLowerCase();
  if (kind === 'grooming') return ['grooming', 'bathing', 'spa', 'wash'].some((k) => t.includes(k));
  if (kind === 'training') return t.includes('training');
  return true;
}

function fmtDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MyCareRequestsBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kind = searchParams.get('kind') ?? 'grooming';
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [rows, setRows] = useState<CareRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/care/my-requests');
        const data = res.data?.data;
        if (!cancelled) setRows(Array.isArray(data) ? (data as CareRequest[]) : []);
      } catch {
        if (!cancelled) setErr('Could not load care sessions. Please refresh.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated, router]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesKind(r.serviceType?.toString() ?? '', kind)),
    [rows, kind],
  );

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
          <Link href="/pet-care-plus" className="text-sm font-semibold text-[#0d9488] hover:underline">
            Pet Care+
          </Link>
        </div>

        {/* Kind tabs */}
        <div className="mb-6 flex gap-2 rounded-xl bg-[#f3ebe2]/80 p-1">
          {(['grooming', 'training'] as const).map((k) => (
            <Link
              key={k}
              href={`/my-care-requests?kind=${k}`}
              className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors capitalize ${
                kind === k ? 'bg-white text-[#703418] shadow-sm' : 'text-[#703418]/60 hover:text-[#703418]'
              }`}
            >
              {k}
            </Link>
          ))}
        </div>

        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
        )}

        {!err && filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#703418]/15 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3ebe2]">
              <Scissors className="h-7 w-7 text-[#703418]/40" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold text-[#2c241c]">No {kind} sessions yet</p>
              <p className="mt-1 text-sm text-[#2c241c]/55">Book a session from Pet Care+.</p>
            </div>
            <Link
              href="/pet-care-plus"
              className="rounded-full bg-[#703418] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5c2c14] transition-colors"
            >
              Book now
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {filtered.map((r, i) => {
              const st = r.status ?? 'pending';
              const meta = STATUS_META[st] ?? { label: st.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-700', icon: Clock };
              const Icon = meta.icon;
              const svc = r.serviceType ?? 'Session';
              const partnerName = r.hostelId?.name;
              const pet = r.petId?.name;
              const date = fmtDate(r.scheduledDate ?? r.createdAt);

              return (
                <li
                  key={r._id ?? `c-${i}`}
                  className="rounded-2xl border border-[#703418]/10 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#2c241c]">{svc}</p>
                      {partnerName && (
                        <p className="mt-0.5 text-xs text-[#2c241c]/50">{partnerName}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      {meta.label}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    {pet && <p className="text-[#2c241c]/75"><span className="font-medium">Pet:</span> {pet}</p>}
                    {date && (
                      <div className="flex items-center gap-1.5 text-xs text-[#2c241c]/60">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#703418]/50" strokeWidth={1.75} />
                        {date}
                      </div>
                    )}
                    {r.notes && (
                      <p className="text-xs text-[#2c241c]/55 italic">{r.notes}</p>
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
