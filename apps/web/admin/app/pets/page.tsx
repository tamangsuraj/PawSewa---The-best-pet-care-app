'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { PawPrint, Search } from 'lucide-react';
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

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPets();
  }, []);

  const fetchPets = async (search?: string) => {
    try {
      setLoading(true);
      const response = await api.get('/pets/admin', {
        params: search ? { search } : undefined,
      });
      setPets(response.data.data || []);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPets(searchTerm.trim() || undefined);
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-secondary">
        <Sidebar />

        <div className="flex-1 ml-64">
          <Header />

          <main className="pt-24 px-6 pb-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
                  <PawPrint className="w-8 h-8 text-primary" />
                  Pet Registry
                </h1>
                <p className="text-gray-600">
                  Search and review all registered pets across the PawSewa ecosystem.
                </p>
              </div>

              <form
                onSubmit={handleSearch}
                className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-primary/10 max-w-md w-full"
              >
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by PawID (PAW-2026-XXXX), name, species..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div>
                  <p className="text-sm text-gray-700">
                    All Pets
                    <span className="ml-2 font-semibold text-primary">
                      ({pets.length})
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Each pet has a unique PawID for quick lookup in clinics and support.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="py-16 flex items-center justify-center text-gray-500 text-sm">
                  Loading pets...
                </div>
              ) : pets.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                  <PawPrint className="w-12 h-12 text-primary/20 mb-4" />
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    No pets found
                  </h2>
                  <p className="text-sm text-gray-500 max-w-md">
                    Try searching with a different PawID (for example
                    <span className="mx-1 font-mono text-[#703418]">
                      PAW-{new Date().getFullYear()}-XXXX
                    </span>
                    ) or by pet name.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          PawID
                        </th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          Pet
                        </th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          Owner
                        </th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          Species / Breed
                        </th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          Age / Weight
                        </th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          Registered
                        </th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          Records
                        </th>
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
                              <span className="text-xs text-gray-400 italic">
                                Generating...
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 align-top">
                            <div className="font-semibold text-gray-900">
                              {pet.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {pet.gender}
                            </div>
                          </td>
                          <td className="px-6 py-3 align-top">
                            {pet.owner ? (
                              <>
                                <div className="text-gray-900 font-medium">
                                  {pet.owner.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {pet.owner.email}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3 align-top">
                            <div className="text-gray-900">{pet.species}</div>
                            {pet.breed && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {pet.breed}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3 align-top">
                            <div className="text-gray-900">
                              {pet.age != null ? `${pet.age}y` : '—'}
                            </div>
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
              )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
