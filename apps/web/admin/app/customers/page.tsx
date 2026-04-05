'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Eye, X, Users } from 'lucide-react';

interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  isVerified?: boolean;
  createdAt: string;
}

export default function CustomersPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    location: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchCustomers();
    }
  }, [isAuthenticated, router]);

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/users');
      const allUsers = response.data.data;
      const petOwners = allUsers.filter((u: any) => u.role === 'pet_owner');
      setCustomers(petOwners);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      await api.post('/users/admin/create', {
        ...formData,
        role: 'pet_owner',
      });

      // Reset form and close modal
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        location: '',
      });
      setShowModal(false);
      
      // Refresh customers list
      fetchCustomers();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create customer');
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewDetails = async (customerId: string) => {
    try {
      const response = await api.get(`/users/${customerId}`);
      setSelectedCustomer(response.data.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching customer details:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      await api.delete(`/users/${id}`);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const term = searchTerm.toLowerCase();
  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(term) ||
      customer.email.toLowerCase().includes(term)
  );

  return (
    <>
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#5CB0CC]/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#5CB0CC]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
                  <p className="text-gray-600 text-sm">Manage pet owner accounts and information</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search customers…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#5CB0CC] focus:border-[#5CB0CC] text-sm"
                />
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-[#5CB0CC] hover:bg-[#4a9bb5] text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  + Add Customer
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-10 h-10 border-2 border-[#5CB0CC] border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-gray-500">Loading customers…</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Joined
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-10 text-center text-gray-500 text-sm">
                            No customers found
                          </td>
                        </tr>
                      ) : (
                        filteredCustomers.map((customer) => (
                          <tr key={customer._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {customer.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {customer.email}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {customer.phone || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {customer.location || '-'}
                            </td>
                            <td className="px-6 py-4">
                              {customer.isVerified ? (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(customer.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => router.push(`/customers/${customer._id}`)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5CB0CC]/10 text-[#5CB0CC] hover:bg-[#5CB0CC]/20 text-xs font-medium transition-colors border border-[#5CB0CC]/30"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </button>
                                <button
                                  onClick={() => handleDelete(customer._id)}
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors border border-red-200"
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
              )}
            </div>

            {/* Create Customer Modal */}
            {showModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4 border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Customer</h2>
                  
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleCreateCustomer}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#5CB0CC] focus:border-[#5CB0CC]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#5CB0CC] focus:border-[#5CB0CC]"
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
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#5CB0CC] focus:border-[#5CB0CC]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#5CB0CC] focus:border-[#5CB0CC]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#5CB0CC] focus:border-[#5CB0CC]"
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
                          });
                        }}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={formLoading}
                        className="flex-1 px-4 py-2 bg-[#5CB0CC] hover:bg-[#4a9bb5] text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {formLoading ? 'Creating...' : 'Add Customer'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Customer Details Modal */}
            {showDetailsModal && selectedCustomer && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl p-8 max-w-lg w-full mx-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Customer Details</h2>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        setSelectedCustomer(null);
                      }}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500">Name</label>
                      <p className="text-gray-900 font-medium">{selectedCustomer.name}</p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="text-gray-900 font-medium">{selectedCustomer.email}</p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-500">Phone</label>
                      <p className="text-gray-900 font-medium">{selectedCustomer.phone || 'Not provided'}</p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-500">Location</label>
                      <p className="text-gray-900 font-medium">{selectedCustomer.location || 'Not provided'}</p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-500">Verification Status</label>
                      <div className="mt-1">
                        {selectedCustomer.isVerified ? (
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium border border-green-200">
                            ✓ Verified
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium border border-amber-200">
                            ⏳ Pending Verification
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-gray-500">Account Status</label>
                      <p className="text-green-600 font-medium">Active</p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-500">Member Since</label>
                      <p className="text-gray-900 font-medium">
                        {new Date(selectedCustomer.createdAt).toLocaleDateString('en-US', {
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
                      setSelectedCustomer(null);
                    }}
                    className="w-full mt-6 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
    </>
  );
}
