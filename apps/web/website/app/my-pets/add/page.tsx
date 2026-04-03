'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import Image from 'next/image';

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
    } catch (error: any) {
      console.error('Error creating pet:', error);
      alert(error.response?.data?.message || 'Failed to register pet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5E6CA]">
      {/* Header */}
      <div className="bg-[#703418] text-white py-12">
        <div className="container mx-auto px-4">
          <button
            onClick={() => router.push('/my-pets')}
            className="mb-4 text-[#F5E6CA] hover:text-white transition-colors"
          >
            ← Back to My Pets
          </button>
          <h1 className="text-4xl font-bold">Register New Pet</h1>
        </div>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
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
                  <div className="absolute bottom-0 right-0 w-10 h-10 bg-[#703418] rounded-full flex items-center justify-center text-white text-xl">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#703418] focus:border-transparent bg-white text-gray-900"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#703418] focus:border-transparent bg-white text-gray-900"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#703418] focus:border-transparent bg-white text-gray-900"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#703418] focus:border-transparent bg-white text-gray-900"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#703418] focus:border-transparent bg-white text-gray-900"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#703418] focus:border-transparent bg-white text-gray-900"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#703418] focus:border-transparent bg-white text-gray-900"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#703418] focus:border-transparent bg-white text-gray-900"
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
                  className="w-5 h-5 text-[#703418] border-gray-300 rounded focus:ring-[#703418]"
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
                  className="w-5 h-5 text-[#703418] border-gray-300 rounded focus:ring-[#703418] mt-0.5"
                />
                <span className="text-sm text-gray-900">
                  I agree to the{' '}
                  <span className="text-[#703418] underline">terms & Conditions</span>
                  {' '}and{' '}
                  <span className="text-[#703418] underline">Privacy Policy</span>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#703418] text-white py-4 rounded-xl font-semibold hover:bg-[#8B4513] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                'Registering...'
              ) : (
                <>
                  <span>🐾</span>
                  <span>Register Pet</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
