'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  ClinicalMyPetsDashboard,
  type PetListItem,
} from '@/components/my-pets/ClinicalMyPetsDashboard';
import { PageShell } from '@/components/layout/PageShell';
import { PawPrint } from 'lucide-react';

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
      <PageShell className="flex min-h-[50vh] items-center justify-center">
        <p className="text-paw-bark">Loading your pets…</p>
      </PageShell>
    );
  }

  if (pets.length === 0) {
    return (
      <PageShell className="min-h-[calc(100vh-4.25rem)] px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="paw-card-glass rounded-[1.75rem] border border-paw-bark/10 p-12 shadow-paw">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-paw-sand text-paw-bark">
              <PawPrint className="h-8 w-8" strokeWidth={1.75} aria-hidden />
            </div>
            <h1 className="font-display text-3xl font-semibold text-paw-ink">No pets yet</h1>
            <p className="mt-3 text-paw-bark/75">
              Add your first pet to unlock the clinical dashboard, health tracking, and appointments.
            </p>
            <button
              type="button"
              onClick={() => router.push('/my-pets/add')}
              className="mt-8 rounded-full bg-paw-bark px-8 py-4 font-semibold text-paw-cream hover:bg-paw-ink shadow-paw"
            >
              Add your first pet
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mt-4 block w-full text-sm font-medium text-paw-teal-mid hover:underline"
            >
              Back to home
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return <ClinicalMyPetsDashboard pets={pets} />;
}

export default function MyPetsPage() {
  return (
    <Suspense
      fallback={
        <PageShell className="flex min-h-[50vh] items-center justify-center">
          <p className="text-paw-bark">Loading…</p>
        </PageShell>
      }
    >
      <MyPetsClinicalShell />
    </Suspense>
  );
}
