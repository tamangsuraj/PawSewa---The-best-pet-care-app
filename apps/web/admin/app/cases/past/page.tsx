'use client';

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  CheckCircle,
  MapPin,
  History,
  RefreshCw,
  Search,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface CaseItem {
  _id: string;
  type: 'assistance';
  customer: { _id: string; name: string; email?: string; phone?: string };
  pet: { _id: string; name: string; breed?: string; age?: number; image?: string; pawId?: string };
  issueDescription: string;
  location: string;
  status: 'completed' | 'cancelled';
  assignedVet?: { _id: string; name: string; specialty?: string; currentShift?: string };
  createdAt: string;
  assignedAt?: string;
  completedAt?: string;
}

interface ServiceRequestItem {
  _id: string;
  type: 'appointment';
  user: { _id: string; name: string; email?: string; phone?: string };
  pet: { _id: string; name: string; breed?: string; age?: number; photoUrl?: string; image?: string; pawId?: string };
  serviceType: string;
  preferredDate: string;
  timeWindow: string;
  location?: { address?: string; coordinates?: { lat: number; lng: number } };
  status: 'completed' | 'cancelled';
  assignedStaff?: { _id: string; name: string; specialty?: string; specialization?: string };
  createdAt: string;
  scheduledTime?: string;
}

type PastCaseRow = (CaseItem | ServiceRequestItem) & { createdAt: string };

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month';

function getDateRange(filter: DateFilter): { start: Date; end: Date } | null {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (filter === 'today') {
    return { start, end };
  }
  if (filter === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
    return { start, end };
  }
  if (filter === 'week') {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (filter === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

export default function PastCasesPage() {
  const [items, setItems] = useState<PastCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const handleSearch = () => setAppliedSearch(search.trim());

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('admin-token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      const [casesCompleted, casesCancelled, reqCompleted, reqCancelled] = await Promise.all([
        axios.get<{ success: boolean; data?: CaseItem[] }>(`${API_BASE}/cases?status=completed`, { headers }),
        axios.get<{ success: boolean; data?: CaseItem[] }>(`${API_BASE}/cases?status=cancelled`, { headers }),
        axios.get<{ success: boolean; data?: ServiceRequestItem[] }>(`${API_BASE}/service-requests?status=completed`, { headers }),
        axios.get<{ success: boolean; data?: ServiceRequestItem[] }>(`${API_BASE}/service-requests?status=cancelled`, { headers }),
      ]);

      const casesData: CaseItem[] = [
        ...(casesCompleted.data?.data || []).map((c) => ({ ...c, type: 'assistance' as const })),
        ...(casesCancelled.data?.data || []).map((c) => ({ ...c, type: 'assistance' as const })),
      ];
      const requestsData: ServiceRequestItem[] = [
        ...(reqCompleted.data?.data || []).map((r) => ({ ...r, type: 'appointment' as const })),
        ...(reqCancelled.data?.data || []).map((r) => ({ ...r, type: 'appointment' as const })),
      ];

      const merged: PastCaseRow[] = [...casesData, ...requestsData].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setItems(merged);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load past cases');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const getPet = (item: PastCaseRow) => ('pet' in item ? item.pet : item.pet);
  const getOwner = (item: PastCaseRow) => ('customer' in item ? item.customer?.name : item.user?.name) ?? '—';
  const getOwnerEmail = (item: PastCaseRow) => ('customer' in item ? item.customer?.email : item.user?.email) ?? '';
  const getOwnerPhone = (item: PastCaseRow) => ('customer' in item ? item.customer?.phone : item.user?.phone) ?? '';
  const getDescription = (item: PastCaseRow) =>
    item.type === 'assistance'
      ? (item as CaseItem).issueDescription
      : `${(item as ServiceRequestItem).serviceType} — ${(item as ServiceRequestItem).preferredDate} (${(item as ServiceRequestItem).timeWindow})`;
  const getLocation = (item: PastCaseRow) =>
    item.type === 'assistance'
      ? (item as CaseItem).location
      : (item as ServiceRequestItem).location?.address ?? '—';
  const getVetName = (item: PastCaseRow) =>
    item.type === 'assistance'
      ? (item as CaseItem).assignedVet?.name ?? ''
      : (item as ServiceRequestItem).assignedStaff?.name ?? '';

  const filteredItems = useMemo(() => {
    let list = items;

    const q = appliedSearch.toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const pet = getPet(item);
        const pawId = (pet as { pawId?: string })?.pawId ?? '';
        const petId = String(pet?._id ?? '');
        const caseId = String(item._id ?? '');
        const email = getOwnerEmail(item) ?? '';
        const phone = String(getOwnerPhone(item) ?? '');
        const vetName = getVetName(item) ?? '';
        const vetFirstName = vetName.split(/\s+/)[0] ?? '';
        return (
          pawId.toLowerCase().includes(q) ||
          petId.toLowerCase().includes(q) ||
          caseId.toLowerCase().includes(q) ||
          email.toLowerCase().includes(q) ||
          phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
          vetName.toLowerCase().includes(q) ||
          vetFirstName.toLowerCase().includes(q)
        );
      });
    }

    const range = getDateRange(dateFilter);
    if (range) {
      const { start, end } = range;
      list = list.filter((item) => {
        const d = new Date(item.createdAt).getTime();
        return d >= start.getTime() && d <= end.getTime();
      });
    }

    return list;
  }, [items, appliedSearch, dateFilter]);

  return (
    <div className="p-8 bg-gray-50 min-h-dvh">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Past Cases</h1>
            <p className="text-gray-600 mt-1">
              Completed and cancelled cases. Search by pet ID, case ID, owner email, phone or vet name.
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

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex flex-1 min-w-[200px] gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Pet ID, Case ID, owner email, phone or vet name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'today', 'yesterday', 'week', 'month'] as DateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateFilter === f
                    ? 'bg-primary text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'All time' : f === 'week' ? 'This week' : f === 'month' ? 'This month' : f.charAt(0).toUpperCase() + f.slice(1)}
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-gray-600">Loading past cases...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            {items.length === 0 ? 'No past cases found' : 'No search results found. Try a different search or date filter.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pet & Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue / Appointment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const pet = getPet(item);
                const pawId = (pet as { pawId?: string })?.pawId ?? '—';
                return (
                  <tr key={`${item.type}-${item._id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
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
                          {(pet as { image?: string })?.image || (pet as { photoUrl?: string })?.photoUrl ? (
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
                          {pawId !== '—' && <p className="text-xs text-gray-400 font-mono">{pawId}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 max-w-xs truncate">{getDescription(item)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600 max-w-xs">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{getLocation(item)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                          item.status === 'completed'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}
                      >
                        {item.status === 'completed' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
