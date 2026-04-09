'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { AlertCircle, Clock, MapPin, User, RefreshCw, CheckCircle } from 'lucide-react';
import Image from 'next/image';

interface CareRequest {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  pet: {
    _id: string;
    name: string;
    breed?: string;
    age?: number;
    photoUrl?: string;
  };
  serviceType: 'Grooming' | 'Bathing' | 'Training';
  preferredDate: string;
  notes?: string;
  status: 'draft' | 'pending_review' | 'assigned' | 'in_progress' | 'completed';
  paymentStatus: 'unpaid' | 'paid';
  location?: {
    address: string;
    point?: {
      type: 'Point';
      coordinates: [number, number]; // [lng, lat]
    };
  };
  createdAt: string;
}

interface StaffCandidate {
  staffId: string;
  name: string;
  role: string;
  phone?: string;
  distanceKm: number;
}

export default function CareInboxPage() {
  const [items, setItems] = useState<CareRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [selected, setSelected] = useState<CareRequest | null>(null);
  const [staff, setStaff] = useState<StaffCandidate[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const loadInbox = async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get('/care/inbox', {
        params: { status: 'pending_review' },
      });
      const data = resp.data?.data ?? [];
      setItems(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      setError(msg || 'Failed to load Care+ inbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  const openAssignModal = async (item: CareRequest) => {
    setSelected(item);
    setSelectedStaffId('');
    setStaff([]);
    setAssignModalOpen(true);

    try {
      const coords = item.location?.point?.coordinates ?? null;
      const [lng, lat] = coords ?? [undefined, undefined];
      const resp = await api.get('/care/available-staff', {
        params: { lat, lng },
      });
      const data = resp.data?.data ?? [];
      setStaff(data);
    } catch (err) {
      console.error('Failed to load staff candidates', err);
    }
  };

  const handleAssign = async () => {
    if (!selected || !selectedStaffId) return;
    try {
      setAssigning(true);
      await api.patch(`/care/${selected._id}/assign`, {
        staffId: selectedStaffId,
      });
      setAssignModalOpen(false);
      setSelected(null);
      await loadInbox();
      alert('Care+ request assigned successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      alert(msg || 'Failed to assign care provider');
    } finally {
      setAssigning(false);
    }
  };

  const pendingCount = items.filter((i) => i.status === 'pending_review').length;
  const assignedCount = items.filter((i) => i.status === 'assigned').length;
  const completedCount = items.filter((i) => i.status === 'completed').length;

  return (
    <div className="p-8 bg-gray-50 min-h-dvh">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Care+ Inbox</h1>
          <p className="text-gray-600 mt-1">
            Paid grooming, bathing, and training requests awaiting assignment.
          </p>
        </div>
        <button
          onClick={loadInbox}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border-2 border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-700 text-sm font-medium">Pending Review</p>
              <p className="text-3xl font-bold text-yellow-800">{pendingCount}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-700 text-sm font-medium">Assigned</p>
              <p className="text-3xl font-bold text-blue-800">{assignedCount}</p>
            </div>
            <User className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        <div className="bg-white border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm font-medium">Completed</p>
              <p className="text-3xl font-bold text-green-800">{completedCount}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-gray-600">Loading Care+ requests…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No Care+ services booked yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Care ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pet & Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    #{item._id.slice(-6)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        {item.pet.photoUrl ? (
                          <Image
                            src={item.pet.photoUrl}
                            alt={item.pet.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-primary font-bold">
                            {item.pet.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.pet.name}
                        </p>
                        <p className="text-xs text-gray-500">{item.user.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">
                      {item.serviceType}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.preferredDate).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600 max-w-xs">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">
                        {item.location?.address ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => openAssignModal(item)}
                      className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90"
                    >
                      Assign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignModalOpen && selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Assign Care Provider</h2>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg text-sm">
                <p>
                  <span className="font-semibold">Pet:</span> {selected.pet.name}
                </p>
                <p>
                  <span className="font-semibold">Owner:</span> {selected.user.name}
                </p>
                <p>
                  <span className="font-semibold">Service:</span> {selected.serviceType}
                </p>
                <p>
                  <span className="font-semibold">When:</span>{' '}
                  {new Date(selected.preferredDate).toLocaleString()}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Nearby Care Providers ({staff.length})
                </h3>
                {staff.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No active staff found near this location.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {staff.map((s) => (
                      <label
                        key={s.staffId}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer ${
                          selectedStaffId === s.staffId
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="staff"
                          value={s.staffId}
                          checked={selectedStaffId === s.staffId}
                          onChange={() => setSelectedStaffId(s.staffId)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500">
                            {s.role} • {s.distanceKm.toFixed(1)} km away
                          </p>
                          {s.phone && (
                            <p className="text-xs text-gray-500">{s.phone}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedStaffId || assigning}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {assigning ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

