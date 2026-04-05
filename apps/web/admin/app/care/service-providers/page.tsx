'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { UserCheck, RefreshCw, ShieldCheck } from 'lucide-react';

const PROVIDER_ROLES = ['hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner'] as const;
const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All providers' },
  { value: 'hostel_owner', label: 'Hostel Owners' },
  { value: 'groomer', label: 'Groomers' },
  { value: 'trainer', label: 'Trainers' },
  { value: 'service_provider', label: 'Service Providers' },
  { value: 'facility_owner', label: 'Facility Owners' },
];

interface Provider {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  facilityName?: string;
  businessLicenseVerified?: boolean;
  subscriptionStatus?: string;
  listingExpiry?: string;
  createdAt: string;
}

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get('/users');
      const all = resp.data?.data ?? [];
      const list = all.filter((u: { role: string }) => PROVIDER_ROLES.includes(u.role));
      setProviders(list);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string }; status?: number } };
      const msg = e.response?.data?.message || (e as Error).message || 'Failed to load providers';
      setError(e.response?.status === 404 ? `${msg}. Ensure backend is running.` : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = filter
    ? providers.filter((p) => p.role === filter)
    : providers;

  const roleLabel = (role: string) => {
    const r = FILTER_OPTIONS.find((o) => o.value === role);
    return r?.label || role;
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64">
          <Header />
          <main className="pt-24 px-6 pb-6">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#703418]/10 rounded-xl flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-[#703418]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Service Providers</h1>
                  <p className="text-gray-600 text-sm">Hostel owners, groomers, trainers — filter and verify</p>
                </div>
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#703418] text-white rounded-lg hover:bg-[#5c2c14] disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                {error}
              </div>
            )}

            <div className="mb-4 flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Filter by type:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#703418] focus:border-[#703418]"
              >
                {FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500">{filtered.length} provider(s)</span>
            </div>

            {loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-[#703418] border-t-transparent" />
                <p className="mt-4 text-gray-600">Loading providers...</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Verified</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Subscription</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No providers match the filter.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((p) => (
                        <tr key={p._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{p.name}</td>
                          <td className="px-6 py-4 text-gray-600">{p.email}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-[#703418]/10 text-[#703418]">
                              {roleLabel(p.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {p.businessLicenseVerified ? (
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <ShieldCheck className="w-4 h-4" /> Verified
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {p.subscriptionStatus || '—'}
                            {p.listingExpiry && (
                              <span className="block text-xs text-gray-500">
                                Expires: {new Date(p.listingExpiry).toLocaleDateString()}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
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
