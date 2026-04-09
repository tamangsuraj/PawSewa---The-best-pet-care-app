'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Home, MapPin, RefreshCw, ShieldCheck } from 'lucide-react';

const SERVICE_TYPES = ['', 'Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'];

interface Hostel {
  _id: string;
  name: string;
  description?: string;
  location?: { address: string; coordinates?: { lat: number; lng: number } };
  pricePerNight?: number;
  pricePerSession?: number;
  serviceType?: string;
  isVerified?: boolean;
  isActive?: boolean;
  isAvailable?: boolean;
  ownerId?: { name?: string; email?: string; phone?: string };
  createdAt: string;
}

export default function LiveCareCentersPage() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string | number> = { limit: 100, page: 1 };
      if (serviceTypeFilter) params.serviceType = serviceTypeFilter;
      const resp = await api.get('/admin/hostels', { params });
      setHostels(resp.data?.data ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || 'Failed to load centres');
    } finally {
      setLoading(false);
    }
  }, [serviceTypeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = activeOnly
    ? hostels.filter((h) => h.isActive === true && h.isAvailable !== false)
    : hostels;

  const mapsUrl = (h: Hostel) => {
    const c = h.location?.coordinates;
    if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
      return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
    }
    const a = h.location?.address;
    if (a) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
    }
    return '';
  };

  const handleVerify = async (id: string) => {
    try {
      await api.patch(`/admin/hostels/${id}/verify`);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'Failed to verify');
    }
  };

  return (
    <>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#703418]/10 rounded-xl flex items-center justify-center">
            <Home className="w-6 h-6 text-[#703418]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Live Care Centers</h1>
            <p className="text-gray-600 text-sm">
              Registered care facilities. Toggle active-only to focus on centres accepting bookings.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Active only
          </label>
          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#703418] focus:border-[#703418]"
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t || 'All service types'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#703418] text-white rounded-lg hover:bg-[#5c2c14] disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-[#703418] border-t-transparent" />
          <p className="mt-4 text-gray-600">Loading</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No centres match the current filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-w-0">
          <div className="overflow-x-auto w-full">
            <table className="min-w-[900px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Centre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Map
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visible.map((h) => {
                  const mapLink = mapsUrl(h);
                  return (
                    <tr key={h._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{h.name}</p>
                        {h.description ? (
                          <p className="text-xs text-gray-500 line-clamp-2">{h.description}</p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{h.serviceType ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                        <div className="flex items-start gap-1">
                          <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400 mt-0.5" />
                          <span>{h.location?.address ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <p>{h.ownerId?.name ?? '—'}</p>
                        <p className="text-xs text-gray-500">{h.ownerId?.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            h.isActive && h.isAvailable !== false
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {h.isActive && h.isAvailable !== false ? 'Active' : 'Inactive'}
                        </span>
                        {h.isVerified ? (
                          <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verified
                          </p>
                        ) : (
                          <p className="text-xs text-amber-700 mt-1">Unverified</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {mapLink ? (
                          <a
                            href={mapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary font-medium hover:underline"
                          >
                            Open map
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!h.isVerified ? (
                          <button
                            type="button"
                            onClick={() => void handleVerify(h._id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#703418] text-white hover:bg-[#5c2c14]"
                          >
                            Verify
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
