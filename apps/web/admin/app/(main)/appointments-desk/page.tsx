'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, RefreshCw, Stethoscope, UserCheck } from 'lucide-react';
import api from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import { PawSewaLoader } from '@/components/PawSewaLoader';

interface AppointmentRow {
  _id: string;
  type: string;
  status: string;
  preferredDate?: string;
  timeWindow?: string;
  description?: string;
  customerId?: { _id?: string; name?: string; email?: string; phone?: string };
  petId?: { _id?: string; name?: string; species?: string; breed?: string };
  staffId?: { _id?: string; name?: string };
  vetId?: { _id?: string; name?: string };
}

interface VetOption {
  _id: string;
  name: string;
  email?: string;
}

export default function AppointmentsDeskPage() {
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [vets, setVets] = useState<VetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});

  const loadPending = useCallback(async () => {
    try {
      setError('');
      const resp = await api.get('/appointments/desk/pending');
      const data = resp.data?.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to load pending appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVets = useCallback(async () => {
    try {
      const resp = await api.get('/users', { params: { role: 'veterinarian' } });
      const raw = resp.data?.data ?? resp.data ?? [];
      const list = (Array.isArray(raw) ? raw : []).map((u: Record<string, unknown>) => ({
        _id: String(u._id),
        name: String(u.name || u.full_name || u.email || 'Vet'),
        email: u.email != null ? String(u.email) : undefined,
      }));
      setVets(list);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void loadPending();
    void loadVets();
    const t = setInterval(() => void loadPending(), 25000);
    return () => clearInterval(t);
  }, [loadPending, loadVets]);

  useEffect(() => {
    const s = getAdminSocket();
    if (!s) return;
    const onUpdate = () => void loadPending();
    s.on('appointment:update', onUpdate);
    return () => {
      s.off('appointment:update', onUpdate);
    };
  }, [loadPending]);

  const assign = async (row: AppointmentRow) => {
    const vetId = selection[row._id];
    if (!vetId) {
      alert('Select a veterinarian first.');
      return;
    }
    setAssigningId(row._id);
    try {
      await api.patch(`/appointments/${row._id}/assign`, { vetId });
      await loadPending();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      alert(ax.response?.data?.message || 'Assign failed');
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
              <CalendarClock className="h-8 w-8 text-amber-400" />
              Appointment desk
            </h1>
            <p className="mt-1 text-slate-400">
              Pending clinic bookings (vaccination / checkup / vet). Assign a vet to notify their Partner app (FCM +
              realtime).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPending()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-red-200">{error}</div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-slate-400">
            <PawSewaLoader width={140} />
            <p>Loading pending appointments…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center text-slate-400">
            <Stethoscope className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            No bookings waiting for admin.
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((row) => {
              const petName = row.petId?.name ?? 'Pet';
              const ownerName = row.customerId?.name ?? 'Customer';
              const when =
                row.preferredDate != null
                  ? new Date(row.preferredDate).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : row.timeWindow ?? '—';
              return (
                <li
                  key={row._id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {row.type} · {petName}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Owner: {ownerName}
                        {row.customerId?.phone ? ` · ${row.customerId.phone}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">When: {when}</p>
                      {row.description ? (
                        <p className="mt-2 max-w-xl text-sm text-slate-300">{row.description}</p>
                      ) : null}
                      <p className="mt-2 inline-flex rounded-full bg-amber-500/15 px-3 py-0.5 text-xs font-medium text-amber-200">
                        {row.status === 'pending' ? 'pending (legacy)' : row.status}
                      </p>
                    </div>
                    <div className="flex min-w-[260px] flex-col gap-2 sm:items-end">
                      <label className="flex w-full flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Veterinarian
                        <select
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                          value={selection[row._id] ?? ''}
                          onChange={(ev) =>
                            setSelection((prev) => ({ ...prev, [row._id]: ev.target.value }))
                          }
                        >
                          <option value="">Select vet…</option>
                          {vets.map((v) => (
                            <option key={v._id} value={v._id}>
                              {v.name}
                              {v.email ? ` (${v.email})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={assigningId === row._id}
                        onClick={() => void assign(row)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 sm:w-auto"
                      >
                        <UserCheck className="h-4 w-4" />
                        {assigningId === row._id ? 'Assigning…' : 'Assign & notify'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
