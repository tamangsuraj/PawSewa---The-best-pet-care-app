'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  User, 
  MapPin, 
  Phone,
  Stethoscope,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

interface Case {
  _id: string;
  pet: {
    _id: string;
    name: string;
    breed?: string;
    age?: number;
    image?: string;
  };
  issueDescription: string;
  location: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  assignedVet?: {
    _id: string;
    name: string;
    phone?: string;
    specialty?: string;
    specialization?: string;
  };
  createdAt: string;
  assignedAt?: string;
  completedAt?: string;
}

export default function MyCasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchMyCases = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const response = await api.get('/cases/my/requests');
      if (response.data.success) {
        setCases(response.data.data || []);
      }
      setError('');
    } catch (err: unknown) {
      console.error('Error fetching cases:', err);
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      void fetchMyCases();
    }
  }, [router, fetchMyCases]);

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      assigned: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-orange-100 text-orange-800 border-orange-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
    };

    const icons = {
      pending: <Clock className="w-4 h-4" />,
      assigned: <User className="w-4 h-4" />,
      in_progress: <Stethoscope className="w-4 h-4" />,
      completed: <CheckCircle className="w-4 h-4" />,
    };

    const labels = {
      pending: 'Pending Assignment',
      assigned: 'Assigned',
      in_progress: 'In Progress',
      completed: 'Completed',
    };

    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border-2 ${styles[status as keyof typeof styles]}`}>
        {icons[status as keyof typeof icons]}
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredCases = filterStatus === 'all' 
    ? cases 
    : cases.filter(c => c.status === filterStatus);

  const pendingCount = cases.filter(c => c.status === 'pending').length;
  const activeCount = cases.filter(c => c.status === 'assigned' || c.status === 'in_progress').length;
  const completedCount = cases.filter(c => c.status === 'completed').length;
  const totalCount = cases.length; // All cases including cancelled

  if (loading) {
    return (
      <PageShell className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-paw-bark border-t-transparent mb-4" />
          <p className="text-paw-bark text-xl">Loading your cases...</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Dispatch"
        title="My cases"
        subtitle="Track your veterinary assistance requests."
        actions={
          <button
            type="button"
            onClick={fetchMyCases}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-paw-cream/15 border border-white/20 text-paw-cream font-semibold hover:bg-paw-cream/25 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      <PageContent compact>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="paw-surface-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <div className="bg-yellow-100 p-4 rounded-full">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="paw-surface-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Active</p>
                <p className="text-3xl font-bold text-blue-600">{activeCount}</p>
              </div>
              <div className="bg-blue-100 p-4 rounded-full">
                <Stethoscope className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="paw-surface-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{completedCount}</p>
              </div>
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="paw-surface-card border-2 border-paw-bark/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Total Cases</p>
                <p className="text-3xl font-bold text-paw-bark">{totalCount}</p>
              </div>
              <div className="bg-paw-bark/10 p-4 rounded-full">
                <svg className="w-8 h-8 text-paw-bark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="paw-surface-card mb-8 flex gap-2 overflow-x-auto p-2">
          {[
            { value: 'all', label: 'All Cases' },
            { value: 'pending', label: 'Pending' },
            { value: 'assigned', label: 'Assigned' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={`px-6 py-3 rounded-xl font-semibold transition-colors whitespace-nowrap ${
                filterStatus === filter.value
                  ? 'bg-paw-bark text-paw-cream shadow-paw'
                  : 'text-paw-bark/70 hover:bg-paw-sand/80'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Cases List */}
        {filteredCases.length === 0 ? (
          <div className="paw-surface-card p-12 text-center">
            <h2 className="font-display text-2xl font-semibold text-paw-ink mb-2">
              {filterStatus === 'all' ? 'No Cases Yet' : `No ${filterStatus.replace('_', ' ')} Cases`}
            </h2>
            <p className="text-paw-bark/70 mb-6">
              {filterStatus === 'all'
                ? "You haven't submitted any assistance requests yet."
                : `You don't have any ${filterStatus.replace('_', ' ')} cases.`}
            </p>
            {filterStatus === 'all' && (
              <button
                type="button"
                onClick={() => router.push('/request-assistance')}
                className="paw-cta-primary text-lg"
              >
                Request assistance
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredCases.map((caseData) => (
              <div
                key={caseData._id}
                className="paw-surface-card p-6"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Pet Info */}
                  <div className="flex items-start gap-4 lg:w-1/3">
                    <div className="w-20 h-20 bg-paw-bark/10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {caseData.pet.image ? (
                        <Image
                          src={caseData.pet.image}
                          alt={caseData.pet.name}
                          width={80}
                          height={80}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">🐾</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-paw-ink mb-1">
                        {caseData.pet.name}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {caseData.pet.breed} • {caseData.pet.age} years
                      </p>
                      <div className="mt-2">
                        {getStatusBadge(caseData.status)}
                      </div>
                    </div>
                  </div>

                  {/* Case Details */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Issue Description:</p>
                      <p className="text-gray-800">{caseData.issueDescription}</p>
                    </div>

                    <div className="flex items-start gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                      <span className="text-sm">{caseData.location}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Submitted: {formatDate(caseData.createdAt)}</span>
                    </div>

                    {/* Assigned Vet Info */}
                    {caseData.assignedVet && (
                      <div className="mt-4 p-4 rounded-xl border-2 border-paw-bark/15 bg-paw-sand/40">
                        <p className="text-sm font-semibold text-paw-ink mb-2">Assigned veterinarian</p>
                        <div className="flex items-center gap-3">
                          <div className="bg-paw-bark/10 p-2 rounded-full">
                            <User className="w-5 h-5 text-paw-bark" />
                          </div>
                          <div>
                            <p className="font-bold text-paw-ink">
                              Dr. {caseData.assignedVet.name}
                            </p>
                            <p className="text-sm text-gray-700">
                              {caseData.assignedVet.specialty || caseData.assignedVet.specialization || 'General Practitioner'}
                            </p>
                            {caseData.assignedVet.phone && (
                              <div className="flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3 text-paw-bark" />
                                <span className="text-sm text-gray-800">
                                  {caseData.assignedVet.phone}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {caseData.assignedAt && (
                          <p className="text-xs text-gray-600 mt-2">
                            Assigned: {formatDate(caseData.assignedAt)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Completed Info */}
                    {caseData.status === 'completed' && caseData.completedAt && (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-semibold">
                            Completed on {formatDate(caseData.completedAt)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA Section */}
        {cases.length > 0 && (
          <div className="mt-12 relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-paw-bark via-paw-ink to-paw-umber text-paw-cream p-8 text-center shadow-paw-lg border border-white/10">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_100%,rgba(13,148,136,0.2),transparent_50%)]"
              aria-hidden
            />
            <div className="relative">
              <h2 className="font-display text-2xl font-semibold mb-3">Need more help?</h2>
              <p className="text-paw-cream/85 mb-6">Submit another assistance request for your pet.</p>
              <button
                type="button"
                onClick={() => router.push('/request-assistance')}
                className="paw-cta-primary text-lg"
              >
                Request assistance
              </button>
            </div>
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}
