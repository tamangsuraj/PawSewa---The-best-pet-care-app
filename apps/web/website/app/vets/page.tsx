'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, MapPin, Stethoscope, Filter } from 'lucide-react';
import axios from 'axios';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

interface Vet {
  _id: string;
  name: string;
  email: string;
  specialization?: string;
  clinicName?: string;
  clinicLocation?: string;
  phone?: string;
}

export default function VetDirectoryPage() {
  const [vets, setVets] = useState<Vet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchVets();
  }, []);

  const fetchVets = async () => {
    try {
      setLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.get(`${apiBase}/vets/public`);
      if (response.data.success) {
        setVets(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching vets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVets = useMemo(() => {
    let filtered = [...vets];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (vet) =>
          vet.name.toLowerCase().includes(q) ||
          vet.clinicName?.toLowerCase().includes(q) ||
          vet.clinicLocation?.toLowerCase().includes(q),
      );
    }
    if (specializationFilter) {
      filtered = filtered.filter(
        (vet) => vet.specialization?.toLowerCase() === specializationFilter.toLowerCase(),
      );
    }
    return filtered;
  }, [vets, searchQuery, specializationFilter]);

  const specializations = Array.from(
    new Set(vets.map((vet) => vet.specialization).filter(Boolean))
  );

  return (
    <PageShell>
      <PageHero
        eyebrow="Directory"
        title="Find a veterinarian"
        subtitle="Connect with certified professionals in your area."
      />

      <PageContent compact>
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar Filters */}
          <div className="lg:w-64">
            <div className="paw-surface-card sticky top-24 rounded-[1.35rem] p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-paw-ink">Filters</h3>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden text-paw-bark"
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>

              <div className={`space-y-6 ${showFilters ? 'block' : 'hidden lg:block'}`}>
                {/* Search */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-paw-ink">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paw-bark/40" />
                    <input
                      type="text"
                      placeholder="Name or location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="paw-input pl-10"
                    />
                  </div>
                </div>

                {/* Specialization */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-paw-ink">Specialization</label>
                  <select
                    value={specializationFilter}
                    onChange={(e) => setSpecializationFilter(e.target.value)}
                    className="paw-input"
                  >
                    <option value="">All Specializations</option>
                    {specializations.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                {(searchQuery || specializationFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSpecializationFilter('');
                    }}
                    className="w-full py-2 text-paw-bark hover:text-paw-bark/80 font-medium text-sm"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Vet Cards Grid */}
          <div className="flex-1">
            <div className="mb-6">
              <p className="text-paw-bark/80">
                Showing <span className="font-semibold text-paw-ink">{filteredVets.length}</span>{' '}
                veterinarians
              </p>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-paw-bark border-t-transparent" />
                <p className="mt-4 text-paw-bark/75">Loading veterinarians…</p>
              </div>
            ) : filteredVets.length === 0 ? (
              <div className="paw-surface-card py-16 text-center">
                <Stethoscope className="mx-auto mb-4 h-16 w-16 text-paw-bark/25" />
                <h3 className="font-display mb-2 text-xl font-semibold text-paw-ink">No veterinarians found</h3>
                <p className="text-paw-bark/70">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredVets.map((vet) => (
                  <Link key={vet._id} href={`/vets/${vet._id}`}>
                    <div className="paw-surface-card h-full cursor-pointer overflow-hidden rounded-[1.35rem]">
                      <div className="flex h-44 items-center justify-center bg-gradient-to-br from-paw-bark via-paw-ink to-paw-teal-mid">
                        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/95 shadow-lg ring-2 ring-white/40">
                          <span className="font-display text-4xl font-bold text-paw-bark">
                            {vet.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="p-6">
                        <h3 className="font-display mb-2 text-xl font-semibold text-paw-ink">Dr. {vet.name}</h3>

                        <div className="mb-4 space-y-2">
                          {vet.specialization && (
                            <div className="flex items-center gap-2 text-paw-bark">
                              <Stethoscope className="h-4 w-4 shrink-0" />
                              <span className="text-sm font-medium">{vet.specialization}</span>
                            </div>
                          )}

                          {vet.clinicName && <p className="text-sm text-paw-bark/75">{vet.clinicName}</p>}

                          {vet.clinicLocation && (
                            <div className="flex items-start gap-2 text-paw-bark/65">
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                              <span className="text-sm">{vet.clinicLocation}</span>
                            </div>
                          )}
                        </div>

                        <span className="block w-full rounded-xl bg-gradient-to-br from-paw-bark to-paw-ink py-3 text-center text-sm font-semibold text-paw-cream shadow-md transition hover:opacity-95">
                          View profile
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
