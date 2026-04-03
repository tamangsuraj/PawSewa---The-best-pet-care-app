'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import Image from 'next/image';
import QRCode from 'react-qr-code';

interface Pet {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  gender: string;
  weight?: number;
  photoUrl?: string;
  pawId?: string;
  createdAt: string;
}

export default function MyPetsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchMyPets();
    }
  }, [isAuthenticated]);

  const fetchMyPets = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.get(`${apiBase}/pets/my-pets`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        setPets(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching pets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5E6CA] flex items-center justify-center">
        <div className="text-[#703418] text-xl">Loading your pets...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5E6CA]">
      {/* Header */}
      <div className="bg-[#703418] text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">My Pets</h1>
          <p className="text-[#F5E6CA]">Manage your beloved companions</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        {pets.length === 0 ? (
          /* Empty State */
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-2xl shadow-lg p-12">
              <div className="text-6xl mb-6">🐾</div>
              <h2 className="text-3xl font-bold text-[#703418] mb-4">
                No Pets Yet
              </h2>
              <p className="text-gray-600 mb-8 text-lg">
                You haven't added any pets yet. Add your first pet now!
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={() => router.push('/my-pets/add')}
                  className="px-8 py-4 bg-[#703418] text-white rounded-lg font-semibold hover:bg-[#8B4513] transition-colors text-lg"
                >
                  + Add Your First Pet
                </button>

                <div className="bg-[#F5E6CA] rounded-xl p-6 mt-6">
                  <h3 className="font-bold text-[#703418] mb-3 text-xl">
                    📱 Or Use Our Mobile App
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Add and manage your pets on the go with our mobile application
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button className="px-6 py-3 bg-[#703418] text-white rounded-lg font-semibold hover:bg-[#8B4513] transition-colors">
                      Download for Android
                    </button>
                    <button className="px-6 py-3 bg-[#703418] text-white rounded-lg font-semibold hover:bg-[#8B4513] transition-colors">
                      Download for iOS
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-[#703418] hover:text-[#8B4513] font-semibold"
                >
                  ← Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Pets Grid */
          <>
            <div className="mb-8 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-[#703418]">
                Your Pets ({pets.length})
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push('/my-cases')}
                  className="px-6 py-2 bg-[#703418] text-white rounded-lg font-semibold hover:bg-[#8B4513] transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  My Cases
                </button>
                <button
                  onClick={() => router.push('/request-assistance')}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <span>🚨</span> Request Assistance
                </button>
                <button
                  onClick={() => router.push('/my-pets/add')}
                  className="px-6 py-2 bg-[#703418] text-white rounded-lg font-semibold hover:bg-[#8B4513] transition-colors"
                >
                  + Add Pet
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pets.map((pet) => (
                <div
                  key={pet._id}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {/* Pet Image */}
                  <div className="relative h-64 bg-[#F5E6CA]">
                    {pet.photoUrl ? (
                      <Image
                        src={pet.photoUrl}
                        alt={pet.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-8xl">
                        {pet.species === 'Dog' ? '🐕' :
                         pet.species === 'Cat' ? '🐈' :
                         pet.species === 'Bird' ? '🐦' :
                         pet.species === 'Rabbit' ? '🐰' :
                         pet.species === 'Hamster' ? '🐹' :
                         pet.species === 'Fish' ? '🐠' : '🐾'}
                      </div>
                    )}
                  </div>

                  {/* Pet Info */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-2xl font-bold text-[#703418]">
                        {pet.name}
                      </h3>
                      <span className="text-3xl">
                        {pet.gender === 'Male' ? '♂️' : '♀️'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* Digital ID Card + QR */}
                      {pet.pawId && (
                        <div className="mb-3 flex items-center gap-3">
                          <div className="inline-flex items-center px-3 py-1 rounded-lg border border-dashed border-[#703418] bg-[#F5E6CA]/70 text-xs font-mono text-[#703418]">
                            <span className="mr-1 opacity-80">ID:</span>
                            <span>{pet.pawId}</span>
                          </div>
                          <div className="bg-white border border-[#E2D3B5] rounded-md p-1 shadow-sm">
                            <QRCode
                              value={pet.pawId}
                              size={54}
                              bgColor="#FFFFFF"
                              fgColor="#703418"
                              style={{ height: 'auto', width: '54px' }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 bg-[#703418] text-white rounded-full text-sm font-semibold">
                          {pet.species}
                        </span>
                        {pet.age && (
                          <span className="px-3 py-1 bg-[#A67B5B] text-white rounded-full text-sm font-semibold">
                            {pet.age} {pet.age === 1 ? 'year' : 'years'}
                          </span>
                        )}
                      </div>

                      {pet.breed && (
                        <p className="text-gray-700">
                          <span className="font-semibold text-[#703418]">Breed:</span> {pet.breed}
                        </p>
                      )}

                      {pet.weight && (
                        <p className="text-gray-700">
                          <span className="font-semibold text-[#703418]">Weight:</span> {pet.weight} kg
                        </p>
                      )}

                      <p className="text-sm text-gray-500 mt-3">
                        Added on {new Date(pet.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add More Pets CTA */}
            <div className="mt-12 bg-white rounded-2xl shadow-lg p-8 text-center">
              <h3 className="text-2xl font-bold text-[#703418] mb-3">
                Want to add more pets?
              </h3>
              <p className="text-gray-600 mb-6">
                Add another pet or use our mobile app for on-the-go management
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => router.push('/my-pets/add')}
                  className="px-6 py-3 bg-[#703418] text-white rounded-lg font-semibold hover:bg-[#8B4513] transition-colors"
                >
                  + Add Another Pet
                </button>
                <button className="px-6 py-3 bg-white text-[#703418] border-2 border-[#703418] rounded-lg font-semibold hover:bg-gray-50 transition-colors">
                  Download Mobile App
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
