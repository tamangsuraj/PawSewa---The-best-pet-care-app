'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
  AlertCircle,
  Clock,
  CheckCircle,
  User,
  MapPin,
  Stethoscope,
  RefreshCw,
  Calendar,
  Star,
  Download,
  Navigation,
} from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';

interface ServiceRequest {
  _id: string;
  pet: { _id: string; name: string; breed?: string; age?: number; image?: string; photoUrl?: string };
  serviceType: string;
  preferredDate: string;
  timeWindow: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  location?: { address?: string; coordinates?: { lat: number; lng: number } };
  assignedStaff?: { _id: string; name: string; phone?: string; specialty?: string };
  scheduledTime?: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Reviewing Request',
  assigned: 'Staff Confirmed',
  in_progress: 'Service in Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function MyServiceRequestsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'active' | 'history' | 'scheduled'>('active');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      fetchMyRequests();
    }

    const onScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchMyRequests = async () => {
    try {
      setLoading(true);
      if (!localStorage.getItem('token')) {
        router.push('/login');
        return;
      }
      const response = await api.get('/service-requests/my/requests');
      if (response.data.success) {
        setRequests(response.data.data || []);
      }
      setError('');
    } catch (err: any) {
      console.error('Error fetching service requests:', err);
      setError(err.response?.data?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const isActive = (s: string) => ['pending', 'assigned', 'in_progress'].includes(s);
  const isHistory = (s: string) => ['completed', 'cancelled'].includes(s);
  const isScheduled = (r: ServiceRequest) => {
    if (isHistory(r.status)) return false;
    const dateStr = r.preferredDate ?? r.scheduledTime;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
  };

  useEffect(() => {
    if (!focusId || !requests.length) return;
    const target = requests.find((r) => r._id === focusId);
    if (!target) return;
    if (isHistory(target.status)) setTab('history');
    else if (isScheduled(target)) setTab('scheduled');
    else setTab('active');
  }, [focusId, requests]);

  useEffect(() => {
    if (!focusId) return;
    const timer = window.setTimeout(() => {
      highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [focusId, tab, requests]);

  const activeList = requests.filter((r) => isActive(r.status));
  const historyList = requests.filter((r) => isHistory(r.status));
  const scheduledList = requests.filter((r) => isScheduled(r));

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 border-amber-300',
      assigned: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
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
    const label = STATUS_LABELS[status] || status.replace('_', ' ');
    return (
      <span
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border-2 ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}
      >
        {(status === 'assigned' || status === 'in_progress') && (
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
        )}
        {icons[status]}
        {label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const currentList =
    tab === 'active' ? activeList : tab === 'history' ? historyList : scheduledList;

  if (loading) {
    return (
      <PageShell className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-paw-bark border-t-transparent mb-4" />
          <p className="text-paw-bark text-xl">Loading your appointments…</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Scheduling"
        title="My services"
        subtitle="Active, scheduled, and past appointments."
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={fetchMyRequests}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-paw-bark/20 bg-paw-cream/90 text-paw-bark hover:bg-paw-bark hover:text-paw-cream transition-colors font-medium shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="flex rounded-2xl paw-card-glass p-1 shadow-paw border border-paw-bark/10 mb-8">
          {(['active', 'history', 'scheduled'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors ${tab === t ? 'bg-paw-bark text-paw-cream shadow-paw' : 'text-paw-bark/70 hover:bg-paw-sand/60'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {currentList.length === 0 ? (
          <div className="paw-card-glass rounded-[20px] border border-paw-bark/10 shadow-paw p-10 text-center">
            <div className="w-20 h-20 rounded-2xl bg-paw-bark/10 flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-paw-bark" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {tab === 'active' && 'No active appointments'}
              {tab === 'history' && 'No history yet'}
              {tab === 'scheduled' && 'Nothing scheduled'}
            </h2>
            <p className="text-gray-600 mb-8 max-w-sm mx-auto">
              {tab === 'active' && 'Your live and in-progress services will appear here.'}
              {tab === 'history' && 'Completed and cancelled requests will show here.'}
              {tab === 'scheduled' && 'Upcoming appointments will appear here.'}
            </p>
            <Link
              href="/services/request"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-paw-bark text-paw-cream font-semibold hover:bg-paw-ink transition-colors shadow-paw-lg"
            >
              Book Now
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {currentList.map((req) => (
              <div
                key={req._id}
                ref={focusId === req._id ? highlightedRef : undefined}
                className={`paw-card-glass rounded-[20px] shadow-paw p-5 border transition-colors ${
                  focusId === req._id
                    ? 'border-paw-bark ring-2 ring-paw-bark/30'
                    : 'border-paw-bark/10 hover:border-paw-bark/25'
                }`}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  {getStatusBadge(req.status)}
                  <span className="text-xs text-gray-500">{formatDate(req.createdAt)}</span>
                </div>
                <p className="font-semibold text-gray-900 mt-3 text-lg">
                  {req.pet?.name ?? 'Pet'} · {req.serviceType}
                </p>
                <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-paw-bark" />
                  {formatDate(req.preferredDate)} — {req.timeWindow}
                </p>
                {req.location?.address && (
                  <p className="text-sm text-gray-700 flex items-start gap-2 mt-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-paw-bark flex-shrink-0" />
                    <span className="line-clamp-2">{req.location.address}</span>
                  </p>
                )}
                {req.assignedStaff && (
                  <p className="text-sm text-green-700 mt-2 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {req.assignedStaff.name}
                  </p>
                )}
                {(req.status === 'assigned' || req.status === 'in_progress') &&
                  req.location?.coordinates && (
                    <div className="mt-3 p-3 rounded-xl bg-paw-sand/60 border border-paw-bark/10">
                      <p className="text-sm font-medium text-paw-ink flex items-center gap-2">
                        <Navigation className="w-4 h-4" />
                        View live map & ETA in the mobile app
                      </p>
                    </div>
                  )}
                {req.status === 'completed' && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-paw-bark text-paw-bark font-medium hover:bg-paw-bark/5 transition-colors"
                      onClick={() => alert('Thank you! Review submitted.')}
                    >
                      <Star className="w-4 h-4" />
                      Leave Review
                    </button>
                    <button
                      type="button"
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-paw-bark text-paw-bark font-medium hover:bg-paw-bark/5 transition-colors"
                      onClick={() => alert('Prescription ready for download.')}
                    >
                      <Download className="w-4 h-4" />
                      Prescription
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 h-10 w-10 rounded-full bg-paw-bark text-paw-cream shadow-paw-lg flex items-center justify-center hover:bg-paw-ink transition-colors"
          aria-label="Back to top"
        >
          ↑
        </button>
      )}
    </PageShell>
  );
}

export default function MyServiceRequestsPage() {
  return (
    <Suspense
      fallback={
        <PageShell className="flex min-h-screen items-center justify-center">
          <p className="text-paw-bark">Loading…</p>
        </PageShell>
      }
    >
      <MyServiceRequestsPageInner />
    </Suspense>
  );
}
