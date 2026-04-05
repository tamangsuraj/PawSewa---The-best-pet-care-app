'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Users,
  PawPrint,
  UserCheck,
  TrendingUp,
  Package,
  MapPin,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Stats {
  totalUsers: number;
  totalPets: number;
  totalVets: number;
  totalPetOwners: number;
  totalShopOwners: number;
  totalCareServices: number;
  totalRiders: number;
}

interface RecentUser {
  _id: string;
  name: string;
  email?: string;
  role: string;
}

interface DashboardData {
  stats: Stats;
  recentUsers: RecentUser[];
}

interface RecentOrderRow {
  _id: string;
  user?: { name?: string };
  totalAmount: number;
  status: string;
  createdAt: string;
  deliveryLocation?: {
    address: string;
    point?: { coordinates: [number, number] };
  };
  location?: { lat: number; lng: number };
}

interface ShopRecommendationActivityRow {
  _id: string;
  action?: string;
  personalizedMatch?: boolean;
  userPetType?: string;
  createdAt: string;
  user?: { name?: string; email?: string };
  product?: { name?: string; price?: number; targetPets?: string[] };
}

function recentOrderCoords(o: RecentOrderRow): { lat: number; lng: number } | null {
  const loc = o.location;
  if (
    loc &&
    typeof loc.lat === 'number' &&
    typeof loc.lng === 'number' &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  ) {
    return { lat: loc.lat, lng: loc.lng };
  }
  const c = o.deliveryLocation?.point?.coordinates;
  if (c && c.length >= 2) {
    const lng = c[0];
    const lat = c[1];
    if (typeof lat === 'number' && typeof lng === 'number') {
      return { lat, lng };
    }
  }
  return null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<RecentOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [shopRecActivity, setShopRecActivity] = useState<ShopRecommendationActivityRow[]>([]);
  const [shopRecLoading, setShopRecLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data?: RecentOrderRow[];
        }>('/orders', { params: { limit: 8, page: 1 } });
        if (response.data.success && Array.isArray(response.data.data)) {
          setRecentOrders(response.data.data);
        }
      } catch {
        toast.error('Failed to load recent orders');
      } finally {
        setOrdersLoading(false);
      }
    };
    loadOrders();
  }, []);

  useEffect(() => {
    const loadShopRec = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data?: ShopRecommendationActivityRow[];
        }>('/admin/shop-recommendation-activity', { params: { limit: 15 } });
        if (response.data.success && Array.isArray(response.data.data)) {
          setShopRecActivity(response.data.data);
        }
      } catch {
        /* Non-admin or route unavailable */
      } finally {
        setShopRecLoading(false);
      }
    };
    loadShopRec();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/users/admin/stats');
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error: unknown) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
            {/* Page Title */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
              <p className="text-gray-600">Real-time platform statistics and insights</p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse border border-gray-200">
                    <div className="h-12 w-12 bg-gray-200 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-16"></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {/* Total Users */}
                  <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.stats.totalUsers || 0}</p>
                  </div>

                  {/* Pet Owners */}
                  <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-danger" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Pet Owners</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.stats.totalPetOwners || 0}</p>
                  </div>

                  {/* Veterinarians */}
                  <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                        <UserCheck className="w-6 h-6 text-success" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Veterinarians</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.stats.totalVets || 0}</p>
                  </div>

                  {/* Shop Owners */}
                  <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-purple-600" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Shop Owners</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.stats.totalShopOwners || 0}</p>
                  </div>

                  {/* Care Services */}
                  <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-yellow-600" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Care Services</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.stats.totalCareServices || 0}</p>
                  </div>

                  {/* Riders */}
                  <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-cyan-50 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-cyan-600" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Riders</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.stats.totalRiders || 0}</p>
                  </div>

                  {/* Total Pets */}
                  <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <PawPrint className="w-6 h-6 text-primary" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-gray-600 text-sm font-medium mb-1">Total Pets</p>
                    <p className="text-3xl font-bold text-gray-900">{data?.stats.totalPets || 0}</p>
                  </div>
                </div>

                {/* Recent Users */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Users</h2>
                  {data?.recentUsers && data.recentUsers.length > 0 ? (
                    <div className="space-y-3">
                      {data.recentUsers.map((user) => (
                        <div
                          key={user._id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.name}</p>
                              <p className="text-sm text-gray-600">{user.email}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              user.role === 'admin' 
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : user.role === 'veterinarian'
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}>
                              {user.role.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No users yet</p>
                  )}
                </div>

                {/* Shop: personalized recommendation interactions */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-primary" />
                    Shop recommendation activity
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Logged when customers add a product to cart that matched their pet type (personalized
                    picks).
                  </p>
                  {shopRecLoading ? (
                    <p className="text-gray-500 text-center py-6">Loading…</p>
                  ) : shopRecActivity.length === 0 ? (
                    <p className="text-gray-500 text-center py-6">No recommendation events yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-500">
                            <th className="py-2 pr-4 font-medium">When</th>
                            <th className="py-2 pr-4 font-medium">Customer</th>
                            <th className="py-2 pr-4 font-medium">Product</th>
                            <th className="py-2 pr-4 font-medium">Action</th>
                            <th className="py-2 font-medium">Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shopRecActivity.map((row) => (
                            <tr
                              key={row._id}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                                {new Date(row.createdAt).toLocaleString()}
                              </td>
                              <td className="py-3 pr-4 text-gray-900">
                                <span className="font-medium">{row.user?.name ?? '—'}</span>
                                {row.user?.email ? (
                                  <span className="block text-xs text-gray-500">{row.user.email}</span>
                                ) : null}
                              </td>
                              <td className="py-3 pr-4 text-gray-900">
                                {row.product?.name ?? '—'}
                                {row.product?.price != null ? (
                                  <span className="block text-xs text-gray-500">
                                    NPR {Number(row.product.price).toFixed(0)}
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-3 pr-4 text-gray-600 capitalize">
                                {(row.action ?? 'add_to_cart').replace(/_/g, ' ')}
                              </td>
                              <td className="py-3">
                                {row.personalizedMatch ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">
                                    Pet match
                                    {row.userPetType ? ` (${row.userPetType})` : ''}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Recent Orders (GPS pin + coordinate tooltip) */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-6 h-6 text-primary" />
                    Recent Orders
                  </h2>
                  {ordersLoading ? (
                    <p className="text-gray-500 text-center py-8">Loading orders…</p>
                  ) : recentOrders.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No orders yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-500">
                            <th className="py-2 pr-4 font-medium">Order</th>
                            <th className="py-2 pr-4 font-medium">Customer</th>
                            <th className="py-2 pr-4 font-medium">Address</th>
                            <th className="py-2 pr-4 font-medium">Total</th>
                            <th className="py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentOrders.map((o) => {
                            const p = recentOrderCoords(o);
                            return (
                              <tr
                                key={o._id}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="py-3 pr-4 font-mono text-gray-600">
                                  #{o._id.slice(-6)}
                                </td>
                                <td className="py-3 pr-4 text-gray-900">
                                  {o.user?.name ?? '—'}
                                </td>
                                <td className="py-3 pr-4 max-w-[200px]">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-gray-700">
                                      {o.deliveryLocation?.address ?? '—'}
                                    </span>
                                    {p && (
                                      <span
                                        title={`Exact: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`}
                                        className="flex-shrink-0 text-primary"
                                      >
                                        <MapPin className="w-4 h-4" />
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 pr-4 font-medium text-gray-900">
                                  NPR {Number(o.totalAmount).toFixed(0)}
                                </td>
                                <td className="py-3 text-gray-600 capitalize">
                                  {o.status?.replace(/_/g, ' ') ?? '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
    </>
  );
}
