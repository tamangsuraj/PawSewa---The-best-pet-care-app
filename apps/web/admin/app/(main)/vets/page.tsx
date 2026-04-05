'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Vet {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  clinicLocation?: string;
  createdAt: string;
}

export default function VetsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [vets, setVets] = useState<Vet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    clinicLocation: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchVets();
    }
  }, [isAuthenticated, router]);

  const fetchVets = async () => {
    try {
      const response = await api.get('/users');
      const allUsers = response.data.data;
      const veterinarians = (allUsers || []).filter(
        (u: any) => u.role === 'veterinarian' || u.role === 'VET'
      );
      setVets(veterinarians.map((u: any) => ({ ...u, name: u.name || u.full_name || u.email })));
    } catch (error) {
      console.error('Error fetching vets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVet = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      await api.post('/users/admin/create', {
        ...formData,
        role: 'veterinarian',
      });

      // Reset form and close modal
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        clinicLocation: '',
      });
      setShowModal(false);
      
      // Refresh vets list
      fetchVets();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create veterinarian');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this veterinarian?')) return;

    try {
      await api.delete(`/users/${id}`);
      fetchVets();
    } catch (error) {
      console.error('Error deleting vet:', error);
    }
  };

  const filteredVets = vets.filter(vet =>
    vet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vet.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Veterinarian Management</h1>
        <p className="text-slate-400">Manage veterinarian accounts and clinic information</p>
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search veterinarians..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="ml-4 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          + Create New Veterinarian
        </button>
      </div>

      {/* Vets Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Clinic Location</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Joined</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredVets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                  No veterinarians found
                </td>
              </tr>
            ) : (
              filteredVets.map((vet) => (
                <tr key={vet._id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 text-white">{vet.name}</td>
                  <td className="px-6 py-4 text-slate-300">{vet.email}</td>
                  <td className="px-6 py-4 text-slate-300">{vet.phone || '-'}</td>
                  <td className="px-6 py-4 text-slate-300">{vet.clinicLocation || '-'}</td>
                  <td className="px-6 py-4 text-slate-300">
                    {new Date(vet.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(vet._id)}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Vet Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Veterinarian</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateVet}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Clinic Location
                  </label>
                  <input
                    type="text"
                    value={formData.clinicLocation}
                    onChange={(e) => setFormData({ ...formData, clinicLocation: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                    setFormData({
                      name: '',
                      email: '',
                      password: '',
                      phone: '',
                      clinicLocation: '',
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {formLoading ? 'Creating...' : 'Create Veterinarian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
