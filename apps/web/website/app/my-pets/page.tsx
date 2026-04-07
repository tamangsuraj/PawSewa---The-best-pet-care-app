'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { PetListItem } from '@/components/my-pets/ClinicalMyPetsDashboard';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLoader } from '@/components/PawSewaLoader';
import { PawPrint } from 'lucide-react';

function MyPetsClinicalShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
          const list: PetListItem[] = response.data.data || [];
          setPets(list);
          if (list.length > 0) {
            const q = searchParams.toString();
            router.replace(`/my-pets/${list[0]._id}${q ? `?${q}` : ''}`);
            return;
          }
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
  }, [authLoading, isAuthenticated, router, searchParams]);

  if (authLoading || loading) {
    return (
      <PageShell className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <PawSewaLoader width={150} />
        <p className="text-paw-bark">Loading your pets…</p>
      </PageShell>
    );
  }

  if (pets.length === 0) {
    return (
      <PageShell className="min-h-[calc(100vh-4.25rem)] bg-[#F5F5F5]">
        <PageContent>
        <div className="mx-auto max-w-2xl text-center">
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 shadow-sm">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F5F5] text-[#703418]">
              <PawPrint className="h-8 w-8" strokeWidth={1.75} aria-hidden />
            </div>
            <h1 className="text-3xl font-bold text-[#703418]">No pets yet</h1>
            <p className="mt-3 text-slate-600">
              Add your first pet to unlock the medical dashboard, health tracking, and appointments.
            </p>
            <button
              type="button"
              onClick={() => router.push('/my-pets/add')}
              className="mt-8 rounded-xl bg-[#703418] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5c2a14]"
            >
              Add your first pet
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mt-4 block w-full text-sm font-medium text-[#004D4D] hover:underline"
            >
              Back to home
            </button>
          </div>
        </div>
        </PageContent>
      </PageShell>
    );
  }

  return (
    <PageShell className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-[#F5F5F5]">
      <PawSewaLoader width={120} />
      <p className="text-slate-600">Opening your pet dashboard…</p>
    </PageShell>
  );
}

export default function MyPetsPage() {
  return (
    <Suspense
      fallback={
        <PageShell className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
          <PawSewaLoader width={150} />
          <p className="text-paw-bark">Loading…</p>
        </PageShell>
      }
    >
      <MyPetsClinicalShell />
    </Suspense>
  );
}
