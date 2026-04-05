'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Eye, X, Bike } from 'lucide-react';

interface Rider {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  vehicleType?: string;
  licenseNumber?: string;
  isVerified?: boolean;
  createdAt: string;
}

export default function RidersPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    location: '',
    vehicleType: '',
    licenseNumber: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchRiders();
    }
  }, [isAuthenticated, router]);

  const fetchRiders = async () => {
    try {
      const response = await api.get('/users');
      const allUsers = response.data.data;
      const ridersList = (allUsers || []).filter(
        (u: any) => u.role === 'rider' || u.role === 'RIDER'
      );
      setRiders(ridersList.map((u: any) => ({ ...u, name: u.name || u.full_name || u.email })));
    } catch (error) {
      console.error('Error fetching riders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      await api.post('/users/admin/create', {
        ...formData,
        role: 'rider',
      });

      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        location: '',
        vehicleType: '',
        licenseNumber: '',
      });
      setShowModal(false);
      fetchRiders();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create rider');
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewDetails = async (riderId: string) => {
    try {
      const response = await api.get(`/users/${riderId}`);
      setSelectedRider(response.data.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching rider details:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rider?')) return;

    try {
      await api.delete(`/users/${id}`);
      fetchRiders();
    } catch (error) {
      console.error('Error deleting rider:', error);
    }
  };

  const filteredRiders = riders.filter(rider =>
    rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rider.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (rider.vehicleType && rider.vehicleType.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <Bike className="w-8 h-8 text-primary" />
          Riders Management
        </h1>
        <p className="text-gray-600">Manage delivery and transportation riders</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search riders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="ml-4 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          + Add Rider
        </button>
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Vehicle Type</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">License Number</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredRiders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No riders found
                </td>
              </tr>
            ) : (
              filteredRiders.map((rider) => (
                <tr key={rider._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-900">{rider.name}</td>
                  <td className="px-6 py-4 text-gray-700">{rider.vehicleType || '-'}</td>
                  <td className="px-6 py-4 text-gray-700">{rider.licenseNumber || '-'}</td>
                  <td className="px-6 py-4 text-gray-700">{rider.email}</td>
                  <td className="px-6 py-4 text-gray-700">{rider.phone || '-'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                      Verified
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleViewDetails(rider._id)}
                        className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors text-sm flex items-center gap-1 border border-primary/20"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(rider._id)}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-colors text-sm border border-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Rider</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateRider}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Motorcycle, Bicycle, Car"
                    value={formData.vehicleType}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">License Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                      location: '',
                      vehicleType: '',
                      licenseNumber: '',
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {formLoading ? 'Creating...' : 'Add Rider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedRider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-xl border border-gray-200">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Rider Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedRider(null);
                }}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Name</label>
                <p className="text-gray-900 font-medium">{selectedRider.name}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Vehicle Type</label>
                <p className="text-gray-900 font-medium">{selectedRider.vehicleType || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">License Number</label>
                <p className="text-gray-900 font-medium">{selectedRider.licenseNumber || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Email</label>
                <p className="text-gray-900 font-medium">{selectedRider.email}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Phone</label>
                <p className="text-gray-900 font-medium">{selectedRider.phone || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Location</label>
                <p className="text-gray-900 font-medium">{selectedRider.location || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Member Since</label>
                <p className="text-gray-900 font-medium">
                  {new Date(selectedRider.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowDetailsModal(false);
                setSelectedRider(null);
              }}
              className="w-full mt-6 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
