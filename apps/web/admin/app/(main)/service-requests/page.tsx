'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, Clock, MapPin, User, CheckCircle, Stethoscope, RefreshCw, MessageSquare, X } from 'lucide-react';
import api from '@/lib/api';
import { getAdminSocket, joinRequestRoom } from '@/lib/socket';

interface ServiceRequest {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  };
  pet: {
    _id: string;
    name: string;
    breed?: string;
    age?: number;
    image?: string;
    photoUrl?: string;
    pawId?: string;
  };
  serviceType: 'Appointment' | 'Health Checkup' | 'Vaccination';
  preferredDate: string;
  timeWindow: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  location?: {
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  assignedStaff?: {
    _id: string;
    name: string;
    profilePicture?: string;
  };
  scheduledTime?: string;
  createdAt: string;
}

interface Vet {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  specialty?: string;
  specialization?: string;
}

type DateRangeFilter = 'today' | 'tomorrow' | 'week' | 'all';

const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((m) => m.Marker),
  { ssr: false }
);

export default function ServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterStatus, setFilterStatus] = useState<'pending' | 'assigned' | 'in_progress' | 'completed'>('pending');
  const [filterServiceType, setFilterServiceType] = useState<'all' | ServiceRequest['serviceType']>('all');
  const [filterRange, setFilterRange] = useState<DateRangeFilter>('all');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [vets, setVets] = useState<Vet[]>([]);
  const [selectedVetId, setSelectedVetId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Support Chat drawer (admin joins request room to oversee chat)
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [chatRequestId, setChatRequestId] = useState<string | null>(null);
  const [chatRequestSummary, setChatRequestSummary] = useState<{ petName: string; userName: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; senderName?: string; text: string; timestamp: string }>>([]);
  const [chatTyping, setChatTyping] = useState<string | null>(null);
  const [chatCleanup, setChatCleanup] = useState<(() => void) | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');

      // No platform/source filter — includes requests from both Website and Mobile app
      const resp = await api.get('/service-requests');
      const data = resp.data?.data ?? [];
      setRequests(Array.isArray(data) ? (data as ServiceRequest[]) : []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to load service requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchVets = async () => {
    try {
      const resp = await api.get('/users', {
        params: { role: 'veterinarian' },
      });
      setVets(resp.data.data || resp.data || []);
    } catch {
      setVets([]);
    }
  };

  const filteredRequests = requests
    .filter((r) => r.status === filterStatus)
    .filter((r) => (filterServiceType === 'all' ? true : r.serviceType === filterServiceType))
    .filter((r) => {
      if (filterRange === 'all') return true;
      const date = new Date(r.preferredDate);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (filterRange === 'today') return target.getTime() === today.getTime();

      if (filterRange === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return target.getTime() === tomorrow.getTime();
      }

      if (filterRange === 'week') {
        const weekAhead = new Date(today);
        weekAhead.setDate(today.getDate() + 7);
        return target >= today && target <= weekAhead;
      }

      return true;
    });

  const openAssignModal = (req: ServiceRequest) => {
    setSelectedRequest(req);
    setAssignModalOpen(true);
    setSelectedVetId('');
    setScheduledTime('');
    if (vets.length === 0) {
      fetchVets();
    }
  };

  const openChat = useCallback(async (req: ServiceRequest) => {
    const requestId = req._id;
    setChatRequestId(requestId);
    setChatRequestSummary({
      petName: req.pet?.name ?? 'Pet',
      userName: req.user?.name ?? 'Owner',
    });
    setChatMessages([]);
    setChatTyping(null);
    setChatError(null);
    setChatDrawerOpen(true);
    if (chatCleanup) {
      chatCleanup();
      setChatCleanup(null);
    }

    try {
      const resp = await api.get(`/service-requests/${requestId}/messages`);
      const list = resp.data?.data ?? [];
      setChatMessages(
        list.map((m: { sender?: { _id: string; name?: string }; content?: string; createdAt?: string }) => ({
          sender: m.sender?._id ?? '',
          senderName: m.sender?.name,
          text: m.content ?? '',
          timestamp: m.createdAt ?? new Date().toISOString(),
        }))
      );
    } catch {
      setChatMessages([]);
    }

    getAdminSocket();
    const result = await joinRequestRoom(
      requestId,
      (data) =>
        setChatMessages((prev) => [
          ...prev,
          { sender: data.sender, text: data.text, timestamp: data.timestamp },
        ]),
      (data) => setChatTyping(data.isTyping ? data.userName ?? 'Someone' : null)
    );
    if (typeof result === 'function') {
      setChatCleanup(() => result);
    } else if (!result.success) {
      setChatError(result.message ?? 'Could not join chat');
    }
  }, [chatCleanup]);

  const closeChat = useCallback(() => {
    if (chatCleanup) {
      chatCleanup();
      setChatCleanup(null);
    }
    setChatDrawerOpen(false);
    setChatRequestId(null);
    setChatRequestSummary(null);
    setChatMessages([]);
    setChatTyping(null);
    setChatError(null);
  }, [chatCleanup]);

  const handleAssign = async () => {
    if (!selectedRequest || !selectedVetId || !scheduledTime) return;

    try {
      setAssigning(true);
      await api.patch(`/admin/requests/${selectedRequest._id}/assign`, {
        staffId: selectedVetId,
        scheduledTime,
      });
      setAssignModalOpen(false);
      setSelectedRequest(null);
      await fetchRequests();
      alert('Doctor assigned. The vet will receive the case in their app.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'Failed to assign request');
    } finally {
      setAssigning(false);
    }
  };

  const getStatusBadge = (status: ServiceRequest['status']) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
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

  return (
    <div className="p-8 bg-gray-50 min-h-dvh">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Requests Dispatcher</h1>
          <p className="text-gray-600 mt-1">
            Review pending bookings and assign veterinarians with OpenStreetMap context.
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Status:</span>
          {(['pending', 'assigned', 'in_progress', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                filterStatus === status
                  ? 'bg-primary text-white border-primary'
                  : 'bg-gray-50 text-gray-700 border-gray-300'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Service:</span>
          {(['all', 'Appointment', 'Health Checkup', 'Vaccination'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterServiceType(type)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                filterServiceType === type
                  ? 'bg-primary text-white border-primary'
                  : 'bg-gray-50 text-gray-700 border-gray-300'
              }`}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Date:</span>
          {(['today', 'tomorrow', 'week', 'all'] as DateRangeFilter[]).map((range) => (
            <button
              key={range}
              onClick={() => setFilterRange(range)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                filterRange === range
                  ? 'bg-primary text-white border-primary'
                  : 'bg-gray-50 text-gray-700 border-gray-300'
              }`}
            >
              {range === 'all'
                ? 'All'
                : range === 'week'
                ? 'This Week'
                : range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Requests list */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            Loading service requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            No service requests match the selected filters.
          </div>
        ) : (
          filteredRequests.map((req) => (
            <div
              key={req._id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-4"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(req.status)}
                    <span className="text-xs text-gray-500">
                      Created {new Date(req.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-primary uppercase">
                    {req.serviceType}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {req.pet?.name?.charAt(0) ?? 'P'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {req.pet?.name ?? 'Pet'} • {req.user?.name ?? 'Owner'}
                    </p>
                    {/* PawID badge for quick identification */}
                    {req.pet?.pawId && (
                      <div className="mt-1 inline-flex items-center px-2.5 py-1 rounded-full border border-[#703418] text-[10px] font-mono text-[#703418] bg-[#F5E6CA]/70">
                        <span className="mr-1 opacity-80">ID:</span>
                        <span>{req.pet.pawId}</span>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-600">
                      Preferred: {new Date(req.preferredDate).toLocaleDateString()} ({req.timeWindow})
                    </p>
                    {req.scheduledTime && (
                      <p className="text-xs text-gray-700">
                        Scheduled:{' '}
                        {new Date(req.scheduledTime).toLocaleString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                    {req.assignedStaff && (
                      <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Assigned to {req.assignedStaff.name}
                      </p>
                    )}
                  </div>
                </div>
                {req.location?.address && (
                  <p className="text-xs text-gray-700 flex items-start gap-1">
                    <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                    <span>{req.location.address}</span>
                  </p>
                )}
              </div>

              {/* Right side: actions + map preview */}
              <div className="w-full md:w-72 flex flex-col gap-3">
                {req.location?.coordinates ? (
                  <>
                    <div className="rounded-xl border border-gray-200 overflow-hidden h-40 bg-gray-100">
                      <MapContainer
                        center={[req.location.coordinates.lat, req.location.coordinates.lng]}
                        zoom={14}
                        scrollWheelZoom={false}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                        />
                        <Marker position={[req.location.coordinates.lat, req.location.coordinates.lng]} />
                      </MapContainer>
                    </div>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${req.location.coordinates.lat}&mlon=${req.location.coordinates.lng}#map=16/${req.location.coordinates.lat}/${req.location.coordinates.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline self-end"
                    >
                      Open in OpenStreetMap
                    </a>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 h-32 flex items-center justify-center text-xs text-gray-400">
                    No location data
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => openChat(req)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Support Chat
                  </button>
                  <button
                    onClick={() => openAssignModal(req)}
                    disabled={req.status !== 'pending'}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                      req.status === 'pending'
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Assignment Modal */}
      {assignModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Assign Veterinarian</h2>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-800">
                {selectedRequest.pet?.name ?? 'Pet'} • {selectedRequest.user?.name ?? 'Owner'}
              </p>
              {selectedRequest.pet?.pawId && (
                <p className="text-[11px] text-[#703418] inline-flex items-center px-2 py-0.5 rounded-full border border-dashed border-[#703418] bg-[#F5E6CA]/70 font-mono">
                  ID: {selectedRequest.pet.pawId}
                </p>
              )}
              <p className="text-gray-600">
                {selectedRequest.serviceType} —{' '}
                {new Date(selectedRequest.preferredDate).toLocaleDateString()} ({selectedRequest.timeWindow})
              </p>
              {selectedRequest.location?.address && (
                <p className="text-gray-700 flex gap-1">
                  <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                  <span>{selectedRequest.location.address}</span>
                </p>
              )}
            </div>

            {/* Vet selection */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Veterinarian</label>
              <select
                value={selectedVetId}
                onChange={(e) => setSelectedVetId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">Select veterinarian...</option>
                {vets.map((vet) => (
                  <option key={vet._id} value={vet._id}>
                    {vet.name} {vet.specialty || vet.specialization ? `• ${vet.specialty || vet.specialization}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Time picker */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">
                Scheduled Time (within preferred window)
              </label>
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning || !selectedVetId || !scheduledTime}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:bg-gray-300 disabled:text-gray-600"
              >
                {assigning ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Chat drawer */}
      {chatDrawerOpen && chatRequestId && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col border-l border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Support Chat — {chatRequestSummary?.petName ?? 'Request'} • {chatRequestSummary?.userName ?? 'Owner'}
            </h2>
            <button
              onClick={closeChat}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {chatError && (
            <div className="mx-4 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {chatError}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className="flex flex-col items-start">
                <span className="text-xs text-gray-500 mb-0.5">
                  {msg.senderName ?? msg.sender || 'User'} • {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-sm text-gray-900 bg-gray-100 rounded-lg px-3 py-2 max-w-full break-words">
                  {msg.text}
                </span>
              </div>
            ))}
            {chatTyping && (
              <p className="text-xs italic text-gray-500">{chatTyping} is typing...</p>
            )}
          </div>
          <p className="px-4 pb-4 text-xs text-gray-500 border-t border-gray-100 pt-2">
            Admin view-only. User and staff chat in the app; you see messages here in real time.
          </p>
        </div>
      )}
    </div>
  );
}

