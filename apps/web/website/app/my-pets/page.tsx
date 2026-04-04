'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  ClinicalMyPetsDashboard,
  type PetListItem,
} from '@/components/my-pets/ClinicalMyPetsDashboard';

function MyPetsClinicalShell() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [pets, setPets] = useState<PetListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/pets/my-pets');
        if (!cancelled && response.data.success) {
          setPets(response.data.data || []);
        }
      } catch (e) {
        console.error('Error fetching pets:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-cream">
        <p className="text-primary">Loading your pets…</p>
      </div>
    );
  }

  if (pets.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4.25rem)] bg-cream px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="rounded-2xl border border-[#E8DFD0] bg-white p-12 shadow-sm">
            <div className="mb-6 text-6xl">🐾</div>
            <h1 className="font-display text-3xl font-semibold text-primary">No pets yet</h1>
            <p className="mt-3 text-slate-600">
              Add your first pet to unlock the clinical dashboard, health tracking, and appointments.
            </p>
            <button
              type="button"
              onClick={() => router.push('/my-pets/add')}
              className="mt-8 rounded-xl bg-primary px-8 py-4 font-semibold text-white hover:opacity-95"
            >
              Add your first pet
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mt-4 block w-full text-sm font-medium text-primary underline"
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <ClinicalMyPetsDashboard pets={pets} />;
}

export default function MyPetsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-cream">
          <p className="text-primary">Loading…</p>
        </div>
      }
    >
      <MyPetsClinicalShell />
    </Suspense>
  );
}
