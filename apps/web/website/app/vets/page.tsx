'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, MapPin, Stethoscope, Filter } from 'lucide-react';
import axios from 'axios';
import { PageShell } from '@/components/layout/PageShell';

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
  const [filteredVets, setFilteredVets] = useState<Vet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchVets();
  }, []);

  useEffect(() => {
    filterVets();
  }, [vets, searchQuery, specializationFilter]);

  const fetchVets = async () => {
    try {
      setLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.get(`${apiBase}/vets/public`);
      if (response.data.success) {
        setVets(response.data.data);
        setFilteredVets(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching vets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterVets = () => {
    let filtered = [...vets];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (vet) =>
          vet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          vet.clinicName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          vet.clinicLocation?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Specialization filter
    if (specializationFilter) {
      filtered = filtered.filter(
        (vet) => vet.specialization?.toLowerCase() === specializationFilter.toLowerCase()
      );
    }

    setFilteredVets(filtered);
  };

  const specializations = Array.from(
    new Set(vets.map((vet) => vet.specialization).filter(Boolean))
  );

  return (
    <PageShell>
      <div className="relative overflow-hidden bg-gradient-to-br from-paw-bark via-paw-ink to-paw-umber text-paw-cream py-16 px-4">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_20%,rgba(13,148,136,0.2),transparent_50%)]"
          aria-hidden
        />
        <div className="container mx-auto relative">
          <p className="paw-eyebrow text-paw-cream/75 mb-3">Directory</p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Find a veterinarian
          </h1>
          <p className="text-lg md:text-xl text-paw-cream/85 max-w-2xl leading-relaxed">
            Connect with certified professionals in your area.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className="lg:w-64">
            <div className="paw-card-glass rounded-2xl shadow-paw border border-paw-bark/8 p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800 font-poppins">Filters</h3>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2 font-poppins">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Name or location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paw-bark focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Specialization */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 font-poppins">
                    Specialization
                  </label>
                  <select
                    value={specializationFilter}
                    onChange={(e) => setSpecializationFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paw-bark focus:border-transparent"
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
              <p className="text-gray-600 font-inter">
                Showing <span className="font-semibold text-paw-bark">{filteredVets.length}</span> veterinarians
              </p>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-paw-bark border-t-transparent"></div>
                <p className="mt-4 text-gray-600">Loading veterinarians...</p>
              </div>
            ) : filteredVets.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-md">
                <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">No veterinarians found</h3>
                <p className="text-gray-600">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredVets.map((vet) => (
                  <Link key={vet._id} href={`/vets/${vet._id}`}>
                    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-2 overflow-hidden cursor-pointer h-full">
                      {/* Vet Image/Avatar */}
                      <div className="h-48 bg-gradient-to-br from-paw-bark via-paw-ink to-paw-teal-mid flex items-center justify-center">
                        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-5xl font-bold text-paw-bark">
                            {vet.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Vet Info */}
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-2 font-poppins">
                          Dr. {vet.name}
                        </h3>
                        
                        <div className="space-y-2 mb-4">
                          {vet.specialization && (
                            <div className="flex items-center gap-2 text-paw-bark">
                              <Stethoscope className="w-4 h-4" />
                              <span className="text-sm font-medium">{vet.specialization}</span>
                            </div>
                          )}
                          
                          {vet.clinicName && (
                            <p className="text-gray-600 text-sm font-inter">
                              {vet.clinicName}
                            </p>
                          )}
                          
                          {vet.clinicLocation && (
                            <div className="flex items-center gap-2 text-gray-500">
                              <MapPin className="w-4 h-4" />
                              <span className="text-sm">{vet.clinicLocation}</span>
                            </div>
                          )}
                        </div>

                        <button className="w-full py-3 bg-paw-bark text-white rounded-lg hover:bg-paw-bark/90 transition-colors font-medium">
                          View Profile
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
