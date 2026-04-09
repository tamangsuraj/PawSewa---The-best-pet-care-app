'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getStoredAdminToken } from '@/lib/authStorage';
import { ArrowLeft, Mail, Phone, MapPin, CheckCircle, XCircle, Plus, X } from 'lucide-react';
import Image from 'next/image';

interface Pet {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  gender: string;
  weight?: number;
  photoUrl?: string;
  createdAt: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
}

interface FullProfile {
  user: User;
  pets: Pet[];
  petCount: number;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [addingPet, setAddingPet] = useState(false);

  // Pet form state
  const [petFormData, setPetFormData] = useState({
    name: '',
    species: '',
    breed: '',
    gender: '',
    weight: '',
    medicalConditions: '',
    behavioralNotes: '',
    isVaccinated: false,
  });
  const [petDob, setPetDob] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const speciesList = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Other'];
  const genderList = ['Male', 'Female'];

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await api.get(`/users/admin/${params.id}/full-profile`);
      setProfile(response.data.data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchUserProfile();
    }
  }, [isAuthenticated, router, fetchUserProfile]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPet = async (e: FormEvent) => {
    e.preventDefault();
    setAddingPet(true);

    try {
      const token = getStoredAdminToken();
      if (!token) {
        alert('Authentication required');
        return;
      }

      const submitData = new FormData();
      submitData.append('name', petFormData.name);
      submitData.append('species', petFormData.species);
      submitData.append('gender', petFormData.gender);
      
      if (petFormData.breed) submitData.append('breed', petFormData.breed);
      if (petDob) submitData.append('dob', new Date(petDob).toISOString());
      if (petFormData.weight) submitData.append('weight', petFormData.weight);
      if (petFormData.medicalConditions) submitData.append('medicalConditions', petFormData.medicalConditions);
      if (petFormData.behavioralNotes) submitData.append('behavioralNotes', petFormData.behavioralNotes);
      submitData.append('isVaccinated', petFormData.isVaccinated.toString());
      
      if (selectedImage) {
        submitData.append('photo', selectedImage);
      }

      const response = await api.post(`/pets/admin/${params.id}`, submitData);

      if (response.data.success) {
        alert('Pet added successfully!');
        setShowAddPetModal(false);
        // Reset form
        setPetFormData({
          name: '',
          species: '',
          breed: '',
          gender: '',
          weight: '',
          medicalConditions: '',
          behavioralNotes: '',
          isVaccinated: false,
        });
        setPetDob('');
        setSelectedImage(null);
        setImagePreview(null);
        // Refresh profile
        fetchUserProfile();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'Failed to add pet');
    } finally {
      setAddingPet(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-slate-400">User not found</div>
      </div>
    );
  }

  const { user, pets, petCount } = profile;

  return (
    <div className="p-8">
      {/* Back Button */}
      <button
        onClick={() => router.push('/customers')}
        className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Customers
      </button>

      {/* Profile Card */}
      <div className="bg-slate-800 rounded-xl p-8 mb-8 border border-slate-700">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{user.name}</h1>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium border border-blue-500/30">
                {user.role.replace('_', ' ')}
              </span>
              {user.isVerified ? (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Verified
                </span>
              ) : (
                <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium border border-red-500/30 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  Not Verified
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Member Since</p>
            <p className="text-white font-medium">
              {new Date(user.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Email</p>
              <p className="text-white font-medium">{user.email}</p>
            </div>
          </div>

          {user.phone && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Phone</p>
                <p className="text-white font-medium">{user.phone}</p>
              </div>
            </div>
          )}

          {user.location && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Location</p>
                <p className="text-white font-medium">{user.location}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pets Section */}
      <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Pets ({petCount})</h2>
          <button
            onClick={() => setShowAddPetModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Pet for Customer
          </button>
        </div>

        {pets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-sm font-semibold text-slate-200">PET</span>
            </div>
            <p className="text-slate-400 text-lg">No pets registered yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map((pet) => (
              <div
                key={pet._id}
                className="bg-slate-700/50 rounded-xl overflow-hidden border border-slate-600 hover:border-blue-500/50 transition-all"
              >
                {/* Pet Image */}
                <div className="relative h-48 bg-slate-900">
                  {pet.photoUrl ? (
                    <Image
                      src={pet.photoUrl}
                      alt={pet.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm font-semibold border border-slate-700">
                        {pet.species || 'Pet'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Pet Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-white">{pet.name}</h3>
                    <span className="text-xs font-semibold text-slate-300">
                      {pet.gender === 'Male' ? 'Male' : 'Female'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                        {pet.species}
                      </span>
                      {pet.age && (
                        <span className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs font-medium">
                          {pet.age} {pet.age === 1 ? 'year' : 'years'}
                        </span>
                      )}
                    </div>

                    {pet.breed && (
                      <p className="text-sm text-slate-400">
                        <span className="font-medium">Breed:</span> {pet.breed}
                      </p>
                    )}

                    {pet.weight && (
                      <p className="text-sm text-slate-400">
                        <span className="font-medium">Weight:</span> {pet.weight} kg
                      </p>
                    )}

                    <p className="text-xs text-slate-500 mt-2">
                      Added {new Date(pet.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Pet Modal */}
      {showAddPetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Add Pet for {user.name}</h3>
              <button
                onClick={() => setShowAddPetModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddPet} className="p-6 space-y-6">
              {/* Photo Upload */}
              <div className="flex flex-col items-center">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden bg-slate-700">
                      {imagePreview ? (
                        <Image
                          src={imagePreview}
                          alt="Pet preview"
                          width={128}
                          height={128}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-slate-200">PHOTO</span>
                      )}
                    </div>
                    <div className="absolute bottom-0 right-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl">
                      +
                    </div>
                  </div>
                </label>
                <p className="text-sm text-slate-400 mt-2">Click to upload photo</p>
              </div>

              {/* Pet Name */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Pet Name *
                </label>
                <input
                  type="text"
                  required
                  value={petFormData.name}
                  onChange={(e) => setPetFormData({ ...petFormData, name: e.target.value })}
                  placeholder="e.g. Buddy"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                />
              </div>

              {/* Species */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Species *
                </label>
                <select
                  required
                  value={petFormData.species}
                  onChange={(e) => setPetFormData({ ...petFormData, species: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                >
                  <option value="">Select species</option>
                  {speciesList.map((species) => (
                    <option key={species} value={species}>
                      {species}
                    </option>
                  ))}
                </select>
              </div>

              {/* Breed */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Breed
                </label>
                <input
                  type="text"
                  value={petFormData.breed}
                  onChange={(e) => setPetFormData({ ...petFormData, breed: e.target.value })}
                  placeholder="e.g. Golden Retriever"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Date of Birth (Optional)
                </label>
                <input
                  type="date"
                  value={petDob}
                  onChange={(e) => setPetDob(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                />
              </div>

              {/* Gender and Weight Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Gender *
                  </label>
                  <select
                    required
                    value={petFormData.gender}
                    onChange={(e) => setPetFormData({ ...petFormData, gender: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  >
                    <option value="">Select</option>
                    {genderList.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Weight (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={petFormData.weight}
                      onChange={(e) => setPetFormData({ ...petFormData, weight: e.target.value })}
                      placeholder="0.0"
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Medical Conditions */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Medical Conditions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={petFormData.medicalConditions}
                  onChange={(e) => setPetFormData({ ...petFormData, medicalConditions: e.target.value })}
                  placeholder="Describe any existing conditions, allergies, or past surgeries..."
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                />
              </div>

              {/* Behavioral Notes */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Behavioral Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={petFormData.behavioralNotes}
                  onChange={(e) => setPetFormData({ ...petFormData, behavioralNotes: e.target.value })}
                  placeholder="Describe temperament, any anxiety, or specific behaviors..."
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                />
              </div>

              {/* Vaccination Status */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={petFormData.isVaccinated}
                    onChange={(e) => setPetFormData({ ...petFormData, isVaccinated: e.target.checked })}
                    className="w-5 h-5 text-blue-500 border-slate-600 rounded focus:ring-blue-500 bg-slate-700"
                  />
                  <span className="text-white">Up to date with all core vaccines</span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingPet}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingPet ? 'Adding Pet...' : 'Add Pet'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPetModal(false)}
                  className="px-6 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
