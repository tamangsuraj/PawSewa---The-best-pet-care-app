'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AlertCircle, Stethoscope, PawPrint } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';

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
      const response = await axios.get(`${apiBase}/pets/my-pets`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        setPets(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching pets:', err);
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
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.success) {
        alert('Case submitted. Our team is assigning the best available Veterinarian to you. You will be notified once a veterinarian is assigned.');
        router.push('/my-pets');
      }
    } catch (err: unknown) {
      console.error('Error submitting case:', err);
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell className="flex min-h-screen items-center justify-center">
        <p className="text-paw-bark text-lg">Loading...</p>
      </PageShell>
    );
  }

  if (pets.length === 0) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Urgent care"
          title="Request assistance"
          subtitle="Get help for your pet from our dispatch team."
        />

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="paw-card-glass rounded-[1.75rem] border border-paw-bark/10 p-12 text-center shadow-paw">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-paw-sand text-paw-bark">
                <PawPrint className="h-8 w-8" strokeWidth={1.75} aria-hidden />
              </div>
              <h2 className="font-display text-3xl font-semibold text-paw-ink mb-4">No pets registered</h2>
              <p className="text-paw-bark/75 mb-8 text-lg">Add a pet profile before requesting assistance.</p>
              <button
                type="button"
                onClick={() => router.push('/my-pets/add')}
                className="px-8 py-4 rounded-full bg-paw-bark text-paw-cream font-semibold hover:bg-paw-ink transition-colors text-lg shadow-paw"
              >
                Add your first pet
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Urgent care"
        title="Request assistance"
        subtitle="Describe the issue and your location — we route you to the best available vet."
      />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="paw-card-glass rounded-2xl border-2 border-paw-bark/15 p-6 mb-8 flex gap-4 items-start shadow-paw">
            <div className="bg-paw-bark/10 p-3 rounded-full shrink-0">
              <Stethoscope className="w-6 h-6 text-paw-bark" aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold text-paw-ink text-lg mb-2">How it works</h3>
              <p className="text-paw-bark/80 leading-relaxed">
                Our team assigns the best available veterinarian to your case. You will be notified once a
                vet is assigned and they will contact you shortly.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="paw-card-glass rounded-[1.75rem] border border-paw-bark/10 p-8 shadow-paw">
            {error && (
              <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-lg font-semibold text-paw-ink mb-3" htmlFor="pet-select">
                Select pet *
              </label>
              <select
                id="pet-select"
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-paw-bark/15 rounded-2xl focus:border-paw-teal-mid focus:outline-none focus:ring-2 focus:ring-paw-teal-mid/20 text-lg bg-white/90"
              >
                <option value="">Choose your pet...</option>
                {pets.map((pet) => (
                  <option key={pet._id} value={pet._id}>
                    {pet.name} ({pet.species}
                    {pet.breed ? ` - ${pet.breed}` : ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-lg font-semibold text-paw-ink mb-3" htmlFor="issue">
                Describe the issue *
              </label>
              <textarea
                id="issue"
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                required
                maxLength={1000}
                rows={6}
                placeholder="Please describe what's wrong with your pet in detail..."
                className="w-full px-4 py-3 border-2 border-paw-bark/15 rounded-2xl focus:border-paw-teal-mid focus:outline-none focus:ring-2 focus:ring-paw-teal-mid/20 resize-none bg-white/90"
              />
              <p className="text-sm text-paw-bark/50 mt-2">{issueDescription.length}/1000 characters</p>
            </div>

            <div className="mb-8">
              <label className="block text-lg font-semibold text-paw-ink mb-3" htmlFor="loc">
                Your location *
              </label>
              <input
                id="loc"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                placeholder="Enter your address"
                className="w-full px-4 py-3 border-2 border-paw-bark/15 rounded-2xl focus:border-paw-teal-mid focus:outline-none focus:ring-2 focus:ring-paw-teal-mid/20 bg-white/90"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => router.push('/my-pets')}
                className="flex-1 px-6 py-4 rounded-full bg-paw-sand text-paw-ink font-semibold hover:bg-paw-sand/80 border border-paw-bark/10 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-4 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:bg-paw-bark/30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-paw"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Request assistance</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
