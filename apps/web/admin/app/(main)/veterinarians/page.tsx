'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { USER_ROLES } from '@/lib/userRoles';
import { UserCheck, Clock, CheckCircle, XCircle, Edit2, RefreshCw, Plus } from 'lucide-react';

interface VetRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialty?: string;
  specialization?: string;
  licenseNumber?: string;
  currentShift: string;
  isAvailable: boolean;
  isAccountActive?: boolean;
  bio?: string;
  createdAt: string;
  totalAppointments?: number;
}

export default function VeterinariansPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [vets, setVets] = useState<VetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingVet, setEditingVet] = useState<VetRow | null>(null);
  const [newShift, setNewShift] = useState('');
  const [newAvailability, setNewAvailability] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    licenseNumber: '',
    password: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      void fetchVets();
    }
  }, [isAuthenticated, router]);

  const fetchVets = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.get('/users/admin/veterinarians');
      const raw = response.data?.data as unknown;
      const rows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
      const veterinarians = rows.map((u) => ({
        _id: String(u._id ?? ''),
        name: String(u.name ?? u.full_name ?? u.email ?? 'Veterinarian'),
        email: String(u.email ?? ''),
        phone: u.phone ? String(u.phone) : undefined,
        specialty: u.specialty ? String(u.specialty) : undefined,
        specialization: u.specialization ? String(u.specialization) : undefined,
        licenseNumber: u.licenseNumber ? String(u.licenseNumber) : undefined,
        currentShift: String(u.currentShift ?? 'Off'),
        isAvailable: Boolean(u.isAvailable),
        isAccountActive: typeof u.isAccountActive === 'boolean' ? u.isAccountActive : true,
        bio: u.bio ? String(u.bio) : undefined,
        createdAt: String(u.createdAt ?? ''),
        totalAppointments: typeof u.totalAppointments === 'number' ? u.totalAppointments : 0,
      }));
      setVets(veterinarians);
      setError('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to load veterinarians');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCreateVet = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    const emailTrim = formData.email.trim();
    console.log('[INFO] Admin provisioning new Veterinarian:', emailTrim);
    try {
      await api.post('/users/admin/create', {
        name: formData.name.trim(),
        email: emailTrim,
        phone: formData.phone.trim() || undefined,
        password: formData.password,
        role: USER_ROLES.VETERINARIAN,
        specialization: formData.specialization.trim(),
        licenseNumber: formData.licenseNumber.trim() || undefined,
      });
      console.log('[SUCCESS] Veterinarian account created and synced to PawSewa-Cluster.');
      setFormData({
        name: '',
        email: '',
        phone: '',
        specialization: '',
        licenseNumber: '',
        password: '',
      });
      setShowCreateModal(false);
      void fetchVets(true);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } } };
      setFormError(e2.response?.data?.message || 'Failed to create veterinarian');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (vet: VetRow) => {
    setEditingVet(vet);
    setNewShift(vet.currentShift || 'Off');
    setNewAvailability(vet.isAvailable || false);
  };

  const handleUpdateShift = async () => {
    if (!editingVet) return;

    try {
      setUpdating(true);

      await api.patch(`/cases/vets/${editingVet._id}/shift`, {
        currentShift: newShift,
        isAvailable: newAvailability,
      });

      setEditingVet(null);
      void fetchVets(true);
      alert('Shift updated successfully!');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'Failed to update shift');
    } finally {
      setUpdating(false);
    }
  };

  const getShiftBadge = (shift: string) => {
    const styles = {
      Morning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      Evening: 'bg-orange-100 text-orange-800 border-orange-300',
      Night: 'bg-purple-100 text-purple-800 border-purple-300',
      Off: 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${styles[shift as keyof typeof styles] || styles.Off}`}
      >
        <Clock className="h-3 w-3" />
        {shift}
      </span>
    );
  };

  const partnerStatus = (v: VetRow) => {
    if (v.isAccountActive === false) {
      return { label: 'Disabled', className: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
    if (v.isAvailable) {
      return { label: 'Active', className: 'bg-green-100 text-green-800 border-green-300' };
    }
    return { label: 'Offline', className: 'bg-amber-100 text-amber-900 border-amber-300' };
  };

  if (loading && vets.length === 0 && !error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-none pb-8">
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-primary">
              <UserCheck className="h-8 w-8" />
              Veterinarians
            </h1>
            <p className="text-gray-600">Provision vet_app accounts and manage shifts</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Veterinarian
            </button>
            <button
              type="button"
              onClick={() => void fetchVets(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Total Vets</p>
          <p className="text-3xl font-bold text-gray-900">{vets.length}</p>
        </div>
        <div className="rounded-lg bg-green-50 p-4 shadow">
          <p className="text-sm text-green-600">Available</p>
          <p className="text-3xl font-bold text-green-800">{vets.filter((v) => v.isAvailable).length}</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-4 shadow">
          <p className="text-sm text-yellow-600">Morning Shift</p>
          <p className="text-3xl font-bold text-yellow-800">
            {vets.filter((v) => v.currentShift === 'Morning').length}
          </p>
        </div>
        <div className="rounded-lg bg-purple-50 p-4 shadow">
          <p className="text-sm text-purple-600">Night Shift</p>
          <p className="text-3xl font-bold text-purple-800">
            {vets.filter((v) => v.currentShift === 'Night').length}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading && vets.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-gray-600">Loading veterinarians...</p>
        </div>
      ) : vets.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-md">
          <UserCheck className="text-primary/20 mx-auto mb-6 h-20 w-20" />
          <h2 className="text-primary mb-4 text-2xl font-bold">No Veterinarians</h2>
          <p className="mb-6 text-gray-600">Add a veterinarian to enable vet_app sign-in.</p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary/90"
          >
            Add Veterinarian
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="admin-table-scroll overflow-x-auto">
            <div className="admin-data-table-inner">
              <table className="admin-table-sticky-first admin-table-sticky-last min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Veterinarian
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Specialization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      License
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Total Appointments
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Current Shift
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Availability
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {vets.map((vet) => {
                    const st = partnerStatus(vet);
                    return (
                      <tr key={vet._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Dr. {vet.name}</p>
                            <p className="text-xs text-gray-500">{vet.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">{vet.phone || 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">
                            {vet.specialty || vet.specialization || 'General'}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{vet.licenseNumber || '—'}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${st.className}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {vet.totalAppointments ?? 0}
                        </td>
                        <td className="px-6 py-4">{getShiftBadge(vet.currentShift || 'Off')}</td>
                        <td className="px-6 py-4">
                          {vet.isAvailable ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                              <CheckCircle className="h-3 w-3" />
                              Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                              <XCircle className="h-3 w-3" />
                              Unavailable
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEditModal(vet)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                          >
                            <Edit2 className="h-3 w-3" />
                            Manage Shift
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">Add New Veterinarian</h2>
            {formError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateVet}>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Specialization *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Surgery, General, Vaccinations"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Professional license (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormError('');
                    setFormData({
                      name: '',
                      email: '',
                      phone: '',
                      specialization: '',
                      licenseNumber: '',
                      password: '',
                    });
                  }}
                  className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-800 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {formLoading ? 'Creating...' : 'Add Veterinarian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingVet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900">Manage Shift</h2>
              <p className="mt-1 text-gray-600">Dr. {editingVet.name}</p>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Current Shift</label>
                <select
                  value={newShift}
                  onChange={(e) => setNewShift(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                  <option value="Night">Night</option>
                  <option value="Off">Off</option>
                </select>
              </div>

              <div>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={newAvailability}
                    onChange={(e) => setNewAvailability(e.target.checked)}
                    className="h-5 w-5 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Mark as Available for Assignment</span>
                </label>
                <p className="ml-8 mt-1 text-xs text-gray-500">
                  Available vets appear in assignment lists for new cases
                </p>
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-200 p-6">
              <button
                type="button"
                onClick={() => setEditingVet(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                disabled={updating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleUpdateShift()}
                disabled={updating}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {updating ? 'Updating...' : 'Update Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
