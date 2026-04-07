'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, MapPin, User, CreditCard, PawPrint } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLoader } from '@/components/PawSewaLoader';

type AppointmentDetail = {
  _id: string;
  type?: string;
  status?: string;
  paymentStatus?: string;
  preferredDate?: string;
  timeWindow?: string;
  totalAmount?: number;
  description?: string;
  notes?: string;
  visitNotes?: string;
  petId?: { _id: string; name?: string; breed?: string; pawId?: string };
  staffId?: { _id: string; name?: string; phone?: string };
  serviceId?: { _id: string; name?: string; type?: string };
  location?: { address?: string };
  createdAt?: string;
};

export default function AppointmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const [data, setData] = useState<AppointmentDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/appointments/${id}`);
        if (!cancelled && res.data?.success) {
          setData(res.data.data);
        } else if (!cancelled) {
          setError('Appointment not found.');
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg =
            typeof e === 'object' && e !== null && 'response' in e
              ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
              : '';
          setError(msg || 'Could not load this appointment.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <PageShell className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <PawSewaLoader width={150} />
        <p className="text-paw-bark">Loading appointment…</p>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <PageContent>
        <div className="mx-auto max-w-lg text-center paw-surface-card p-10">
          <p className="text-red-700">{error || 'Not found'}</p>
          <Link
            href="/my-pets?tab=appointments"
            className="mt-6 inline-block font-semibold text-paw-teal-mid hover:underline"
          >
            Back to My Pets
          </Link>
        </div>
        </PageContent>
      </PageShell>
    );
  }

  const when = data.preferredDate || data.createdAt;
  const dateStr = when
    ? new Date(when).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const title = data.serviceId?.name || data.type?.replace(/_/g, ' ') || 'Vet visit';
  const subtitle = `${dateStr}${data.timeWindow ? ` · ${data.timeWindow}` : ''} · Ref ${data._id.slice(-8).toUpperCase()}`;

  return (
    <PageShell>
      <PageHero
        leading={
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-medium text-paw-cream/90 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        }
        eyebrow="Appointment"
        title={title}
        subtitle={subtitle}
      />

      <PageContent compact className="max-w-2xl pb-10 pt-2">
        <div className="paw-surface-card p-6 sm:p-8">
          <div className="space-y-4 text-sm">
            {data.petId && typeof data.petId === 'object' && (
              <div className="flex items-start gap-3 text-slate-700">
                <PawPrint className="mt-0.5 h-5 w-5 shrink-0 text-paw-bark" aria-hidden />
                <div>
                  <p className="font-semibold text-paw-bark">Pet</p>
                  <p>
                    {data.petId.name}
                    {data.petId.breed ? ` · ${data.petId.breed}` : ''}
                  </p>
                  {data.petId.pawId ? (
                    <p className="text-xs text-slate-500">PawID: {data.petId.pawId}</p>
                  ) : null}
                </div>
              </div>
            )}

            {data.staffId && typeof data.staffId === 'object' && data.staffId.name && (
              <div className="flex items-start gap-3 text-slate-700">
                <User className="mt-0.5 h-5 w-5 shrink-0 text-paw-bark" />
                <div>
                  <p className="font-semibold text-paw-bark">Specialist</p>
                  <p>{data.staffId.name}</p>
                  {data.staffId.phone ? <p className="text-xs">{data.staffId.phone}</p> : null}
                </div>
              </div>
            )}

            {data.location?.address && (
              <div className="flex items-start gap-3 text-slate-700">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-paw-bark" />
                <div>
                  <p className="font-semibold text-paw-bark">Location</p>
                  <p>{data.location.address}</p>
                </div>
              </div>
            )}

            {(typeof data.totalAmount === 'number' && data.totalAmount > 0) ||
            data.paymentStatus === 'paid' ||
            data.paymentStatus === 'unpaid' ? (
              <div className="flex items-start gap-3 text-slate-700">
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-paw-bark" />
                <div>
                  <p className="font-semibold text-paw-bark">Billing</p>
                  <p>
                    {typeof data.totalAmount === 'number' && data.totalAmount > 0
                      ? `NPR ${data.totalAmount.toLocaleString()}`
                      : 'Amount on file with clinic'}
                  </p>
                  <p className="text-xs capitalize text-slate-500">
                    Payment: {data.paymentStatus || 'unpaid'}
                  </p>
                </div>
              </div>
            ) : null}

            {data.description ? (
              <div className="rounded-xl bg-paw-sand/50 border border-paw-bark/8 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{data.description}</p>
              </div>
            ) : null}

            {data.visitNotes ? (
              <div className="rounded-xl border border-paw-bark/10 p-4 bg-white/50">
                <p className="text-xs font-semibold uppercase text-slate-500">Visit notes</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{data.visitNotes}</p>
              </div>
            ) : null}

            <div className="pt-4">
              <span className="inline-block rounded-full bg-paw-sand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-paw-ink">
                {(data.status || 'pending').replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/my-pets?tab=appointments" className="paw-cta-secondary text-sm">
              All appointments
            </Link>
            <Link href="/vets" className="paw-cta-primary text-sm">
              Book again
            </Link>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
