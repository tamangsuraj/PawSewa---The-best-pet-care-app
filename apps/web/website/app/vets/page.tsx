'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, MapPin, RefreshCw, Search, Stethoscope, X } from 'lucide-react';
import axios from 'axios';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { getWebsiteApiBase, ngrokBrowserBypassHeaders } from '@/lib/apiEnv';

interface Vet {
  _id: string;
  name: string;
  email: string;
  specialization?: string;
  clinicName?: string;
  clinicLocation?: string;
  phone?: string;
}

const SPECIALIZATION_COLORS: Record<string, string> = {
  'General Practice': 'bg-paw-bark/10 text-paw-bark',
  'Surgery':          'bg-rose-100 text-rose-700',
  'Dermatology':      'bg-amber-100 text-amber-700',
  'Dentistry':        'bg-sky-100 text-sky-700',
  'Internal Medicine':'bg-violet-100 text-violet-700',
};

function specializationColor(spec: string | undefined): string {
  if (!spec) return 'bg-paw-bark/10 text-paw-bark';
  return SPECIALIZATION_COLORS[spec] ?? 'bg-paw-teal-mid/10 text-paw-teal';
}

// Stable avatar gradient per first character
const AVATAR_GRADIENTS = [
  'from-[#703418] to-[#4a2310]',
  'from-[#0d9488] to-[#0f766e]',
  'from-amber-600 to-amber-800',
  'from-violet-600 to-violet-800',
  'from-rose-600 to-rose-800',
];
function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

export default function VetDirectoryPage() {
  const [vets, setVets]       = useState<Vet[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [search, setSearch]   = useState('');
  const [spec, setSpec]       = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${getWebsiteApiBase()}/vets/public`, {
          headers: ngrokBrowserBypassHeaders,
          timeout: 15000,
        });
        if (res.data.success) setVets(res.data.data);
        else setApiError('Could not load veterinarians. Please try again.');
      } catch (err: unknown) {
        const ax = err as { code?: string };
        if (ax.code === 'ECONNABORTED') {
          setApiError('The server took too long to respond. Check your connection and refresh.');
        } else {
          setApiError('Could not reach the server. Please refresh or try again later.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const specializations = useMemo(
    () => Array.from(new Set(vets.map((v) => v.specialization).filter(Boolean))).sort(),
    [vets],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vets.filter((v) => {
      const matchSearch =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.clinicName?.toLowerCase().includes(q) ||
        v.clinicLocation?.toLowerCase().includes(q) ||
        v.specialization?.toLowerCase().includes(q);
      const matchSpec = !spec || v.specialization === spec;
      return matchSearch && matchSpec;
    });
  }, [vets, search, spec]);

  const hasFilters = !!(search || spec);

  return (
    <PageShell>
      <PageHero
        eyebrow="Directory"
        title="Find a veterinarian"
        subtitle="Browse our network of verified, experienced vets — book directly from their profile."
      />

      <PageContent>
        {/* ── Search & filter bar ────────────────────────────────────────── */}
        <div className="mb-10 flex flex-col gap-3 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-paw-bark/40" />
            <input
              type="text"
              placeholder="Search by name, clinic, or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="paw-input pl-10 pr-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-paw-bark/40 hover:text-paw-bark/70"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Spec filter */}
          <select
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            className="paw-input sm:max-w-[220px] cursor-pointer"
          >
            <option value="">All specializations</option>
            {specializations.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSpec(''); }}
              className="flex items-center gap-1.5 rounded-xl border border-paw-bark/15 px-4 py-2.5 text-sm font-medium text-paw-bark/70 hover:bg-paw-haze transition-colors whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>

        {/* ── API error banner ─────────────────────────────────────────────── */}
        {apiError && !loading && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{apiError}</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* ── Results count ────────────────────────────────────────────────── */}
        <p className="mb-6 text-sm text-paw-bark/60">
          {loading ? 'Loading…' : (
            <>Showing <span className="font-semibold text-paw-ink">{filtered.length}</span> veterinarian{filtered.length !== 1 ? 's' : ''}</>
          )}
        </p>

        {/* ── Grid ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bento-card animate-pulse p-6 space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-paw-sand" />
                <div className="h-4 w-2/3 rounded-lg bg-paw-sand" />
                <div className="h-3 w-1/2 rounded-lg bg-paw-sand" />
                <div className="h-3 w-3/4 rounded-lg bg-paw-sand" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <ScrollReveal>
            <div className="bento-card flex flex-col items-center py-20 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-paw-bark/8">
                <Stethoscope className="h-8 w-8 text-paw-bark/40" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-xl font-semibold text-paw-ink mb-2">No results found</h3>
              <p className="text-sm text-paw-bark/60 mb-5">Try a different name, location, or specialization.</p>
              <button
                type="button"
                onClick={() => { setSearch(''); setSpec(''); }}
                className="text-sm font-semibold text-paw-teal-mid hover:underline"
              >
                Clear filters
              </button>
            </div>
          </ScrollReveal>
        ) : (
          <ScrollReveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((vet) => (
                <Link key={vet._id} href={`/vets/${vet._id}`} className="group">
                  <article className="bento-card flex h-full flex-col overflow-hidden">
                    {/* Card banner */}
                    <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${avatarGradient(vet.name)}`}>
                      {/* Decorative dots */}
                      <div className="pointer-events-none absolute inset-0 opacity-10" style={{
                        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                        backgroundSize: '16px 16px',
                      }} />
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-white/25 bg-white/15 backdrop-blur-sm shadow-lg">
                        <span className="font-display text-3xl font-bold text-white">
                          {vet.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-paw-ink leading-tight">
                          {vet.name}
                        </h3>
                        {vet.specialization && (
                          <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${specializationColor(vet.specialization)}`}>
                            {vet.specialization}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-sm text-paw-bark/65">
                        {vet.clinicName && (
                          <p className="flex items-center gap-1.5">
                            <Stethoscope className="h-3.5 w-3.5 shrink-0 text-paw-bark/40" strokeWidth={1.75} />
                            {vet.clinicName}
                          </p>
                        )}
                        {vet.clinicLocation && (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-paw-bark/40" strokeWidth={1.75} />
                            {vet.clinicLocation}
                          </p>
                        )}
                      </div>

                      <div className="mt-auto flex items-center justify-between border-t border-paw-bark/8 pt-4">
                        <span className="text-xs font-semibold text-paw-teal-mid">View profile</span>
                        <ArrowRight className="h-4 w-4 text-paw-teal-mid transition-transform duration-200 group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </ScrollReveal>
        )}

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        {!loading && vets.length > 0 && (
          <ScrollReveal>
            <div className="mt-14 rounded-[2rem] bg-gradient-to-br from-paw-bark to-paw-ink p-8 text-center text-paw-cream shadow-paw-lg sm:p-10">
              <h3 className="font-display text-2xl font-semibold mb-2">Ready to book?</h3>
              <p className="text-paw-cream/70 text-sm mb-6 max-w-sm mx-auto">
                Select a vet and book your appointment. Same scheduling as the mobile app.
              </p>
              <Link
                href="/book-appointment"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-paw-ink shadow-sm hover:bg-paw-cream transition-colors"
              >
                Book an appointment <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </ScrollReveal>
        )}
      </PageContent>
    </PageShell>
  );
}
