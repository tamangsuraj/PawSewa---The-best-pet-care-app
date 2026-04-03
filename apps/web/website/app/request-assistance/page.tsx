'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AlertCircle, Stethoscope } from 'lucide-react';

interface Pet {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  photoUrl?: string;
}

export default function RequestAssistancePage() {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedPetId, setSelectedPetId] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      fetchMyPets();
    }
  }, []);

  const fetchMyPets = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.get(
        `${apiBase}/pets/my-pets`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        setPets(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching pets:', error);
      setError('Failed to load pets');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedPetId) {
      setError('Please select a pet');
      return;
    }

    if (issueDescription.trim().length < 10) {
      setError('Please provide more details about the issue (at least 10 characters)');
      return;
    }

    if (!location.trim()) {
      setError('Please enter your location');
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.post(
        `${apiBase}/cases`,
        {
          petId: selectedPetId,
          issueDescription: issueDescription.trim(),
          location: location.trim(),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        // Show success message
        alert('Case submitted. Our team is assigning the best available Veterinarian to you. You will be notified once a veterinarian is assigned.');
        router.push('/my-pets');
      }
    } catch (err: any) {
      console.error('Error submitting case:', err);
      setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5E6CA] flex items-center justify-center">
        <div className="text-[#703418] text-xl">Loading...</div>
      </div>
    );
  }

  if (pets.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5E6CA]">
        <div className="bg-[#703418] text-white py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold mb-2">Request Assistance</h1>
            <p className="text-[#F5E6CA]">Get help for your pet</p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-6">🐾</div>
              <h2 className="text-3xl font-bold text-[#703418] mb-4">
                No Pets Registered
              </h2>
              <p className="text-gray-600 mb-8 text-lg">
                You need to add a pet before requesting assistance.
              </p>
              <button
                onClick={() => router.push('/my-pets/add')}
                className="px-8 py-4 bg-[#703418] text-white rounded-lg font-semibold hover:bg-[#8B4513] transition-colors text-lg"
              >
                + Add Your First Pet
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5E6CA]">
      {/* Header */}
      <div className="bg-[#703418] text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">Request Assistance</h1>
          <p className="text-[#F5E6CA]">Get immediate help for your pet</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
        {/* Info Card */}
        <div className="bg-white border-2 border-[#703418] rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="bg-[#703418] bg-opacity-10 p-3 rounded-full">
              <Stethoscope className="w-6 h-6 text-[#703418]" />
            </div>
            <div>
              <h3 className="font-bold text-[#703418] text-lg mb-2">
                How It Works
              </h3>
              <p className="text-gray-800">
                Our team will assign the best available veterinarian to your case. 
                You'll be notified once a vet is assigned and they will contact you shortly.
              </p>
            </div>
          </div>
        </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8">
            {error && (
              <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Select Pet */}
            <div className="mb-6">
              <label className="block text-lg font-semibold text-[#703418] mb-3">
                Select Pet *
              </label>
              <select
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#703418] focus:outline-none text-lg"
              >
                <option value="">Choose your pet...</option>
                {pets.map((pet) => (
                  <option key={pet._id} value={pet._id}>
                    {pet.name} ({pet.species}{pet.breed ? ` - ${pet.breed}` : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* Issue Description */}
            <div className="mb-6">
              <label className="block text-lg font-semibold text-[#703418] mb-3">
                Describe the Issue *
              </label>
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                required
                maxLength={1000}
                rows={6}
                placeholder="Please describe what's wrong with your pet in detail..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#703418] focus:outline-none resize-none"
              />
              <p className="text-sm text-gray-500 mt-2">
                {issueDescription.length}/1000 characters
              </p>
            </div>

            {/* Location */}
            <div className="mb-8">
              <label className="block text-lg font-semibold text-[#703418] mb-3">
                Your Location *
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                placeholder="Enter your address"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#703418] focus:outline-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push('/my-pets')}
                className="flex-1 px-6 py-4 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>🚨</span>
                    <span>Request Assistance</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
