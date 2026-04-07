'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  FileHeart,
  Calendar,
  Pill,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Plus,
  AlertTriangle,
  PawPrint,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useChatHub } from '@/context/ChatHubContext';
import { clsx } from 'clsx';
import { PageShell } from '@/components/layout/PageShell';
import { PawSewaLoader } from '@/components/PawSewaLoader';

export type PetListItem = {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  gender: string;
  weight?: number;
  photoUrl?: string;
  pawId?: string;
  dob?: string;
  createdAt: string;
};

type PetReminder = {
  _id: string;
  category: 'vaccination' | 'deworming' | 'flea_tick' | 'checkup';
  title: string;
  dueDate: string;
  status: 'upcoming' | 'completed' | 'skipped';
  completedAt?: string;
};

type WeightChart6mRow = {
  label: string;
  yearMonth: string;
  weightKg: number | null;
  hasRecord: boolean;
  recordedAt: string | null;
  source: string | null;
};

type ChartWeightPoint = {
  name: string;
  yearMonth: string;
  weightKg: number;
  isCurrent: boolean;
  isEstimate: boolean;
  hasRecord: boolean;
  recordedAt: string | null;
  source: string | null;
};

type HealthSummary = PetListItem & {
  medicalHistory?: string[];
  medicalConditions?: string;
  vaccinationStatus?: string;
  lastVetVisit?: string;
  reminders?: PetReminder[];
  age?: { years: number; months: number; display: string } | null;
  visit_days_ago?: number | null;
  weightChart6m?: WeightChart6mRow[];
};

type UnifiedAppointment = {
  _id: string;
  type?: string;
  status: string;
  preferredDate?: string;
  timeWindow?: string;
  createdAt?: string;
  petId?: { _id: string; name?: string } | string;
  staffId?: { _id: string; name?: string } | null;
  serviceId?: { _id: string; name?: string; type?: string } | null;
  description?: string;
};

type ServiceRequestRow = {
  _id: string;
  status: string;
  preferredDate?: string;
  scheduledTime?: string;
  timeWindow?: string;
  serviceType?: string;
  pet?: { _id: string; name?: string };
  assignedStaff?: { _id: string; name?: string };
  createdAt?: string;
};

export type AppointmentTableRow = {
  key: string;
  kind: 'unified' | 'service';
  id: string;
  displayNo: string;
  specialist: string;
  dateLabel: string;
  serviceLabel: string;
  status: string;
};

function formatAppointmentNo(id: string): string {
  const tail = id.replace(/[^a-fA-F0-9]/g, '').slice(-6) || id.slice(-6);
  return `#${tail.toUpperCase()}`;
}

function formatSpecialist(name: string | null | undefined): string {
  if (!name || name === '—') {
    return '—';
  }
  const t = name.trim();
  const lower = t.toLowerCase();
  if (lower.startsWith('dr.') || lower.startsWith('dr ')) {
    return t;
  }
  return `Dr. ${t}`;
}

function formatAgeFromDob(dob?: string, fallbackYears?: number): string {
  if (dob) {
    const birth = new Date(dob);
    if (!Number.isNaN(birth.getTime())) {
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      let months = now.getMonth() - birth.getMonth();
      if (months < 0) {
        years -= 1;
        months += 12;
      }
      if (now.getDate() < birth.getDate()) {
        months -= 1;
        if (months < 0) {
          years -= 1;
          months += 12;
        }
      }
      if (years >= 1) {
        return `${years} Year${years === 1 ? '' : 's'} ${months} Month${months === 1 ? '' : 's'}`;
      }
      const totalMonths = years * 12 + months;
      return `${Math.max(0, totalMonths)} Month${totalMonths === 1 ? '' : 's'}`;
    }
  }
  if (typeof fallbackYears === 'number' && fallbackYears >= 0) {
    return `${fallbackYears} Year${fallbackYears === 1 ? '' : 's'}`;
  }
  return '—';
}

function parseAllergies(medicalConditions?: string): string[] {
  if (!medicalConditions?.trim()) return [];
  return medicalConditions
    .split(/[,;]|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function healthStatusLabel(pet: HealthSummary | null): { text: string; dotClass: string } {
  if (!pet) return { text: '—', dotClass: 'bg-slate-400' };
  const cond = (pet.medicalConditions || '').toLowerCase();
  if (cond.includes('critical') || cond.includes('severe')) {
    return { text: 'Needs veterinary attention', dotClass: 'bg-amber-500' };
  }
  if (pet.vaccinationStatus === 'Overdue') {
    return { text: 'Vaccination overdue', dotClass: 'bg-amber-500' };
  }
  if (pet.vaccinationStatus === 'Due soon') {
    return { text: 'Stable — monitor vaccines', dotClass: 'bg-emerald-500' };
  }
  return { text: 'Stable condition', dotClass: 'bg-emerald-500' };
}

function monthLabels(): { key: string; label: string }[] {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: labels[d.getMonth()],
    });
  }
  return out;
}

/** Legacy fallback when API does not send weightChart6m (older backend). */
function buildWeightChartDataLegacy(currentKg: number | undefined): ChartWeightPoint[] {
  const months = monthLabels();
  const w = typeof currentKg === 'number' && currentKg > 0 ? currentKg : 0;
  const isReal = w > 0;
  return months.map((m, idx) => {
    const isLast = idx === months.length - 1;
    const value = isReal ? (isLast ? w : Math.max(0.1, w * (0.88 + idx * 0.024))) : 0;
    return {
      name: m.label,
      yearMonth: m.key,
      weightKg: Math.round(value * 10) / 10,
      isCurrent: isLast,
      isEstimate: isReal && !isLast,
      hasRecord: Boolean(isReal && isLast),
      recordedAt: null,
      source: null,
    };
  });
}

function buildChartFromWeightApi(
  rows: WeightChart6mRow[] | undefined,
  fallbackKg: number | undefined
): ChartWeightPoint[] {
  if (!rows || rows.length !== 6) {
    return buildWeightChartDataLegacy(fallbackKg);
  }
  return rows.map((row, idx) => ({
    name: row.label,
    yearMonth: row.yearMonth,
    weightKg: row.weightKg != null && row.weightKg > 0 ? row.weightKg : 0,
    isCurrent: idx === rows.length - 1,
    isEstimate: !row.hasRecord,
    hasRecord: row.hasRecord,
    recordedAt: row.recordedAt,
    source: row.source,
  }));
}

const SIDEBAR_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'health', label: 'Health Records', icon: FileHeart },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = (typeof SIDEBAR_TABS)[number]['id'];

/** Medical dashboard: data from `GET /pets/:id/health-summary` + unified appointments + service requests (same DB as `pawsewa_chat` when configured on the API). */
export function ClinicalMyPetsDashboard({
  pets,
  routePetId,
}: {
  pets: PetListItem[];
  routePetId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();
  const { openHubWithSupport } = useChatHub();

  const tabParam = (searchParams.get('tab') || 'dashboard') as TabId;
  const activeTab: TabId = SIDEBAR_TABS.some((t) => t.id === tabParam)
    ? tabParam
    : 'dashboard';

  const [activePetId, setActivePetId] = useState(() =>
    pets.some((p) => p._id === routePetId) ? routePetId : pets[0]?._id || ''
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [appointmentsUnified, setAppointmentsUnified] = useState<UnifiedAppointment[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestRow[]>([]);
  const [fetchError, setFetchError] = useState('');

  const [vaccineModal, setVaccineModal] = useState<{
    open: boolean;
    title: string;
    body: string;
  }>({ open: false, title: '', body: '' });

  useEffect(() => {
    if (pets.some((p) => p._id === routePetId)) {
      setActivePetId(routePetId);
    }
  }, [routePetId, pets]);

  const loadDashboardData = useCallback(async () => {
    if (!activePetId) return;
    setLoadingHealth(true);
    setFetchError('');
    try {
      const [hs, apptRes, srRes] = await Promise.all([
        api.get(`/pets/${activePetId}/health-summary`),
        api.get('/appointments/my').catch(() => ({ data: { success: false, data: [] } })),
        api.get('/service-requests/my/requests').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (hs.data?.success) {
        setHealth(hs.data.data as HealthSummary);
      } else {
        setHealth(null);
      }

      const appts = apptRes.data?.success ? apptRes.data.data || [] : [];
      setAppointmentsUnified(Array.isArray(appts) ? appts : []);

      const srs = srRes.data?.success ? srRes.data.data || [] : [];
      setServiceRequests(Array.isArray(srs) ? srs : []);

      console.log('[WEB-UI] My Pets Clinical Dashboard rendered and bound to backend data.');
    } catch (e: unknown) {
      console.error(e);
      setFetchError('Could not load pet health data. Try again shortly.');
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  }, [activePetId]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const setTab = (id: TabId) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set('tab', id);
    router.push(`/my-pets/${routePetId}?${q.toString()}`, { scroll: false });
    setMobileNavOpen(false);
  };

  const allergies = useMemo(() => parseAllergies(health?.medicalConditions), [health?.medicalConditions]);

  const vaccinationRows = useMemo(() => {
    const reminders = (health?.reminders || []).filter((r) => r.category === 'vaccination');
    const fromReminders = reminders.map((r) => ({
      id: r._id,
      name: r.title,
      dateLabel:
        r.status === 'completed' && r.completedAt
          ? new Date(r.completedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : `Due ${new Date(r.dueDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}`,
      detail: `Status: ${r.status}. ${r.title}`,
      kind: 'reminder' as const,
    }));
    const fromHistory = (health?.medicalHistory || []).slice(0, 8).map((line, i) => ({
      id: `mh-${i}`,
      name: line.length > 48 ? `${line.slice(0, 45)}…` : line,
      dateLabel: 'On record',
      detail: line,
      kind: 'history' as const,
    }));
    if (fromReminders.length) return fromReminders;
    return fromHistory;
  }, [health?.reminders, health?.medicalHistory]);

  const careTasks = useMemo(() => {
    const r = health?.reminders || [];
    return r
      .filter((x) => x.category !== 'vaccination')
      .slice(0, 12)
      .map((x) => ({
        id: x._id,
        title: x.title,
        timeLabel: new Date(x.dueDate).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        completed: x.status === 'completed' || x.status === 'skipped',
      }));
  }, [health?.reminders]);

  const tableRows: AppointmentTableRow[] = useMemo(() => {
    const petId = activePetId;
    const unified: AppointmentTableRow[] = appointmentsUnified
      .filter((a) => {
        const p = a.petId;
        const id = typeof p === 'object' && p ? p._id : String(p || '');
        return id === petId;
      })
      .map((a) => {
        const when = a.preferredDate || a.createdAt;
        const d = when ? new Date(when) : null;
        const datePart = d
          ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—';
        const tw = a.timeWindow || '';
        const dateLabel = tw ? `${datePart} • ${tw}` : datePart;
        const staff = a.staffId && typeof a.staffId === 'object' ? a.staffId.name : null;
        const svc =
          a.serviceId && typeof a.serviceId === 'object'
            ? a.serviceId.name || a.serviceId.type
            : a.description || a.type?.replace(/_/g, ' ') || 'Vet visit';
        return {
          key: `u-${a._id}`,
          kind: 'unified' as const,
          id: a._id,
          displayNo: formatAppointmentNo(a._id),
          specialist: formatSpecialist(staff),
          dateLabel,
          serviceLabel: svc || '—',
          status: (a.status || 'pending').toUpperCase(),
        };
      });

    const services: AppointmentTableRow[] = serviceRequests
      .filter((s) => s.pet?._id === petId)
      .map((s) => {
        const when = s.scheduledTime || s.preferredDate || s.createdAt;
        const d = when ? new Date(when) : null;
        const datePart = d
          ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—';
        const tw = s.timeWindow || '';
        const dateLabel = tw ? `${datePart} • ${tw}` : datePart;
        return {
          key: `s-${s._id}`,
          kind: 'service' as const,
          id: s._id,
          displayNo: formatAppointmentNo(s._id),
          specialist: formatSpecialist(s.assignedStaff?.name),
          dateLabel,
          serviceLabel: s.serviceType || 'Service request',
          status: (s.status || 'pending').replace(/_/g, ' ').toUpperCase(),
        };
      });

    return [...unified, ...services].sort((a, b) => {
      const parse = (row: AppointmentTableRow) => {
        if (row.kind === 'unified') {
          const raw = appointmentsUnified.find((x) => x._id === row.id);
          const t = raw?.preferredDate || raw?.createdAt;
          return t ? new Date(t).getTime() : 0;
        }
        const raw = serviceRequests.find((x) => x._id === row.id);
        const t = raw?.scheduledTime || raw?.preferredDate || raw?.createdAt;
        return t ? new Date(t).getTime() : 0;
      };
      return parse(b) - parse(a);
    });
  }, [activePetId, appointmentsUnified, serviceRequests]);

  const weightData = useMemo(
    () =>
      buildChartFromWeightApi(
        health?.weightChart6m,
        health?.weight ?? pets.find((p) => p._id === activePetId)?.weight
      ),
    [health?.weightChart6m, health?.weight, pets, activePetId]
  );

  const currentWeightDisplayKg = useMemo(() => {
    const rows = health?.weightChart6m;
    if (rows?.length === 6) {
      const last = rows[5];
      if (last.hasRecord && last.weightKg != null) return last.weightKg;
    }
    const w = health?.weight ?? pets.find((p) => p._id === activePetId)?.weight;
    return typeof w === 'number' && w > 0 ? w : null;
  }, [health?.weightChart6m, health?.weight, pets, activePetId]);

  const statusInfo = healthStatusLabel(health);
  const activePet = pets.find((p) => p._id === activePetId);
  const heroName = health?.name || activePet?.name || 'Pet';
  const heroBreed = health?.breed || activePet?.breed || '—';
  const heroPhoto = health?.photoUrl || activePet?.photoUrl;
  const pawIdDisplay = health?.pawId || activePet?.pawId || '';
  const idBadgeFallback = activePetId.replace(/[^a-fA-F0-9]/g, '').slice(-8).toUpperCase() || '—';

  const onRowNavigate = (row: AppointmentTableRow) => {
    if (row.kind === 'unified') {
      router.push(`/appointments/${row.id}`);
    } else {
      router.push(`/my-service-requests?focus=${row.id}`);
    }
  };

  const brownBarScale = ['#EBE0D4', '#D9CBB8', '#C4A882', '#A67B52', '#8B5A32', '#703418'];
  const barColors = weightData.map((d, i) => {
    if (d.weightKg <= 0) {
      return '#E8E4DF';
    }
    return brownBarScale[Math.min(i, brownBarScale.length - 1)];
  });

  return (
    <PageShell className="min-h-[calc(100vh-4.25rem)] bg-[#F5F5F5]">
    <div className="relative min-h-[calc(100vh-4.25rem)] text-slate-900">
      {/* Mobile top bar (below global Navbar) */}
      <div className="sticky top-[4.25rem] z-30 flex items-center justify-between border-b border-neutral-200 bg-[#F5F5F5]/95 backdrop-blur-md px-4 py-3 lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          className="rounded-lg p-2 text-paw-bark hover:bg-white"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-bold text-[#703418]">My Pets</span>
        <span className="w-10" />
      </div>

      <div className="flex items-start">
        {/* Sidebar — sticky on desktop; light gray canvas per medical dashboard spec */}
        <aside
          className={clsx(
            'fixed bottom-0 left-0 top-[4.25rem] z-50 w-[min(100%,280px)] transform border-r border-neutral-200 bg-[#F5F5F5] shadow-sm transition-transform lg:sticky lg:top-[4.25rem] lg:z-10 lg:max-h-[calc(100vh-4.25rem)] lg:w-64 lg:shrink-0 lg:translate-x-0 lg:overflow-y-auto lg:self-start',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <div className="flex h-full min-h-0 flex-col overflow-y-auto pt-4 lg:pt-6">
            <div className="border-b border-neutral-200/90 px-4 pb-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active pet
              </label>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-neutral-200">
                  {activePet?.photoUrl ? (
                    <Image src={activePet.photoUrl} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#703418]/35">
                      <PawPrint className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                    </div>
                  )}
                </div>
                <select
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm font-semibold text-[#703418] transition hover:border-[#703418]/40"
                  value={activePetId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const q = new URLSearchParams(searchParams.toString());
                    router.push(`/my-pets/${id}?${q.toString()}`);
                  }}
                >
                  {pets.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 truncate text-xs font-semibold tracking-wide text-[#703418]">
                {(activePet?.breed || 'Mixed / —').toString().toUpperCase()}
              </p>
              {(health?.pawId || activePet?.pawId) && (
                <p className="mt-2 truncate rounded-lg border border-[#E8DFD0] bg-cream px-2 py-1.5 font-mono text-[11px] font-semibold text-paw-bark">
                  PawID: {health?.pawId || activePet?.pawId}
                </p>
              )}
            </div>

            <nav className="relative flex-1 space-y-1 px-2 py-4">
              {SIDEBAR_TABS.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={clsx(
                      'relative flex w-full items-center gap-3 rounded-lg py-2.5 pl-3 pr-3 text-left text-sm font-semibold transition-colors lg:pl-4',
                      active
                        ? 'bg-white text-[#703418] shadow-sm'
                        : 'text-slate-600 hover:bg-white/70 hover:text-[#703418]'
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute left-0 top-1/2 hidden h-8 w-1 -translate-y-1/2 rounded-r lg:block',
                        active ? 'bg-[#703418]' : 'bg-transparent'
                      )}
                    />
                    <Icon className="h-5 w-5 shrink-0 opacity-80" />
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="space-y-1 border-t border-neutral-200 px-2 py-4">
              <button
                type="button"
                onClick={() => void openHubWithSupport()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-white/80"
              >
                <HelpCircle className="h-5 w-5" />
                Help Center
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-white/80"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>

          <button
            type="button"
            className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 transition hover:bg-white/90 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </aside>

        {mobileNavOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            aria-label="Close overlay"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        {/* Main — 12-column grid inside dashboard tab; canvas #F5F5F5 */}
        <main className="relative min-h-[calc(100vh-4.25rem)] flex-1 overflow-y-auto bg-[#F5F5F5] px-4 py-6 sm:px-6 lg:min-h-0 lg:px-8">
          {fetchError ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {fetchError}
            </div>
          ) : null}

          {activeTab === 'dashboard' && (
            <>
              {loadingHealth ? (
                <div className="flex flex-col items-center gap-4 py-20 text-center text-slate-500">
                  <PawSewaLoader width={150} />
                  <p>Loading clinical profile…</p>
                </div>
              ) : (
                <>
                  {/* Hero */}
                  <section className="col-span-12 mb-8 grid grid-cols-12 gap-6 lg:items-stretch">
                    <div className="col-span-12 flex justify-center lg:col-span-5 xl:col-span-4">
                      <div className="relative w-full max-w-md">
                        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-200 shadow-md">
                        {heroPhoto ? (
                          <Image src={heroPhoto} alt={heroName} fill className="object-cover" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[#703418]/20">
                            <PawPrint className="h-24 w-24" strokeWidth={1} aria-hidden />
                          </div>
                        )}
                        <div className="absolute bottom-3 right-3 max-w-[calc(100%-1.5rem)] rounded-full bg-[#703418] px-4 py-1.5 text-xs font-bold tracking-wide text-white shadow-md">
                          <span className="block truncate font-mono">
                            ID: {pawIdDisplay ? pawIdDisplay : `#${idBadgeFallback}`}
                          </span>
                        </div>
                      </div>
                      </div>
                    </div>
                    <div className="col-span-12 flex flex-col justify-center lg:col-span-7 xl:col-span-8">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A67C52]">
                        Pet medical profile
                      </p>
                      <h1 className="mt-2 font-sans text-4xl font-bold tracking-tight text-[#703418] md:text-5xl">
                        {heroName}
                      </h1>
                      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-neutral-200 pt-6 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Breed</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{heroBreed}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Age</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {formatAgeFromDob(health?.dob, health?.age?.years ?? activePet?.age)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</p>
                          <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
                            <span className={clsx('h-2.5 w-2.5 rounded-full', statusInfo.dotClass)} />
                            {statusInfo.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Widget grid — 12 columns, 6+6 mid row */}
                  <div className="grid grid-cols-12 gap-5">
                    {/* Weight */}
                    <div className="col-span-12 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-6 xl:col-span-6">
                      <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-[#703418]">Weight tracker</h2>
                        {currentWeightDisplayKg != null ? (
                          <span className="text-xs font-medium text-slate-500">
                            Current: {currentWeightDisplayKg} kg
                          </span>
                        ) : null}
                      </div>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weightData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <XAxis
                              dataKey="name"
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const p = payload[0].payload as ChartWeightPoint;
                                return (
                                  <div className="rounded-lg border border-[#E8DFD0] bg-white px-3 py-2 text-xs shadow-lg">
                                    <div className="font-semibold text-paw-bark">{p.name}</div>
                                    <div className="text-slate-600">
                                      {p.weightKg > 0 ? `${p.weightKg} kg` : 'No weigh-in this month'}
                                    </div>
                                    {p.hasRecord && p.recordedAt ? (
                                      <div className="mt-1 text-[10px] text-slate-500">
                                        {new Date(p.recordedAt).toLocaleString('en-GB', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                        {p.source ? ` · ${p.source}` : ''}
                                      </div>
                                    ) : null}
                                    {p.isEstimate && p.weightKg > 0 ? (
                                      <div className="mt-1 text-[10px] text-slate-400">
                                        Estimated from latest record (legacy view)
                                      </div>
                                    ) : null}
                                    {!p.hasRecord && p.weightKg <= 0 ? (
                                      <div className="mt-1 text-[10px] text-slate-400">
                                        Log weight via pet profile to build history
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              }}
                            />
                            <Bar dataKey="weightKg" radius={[6, 6, 0, 0]} maxBarSize={48}>
                              {weightData.map((_, i) => (
                                <Cell key={i} fill={barColors[i]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {(() => {
                        const last = weightData[weightData.length - 1];
                        if (!last) {
                          return null;
                        }
                        const kg =
                          currentWeightDisplayKg ??
                          (last.weightKg > 0 ? last.weightKg : null);
                        return (
                          <p className="mt-2 text-center text-xs font-bold tracking-wide text-[#703418]">
                            {last.name.toUpperCase()}
                            {kg != null ? ` (CURRENT: ${kg}KG)` : ''}
                          </p>
                        );
                      })()}
                    </div>

                    {/* Allergies — clinical teal */}
                    <div
                      className="col-span-12 rounded-2xl p-5 shadow-md lg:col-span-6 xl:col-span-6"
                      style={{ backgroundColor: '#004D4D' }}
                    >
                      <h2 className="text-sm font-bold text-white">Active allergies</h2>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {allergies.length ? (
                          allergies.map((a) => (
                            <span
                              key={a}
                              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm"
                            >
                              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                              {a}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-white/80">No active allergies on file.</p>
                        )}
                      </div>
                    </div>

                    {/* Vaccinations */}
                    <div className="col-span-12 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-6 xl:col-span-6">
                      <h2 className="text-sm font-bold text-[#703418]">Vaccination history</h2>
                      <ul className="mt-4 space-y-3">
                        {vaccinationRows.length ? (
                          vaccinationRows.map((row) => (
                            <li
                              key={row.id}
                              className="flex flex-col gap-2 border-b border-[#F0EBE3] pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="font-medium text-paw-bark">{row.name}</p>
                                <p className="text-xs text-slate-500">Administered / due: {row.dateLabel}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setVaccineModal({
                                    open: true,
                                    title: row.name,
                                    body: row.detail,
                                  })
                                }
                                className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#703418] transition hover:border-[#703418] hover:bg-[#703418]/5"
                              >
                                View record
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-slate-500">No vaccination records yet.</li>
                        )}
                      </ul>
                    </div>

                    {/* Daily care */}
                    <div className="relative col-span-12 rounded-2xl bg-[#703418] p-5 text-white shadow-md lg:col-span-6 xl:col-span-6">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <h2 className="text-sm font-bold text-white">Daily care schedule</h2>
                        <Link
                          href={
                            activePetId
                              ? `/services/request?petId=${encodeURIComponent(activePetId)}`
                              : '/services/request'
                          }
                          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#703418] shadow-sm transition hover:bg-neutral-100"
                        >
                          <Plus className="h-4 w-4" />
                          Book vet visit
                        </Link>
                      </div>
                      <ul className="space-y-3">
                        {careTasks.length ? (
                          careTasks.map((t) => (
                            <li
                              key={t.id}
                              className={clsx(
                                'flex items-center justify-between gap-2 border-b border-white/15 pb-2 text-sm last:border-0',
                                t.completed && 'opacity-70'
                              )}
                            >
                              <span className={clsx(t.completed && 'line-through decoration-white/80')}>
                                {t.title}
                              </span>
                              <span className="shrink-0 text-xs text-white/80">{t.timeLabel}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-white/85">
                            No care reminders. Book a vet visit to stay on track.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Appointments table */}
                  <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
                    <h2 className="text-sm font-bold text-[#703418]">Recent appointments</h2>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <th className="pb-3 pr-4">Appointment no.</th>
                            <th className="pb-3 pr-4">Specialist</th>
                            <th className="pb-3 pr-4">Date &amp; time</th>
                            <th className="pb-3 pr-4">Service</th>
                            <th className="pb-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.length ? (
                            tableRows.slice(0, 12).map((row) => (
                              <tr
                                key={row.key}
                                className="cursor-pointer border-t border-neutral-100 transition-colors hover:bg-[#F5F5F5]"
                                onClick={() => onRowNavigate(row)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onRowNavigate(row);
                                  }
                                }}
                                tabIndex={0}
                                role="link"
                              >
                                <td className="py-3 pr-4 font-mono text-xs font-medium">{row.displayNo}</td>
                                <td className="py-3 pr-4">{row.specialist}</td>
                                <td className="py-3 pr-4 text-slate-600">{row.dateLabel}</td>
                                <td className="py-3 pr-4">{row.serviceLabel}</td>
                                <td className="py-3">
                                  <span
                                    className={clsx(
                                      'inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide',
                                      row.status === 'COMPLETED' || row.status === 'CANCELLED'
                                        ? 'bg-neutral-200 text-neutral-700'
                                        : 'bg-amber-100 text-amber-900'
                                    )}
                                  >
                                    {row.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500">
                                No appointments for this pet yet.{' '}
                                <Link href="/vets" className="font-semibold text-paw-bark underline">
                                  Book a clinic visit
                                </Link>
                                .
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {activeTab === 'health' && (
            <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-[#E8DFD0] bg-white p-6 shadow-sm">
              <h2 className="font-display text-2xl text-paw-bark">Health records</h2>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conditions</h3>
                <p className="mt-2 text-slate-700">{health?.medicalConditions || 'None recorded.'}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Medical history
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                  {(health?.medicalHistory || []).length ? (
                    health!.medicalHistory!.map((line, i) => <li key={i}>{line}</li>)
                  ) : (
                    <li className="list-none pl-0 text-slate-500">No entries yet.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="mx-auto max-w-4xl rounded-2xl border border-[#E8DFD0] bg-white p-6 shadow-sm">
              <h2 className="font-display text-2xl text-paw-bark">Appointments</h2>
              <p className="mt-2 text-sm text-slate-600">
                Full history for {heroName}. Select a row to open details.
              </p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <tbody>
                    {tableRows.map((row) => (
                      <tr
                        key={row.key}
                        className="cursor-pointer border-t border-[#F0EBE3] hover:bg-cream"
                        onClick={() => onRowNavigate(row)}
                      >
                        <td className="py-3 font-mono text-xs">{row.displayNo}</td>
                        <td className="py-3">{row.specialist}</td>
                        <td className="py-3 text-slate-600">{row.dateLabel}</td>
                        <td className="py-3">{row.serviceLabel}</td>
                        <td className="py-3">
                          <span className="rounded-full bg-[#ECE8E0] px-2 py-1 text-xs font-semibold">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-[#E8DFD0] bg-white p-8 text-center shadow-sm">
              <Pill className="mx-auto h-10 w-10 text-paw-bark opacity-70" />
              <h2 className="mt-4 font-display text-2xl text-paw-bark">Prescriptions</h2>
              <p className="mt-3 text-slate-600">
                Prescriptions from your vet will appear here when linked to visits. For now, check your
                health records or ask your clinic via{' '}
                <button
                  type="button"
                  className="font-semibold text-careTeal underline"
                  onClick={() => void openHubWithSupport()}
                >
                  Help Center
                </button>
                .
              </p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-[#E8DFD0] bg-white p-6 shadow-sm">
              <h2 className="font-display text-2xl text-paw-bark">Settings</h2>
              <Link
                href="/my-pets/add"
                className="block rounded-xl border border-[#E8DFD0] bg-cream px-4 py-3 font-medium text-paw-bark hover:bg-[#F0EBE3]"
              >
                Add another pet
              </Link>
              <Link
                href="/my-cases"
                className="block rounded-xl border border-[#E8DFD0] px-4 py-3 font-medium text-slate-700 hover:bg-cream"
              >
                My cases
              </Link>
              <Link
                href="/request-assistance"
                className="block rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-800 hover:bg-red-100"
              >
                Request emergency assistance
              </Link>
            </div>
          )}
        </main>
      </div>

      {vaccineModal.open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vaccine-modal-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="vaccine-modal-title" className="text-lg font-semibold text-paw-bark">
              {vaccineModal.title}
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{vaccineModal.body}</p>
            <p className="mt-4 text-xs text-slate-500">
              PDF attachments are not stored for this record in PawSewa web yet; use the mobile app or contact
              your vet for official documents.
            </p>
            <button
              type="button"
              className="mt-6 w-full rounded-xl bg-paw-bark py-3 font-semibold text-white hover:opacity-95"
              onClick={() => setVaccineModal((m) => ({ ...m, open: false }))}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
    </PageShell>
  );
}
