'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import { CalendarCheck, MessageSquare, RefreshCw, XCircle } from 'lucide-react';

export type CareStreamScope = 'live' | 'past';

interface OpUser {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
}

interface LiveOrderRow {
  _id: string;
  category: string;
  centerName: string;
  status: string;
  rawStatus: string;
  petDetails: { name: string; type: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  paymentStatus?: string;
  careAssignmentStatus?: string;
  hostelId?: { name?: string; location?: { address?: string }; serviceType?: string };
  petId?: { name?: string; species?: string };
  userId?: { name?: string; email?: string; phone?: string };
  assignedPartner?: OpUser | null;
}

interface CareOrdersStreamTableProps {
  scope: CareStreamScope;
  heading: string;
  subheading: string;
}

function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'Hostel':
      return 'bg-teal-100 text-teal-900 border-teal-300';
    case 'Grooming':
      return 'bg-violet-100 text-violet-900 border-violet-300';
    case 'Training':
      return 'bg-orange-100 text-orange-900 border-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

export function CareOrdersStreamTable({
  scope,
  heading,
  subheading,
}: CareOrdersStreamTableProps) {
  const [rows, setRows] = useState<LiveOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [carePartners, setCarePartners] = useState<OpUser[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [allHostels, setAllHostels] = useState<
    { _id: string; name?: string; serviceType?: string }[]
  >([]);
  const [reassignPick, setReassignPick] = useState<Record<string, string>>({});
  const [transcriptBookingId, setTranscriptBookingId] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptData, setTranscriptData] = useState<{
    conversation: unknown;
    messages: Array<{
      _id: string;
      content?: string;
      mediaUrl?: string;
      createdAt?: string;
      sender?: { name?: string };
    }>;
  } | null>(null);

  const loadPartners = async () => {
    try {
      const resp = await api.get('/admin/dispatch-operators');
      setCarePartners(resp.data?.data?.carePartners ?? []);
    } catch {
      /* optional */
    }
  };

  const loadAllHostels = async () => {
    try {
      const resp = await api.get('/admin/hostels', { params: { limit: 200, page: 1 } });
      setAllHostels(resp.data?.data ?? []);
    } catch {
      /* optional */
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get<{ success: boolean; data?: LiveOrderRow[] }>(
        '/admin/live-orders',
        { params: { scope, limit: 100, page: 1 } }
      );
      setRows(resp.data?.data ?? []);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
    void loadPartners();
    void loadAllHostels();
  }, [load]);

  useEffect(() => {
    const socket = getAdminSocket();
    if (!socket) return;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void load(), 500);
    };
    socket.on('care_booking:update', bump);
    socket.on('care_booking:new', bump);
    return () => {
      clearTimeout(debounce);
      socket.off('care_booking:update', bump);
      socket.off('care_booking:new', bump);
    };
  }, [load]);

  const cancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this care booking? The customer will be notified.')) return;
    try {
      await api.patch(`/admin/care-bookings/${bookingId}/cancel`);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Cancel failed';
      alert(msg);
    }
  };

  const reassignCentre = async (bookingId: string) => {
    const hid = reassignPick[bookingId];
    if (!hid) {
      alert('Select a care centre first.');
      return;
    }
    if (!confirm('Move this booking to the selected centre? Chat thread partner will update.')) return;
    try {
      await api.patch(`/admin/care-bookings/${bookingId}/reassign-centre`, { hostelId: hid });
      setReassignPick((p) => ({ ...p, [bookingId]: '' }));
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Reassign failed';
      alert(msg);
    }
  };

  const openTranscript = async (bookingId: string) => {
    setTranscriptBookingId(bookingId);
    setTranscriptLoading(true);
    setTranscriptData(null);
    try {
      const resp = await api.get(`/admin/care-bookings/${bookingId}/chat`);
      setTranscriptData(resp.data?.data ?? null);
    } catch {
      setTranscriptData(null);
    } finally {
      setTranscriptLoading(false);
    }
  };

  const assignPartner = async (bookingId: string, partnerId: string) => {
    if (!partnerId) return;
    setAssigningId(bookingId);
    try {
      await api.patch(`/admin/care-bookings/${bookingId}/assign-partner`, { partnerId });
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Assignment failed';
      setError(msg);
    } finally {
      setAssigningId(null);
    }
  };

  const isLive = scope === 'live';

  return (
    <>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#703418]/10 rounded-xl flex items-center justify-center">
            <CalendarCheck className="w-6 h-6 text-[#703418]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{heading}</h1>
            <p className="text-gray-600 text-sm">{subheading}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void load();
            void loadPartners();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#703418] text-white rounded-lg hover:bg-[#5c2c14] disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-[#703418] border-t-transparent" />
          <p className="mt-4 text-gray-600">Loading</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CalendarCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {isLive ? 'No live bookings in Grooming, Training, or Hostel.' : 'No past bookings.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-w-0">
          <div className="overflow-x-auto w-full">
            <table className="min-w-[1100px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Centre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Pet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Check-in
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  {isLive ? (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[200px]">
                      Assign professional
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((b) => (
                  <tr key={b._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${categoryBadgeClass(b.category)}`}
                      >
                        {b.category}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-gray-900">{b.centerName}</p>
                      <p className="text-xs text-gray-500">
                        {b.hostelId?.location?.address ?? ''}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-900">{b.petDetails.name}</p>
                      <p className="text-xs text-gray-500">{b.petDetails.type}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-900">{b.userId?.name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{b.userId?.email}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {b.checkIn ? new Date(b.checkIn).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">
                      Rs. {Number(b.totalAmount).toFixed(0)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 text-gray-800">
                        {b.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{b.paymentStatus}</p>
                      {b.careAssignmentStatus === 'ASSIGNED_TO_PROFESSIONAL' ? (
                        <p className="text-xs text-primary font-medium mt-1">Dispatched</p>
                      ) : null}
                    </td>
                    {isLive ? (
                      <td className="px-4 py-4 min-w-[200px]">
                        {b.assignedPartner ? (
                          <p className="text-xs text-gray-800 font-medium">
                            {b.assignedPartner.name ?? b.assignedPartner.email}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">—</p>
                        )}
                        <select
                          className="mt-2 block w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-[#703418] focus:border-[#703418]"
                          defaultValue=""
                          disabled={assigningId === b._id}
                          onChange={(e) => {
                            const v = e.target.value;
                            e.target.value = '';
                            if (v) void assignPartner(b._id, v);
                          }}
                        >
                          <option value="">
                            {b.assignedPartner ? 'Reassign' : 'Select partner'}
                          </option>
                          {carePartners.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name ?? p.email} ({p.role})
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    <td className="px-4 py-4 align-top min-w-[220px]">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => void openTranscript(b._id)}
                          className="inline-flex items-center justify-center gap-1 text-xs font-medium text-[#703418] border border-[#703418]/40 rounded-md px-2 py-1 hover:bg-[#703418]/5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Chat log
                        </button>
                        {isLive ? (
                          <>
                            <select
                              className="block w-full text-xs border border-gray-300 rounded-md px-2 py-1"
                              value={reassignPick[b._id] ?? ''}
                              onChange={(e) =>
                                setReassignPick((p) => ({ ...p, [b._id]: e.target.value }))
                              }
                            >
                              <option value="">Reassign centre</option>
                              {allHostels.map((h) => (
                                <option key={h._id} value={h._id}>
                                  {h.name ?? h._id} {h.serviceType ? `(${h.serviceType})` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void reassignCentre(b._id)}
                              className="text-xs font-medium bg-slate-100 text-slate-800 rounded-md px-2 py-1 hover:bg-slate-200"
                            >
                              Apply move
                            </button>
                            {!['completed', 'cancelled'].includes(b.rawStatus) ? (
                              <button
                                type="button"
                                onClick={() => void cancelBooking(b._id)}
                                className="inline-flex items-center justify-center gap-1 text-xs font-medium text-red-700 border border-red-200 rounded-md px-2 py-1 hover:bg-red-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancel booking
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {transcriptBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold text-gray-900">Care chat transcript</h2>
              <button
                type="button"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
                onClick={() => {
                  setTranscriptBookingId(null);
                  setTranscriptData(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 text-sm">
              {transcriptLoading ? (
                <p className="text-gray-500">Loading</p>
              ) : !transcriptData?.conversation ? (
                <p className="text-gray-500">No messages yet for this booking.</p>
              ) : (
                <ul className="space-y-3">
                  {transcriptData.messages.map((m) => (
                    <li key={m._id} className="border-b border-gray-100 pb-2">
                      <p className="text-xs text-gray-500">
                        {(m.sender as { name?: string } | undefined)?.name ?? 'User'} ·{' '}
                        {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                      </p>
                      {m.content ? <p className="text-gray-900 mt-1">{m.content}</p> : null}
                      {m.mediaUrl ? (
                        <a
                          href={m.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#703418] text-xs underline mt-1 inline-block"
                        >
                          Media / photo
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
