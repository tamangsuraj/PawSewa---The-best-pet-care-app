'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Calendar, MapPin, User, CreditCard } from 'lucide-react';

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
      <div className="flex min-h-[50vh] items-center justify-center bg-cream">
        <p className="text-primary">Loading appointment…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-700">{error || 'Not found'}</p>
        <Link href="/my-pets?tab=appointments" className="mt-6 inline-block font-semibold text-primary underline">
          Back to My Pets
        </Link>
      </div>
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

  return (
    <div className="min-h-[calc(100vh-4.25rem)] bg-cream px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-2xl border border-[#E8DFD0] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Appointment</p>
          <h1 className="font-display mt-2 text-2xl font-semibold text-primary sm:text-3xl">
            {data.serviceId?.name || data.type?.replace(/_/g, ' ') || 'Vet visit'}
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">Ref: {data._id.slice(-8).toUpperCase()}</p>

          <div className="mt-6 space-y-4 text-sm">
            <div className="flex items-start gap-3 text-slate-700">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-primary">Date &amp; time</p>
                <p>
                  {dateStr}
                  {data.timeWindow ? ` · ${data.timeWindow}` : ''}
                </p>
              </div>
            </div>

            {data.petId && typeof data.petId === 'object' && (
              <div className="flex items-start gap-3 text-slate-700">
                <span className="mt-0.5 text-lg">🐾</span>
                <div>
                  <p className="font-semibold text-primary">Pet</p>
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
                <User className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-primary">Specialist</p>
                  <p>{data.staffId.name}</p>
                  {data.staffId.phone ? <p className="text-xs">{data.staffId.phone}</p> : null}
                </div>
              </div>
            )}

            {data.location?.address && (
              <div className="flex items-start gap-3 text-slate-700">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-primary">Location</p>
                  <p>{data.location.address}</p>
                </div>
              </div>
            )}

            {(typeof data.totalAmount === 'number' && data.totalAmount > 0) ||
            data.paymentStatus === 'paid' ||
            data.paymentStatus === 'unpaid' ? (
              <div className="flex items-start gap-3 text-slate-700">
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-primary">Billing</p>
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
              <div className="rounded-xl bg-cream/80 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{data.description}</p>
              </div>
            ) : null}

            {data.visitNotes ? (
              <div className="rounded-xl border border-[#E8DFD0] p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Visit notes</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{data.visitNotes}</p>
              </div>
            ) : null}

            <div className="pt-4">
              <span className="inline-block rounded-full bg-[#ECE8E0] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                {(data.status || 'pending').replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/my-pets?tab=appointments"
              className="rounded-xl border border-primary px-5 py-2.5 text-sm font-semibold text-primary hover:bg-cream"
            >
              All appointments
            </Link>
            <Link
              href="/vets"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              Book again
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
