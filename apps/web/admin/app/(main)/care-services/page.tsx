'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Eye, X, Home } from 'lucide-react';

interface CareService {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  serviceType?: string;
  facilityName?: string;
  isVerified?: boolean;
  createdAt: string;
}

export default function CareServicesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [careServices, setCareServices] = useState<CareService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedService, setSelectedService] = useState<CareService | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    location: '',
    serviceType: 'Boarding' as
      | 'Boarding'
      | 'Grooming'
      | 'Spa'
      | 'Training'
      | 'Daycare'
      | 'Wash'
      | 'Both',
    facilityName: '',
    price: '',
    latitude: '',
    longitude: '',
    imageUrls: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchCareServices();
    }
  }, [isAuthenticated, router]);

  const fetchCareServices = async () => {
    try {
      const response = await api.get('/users');
      const allUsers: unknown[] = response.data?.data ?? [];
      const services: CareService[] = allUsers
        .filter((u): u is Record<string, unknown> => typeof u === 'object' && u !== null)
        .filter((u) => u['role'] === 'care_service')
        .map((u) => u as unknown as CareService);
      setCareServices(services);
    } catch (error) {
      console.error('Error fetching care services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    const priceNum = Number(formData.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError('Enter a valid price (Rs.)');
      setFormLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        location: formData.location,
        facilityName: formData.facilityName,
        serviceType: formData.serviceType,
        role: 'care_service',
        price: priceNum,
      };
      if (formData.latitude.trim()) payload.latitude = Number(formData.latitude);
      if (formData.longitude.trim()) payload.longitude = Number(formData.longitude);
      if (formData.imageUrls.trim()) payload.imageUrls = formData.imageUrls;

      await api.post('/users/admin/create', payload);

      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        location: '',
        serviceType: 'Boarding',
        facilityName: '',
        price: '',
        latitude: '',
        longitude: '',
        imageUrls: '',
      });
      setShowModal(false);
      fetchCareServices();
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      setError(msg || 'Failed to create care service');
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewDetails = async (serviceId: string) => {
    try {
      const response = await api.get(`/users/${serviceId}`);
      setSelectedService(response.data.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching service details:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this care service?')) return;

    try {
      await api.delete(`/users/${id}`);
      fetchCareServices();
    } catch (error) {
      console.error('Error deleting care service:', error);
    }
  };

  const filteredServices = careServices.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (service.facilityName && service.facilityName.toLowerCase().includes(searchTerm.toLowerCase()))
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
          <Home className="w-8 h-8 text-primary" />
          Care Services Management
        </h1>
        <p className="text-gray-600">Manage pet boarding and grooming facilities</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search care services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="ml-4 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          + Add Care Service
        </button>
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Facility Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Service Type</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredServices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No care services found
                </td>
              </tr>
            ) : (
              filteredServices.map((service) => (
                <tr key={service._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-900">{service.name}</td>
                  <td className="px-6 py-4 text-gray-700">{service.facilityName || '-'}</td>
                  <td className="px-6 py-4 text-gray-700">{service.serviceType || '-'}</td>
                  <td className="px-6 py-4 text-gray-700">{service.email}</td>
                  <td className="px-6 py-4 text-gray-700">{service.phone || '-'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                      Verified
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleViewDetails(service._id)}
                        className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors text-sm flex items-center gap-1 border border-primary/20"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(service._id)}
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

      {/* Create Modal — scrollable so long forms fit small viewports */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 sm:py-10">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg max-h-[min(92vh,calc(100dvh-2rem))] overflow-y-auto overscroll-contain px-6 sm:px-8 py-6 my-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Add New Care Service</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateService}>
              <div className="space-y-4 pb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Facility Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.facilityName}
                    onChange={(e) => setFormData({ ...formData, facilityName: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Listing category *</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Shown in the user app under Pet Care+ (each category maps to a public listing).
                    &quot;Both&quot; creates boarding + grooming listings.
                  </p>
                  <select
                    required
                    value={formData.serviceType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        serviceType: e.target.value as typeof formData.serviceType,
                      })
                    }
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="Boarding">Boarding (overnight stays)</option>
                    <option value="Grooming">Grooming</option>
                    <option value="Spa">Spa</option>
                    <option value="Training">Training</option>
                    <option value="Daycare">Daycare</option>
                    <option value="Wash">Wash</option>
                    <option value="Both">Both (boarding + grooming)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price (Rs.) *</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Per night for boarding/daycare; per session for grooming, spa, training, wash.
                  </p>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Listing images (optional)</label>
                  <p className="text-xs text-gray-500 mb-2">
                    One image URL per line (https://…). If empty, a default image is used.
                  </p>
                  <textarea
                    rows={3}
                    value={formData.imageUrls}
                    onChange={(e) => setFormData({ ...formData, imageUrls: e.target.value })}
                    placeholder="https://example.com/photo1.jpg"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Latitude (optional)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="27.7172"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Longitude (optional)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="85.3240"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location (address) *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
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
                      serviceType: 'Boarding',
                      facilityName: '',
                      price: '',
                      latitude: '',
                      longitude: '',
                      imageUrls: '',
                    });
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {formLoading ? 'Creating...' : 'Add Care Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedService && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 sm:py-10">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg max-h-[min(92vh,calc(100dvh-2rem))] overflow-y-auto overscroll-contain p-6 sm:p-8 my-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Care Service Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedService(null);
                }}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Name</label>
                <p className="text-gray-900 font-medium">{selectedService.name}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Facility Name</label>
                <p className="text-gray-900 font-medium">{selectedService.facilityName || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Service Type</label>
                <p className="text-gray-900 font-medium">{selectedService.serviceType || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Email</label>
                <p className="text-gray-900 font-medium">{selectedService.email}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Phone</label>
                <p className="text-gray-900 font-medium">{selectedService.phone || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Location</label>
                <p className="text-gray-900 font-medium">{selectedService.location || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Member Since</label>
                <p className="text-gray-900 font-medium">
                  {new Date(selectedService.createdAt).toLocaleDateString('en-US', {
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
                setSelectedService(null);
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
