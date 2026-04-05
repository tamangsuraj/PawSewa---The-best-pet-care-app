'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PawPrint, Search, X } from 'lucide-react';
import api from '@/lib/api';

interface PetOwner {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

interface Pet {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  gender: string;
  age?: number;
  weight?: number;
  pawId?: string;
  owner?: PetOwner;
  createdAt: string;
}

/** Matches backend Pet.species enum; used for section order. */
const SPECIES_ORDER = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Other'] as const;

function groupPetsBySpecies(pets: Pet[]): Map<string, Pet[]> {
  const map = new Map<string, Pet[]>();
  for (const p of pets) {
    const key =
      p.species && SPECIES_ORDER.includes(p.species as (typeof SPECIES_ORDER)[number])
        ? p.species
        : 'Other';
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return map;
}

function PetTable({ pets }: { pets: Pet[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left font-semibold text-gray-700">PawID</th>
            <th className="px-6 py-3 text-left font-semibold text-gray-700">Pet</th>
            <th className="px-6 py-3 text-left font-semibold text-gray-700">Owner</th>
            <th className="px-6 py-3 text-left font-semibold text-gray-700">Species / Breed</th>
            <th className="px-6 py-3 text-left font-semibold text-gray-700">Age / Weight</th>
            <th className="px-6 py-3 text-left font-semibold text-gray-700">Registered</th>
            <th className="px-6 py-3 text-left font-semibold text-gray-700">Records</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {pets.map((pet) => (
            <tr key={pet._id} className="hover:bg-gray-50/80">
              <td className="px-6 py-3 align-top">
                {pet.pawId ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full border border-[#703418] text-[#703418] bg-[#F5E6CA]/60 font-mono text-xs">
                    {pet.pawId}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">Generating...</span>
                )}
              </td>
              <td className="px-6 py-3 align-top">
                <div className="font-semibold text-gray-900">{pet.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{pet.gender}</div>
              </td>
              <td className="px-6 py-3 align-top">
                {pet.owner ? (
                  <>
                    <div className="text-gray-900 font-medium">{pet.owner.name}</div>
                    <div className="text-xs text-gray-500">{pet.owner.email}</div>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
              <td className="px-6 py-3 align-top">
                <div className="text-gray-900">{pet.species}</div>
                {pet.breed && <div className="text-xs text-gray-500 mt-0.5">{pet.breed}</div>}
              </td>
              <td className="px-6 py-3 align-top">
                <div className="text-gray-900">{pet.age != null ? `${pet.age}y` : '—'}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {pet.weight != null ? `${pet.weight} kg` : ''}
                </div>
              </td>
              <td className="px-6 py-3 align-top text-xs text-gray-500">
                {new Date(pet.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
              <td className="px-6 py-3 align-top">
                {pet.owner?._id ? (
                  <Link
                    href={`/customers/${pet.owner._id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Owner &amp; health
                  </Link>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [pawIdInput, setPawIdInput] = useState('');
  const [activePawIdFilter, setActivePawIdFilter] = useState<string | null>(null);

  const fetchPets = useCallback(async (pawIdFilter: string | null) => {
    try {
      setLoading(true);
      const response = await api.get('/pets/admin', {
        params: pawIdFilter ? { pawId: pawIdFilter } : undefined,
      });
      setPets(response.data.data || []);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching pets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPets(null);
  }, [fetchPets]);

  const grouped = useMemo(() => groupPetsBySpecies(pets), [pets]);

  const orderedCategories = useMemo(() => {
    const keys = [...grouped.keys()];
    const ordered: string[] = [];
    for (const s of SPECIES_ORDER) {
      if (keys.includes(s) && (grouped.get(s)?.length ?? 0) > 0) {
        ordered.push(s);
      }
    }
    for (const k of keys) {
      if (!ordered.includes(k) && (grouped.get(k)?.length ?? 0) > 0) {
        ordered.push(k);
      }
    }
    return ordered;
  }, [grouped]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = pawIdInput.trim();
    if (!q) {
      setActivePawIdFilter(null);
      fetchPets(null);
      return;
    }
    setActivePawIdFilter(q);
    fetchPets(q);
  };

  const handleClearSearch = () => {
    setPawIdInput('');
    setActivePawIdFilter(null);
    fetchPets(null);
  };

  return (
    <>
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
                  <PawPrint className="w-8 h-8 text-primary" />
                  Pets
                </h1>
                <p className="text-gray-600 max-w-xl">
                  All registered pets grouped by species. Search returns matches by{' '}
                  <span className="font-semibold text-gray-800">PawID only</span> (unique ID, e.g.{' '}
                  <span className="font-mono text-[#703418] text-sm">
                    PAW-{new Date().getFullYear()}-A1B2
                  </span>
                  ).
                </p>
              </div>

              <form
                onSubmit={handleSearch}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white rounded-xl px-4 py-3 shadow-sm border border-primary/10 max-w-lg w-full"
              >
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="PawID only (e.g. PAW-2026-AB12)"
                    value={pawIdInput}
                    onChange={(e) => setPawIdInput(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 font-mono"
                    aria-label="Search by PawID"
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    Search
                  </button>
                  {(activePawIdFilter || pawIdInput.trim()) && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>

            {activePawIdFilter && (
              <div className="mb-4 rounded-lg border border-primary/20 bg-[#F5E6CA]/40 px-4 py-2 text-sm text-gray-800">
                Showing pets whose PawID matches{' '}
                <span className="font-mono font-semibold text-[#703418]">{activePawIdFilter}</span>.
              </div>
            )}

            {loading ? (
              <div className="bg-white rounded-xl shadow-md border border-gray-100 py-16 flex items-center justify-center text-gray-500 text-sm">
                Loading pets...
              </div>
            ) : pets.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md border border-gray-100 py-16 flex flex-col items-center justify-center text-center px-4">
                <PawPrint className="w-12 h-12 text-primary/20 mb-4" />
                <h2 className="text-lg font-semibold text-gray-900 mb-1">No pets found</h2>
                <p className="text-sm text-gray-500 max-w-md">
                  {activePawIdFilter
                    ? 'No pet has that PawID. Check the ID and try again, or clear the search to browse all pets.'
                    : 'No pets are registered yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {orderedCategories.map((category) => {
                  const list = grouped.get(category) ?? [];
                  if (list.length === 0) return null;
                  return (
                    <section
                      key={category}
                      className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">{category}</h2>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {list.length} pet{list.length === 1 ? '' : 's'} in this category
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-primary tabular-nums">
                          {list.length}
                        </span>
                      </div>
                      <PetTable pets={list} />
                    </section>
                  );
                })}
              </div>
            )}
    </>
  );
}
