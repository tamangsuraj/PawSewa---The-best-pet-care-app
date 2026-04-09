'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { UserPlus, RefreshCw, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProviderApplication {
  _id: string;
  userId: { _id: string; name: string; email: string; phone?: string };
  businessName: string;
  businessLicense?: string;
  businessLicenseUrl?: string;
  serviceTypes: string[];
  status: string;
  createdAt: string;
}

export default function PendingApprovalsPage() {
  const [apps, setApps] = useState<ProviderApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get('/provider-applications/pending');
      setApps(resp.data?.data ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string }; status?: number }; message?: string };
      const msg = e.response?.data?.message || e.message || 'Failed to load pending applications';
      const is404 = e.response?.status === 404;
      setError(is404
        ? `${msg}. Ensure the backend is running (cd backend && npm run dev) and has been restarted with the latest code.`
        : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleReview = async (id: string, approve: boolean, rejectionReason?: string) => {
    try {
      setRejecting(id);
      await api.patch(`/provider-applications/${id}/review`, {
        approve,
        rejectionReason: approve ? undefined : (rejectionReason || 'Application rejected'),
      });
      toast.success(approve ? 'Application approved' : 'Application rejected');
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Failed to update');
    } finally {
      setRejecting(null);
    }
  };

  return (
    <>
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#703418]/10 rounded-xl flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-[#703418]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
                  <p className="text-gray-600 text-sm">Verify business licenses before providers can pay & go live</p>
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

            {loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-[#703418] border-t-transparent" />
                <p className="mt-4 text-gray-600">Loading…</p>
              </div>
            ) : apps.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No pending applications</p>
              </div>
            ) : (
              <div className="space-y-4">
                {apps.map((app) => (
                  <div
                    key={app._id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{app.businessName}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {app.userId?.name} · {app.userId?.email}
                      </p>
                      {app.userId?.phone && (
                        <p className="text-sm text-gray-500">Phone: {app.userId.phone}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {app.serviceTypes?.map((t) => (
                          <span
                            key={t}
                            className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#703418]/10 text-[#703418]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      {app.businessLicense && (
                        <p className="text-sm text-gray-600 mt-2">License: {app.businessLicense}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReview(app._id, false)}
                        disabled={rejecting === app._id}
                        className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleReview(app._id, true)}
                        disabled={rejecting === app._id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
    </>
  );
}
