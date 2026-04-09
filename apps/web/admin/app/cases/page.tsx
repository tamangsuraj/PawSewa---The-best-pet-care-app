'use client';

import { useCallback, useEffect, useState } from 'react';
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
import Image from 'next/image';

type LiveCaseSource = 'assistance' | 'service_request' | 'clinic_appointment';

interface LiveCaseCustomer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface LiveCasePet {
  _id: string;
  name: string;
  breed?: string;
  age?: number;
  image?: string;
  photoUrl?: string;
  pawId?: string;
}

interface LiveCaseAssignee {
  _id: string;
  name: string;
  specialty?: string;
  specialization?: string;
}

interface UnifiedLiveCaseRow {
  source: LiveCaseSource;
  _id: string;
  displayType: string;
  issueLine: string;
  locationLabel: string;
  latitude?: number | null;
  longitude?: number | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  customer: LiveCaseCustomer | null;
  pet: LiveCasePet | null;
  assignee: LiveCaseAssignee | null;
  createdAt: string;
  serviceType?: string;
  preferredDate?: string;
  timeWindow?: string;
}

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

const LIVE_STATUSES = ['pending', 'assigned', 'in_progress'] as const;

function parseLiveCaseCoords(item: UnifiedLiveCaseRow): { lat: number; lng: number } | null {
  const lat = item.latitude;
  const lng = item.longitude;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    if (lat === 0 && lng === 0) return null;
    return { lat, lng };
  }
  return null;
}

function openGoogleMapsInNewTab(coords: { lat: number; lng: number }) {
  if (typeof window === 'undefined') return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coords.lat},${coords.lng}`)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function LiveCasesPage() {
  const [items, setItems] = useState<UnifiedLiveCaseRow[]>([]);
  const [vets, setVets] = useState<Vet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<UnifiedLiveCaseRow | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedVet, setSelectedVet] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'assistance' | 'appointments'>('all');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = getStoredAdminToken();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const statusParam = filterStatus === 'all' ? 'all' : filterStatus;
      const res = await api.get<{ success: boolean; data?: UnifiedLiveCaseRow[] }>(
        `/admin/live-cases?status=${encodeURIComponent(statusParam)}&category=${encodeURIComponent(filterCategory)}`,
      );

      const rows = res.data.data || [];
      const liveOnly = rows.filter((r) => LIVE_STATUSES.includes(r.status as (typeof LIVE_STATUSES)[number]));
      setItems(liveOnly);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to load live cases');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCategory]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const token = getStoredAdminToken();
    if (!token) return;
    const socket: Socket = io(getAdminSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    const onBump = () => {
      fetchAll();
    };
    socket.on('case_status_change', onBump);
    socket.on('appointment:update', onBump);
    return () => {
      socket.off('case_status_change', onBump);
      socket.off('appointment:update', onBump);
      socket.disconnect();
    };
  }, [fetchAll]);

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
    } catch {
      setVets([]);
    }
  };

  const handleAssign = async () => {
    if (!selectedItem || !selectedVet) return;
    const token = getStoredAdminToken();
    if (!token) return;

    try {
      setAssigning(true);
      if (selectedItem.source === 'assistance') {
        await api.patch(`/cases/${selectedItem._id}/assign`, {
          vetId: selectedVet,
          shift: selectedShift || undefined,
        });
        alert('Case assigned successfully.');
      } else if (selectedItem.source === 'service_request') {
        if (!scheduledTime) {
          alert('Please select scheduled time for the appointment.');
          setAssigning(false);
          return;
        }
        await api.patch(`/admin/requests/${selectedItem._id}/assign`, {
          staffId: selectedVet,
          scheduledTime,
        });
        alert('Appointment assigned successfully.');
      } else if (selectedItem.source === 'clinic_appointment') {
        await api.patch(`/appointments/${selectedItem._id}/assign`, {
          vetId: selectedVet,
        });
        alert('Appointment assigned successfully.');
      }
      setShowAssignModal(false);
      setSelectedItem(null);
      setSelectedVet('');
      setSelectedShift('');
      setScheduledTime('');
      fetchAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  const openAssignModal = (item: UnifiedLiveCaseRow) => {
    setSelectedItem(item);
    setShowAssignModal(true);
    setSelectedVet('');
    setSelectedShift('');
    setScheduledTime('');
    if (vets.length === 0) fetchVets();
  };

  const getStatusBadge = (item: UnifiedLiveCaseRow) => {
    const status = item.status;
    const assigned = item.assignee;
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

  const getPet = (item: UnifiedLiveCaseRow) => item.pet;
  const getOwner = (item: UnifiedLiveCaseRow) => item.customer?.name ?? '—';
  const getDescription = (item: UnifiedLiveCaseRow) => item.issueLine;
  const getLocation = (item: UnifiedLiveCaseRow) => item.locationLabel || '—';
  const canAssign = (item: UnifiedLiveCaseRow) => item.status === 'pending' && !item.assignee;

  const unassignedPendingCount = items.filter((i) => i.status === 'pending' && !i.assignee).length;
  const assignedCount = items.filter((i) => i.status === 'assigned').length;
  const inProgressCount = items.filter((i) => i.status === 'in_progress').length;

  const assignNeedsSchedule = selectedItem?.source === 'service_request';
  const assignDisabled =
    !selectedVet ||
    (assignNeedsSchedule && !scheduledTime) ||
    assigning;

  return (
    <div className="min-w-0 w-full max-w-none pb-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Cases</h1>
            <p className="text-gray-600 mt-1">
              Unified queue: assistance requests, booked services, and clinic appointments (including vaccinations).
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-gray-200 bg-white rounded-t-lg px-2 pt-2">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'assistance', 'appointments'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-4 py-2 font-medium transition-colors rounded-t ${
                  filterCategory === cat ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'assistance' ? 'Assistance' : 'Appointments'}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap pb-1">
            {['all', 'pending', 'assigned', 'in_progress'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-md ${
                  filterStatus === status ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {status === 'all' ? 'All statuses' : status.replace('_', ' ')}
              </button>
            ))}
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
          <PawSewaLoader width={150} className="mx-auto" />
          <p className="mt-4 text-gray-600">Loading live cases...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No cases or appointments found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="admin-table-scroll overflow-x-auto">
            <div className="admin-data-table-inner">
              <table className="admin-table-sticky-first admin-table-sticky-last min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pet & Owner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue / Appointment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => {
                    const pet = getPet(item);
                    const assigned = item.assignee;
                    const isPendingUnassigned = item.status === 'pending' && !assigned;
                    const mapCoords = parseLiveCaseCoords(item);
                    const locationLabel = getLocation(item);
                    const typeClass =
                      item.source === 'assistance'
                        ? 'bg-amber-100 text-amber-800'
                        : item.displayType === 'Vaccination'
                          ? 'bg-violet-100 text-violet-800'
                          : 'bg-blue-100 text-blue-800';
                    return (
                      <tr
                        key={`${item.source}-${item._id}`}
                        className={`hover:bg-gray-50 ${isPendingUnassigned ? 'row-live-urgent bg-red-50/50 border-l-4 border-l-red-500' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${typeClass}`}>
                            {item.displayType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">#{item._id.slice(-6)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                              {pet?.image || pet?.photoUrl ? (
                                <Image
                                  src={(pet.image ?? pet.photoUrl) as string}
                                  alt={pet?.name ?? 'Pet'}
                                  width={40}
                                  height={40}
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
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900 max-w-xs truncate">{getDescription(item)}</p>
                        </td>
                        <td className="px-6 py-4">
                          {mapCoords ? (
                            <button
                              type="button"
                              onClick={() => openGoogleMapsInNewTab(mapCoords)}
                              className="group flex max-w-xs items-start gap-1 text-left text-sm text-primary hover:underline"
                              title="Open pinned location in Google Maps"
                            >
                              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                              <span className="truncate text-gray-700 group-hover:text-primary">{locationLabel}</span>
                            </button>
                          ) : (
                            <div className="flex max-w-xs items-center gap-1 text-sm text-gray-600">
                              <MapPin className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{locationLabel}</span>
                            </div>
                          )}
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
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {canAssign(item) && (
                            <button
                              type="button"
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
            </div>
          </div>
        </div>
      )}

      {showAssignModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Assign to veterinarian</h2>
              <button type="button" onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Details</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Type:</span> {selectedItem.displayType}
                  </p>
                  <p>
                    <span className="font-medium">Pet:</span> {getPet(selectedItem)?.name} ({getPet(selectedItem)?.breed ?? '—'})
                  </p>
                  <p>
                    <span className="font-medium">Owner:</span> {getOwner(selectedItem)}
                  </p>
                  <p>
                    <span className="font-medium">Issue / appointment:</span> {getDescription(selectedItem)}
                  </p>
                  <p>
                    <span className="font-medium">Location:</span> {getLocation(selectedItem)}
                  </p>
                </div>
              </div>

              {selectedItem.source === 'assistance' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shift (optional)</label>
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

              {assignNeedsSchedule && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled time</label>
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
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={assignDisabled}
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
