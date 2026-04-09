'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Eye, X, Store } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';

interface ShopOwner {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  shopName?: string;
  businessLicense?: string;
  isVerified?: boolean;
  createdAt: string;
}

export default function ShopOwnersPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [shopOwners, setShopOwners] = useState<ShopOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedShop, setSelectedShop] = useState<ShopOwner | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    location: '',
    shopName: '',
    businessLicense: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchShopOwners();
    }
  }, [isAuthenticated, router]);

  const fetchShopOwners = async () => {
    try {
      const response = await api.get('/users');
      const allUsers = response.data?.data as unknown;
      const rows = Array.isArray(allUsers) ? (allUsers as Array<Record<string, unknown>>) : [];
      const shops = rows
        .filter((u) => u.role === 'shop_owner')
        .map((u) => ({
          _id: String(u._id ?? ''),
          name: String(u.name ?? u.email ?? 'Shop owner'),
          email: String(u.email ?? ''),
          phone: u.phone ? String(u.phone) : undefined,
          location: u.location ? String(u.location) : undefined,
          shopName: u.shopName ? String(u.shopName) : undefined,
          businessLicense: u.businessLicense ? String(u.businessLicense) : undefined,
          isVerified: typeof u.isVerified === 'boolean' ? u.isVerified : undefined,
          createdAt: String(u.createdAt ?? ''),
        }));
      setShopOwners(shops);
    } catch {
      setShopOwners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      await api.post('/users/admin/create', {
        ...formData,
        role: 'shop_owner',
      });

      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        location: '',
        shopName: '',
        businessLicense: '',
      });
      setShowModal(false);
      fetchShopOwners();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } } };
      setError(e2.response?.data?.message || 'Failed to create shop owner');
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewDetails = async (shopId: string) => {
    try {
      const response = await api.get(`/users/${shopId}`);
      setSelectedShop(response.data.data);
      setShowDetailsModal(true);
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shop owner?')) return;

    try {
      await api.delete(`/users/${id}`);
      fetchShopOwners();
    } catch {
      /* ignore */
    }
  };

  const filteredShops = shopOwners.filter(
    (shop) =>
      shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (shop.shopName && shop.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
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
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Partner Management', href: '/partner-management' },
            { label: 'Shop Owners' },
          ]}
        />
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <Store className="w-8 h-8 text-primary" />
          Shop owners
        </h1>
        <p className="text-gray-600">
          Provision seller accounts. Product catalogue and categories are under{' '}
          <Link href="/shop-products" className="text-primary font-medium hover:underline">
            Shop Management
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search shop owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/shop-products"
            className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors shadow-sm text-center text-sm"
          >
            Product catalogue
          </Link>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Store className="w-4 h-4" />
            Add shop owner
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="admin-table-scroll overflow-x-auto">
          <div className="admin-data-table-inner">
            <table className="admin-table-sticky-first admin-table-sticky-last min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Shop name</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Phone</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-4 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredShops.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No shop owners found
                    </td>
                  </tr>
                ) : (
                  filteredShops.map((shop) => (
                    <tr key={shop._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-900">{shop.name}</td>
                      <td className="px-6 py-4 text-gray-700">{shop.shopName || '—'}</td>
                      <td className="px-6 py-4 text-gray-700">{shop.email}</td>
                      <td className="px-6 py-4 text-gray-700">{shop.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                          Verified
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(shop._id)}
                            className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors text-sm flex items-center gap-1 border border-primary/20"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(shop._id)}
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
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add new shop owner</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateShop}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shop name *</label>
                  <input
                    type="text"
                    required
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business license
                  </label>
                  <input
                    type="text"
                    value={formData.businessLicense}
                    onChange={(e) => setFormData({ ...formData, businessLicense: e.target.value })}
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
                      shopName: '',
                      businessLicense: '',
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
                  {formLoading ? 'Creating...' : 'Add shop owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedShop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-xl border border-gray-200">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Shop owner details</h2>
              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedShop(null);
                }}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Name</label>
                <p className="text-gray-900 font-medium">{selectedShop.name}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Shop name</label>
                <p className="text-gray-900 font-medium">{selectedShop.shopName || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Email</label>
                <p className="text-gray-900 font-medium">{selectedShop.email}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Phone</label>
                <p className="text-gray-900 font-medium">{selectedShop.phone || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Location</label>
                <p className="text-gray-900 font-medium">{selectedShop.location || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Business license</label>
                <p className="text-gray-900 font-medium">
                  {selectedShop.businessLicense || 'Not provided'}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Member since</label>
                <p className="text-gray-900 font-medium">
                  {new Date(selectedShop.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowDetailsModal(false);
                setSelectedShop(null);
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
