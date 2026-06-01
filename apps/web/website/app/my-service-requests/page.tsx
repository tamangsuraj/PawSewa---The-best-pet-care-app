'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import {
  AlertCircle,
  ArrowUp,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  RefreshCw,
  Stethoscope,
  User,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ServiceRequest {
  _id: string;
  pet: { _id: string; name: string; breed?: string; age?: number; photoUrl?: string };
  serviceType: string;
  preferredDate: string;
  timeWindow: string;
  status: string;
  location?: { address?: string; coordinates?: { lat: number; lng: number } };
  assignedStaff?: { _id: string; name: string; phone?: string; specialty?: string };
  scheduledTime?: string;
  createdAt: string;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; pill: string; icon: typeof Clock; dot: string }> = {
  pending:     { label: 'Under Review',   pill: 'bg-amber-100 text-amber-800 border-amber-200',    icon: Clock,         dot: 'bg-amber-400' },
  assigned:    { label: 'Vet Assigned',   pill: 'bg-blue-100 text-blue-800 border-blue-200',       icon: User,          dot: 'bg-blue-400 animate-pulse' },
  accepted:    { label: 'Confirmed',      pill: 'bg-sky-100 text-sky-800 border-sky-200',          icon: CheckCircle,   dot: 'bg-sky-400' },
  en_route:    { label: 'On the Way',     pill: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Stethoscope,   dot: 'bg-indigo-400 animate-pulse' },
  arrived:     { label: 'Vet Arrived',    pill: 'bg-violet-100 text-violet-800 border-violet-200', icon: Stethoscope,   dot: 'bg-violet-400' },
  in_progress: { label: 'In Progress',    pill: 'bg-purple-100 text-purple-800 border-purple-200', icon: Stethoscope,   dot: 'bg-purple-400 animate-pulse' },
  completed:   { label: 'Completed',      pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, dot: 'bg-emerald-400' },
  cancelled:   { label: 'Cancelled',      pill: 'bg-red-100 text-red-700 border-red-200',           icon: AlertCircle,  dot: 'bg-red-400' },
  declined:    { label: 'Declined',       pill: 'bg-rose-100 text-rose-700 border-rose-200',        icon: AlertCircle,  dot: 'bg-rose-400' },
};

const SERVICE_ICONS: Record<string, string> = {
  'Appointment':    'Appt',
  'Health Checkup': 'Hlth',
  'Vaccination':    'Vacc',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function isActive(s: string)   { return ['pending','assigned','accepted','en_route','arrived','in_progress'].includes(s); }
function isHistory(s: string)  { return ['completed','cancelled','declined'].includes(s); }
function isScheduled(r: ServiceRequest) {
  if (isHistory(r.status)) return false;
  const d = new Date(r.preferredDate ?? r.scheduledTime ?? '');
  const today = new Date(); today.setHours(0,0,0,0);
  return !isNaN(d.getTime()) && d >= today;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-[1.5rem] border border-paw-bark/8 bg-white p-5 space-y-3">
      <div className="flex justify-between">
        <div className="h-5 w-24 paw-skeleton rounded-full" />
        <div className="h-4 w-16 paw-skeleton rounded-lg" />
      </div>
      <div className="h-4 w-2/3 paw-skeleton rounded-lg" />
      <div className="h-4 w-1/2 paw-skeleton rounded-lg" />
      <div className="h-8 w-full paw-skeleton rounded-xl" />
    </div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────
function RequestCard({
  req,
  highlighted,
  divRef,
}: {
  req: ServiceRequest;
  highlighted: boolean;
  divRef?: React.Ref<HTMLDivElement>;
}) {
  const cfg = STATUS_CONFIG[req.status] ?? { label: req.status, pill: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock, dot: 'bg-gray-400' };
  const IconComp = cfg.icon;
  const isActive_ = isActive(req.status);
  const isDone = req.status === 'completed';

  return (
    <div
      ref={divRef}
      className={`group rounded-[1.5rem] border bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-paw hover:-translate-y-0.5 ${
        highlighted ? 'border-paw-bark ring-2 ring-paw-bark/20' : 'border-paw-bark/10 hover:border-paw-bark/20'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-paw-bark/60">{SERVICE_ICONS[req.serviceType] ?? req.serviceType.slice(0, 4)}</span>
          <span className="font-display font-semibold text-paw-ink text-base">{req.serviceType}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {/* Pet + date */}
      <div className="mt-3 space-y-1.5">
        <p className="flex items-center gap-1.5 text-sm font-medium text-paw-ink">
          <span className="text-paw-bark/50">&#8227;</span>
          {req.pet?.name ?? 'Pet'}
          {req.pet?.breed ? <span className="text-paw-bark/50 font-normal">· {req.pet.breed}</span> : null}
        </p>
        {req.preferredDate && (
          <p className="flex items-center gap-1.5 text-xs text-paw-bark/60">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-paw-bark/40" strokeWidth={1.75} />
            {fmtDate(req.preferredDate)}
            {req.timeWindow ? <span className="font-medium text-paw-bark/50">· {req.timeWindow}</span> : null}
          </p>
        )}
        {req.location?.address && (
          <p className="flex items-start gap-1.5 text-xs text-paw-bark/60">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-paw-bark/40" strokeWidth={1.75} />
            <span className="line-clamp-2">{req.location.address}</span>
          </p>
        )}
      </div>

      {/* Vet chip */}
      {req.assignedStaff?.name && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-paw-teal-mid/20 bg-paw-teal-mid/8 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paw-teal-mid/20 text-xs font-bold text-paw-teal">
            {req.assignedStaff.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-paw-teal leading-tight">Dr. {req.assignedStaff.name}</p>
            {req.assignedStaff.specialty && (
              <p className="text-[10px] text-paw-teal/70">{req.assignedStaff.specialty}</p>
            )}
          </div>
          {isActive_ && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-paw-teal-mid">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paw-teal-mid" />
              Live
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-paw-bark/6 pt-3.5">
        <p className="text-[11px] text-paw-bark/40">
          Booked {fmtDate(req.createdAt)}
        </p>
        <div className="flex gap-2">
          {isDone && (
            <Link
              href={`/my-service-requests?focus=${req._id}`}
              className="flex items-center gap-1 rounded-full border border-paw-bark/20 px-3 py-1.5 text-xs font-semibold text-paw-bark hover:bg-paw-haze transition-colors"
            >
              View details
            </Link>
          )}
          {isActive_ && (
            <Link
              href={`/appointments/${req._id}`}
              className="flex items-center gap-1 rounded-full bg-paw-bark px-3 py-1.5 text-xs font-semibold text-paw-cream hover:bg-paw-ink transition-colors"
            >
              Track
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ tab }: { tab: 'active' | 'history' | 'scheduled' }) {
  const msgs = {
    active:    { title: 'No active visits', sub: 'Live and in-progress services appear here.', cta: true },
    scheduled: { title: 'Nothing scheduled', sub: 'Upcoming future appointments appear here.', cta: true },
    history:   { title: 'No past visits yet', sub: 'Completed and cancelled requests appear here.', cta: false },
  };
  const m = msgs[tab];
  return (
    <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-dashed border-paw-bark/15 bg-white/60 px-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-paw-haze">
        <Stethoscope className="h-7 w-7 text-paw-bark/40" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="font-display text-xl font-semibold text-paw-ink">{m.title}</h3>
        <p className="mt-1 text-sm text-paw-bark/60 max-w-xs">{m.sub}</p>
      </div>
      {m.cta && (
        <Link
          href="/services/request"
          className="paw-cta-primary mt-1 px-6 py-2.5 text-sm"
        >
          Book a visit
        </Link>
      )}
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────
function MyServiceRequestsPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const focusId       = searchParams.get('focus');
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [tab,      setTab]      = useState<'active' | 'history' | 'scheduled'>('active');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchMyRequests = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.get('/service-requests/my/requests');
      if (res.data.success) setRequests(res.data.data || []);
      setError('');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    void fetchMyRequests();
  }, [authLoading, isAuthenticated, router, fetchMyRequests]);

  // Set correct tab for focused request
  useEffect(() => {
    if (!focusId || !requests.length) return;
    const r = requests.find((x) => x._id === focusId);
    if (!r) return;
    if (isHistory(r.status)) setTab('history');
    else if (isScheduled(r)) setTab('scheduled');
    else setTab('active');
  }, [focusId, requests]);

  // Scroll to focused card
  useEffect(() => {
    if (!focusId) return;
    const t = window.setTimeout(() => {
      highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusId, tab, requests]);

  const activeList    = requests.filter((r) => isActive(r.status));
  const historyList   = requests.filter((r) => isHistory(r.status));
  const scheduledList = requests.filter((r) => isScheduled(r));
  const currentList   = tab === 'active' ? activeList : tab === 'history' ? historyList : scheduledList;

  if (authLoading || loading) {
    return (
      <PageShell>
        <PageHero eyebrow="Scheduling" title="My visits" />
        <PageContent compact className="max-w-4xl">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </PageContent>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Scheduling"
        title="My visits"
        subtitle="Track active, upcoming, and past appointments."
        actions={
          <button
            type="button"
            onClick={() => void fetchMyRequests()}
            className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-paw-cream backdrop-blur-sm hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      <PageContent compact className="max-w-4xl">
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Summary strip */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Active',    count: activeList.length,    tab: 'active'    as const, color: 'text-amber-600' },
            { label: 'Scheduled', count: scheduledList.length, tab: 'scheduled' as const, color: 'text-sky-600'   },
            { label: 'History',   count: historyList.length,   tab: 'history'   as const, color: 'text-emerald-600' },
          ].map(({ label, count, tab: t, color }) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`paw-stat-chip cursor-pointer ${tab === t ? 'ring-2 ring-paw-bark/25' : ''}`}
            >
              <span className={`font-display text-3xl font-semibold ${color}`}>{count}</span>
              <p className="text-xs text-paw-bark/55">{label}</p>
            </button>
          ))}
        </div>

        {/* Tab bar */}
        <div className="paw-tab-bar mb-6">
          {(['active', 'scheduled', 'history'] as const).map((t) => {
            const labels = { active: 'Active', scheduled: 'Scheduled', history: 'History' };
            const counts = { active: activeList.length, scheduled: scheduledList.length, history: historyList.length };
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                data-active={tab === t}
                className="paw-tab-item"
              >
                {labels[t]}
                {counts[t] > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    tab === t ? 'bg-paw-bark/10 text-paw-bark' : 'bg-paw-bark/8 text-paw-bark/50'
                  }`}>
                    {counts[t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Cards grid */}
        {currentList.length === 0 ? (
          <ScrollReveal>
            <EmptyState tab={tab} />
          </ScrollReveal>
        ) : (
          <ScrollReveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {currentList.map((req) => (
                <RequestCard
                  key={req._id}
                  req={req}
                  highlighted={focusId === req._id}
                  divRef={focusId === req._id ? highlightedRef : undefined}
                />
              ))}
            </div>
          </ScrollReveal>
        )}

        {/* Book again CTA */}
        {!loading && requests.length > 0 && (
          <ScrollReveal delay={100}>
            <div className="mt-10 flex items-center justify-between gap-4 rounded-2xl border border-paw-bark/10 bg-white p-5 shadow-sm sm:flex-row flex-col text-center sm:text-left">
              <div>
                <p className="font-semibold text-paw-ink">Need another visit?</p>
                <p className="text-xs text-paw-bark/55 mt-0.5">Same-day booking available for most services.</p>
              </div>
              <Link href="/services/request" className="paw-cta-primary whitespace-nowrap px-6 py-2.5 text-sm">
                Book a visit
              </Link>
            </div>
          </ScrollReveal>
        )}
      </PageContent>

      {/* Scroll to top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`scroll-top-btn ${scrolled ? 'visible' : ''} flex h-11 w-11 items-center justify-center rounded-full bg-paw-bark text-paw-cream shadow-paw-lg hover:bg-paw-ink transition-colors`}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </PageShell>
  );
}

export default function MyServiceRequestsPage() {
  return (
    <Suspense fallback={
      <PageShell className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-paw-bark/20 border-t-paw-bark animate-spin" />
        <p className="text-sm text-paw-bark/60">Loading…</p>
      </PageShell>
    }>
      <MyServiceRequestsPageInner />
    </Suspense>
  );
}
