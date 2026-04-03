'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Home, RefreshCw, ShieldCheck } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

const SERVICE_TYPES = ['', 'Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'];

interface Hostel {
  _id: string;
  name: string;
  description?: string;
  location?: { address: string };
  pricePerNight?: number;
  pricePerSession?: number;
  images?: string[];
  rating?: number;
  reviewCount?: number;
  serviceType?: string;
  isVerified?: boolean;
  isActive?: boolean;
  isAvailable?: boolean;
  ownerId?: { name?: string; email?: string; phone?: string };
  createdAt: string;
}

export default function CareHostelsPage() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string> = {};
      if (serviceTypeFilter) params.serviceType = serviceTypeFilter;
      const resp = await api.get('/admin/hostels', { params });
      setHostels(resp.data?.data ?? []);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load hostels';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [serviceTypeFilter]);

  const handleVerify = async (id: string) => {
    try {
      await api.patch(`/admin/hostels/${id}/verify`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to verify');
    }
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
                  <Home className="w-6 h-6 text-[#703418]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Care Hostels</h1>
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
                <button
                  onClick={load}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#703418] text-white rounded-lg hover:bg-[#5a2a13] disabled:opacity-60 text-sm font-medium"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin w-10 h-10 border-2 border-[#703418] border-t-transparent rounded-full" />
              </div>
            ) : hostels.length === 0 ? (
              <div className="text-center py-16 text-gray-500">No hostels found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full bg-white rounded-xl shadow border border-gray-200">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Name</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Type</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Owner</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Location</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Price</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Status</th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hostels.map((h) => (
                      <tr key={h._id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{h.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{h.serviceType || 'Hostel'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(h.ownerId as { name?: string })?.name ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate">
                          {h.location?.address ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#703418] font-medium">
                          Rs. {h.pricePerNight ?? h.pricePerSession ?? 0}
                          {h.serviceType === 'Hostel' ? '/night' : '/session'}
                        </td>
                        <td className="px-4 py-3">
                          {h.isVerified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <ShieldCheck className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!h.isVerified && (
                            <button
                              onClick={() => handleVerify(h._id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#703418] rounded-lg hover:bg-[#5a2a13]"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              Verify
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
