'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Shield, UserPlus, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

interface Admin {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
}

interface PaymentGatewayStatus {
  khalti: {
    configured: boolean;
    mode: string;
    status: 'active' | 'sandbox' | 'inactive';
  };
}

export default function SettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [paymentGateway, setPaymentGateway] = useState<PaymentGatewayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchAdmins();
    }
  }, [isAuthenticated, router]);

  const fetchAdmins = async () => {
    try {
      const response = await api.get('/users');
      const allUsers = response.data.data;
      const adminUsers = allUsers.filter((u: any) => u.role === 'admin');
      setAdmins(adminUsers);
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentGatewayStatus = async () => {
    try {
      const response = await api.get('/admin/payment-gateway-status');
      if (response.data.success && response.data.data) {
        setPaymentGateway(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching payment gateway status:', error);
      setPaymentGateway({ khalti: { configured: false, mode: 'not_configured', status: 'inactive' } });
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPaymentGatewayStatus();
    }
  }, [isAuthenticated]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      await api.post('/users/admin/create', {
        ...formData,
        role: 'admin',
      });

      // Reset form and close modal
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
      });
      setShowModal(false);
      
      // Refresh admins list
      fetchAdmins();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create admin');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this admin? This action cannot be undone.')) return;

    // Prevent deleting yourself
    if (user && user._id === id) {
      alert('You cannot delete your own account');
      return;
    }

    try {
      await api.delete(`/users/${id}`);
      fetchAdmins();
    } catch (error) {
      console.error('Error deleting admin:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage system settings and administrator accounts</p>
      </div>

      {/* Admin Management Section */}
      <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Administrator Management</h2>
              <p className="text-sm text-gray-600">Manage admin user accounts</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Create Admin
          </button>
        </div>

        {/* Admins List */}
        <div className="space-y-3">
          {admins.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
              No administrators found
            </div>
          ) : (
            admins.map((admin) => (
              <div
                key={admin._id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
              >
                <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                  <h3 className="text-gray-900 font-medium">{admin.name}</h3>
                  <p className="text-sm text-gray-600">{admin.email}</p>
                    {admin.phone && (
                    <p className="text-xs text-gray-500 mt-1">{admin.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                  <p className="text-xs text-gray-500">Joined</p>
                  <p className="text-sm text-gray-700">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {user && user._id !== admin._id && (
                    <button
                      onClick={() => handleDelete(admin._id)}
                    className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-colors text-sm border border-red-200"
                    >
                      Remove
                    </button>
                  )}
                  {user && user._id === admin._id && (
                  <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm border border-green-200">
                      You
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment Gateway Status */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Payment Gateway</h2>
            <p className="text-sm text-gray-600">Khalti configuration status</p>
          </div>
        </div>
        {paymentGateway ? (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            {paymentGateway.khalti.configured ? (
              paymentGateway.khalti.status === 'active' ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Khalti: Active (Production)</p>
                    <p className="text-sm text-gray-600">Payment gateway is configured and running in production mode.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Khalti: Sandbox Mode</p>
                    <p className="text-sm text-gray-600">Keys are configured but using dev.khalti.com. Switch KHALTI_BASE_URL for production.</p>
                  </div>
                </>
              )
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Khalti: Not Configured</p>
                  <p className="text-sm text-gray-600">Set KHALTI_SECRET_KEY and KHALTI_BASE_URL in backend .env to enable payments.</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Loading...</p>
        )}
      </div>

      {/* System Information */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-4">System Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Version</p>
            <p className="text-gray-900 font-medium">1.0.0</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Environment</p>
            <p className="text-gray-900 font-medium">Development</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Admins</p>
            <p className="text-gray-900 font-medium">{admins.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Last Updated</p>
            <p className="text-gray-900 font-medium">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Create Admin Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Administrator</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateAdmin}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Admin users have full access. Only create admin accounts for trusted staff.
                  </p>
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
                  {formLoading ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
