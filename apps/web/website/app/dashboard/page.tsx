'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useChatHub } from '@/context/ChatHubContext';
import api from '@/lib/api';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Headphones,
  LifeBuoy,
  Mail,
  Package,
  PawPrint,
  Phone,
  Shield,
  ShoppingBag,
  Stethoscope,
  TrendingUp,
  User,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Pet {
  _id: string;
  name: string;
  species?: string;
  breed?: string;
  age?: number;
  photoUrl?: string;
}

interface ServiceRequest {
  _id: string;
  serviceType?: string;
  status: string;
  preferredDate?: string;
  pet?: { name?: string };
  assignedStaff?: { name?: string };
  location?: { address?: string };
}

interface OrderRow {
  _id?: string;
  status?: string;
  total?: number;
  createdAt?: string;
  items?: Array<{ name?: string; quantity?: number }>;
  deliveryLocation?: { address?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  pending:     { label: 'Under Review',      color: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-400' },
  assigned:    { label: 'Vet Assigned',       color: 'bg-blue-100 text-blue-800',    dot: 'bg-blue-400 animate-pulse' },
  accepted:    { label: 'Visit Confirmed',    color: 'bg-sky-100 text-sky-800',      dot: 'bg-sky-400' },
  en_route:    { label: 'Vet on the Way',     color: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-400 animate-pulse' },
  arrived:     { label: 'Vet Arrived',        color: 'bg-violet-100 text-violet-800', dot: 'bg-violet-400' },
  in_progress: { label: 'In Progress',        color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-400 animate-pulse' },
  completed:   { label: 'Completed',          color: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-400' },
  cancelled:   { label: 'Cancelled',          color: 'bg-red-100 text-red-700',      dot: 'bg-red-400' },
  declined:    { label: 'Declined',           color: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-400' },
};

const ORDER_STATUS_META: Record<string, { label: string; color: string }> = {
  pending:      { label: 'Processing',      color: 'bg-amber-100 text-amber-800'  },
  confirmed:    { label: 'Confirmed',       color: 'bg-blue-100 text-blue-800'    },
  packed:       { label: 'Packed',          color: 'bg-sky-100 text-sky-800'      },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-violet-100 text-violet-800' },
  delivered:    { label: 'Delivered',       color: 'bg-emerald-100 text-emerald-800' },
  cancelled:    { label: 'Cancelled',       color: 'bg-red-100 text-red-700'      },
};

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Dog', cat: 'Cat', rabbit: 'Rbbt', bird: 'Bird', fish: 'Fish', hamster: 'Hams',
};

// ─── Subcomponents ────────────────────────────────────────────────────────────
function SkeletonCard({ h = 'h-24' }: { h?: string }) {
  return <div className={`paw-skeleton ${h} w-full rounded-2xl`} />;
}

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { openHubWithSupport } = useChatHub();

  const [pets,     setPets]     = useState<Pet[]>([]);
  const [visits,   setVisits]   = useState<ServiceRequest[]>([]);
  const [orders,   setOrders]   = useState<OrderRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, vRes, oRes] = await Promise.allSettled([
        api.get('/pets/my-pets'),
        api.get('/service-requests/my/requests'),
        api.get('/orders/my'),
      ]);
      if (pRes.status === 'fulfilled' && pRes.value.data?.success) setPets(pRes.value.data.data ?? []);
      if (vRes.status === 'fulfilled' && vRes.value.data?.success) setVisits(vRes.value.data.data ?? []);
      if (oRes.status === 'fulfilled' && oRes.value.data?.success) setOrders(oRes.value.data.data ?? []);
    } catch { /* individual failures handled in allSettled */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    void fetchData();
  }, [authLoading, user, router, fetchData]);

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paw-cream">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-paw-bark/20 border-t-paw-bark animate-spin" />
          <p className="text-sm text-paw-bark/60">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Derived data
  const upcomingVisits = visits.filter((v) => !['completed', 'cancelled', 'declined'].includes(v.status));
  const completedVisits = visits.filter((v) => v.status === 'completed');
  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status ?? ''));
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const QUICK_ACTIONS = [
    { label: 'Book a vet',       sub: 'Home visit or clinic',   icon: Stethoscope, href: '/services/request', accent: 'from-[#703418]/10 to-[#703418]/5',  iconColor: 'text-paw-bark'     },
    { label: 'My Pets',          sub: 'Health records',         icon: PawPrint,    href: '/my-pets',          accent: 'from-paw-teal-mid/10 to-teal-500/5', iconColor: 'text-paw-teal-mid' },
    { label: 'Shop supplies',    sub: 'Premium marketplace',    icon: ShoppingBag, href: '/shop',             accent: 'from-amber-500/10 to-amber-300/5',   iconColor: 'text-amber-600'    },
    { label: 'Emergency help',   sub: 'Urgent assistance',      icon: LifeBuoy,    href: '/request-assistance', accent: 'from-rose-500/10 to-rose-300/5', iconColor: 'text-rose-600'     },
  ] as const;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative h-14 w-14 shrink-0">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-paw-bark to-paw-ink flex items-center justify-center text-xl font-bold text-paw-cream shadow-paw">
                {user.name?.charAt(0)?.toUpperCase() ?? <User className="h-6 w-6" />}
              </div>
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400 shadow-sm" />
            </div>
            <div>
              <p className="text-sm text-paw-bark/55 font-medium">{today}</p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-paw-ink sm:text-3xl">
                {greeting()}, {user.name.split(' ')[0]}.
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void openHubWithSupport()}
            className="flex items-center gap-2 self-start rounded-full border border-paw-bark/15 bg-white px-4 py-2.5 text-sm font-semibold text-paw-bark shadow-sm transition-all hover:bg-paw-haze hover:shadow-paw"
          >
            <Headphones className="h-4 w-4" />
            Customer support
          </button>
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} h="h-[88px]" />)
          ) : (
            <>
              <div className="paw-stat-chip">
                <div className="flex items-center gap-1.5">
                  <PawPrint className="h-4 w-4 text-paw-bark/50" strokeWidth={1.75} />
                  <span className="font-display text-3xl font-semibold text-paw-ink">{pets.length}</span>
                </div>
                <p className="text-xs text-paw-bark/55">Pet{pets.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="paw-stat-chip">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-500/70" strokeWidth={1.75} />
                  <span className="font-display text-3xl font-semibold text-paw-ink">{upcomingVisits.length}</span>
                </div>
                <p className="text-xs text-paw-bark/55">Upcoming</p>
              </div>
              <div className="paw-stat-chip">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500/70" strokeWidth={1.75} />
                  <span className="font-display text-3xl font-semibold text-paw-ink">{completedVisits.length}</span>
                </div>
                <p className="text-xs text-paw-bark/55">Completed</p>
              </div>
              <div className="paw-stat-chip">
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-violet-500/70" strokeWidth={1.75} />
                  <span className="font-display text-3xl font-semibold text-paw-ink">{activeOrders.length}</span>
                </div>
                <p className="text-xs text-paw-bark/55">Active orders</p>
              </div>
            </>
          )}
        </div>

        {/* ── Quick actions ─────────────────────────────────────────────── */}
        <ScrollReveal>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_ACTIONS.map(({ label, sub, icon: Icon, href, accent, iconColor }) => (
              <Link key={label} href={href} className="paw-action-card group">
                <div className={`icon-wrap group-hover:scale-105 bg-gradient-to-br ${accent}`}>
                  <Icon className={`h-5.5 w-5.5 ${iconColor}`} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-semibold text-paw-ink text-sm leading-tight">{label}</p>
                  <p className="mt-0.5 text-xs text-paw-bark/55">{sub}</p>
                </div>
                <ArrowRight className={`absolute right-4 top-4 h-4 w-4 ${iconColor} opacity-0 transition-opacity group-hover:opacity-70`} />
              </Link>
            ))}
          </div>
        </ScrollReveal>

        {/* ── Main content: Pets + Visits ───────────────────────────────── */}
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_1.15fr]">

          {/* My Pets */}
          <ScrollReveal>
            <div className="rounded-[1.75rem] border border-paw-bark/10 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-paw-ink">My Pets</h2>
                <Link href="/my-pets" className="flex items-center gap-1 text-xs font-semibold text-paw-teal-mid hover:underline">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <SkeletonCard key={i} h="h-16" />)}
                </div>
              ) : pets.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paw-haze">
                    <PawPrint className="h-6 w-6 text-paw-bark/40" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-semibold text-paw-ink text-sm">No pets added yet</p>
                    <p className="mt-0.5 text-xs text-paw-bark/55">Add your companion to unlock health tracking.</p>
                  </div>
                  <Link
                    href="/my-pets/add"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-paw-bark px-4 py-2 text-xs font-bold text-paw-cream shadow-sm hover:bg-paw-ink transition-colors"
                  >
                    <PawPrint className="h-3.5 w-3.5" />
                    Add first pet
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {pets.slice(0, 4).map((pet) => (
                    <li key={pet._id}>
                      <Link
                        href={`/my-pets/${pet._id}`}
                        className="group flex items-center gap-3.5 rounded-xl border border-paw-bark/8 p-3.5 transition-all hover:border-paw-bark/20 hover:bg-paw-haze/40"
                      >
                        {/* Avatar */}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-paw-bark/15 to-paw-bark/5 text-xl">
                          {SPECIES_LABEL[pet.species?.toLowerCase() ?? ''] ?? (pet.species?.slice(0, 3) ?? 'Pet')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-paw-ink text-sm leading-tight">{pet.name}</p>
                          <p className="mt-0.5 truncate text-xs text-paw-bark/55">
                            {[pet.species, pet.breed, pet.age != null ? `${pet.age} yr` : null].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-paw-bark/30 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                  {pets.length > 4 && (
                    <Link href="/my-pets" className="block pt-1 text-center text-xs font-medium text-paw-teal-mid hover:underline">
                      +{pets.length - 4} more pets
                    </Link>
                  )}
                </ul>
              )}

              {!loading && pets.length > 0 && (
                <Link
                  href="/my-pets/add"
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-paw-bark/20 py-2.5 text-xs font-semibold text-paw-bark/50 transition-colors hover:border-paw-bark/35 hover:text-paw-bark/70"
                >
                  + Add another pet
                </Link>
              )}
            </div>
          </ScrollReveal>

          {/* Upcoming Visits */}
          <ScrollReveal delay={80}>
            <div className="rounded-[1.75rem] border border-paw-bark/10 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-paw-ink">Upcoming visits</h2>
                <Link href="/my-service-requests" className="flex items-center gap-1 text-xs font-semibold text-paw-teal-mid hover:underline">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <SkeletonCard key={i} h="h-20" />)}
                </div>
              ) : upcomingVisits.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paw-haze">
                    <Calendar className="h-6 w-6 text-paw-bark/40" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-semibold text-paw-ink text-sm">No upcoming visits</p>
                    <p className="mt-0.5 text-xs text-paw-bark/55">Book your first vet visit below.</p>
                  </div>
                  <Link
                    href="/services/request"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-paw-bark px-4 py-2 text-xs font-bold text-paw-cream shadow-sm hover:bg-paw-ink transition-colors"
                  >
                    <Stethoscope className="h-3.5 w-3.5" />
                    Book now
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {upcomingVisits.slice(0, 4).map((v) => (
                    <li key={v._id} className="rounded-xl border border-paw-bark/8 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paw-bark/8">
                            <Stethoscope className="h-4 w-4 text-paw-bark/70" strokeWidth={1.75} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-paw-ink leading-tight">
                              {v.serviceType ?? 'Vet Visit'}
                            </p>
                            <p className="mt-0.5 text-xs text-paw-bark/55">
                              {v.pet?.name ? `${v.pet.name} · ` : ''}
                              {v.preferredDate ? fmtDate(v.preferredDate) : ''}
                            </p>
                            {v.assignedStaff?.name && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-paw-bark/50">
                                <User className="h-3 w-3" />
                                Dr. {v.assignedStaff.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <StatusPill status={v.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollReveal>
        </div>

        {/* ── Recent Orders ─────────────────────────────────────────────── */}
        <ScrollReveal delay={120}>
          <div className="mb-8 rounded-[1.75rem] border border-paw-bark/10 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-paw-ink">Recent orders</h2>
              <Link href="/my-orders" className="flex items-center gap-1 text-xs font-semibold text-paw-teal-mid hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => <SkeletonCard key={i} h="h-24" />)}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex items-center gap-4 rounded-xl border border-dashed border-paw-bark/15 px-5 py-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paw-haze">
                  <ShoppingBag className="h-5 w-5 text-paw-bark/40" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-semibold text-paw-ink text-sm">No orders yet</p>
                  <p className="mt-0.5 text-xs text-paw-bark/55">Browse our curated pet supply shop.</p>
                </div>
                <Link href="/shop" className="ml-auto shrink-0 rounded-full bg-paw-bark px-4 py-2 text-xs font-bold text-paw-cream hover:bg-paw-ink transition-colors">
                  Shop now
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {orders.slice(0, 3).map((o, i) => {
                  const sMeta = ORDER_STATUS_META[o.status ?? 'pending'] ?? { label: o.status ?? '', color: 'bg-gray-100 text-gray-700' };
                  const firstItem = o.items?.[0];
                  return (
                    <div key={o._id ?? i} className="rounded-xl border border-paw-bark/8 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paw-haze">
                          <Package className="h-4 w-4 text-paw-bark/60" strokeWidth={1.75} />
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sMeta.color}`}>
                          {sMeta.label}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-paw-ink leading-tight">
                        {firstItem?.name ?? 'Order'}
                        {(o.items?.length ?? 0) > 1 ? ` +${(o.items?.length ?? 1) - 1} more` : ''}
                      </p>
                      {o.createdAt && (
                        <p className="mt-0.5 text-xs text-paw-bark/50">{fmtDate(o.createdAt)}</p>
                      )}
                      {o.total != null && (
                        <p className="mt-2 text-sm font-bold text-paw-bark">
                          रू {Number(o.total).toLocaleString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollReveal>

        {/* ── Account card ──────────────────────────────────────────────── */}
        <ScrollReveal delay={160}>
          <div className="rounded-[1.75rem] border border-paw-bark/10 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-paw-ink">Account</h2>
              {user.role !== 'pet_owner' && (
                <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
                  {user.role.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Mail,   label: 'Email',  value: user.email    },
                { icon: Phone,  label: 'Phone',  value: user.phone ?? '—'  },
                { icon: Shield, label: 'Role',   value: user.role.replace('_', ' ') },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-paw-bark/8 bg-paw-haze/40 p-3.5">
                  <Icon className="h-4 w-4 shrink-0 text-paw-teal-mid" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-paw-bark/45">{label}</p>
                    <p className="truncate text-sm font-medium text-paw-ink capitalize">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {user.role !== 'pet_owner' && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-600 mt-0.5" strokeWidth={2} />
                <p className="text-xs text-amber-800">
                  This is the customer website. For professional features, use the{' '}
                  <strong>Partner mobile app</strong> or the admin panel.
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/my-service-requests" className="flex items-center gap-1.5 rounded-full border border-paw-bark/15 px-4 py-2 text-xs font-semibold text-paw-ink hover:bg-paw-haze transition-colors">
                <ClipboardList className="h-3.5 w-3.5" /> My visits
              </Link>
              <Link href="/my-orders" className="flex items-center gap-1.5 rounded-full border border-paw-bark/15 px-4 py-2 text-xs font-semibold text-paw-ink hover:bg-paw-haze transition-colors">
                <Package className="h-3.5 w-3.5" /> Orders
              </Link>
              <button
                type="button"
                onClick={() => { logout(); router.push('/'); }}
                className="flex items-center gap-1.5 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </PageShell>
  );
}
