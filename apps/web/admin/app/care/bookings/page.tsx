'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CalendarCheck, RefreshCw } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

interface CareBooking {
  _id: string;
  hostelId: { name: string; location?: { address?: string }; serviceType?: string };
  petId: { name: string; breed?: string; age?: number };
  userId: { name: string; email: string; phone?: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  serviceType?: string;
  createdAt: string;
}

const SERVICE_TYPES = ['', 'Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'];
const STATUS_OPTIONS = ['', 'pending', 'paid', 'accepted', 'rejected', 'cancelled', 'completed'];

export default function CareBookingsPage() {
  const [bookings, setBookings] = useState<CareBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string> = {};
      if (serviceTypeFilter) params.serviceType = serviceTypeFilter;
      if (statusFilter) params.status = statusFilter;
      const resp = await api.get('/admin/care-bookings', { params });
      setBookings(resp.data?.data ?? []);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load bookings';
      const is404 = err.response?.status === 404;
      setError(is404
        ? `${msg}. Ensure the backend is running (cd backend && npm run dev) and has been restarted with the latest code.`
        : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [serviceTypeFilter, statusFilter]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      paid: 'bg-blue-100 text-blue-800 border-blue-200',
      accepted: 'bg-green-100 text-green-800 border-green-200',
      completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    const c = colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
    return (
      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${c}`}>
        {status}
      </span>
    );
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64">
          <Header />
          <main className="pt-24 px-6 pb-6">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#703418]/10 rounded-xl flex items-center justify-center">
                  <CalendarCheck className="w-6 h-6 text-[#703418]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Care Bookings</h1>
                  <p className="text-gray-600 text-sm">Filter by service type (Hostel, Grooming, etc.)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#703418] focus:border-[#703418]"
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t || 'All Types'}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#703418] focus:border-[#703418]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s || 'All Status'}
                    </option>
                  ))}
                </select>
                <button
                  onClick={load}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#703418] text-white rounded-lg hover:bg-[#5a2a12] disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                {error}
              </div>
            )}

            {loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-[#703418] border-t-transparent" />
                <p className="mt-4 text-gray-600">Loading…</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <CalendarCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No bookings found</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pet / Owner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Check-in
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nights
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bookings.map((b) => (
                        <tr key={b._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-900">{b.hostelId?.name ?? '—'}</p>
                            <p className="text-xs text-gray-500">{b.serviceType ?? b.hostelId?.serviceType ?? '—'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{b.petId?.name ?? '—'}</p>
                            <p className="text-xs text-gray-500">{b.userId?.name} · {b.userId?.email}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {b.checkIn ? new Date(b.checkIn).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{b.nights ?? '—'}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            Rs. {Number(b.totalAmount).toFixed(0)}
                          </td>
                          <td className="px-6 py-4">
                            {statusBadge(b.status)}
                            <p className="text-xs text-gray-500 mt-1">{b.paymentStatus}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
