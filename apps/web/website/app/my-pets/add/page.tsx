'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import Image from 'next/image';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

export default function AddPetPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    breed: '',
    gender: '',
    weight: '',
    medicalConditions: '',
    behavioralNotes: '',
    isVaccinated: false,
    agreedToTerms: false,
  });
  
  const [dob, setDob] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const speciesList = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Other'];
  const genderList = ['Male', 'Female'];

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.agreedToTerms) {
      alert('Please agree to the terms & conditions');
      return;
    }

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('species', formData.species);
      submitData.append('gender', formData.gender);
      
      if (formData.breed) submitData.append('breed', formData.breed);
      if (dob) submitData.append('dob', new Date(dob).toISOString());
      if (formData.weight) submitData.append('weight', formData.weight);
      if (formData.medicalConditions) submitData.append('medicalConditions', formData.medicalConditions);
      if (formData.behavioralNotes) submitData.append('behavioralNotes', formData.behavioralNotes);
      submitData.append('isVaccinated', formData.isVaccinated.toString());
      
      if (selectedImage) {
        submitData.append('photo', selectedImage);
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.post(`${apiBase}/pets`, submitData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        alert('Pet registered successfully!');
        router.push('/my-pets');
      }
    } catch (error: unknown) {
      console.error('Error creating pet:', error);
      const ax = error as { response?: { data?: { message?: string } } };
      alert(ax.response?.data?.message || 'Failed to register pet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHero
        leading={
          <button
            type="button"
            onClick={() => router.push('/my-pets')}
            className="text-sm font-medium text-paw-cream/90 hover:text-white transition-colors"
          >
            ← Back to My Pets
          </button>
        }
        eyebrow="Profiles"
        title="Register new pet"
        subtitle="Add details and a photo so care and bookings stay accurate."
      />

      <PageContent>
        <div className="mx-auto max-w-2xl paw-surface-card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  <div className="w-32 h-32 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt="Pet preview"
                        width={128}
                        height={128}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-4xl text-gray-400">📷</span>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 bg-paw-bark rounded-full flex items-center justify-center text-paw-cream text-xl shadow-paw">
                    +
                  </div>
                </div>
              </label>
              <p className="text-sm text-gray-500 mt-2">Click to upload photo</p>
            </div>

            {/* Pet Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Pet Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Buddy"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-paw-teal-mid focus:border-transparent bg-white text-gray-900"
              />
            </div>

            {/* Species */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Species *
              </label>
              <select
                required
                value={formData.species}
                onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-paw-teal-mid focus:border-transparent bg-white text-gray-900"
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
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Breed
              </label>
              <input
                type="text"
                value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                placeholder="e.g. Golden Retriever"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-paw-teal-mid focus:border-transparent bg-white text-gray-900"
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Date of Birth (Optional)
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-paw-teal-mid focus:border-transparent bg-white text-gray-900"
              />
            </div>

            {/* Gender and Weight Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Gender *
                </label>
                <select
                  required
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-paw-teal-mid focus:border-transparent bg-white text-gray-900"
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
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Weight (Optional)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="0.0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-paw-teal-mid focus:border-transparent bg-white text-gray-900"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600">
                    kg
                  </span>
                </div>
              </div>
            </div>

            {/* Medical Conditions */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Existing Medical Conditions or Allergies (Optional)
              </label>
              <textarea
                rows={3}
                value={formData.medicalConditions}
                onChange={(e) => setFormData({ ...formData, medicalConditions: e.target.value })}
                placeholder="Describe any existing conditions, allergies, or past surgeries..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-paw-teal-mid focus:border-transparent bg-white text-gray-900"
              />
            </div>

            {/* Behavioral Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Behavioral Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={formData.behavioralNotes}
                onChange={(e) => setFormData({ ...formData, behavioralNotes: e.target.value })}
                placeholder="Describe temperament, any anxiety, or specific behaviors (e.g., friendly with dogs, nervous around strangers)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-paw-teal-mid focus:border-transparent bg-white text-gray-900"
              />
            </div>

            {/* Vaccination Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Vaccination Status (Optional)
              </label>
              <label className="flex items-center gap-3 cursor-pointer ml-6">
                <input
                  type="checkbox"
                  checked={formData.isVaccinated}
                  onChange={(e) => setFormData({ ...formData, isVaccinated: e.target.checked })}
                  className="w-5 h-5 text-paw-bark border-gray-300 rounded focus:ring-paw-teal-mid"
                />
                <span className="text-gray-900">Up to date with all core vaccines</span>
              </label>
            </div>

            {/* Terms & Conditions */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.agreedToTerms}
                  onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                  className="w-5 h-5 text-paw-bark border-gray-300 rounded focus:ring-paw-teal-mid mt-0.5"
                />
                <span className="text-sm text-gray-900">
                  I agree to the{' '}
                  <span className="text-paw-bark underline">terms & Conditions</span>
                  {' '}and{' '}
                  <span className="text-paw-bark underline">Privacy Policy</span>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="paw-cta-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register pet'}
            </button>
          </form>
        </div>
      </PageContent>
    </PageShell>
  );
}
