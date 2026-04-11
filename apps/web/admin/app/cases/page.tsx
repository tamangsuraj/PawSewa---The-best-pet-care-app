'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';
import { getAdminSocketUrl } from '@/lib/apiConfig';
import { getStoredAdminToken } from '@/lib/authStorage';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  User,
  Stethoscope,
  RefreshCw,
  X,
} from 'lucide-react';
import { PawSewaLoader } from '@/components/PawSewaLoader';
import ScrollableTableWrapper from '@/components/ui/ScrollableTableWrapper';

interface CaseItem {
  _id: string;
  type: 'assistance';
  customer: { _id: string; name: string; email?: string; phone?: string };
  pet: { _id: string; name: string; breed?: string; age?: number; image?: string };
  issueDescription: string;
  location: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  assignedVet?: { _id: string; name: string; specialty?: string; currentShift?: string };
  createdAt: string;
  assignedAt?: string;
}

interface ServiceRequestItem {
  _id: string;
  type: 'appointment';
  user: { _id: string; name: string; email?: string; phone?: string };
  pet: { _id: string; name: string; breed?: string; age?: number; photoUrl?: string; image?: string };
  serviceType: string;
  preferredDate: string;
  timeWindow: string;
  location?: { address?: string; coordinates?: { lat: number; lng: number } };
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedStaff?: { _id: string; name: string; specialty?: string; specialization?: string };
  createdAt: string;
  scheduledTime?: string;
}

type LiveCaseRow = (CaseItem | ServiceRequestItem) & { createdAt: string };

interface Vet {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  specialty?: string;
  specialization?: string;
  currentShift?: string;
  isAvailable?: boolean;
}

export default function LiveCasesPage() {
  const [items, setItems] = useState<LiveCaseRow[]>([]);
  const [vets, setVets] = useState<Vet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<LiveCaseRow | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedVet, setSelectedVet] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const LIVE_STATUSES = ['pending', 'assigned', 'in_progress'] as const;

  useEffect(() => {
    fetchAll();
  }, [filterStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRefresh = () => fetchAll();
    window.addEventListener('pawsewa:admin-data-refresh', onRefresh);
    return () => window.removeEventListener('pawsewa:admin-data-refresh', onRefresh);
  }, [filterStatus]);

  useEffect(() => {
    const token = getStoredAdminToken();
    if (!token) return;
    const socketUrl = getAdminSocketUrl();
    if (!socketUrl) return;
    const extraHeaders = { 'ngrok-skip-browser-warning': 'true' };
    const socket: Socket = io(socketUrl, {
      auth: { token },
      extraHeaders,
      transports: ['websocket', 'polling'],
    });
    socket.on('case_status_change', () => {
      fetchAll();
    });
    const bumpCare = () => {
      fetchAll();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pawsewa:admin-data-refresh'));
      }
    };
    socket.on('care_booking:new', bumpCare);
    socket.on('new_hostel_booking', bumpCare);
    return () => {
      socket.off('case_status_change');
      socket.off('care_booking:new', bumpCare);
      socket.off('new_hostel_booking', bumpCare);
      socket.disconnect();
    };
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const token = getStoredAdminToken();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const casesPath = filterStatus === 'all' ? '/cases' : `/cases?status=${filterStatus}`;
      const requestsPath =
        filterStatus === 'all'
          ? '/service-requests'
          : `/service-requests?status=${filterStatus}`;

      const [casesRes, requestsRes] = await Promise.all([
        api.get<{ success: boolean; data?: CaseItem[] }>(casesPath),
        api.get<{ success: boolean; data?: ServiceRequestItem[] }>(requestsPath),
      ]);

      const casesData: CaseItem[] = (casesRes.data.data || []).map((c) => ({ ...c, type: 'assistance' as const }));
      const requestsData: ServiceRequestItem[] = (requestsRes.data.data || []).map((r) => ({
        ...r,
        type: 'appointment' as const,
      }));

      const rawMerged = [...casesData, ...requestsData];
      const liveOnly = rawMerged.filter((r) => LIVE_STATUSES.includes(r.status as (typeof LIVE_STATUSES)[number]));

      const isUnassigned = (row: LiveCaseRow) => {
        const assigned = 'assignedVet' in row ? row.assignedVet : row.assignedStaff;
        return !assigned;
      };

      const unassignedPending = liveOnly.filter((r) => r.status === 'pending' && isUnassigned(r));
      const rest = liveOnly.filter((r) => r.status !== 'pending' || !isUnassigned(r));

      unassignedPending.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      rest.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const merged: LiveCaseRow[] = [...unassignedPending, ...rest];
      setItems(merged);
    } catch (err: any) {
      const st = err.response?.status;
      if (st != null) {
        console.error('[Live Cases] Request failed with HTTP status:', st);
      }
      // Detect when Ngrok returns an HTML interstitial instead of JSON
      const responseData = err.response?.data;
      const isHtmlResponse =
        typeof responseData === 'string' && responseData.trim().startsWith('<');
      const isNetworkError = err.message === 'Network Error' || err.code === 'ERR_NETWORK';

      if (isHtmlResponse || (err.response?.status === 404 && isHtmlResponse)) {
        console.error('[ERROR] API handshake failed. Verify Ngrok tunnel and bypass headers.');
        setError(
          'API handshake failed — Ngrok returned an HTML page instead of JSON. Verify the Ngrok tunnel is active and the bypass headers are set.'
        );
      } else if (isNetworkError) {
        console.error('[ERROR] API handshake failed. Verify Ngrok tunnel and bypass headers.');
        setError(
          'Network error — cannot reach the backend. Verify the Ngrok tunnel is running and NEXT_PUBLIC_API_URL matches the active tunnel. The admin app proxies /api/v1 through Next when the URL contains ngrok.'
        );
      } else if (st === 403) {
        setError('Access denied (HTTP 403) — check CORS or auth.');
      } else {
        setError(err.response?.data?.message || 'Failed to load live cases');
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVets = async () => {
    try {
      const token = getStoredAdminToken();
      if (!token) return;
      const [casesVetsRes, usersRes] = await Promise.all([
        api.get('/cases/vets/available'),
        api.get('/users', { params: { role: 'veterinarian' } }),
      ]);
      const fromCases = casesVetsRes.data?.data || [];
      const fromUsers = usersRes.data?.data || usersRes.data || [];
      const byId = new Map<string, Vet>();
      [...fromCases, ...fromUsers].forEach((v: Vet) => byId.set(v._id, { ...v }));
      setVets(Array.from(byId.values()));
    } catch (e) {
      console.error('Failed to load vets', e);
      setVets([]);
    }
  };

  const handleAssign = async () => {
    if (!selectedItem || !selectedVet) return;
    const token = getStoredAdminToken();
    if (!token) return;

    try {
      setAssigning(true);
      if (selectedItem.type === 'assistance') {
        await api.patch(`/cases/${selectedItem._id}/assign`, {
          vetId: selectedVet,
          shift: selectedShift || undefined,
        });
        alert('Case assigned successfully!');
      } else {
        if (!scheduledTime) {
          alert('Please select scheduled time for the appointment.');
          setAssigning(false);
          return;
        }
        await api.patch(`/admin/requests/${selectedItem._id}/assign`, {
          staffId: selectedVet,
          scheduledTime,
        });
        alert('Appointment assigned successfully!');
      }
      setShowAssignModal(false);
      setSelectedItem(null);
      setSelectedVet('');
      setSelectedShift('');
      setScheduledTime('');
      fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  const openAssignModal = (item: LiveCaseRow) => {
    setSelectedItem(item);
    setShowAssignModal(true);
    setSelectedVet('');
    setSelectedShift('');
    setScheduledTime('');
    if (vets.length === 0) fetchVets();
  };

  const getStatusBadge = (item: LiveCaseRow) => {
    const status = item.status;
    const assigned = getAssigned(item);
    const isPendingUnassigned = status === 'pending' && !assigned;

    const styles: Record<string, string> = {
      pending: isPendingUnassigned ? 'bg-red-100 text-red-800 border-red-400' : 'bg-yellow-100 text-yellow-800 border-yellow-300',
      assigned: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-orange-100 text-orange-800 border-orange-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
    };
    const icons: Record<string, JSX.Element> = {
      pending: <Clock className="w-4 h-4" />,
      assigned: <User className="w-4 h-4" />,
      in_progress: <Stethoscope className="w-4 h-4" />,
      completed: <CheckCircle className="w-4 h-4" />,
      cancelled: <AlertCircle className="w-4 h-4" />,
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
          styles[status] || 'bg-gray-100 text-gray-800 border-gray-300'
        }`}
      >
        {icons[status]}
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const getPet = (item: LiveCaseRow) => ('pet' in item ? item.pet : item.pet);
  const getOwner = (item: LiveCaseRow) => ('customer' in item ? item.customer?.name : item.user?.name) ?? '—';
  const getDescription = (item: LiveCaseRow) =>
    item.type === 'assistance'
      ? (item as CaseItem).issueDescription
      : `${(item as ServiceRequestItem).serviceType} — ${(item as ServiceRequestItem).preferredDate} (${(item as ServiceRequestItem).timeWindow})`;
  const getLocation = (item: LiveCaseRow) =>
    item.type === 'assistance'
      ? (item as CaseItem).location
      : (item as ServiceRequestItem).location?.address ?? '—';
  const getAssigned = (item: LiveCaseRow) =>
    item.type === 'assistance'
      ? (item as CaseItem).assignedVet
      : (item as ServiceRequestItem).assignedStaff;
  const canAssign = (item: LiveCaseRow) => item.status === 'pending' && !['cancelled'].includes(item.status);

  const unassignedPendingCount = items.filter((i) => i.status === 'pending' && !getAssigned(i)).length;
  const assignedCount = items.filter((i) => i.status === 'assigned').length;
  const inProgressCount = items.filter((i) => i.status === 'in_progress').length;

  return (
    <div className="p-8 bg-gray-50 min-h-dvh">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Cases</h1>
            <p className="text-gray-600 mt-1">
              All requests from customers (Request Assistance + Book Appointment). Assign and manage from here.
            </p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-700 text-sm font-medium">Pending (Unassigned)</p>
                <p className="text-3xl font-bold text-red-800">{unassignedPendingCount}</p>
              </div>
              <Clock className="w-10 h-10 text-red-500" />
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
          <div className="bg-white border-2 border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-700 text-sm font-medium">In Progress</p>
                <p className="text-3xl font-bold text-orange-800">{inProgressCount}</p>
              </div>
              <Stethoscope className="w-10 h-10 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 bg-white rounded-t-lg px-2 pt-2">
          {['all', 'pending', 'assigned', 'in_progress'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 font-medium transition-colors ${
                filterStatus === status ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ').toUpperCase()}
            </button>
          ))}
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
          <PawSewaLoader width={150} className="mx-auto" />
          <p className="mt-4 text-gray-600">Loading live cases...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No cases or appointments found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <ScrollableTableWrapper>
          <table className="w-full min-w-[1100px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Pet & Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Issue / Appointment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Assigned</th>
                <th className="sticky right-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => {
                const pet = getPet(item);
                const assigned = getAssigned(item);
                const isPendingUnassigned = item.status === 'pending' && !assigned;
                return (
                  <tr
                    key={`${item.type}-${item._id}`}
                    className={`hover:bg-gray-50 ${isPendingUnassigned ? 'bg-red-50/50 border-l-4 border-l-red-500' : ''}`}
                  >
                    <td className="sticky left-0 z-10 bg-white px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.type === 'assistance' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.type === 'assistance' ? 'Assistance' : 'Appointment'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">#{item._id.slice(-6)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          {pet?.image || (pet as { photoUrl?: string })?.photoUrl ? (
                            <img
                              src={((pet as { image?: string }).image ?? (pet as { photoUrl?: string }).photoUrl) as string}
                              alt={pet?.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-primary font-bold">{(pet?.name || '?')[0]}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{pet?.name ?? '—'}</p>
                          <p className="text-xs text-gray-500">{getOwner(item)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      <p className="text-sm text-gray-900 truncate">{getDescription(item)}</p>
                    </td>
                    <td className="px-6 py-4 max-w-[180px]">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{getLocation(item)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(item)}</td>
                    <td className="px-6 py-4">
                      {assigned ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900">Dr. {assigned.name}</p>
                          <p className="text-xs text-gray-500">{assigned.specialty || assigned.specialization || 'Vet'}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not assigned</span>
                      )}
                    </td>
                    <td className="sticky right-0 z-10 bg-white px-6 py-4 whitespace-nowrap">
                      {canAssign(item) && (
                        <button
                          onClick={() => openAssignModal(item)}
                          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90"
                        >
                          Assign
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </ScrollableTableWrapper>
        </div>
      )}

      {showAssignModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedItem.type === 'assistance' ? 'Assign Case to Veterinarian' : 'Assign Appointment to Veterinarian'}
              </h2>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Details</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Type:</span>{' '}
                    {selectedItem.type === 'assistance' ? 'Request Assistance' : 'Book Appointment'}
                  </p>
                  <p>
                    <span className="font-medium">Pet:</span> {getPet(selectedItem)?.name} ({getPet(selectedItem)?.breed ?? '—'})
                  </p>
                  <p>
                    <span className="font-medium">Owner:</span> {getOwner(selectedItem)}
                  </p>
                  <p>
                    <span className="font-medium">{selectedItem.type === 'assistance' ? 'Issue:' : 'Service:'}</span>{' '}
                    {getDescription(selectedItem)}
                  </p>
                  <p>
                    <span className="font-medium">Location:</span> {getLocation(selectedItem)}
                  </p>
                </div>
              </div>

              {selectedItem.type === 'assistance' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shift (Optional)</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select shift...</option>
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              )}

              {selectedItem.type === 'appointment' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Veterinarian</h3>
                {vets.length === 0 ? (
                  <p className="text-gray-500 py-4">Loading veterinarians...</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {vets.map((vet) => (
                      <label
                        key={vet._id}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer ${
                          selectedVet === vet._id ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="vet"
                          value={vet._id}
                          checked={selectedVet === vet._id}
                          onChange={() => setSelectedVet(vet._id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Dr. {vet.name}</p>
                          <p className="text-sm text-gray-600">{vet.specialty || vet.specialization || 'General'}</p>
                          {vet.phone && (
                            <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" />
                              {vet.phone}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedVet || (selectedItem.type === 'appointment' && !scheduledTime) || assigning}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigning ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
