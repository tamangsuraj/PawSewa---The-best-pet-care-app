'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  AdminProductForm,
  type ShopOwnerOption,
  type CategoryOption,
} from '@/components/shop/AdminProductForm';

export default function ShopProductNewPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [shopOwners, setShopOwners] = useState<ShopOwnerOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [ready, setReady] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const [usersRes, catRes] = await Promise.all([api.get('/users'), api.get('/categories')]);
      const allUsers = usersRes.data?.data as unknown;
      const rows = Array.isArray(allUsers) ? (allUsers as Array<Record<string, unknown>>) : [];
      const shops = rows
        .filter((u) => u.role === 'shop_owner')
        .map((u) => ({
          _id: String(u._id ?? ''),
          name: String(u.name ?? u.email ?? 'Shop owner'),
          email: String(u.email ?? ''),
          shopName: u.shopName ? String(u.shopName) : undefined,
        }));
      setShopOwners(shops);
      setCategories(catRes.data.data || []);
    } catch {
      setShopOwners([]);
      setCategories([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    void loadMeta();
  }, [isAuthenticated, router, loadMeta]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 p-6 md:p-8">
      <div className="mb-4 max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'All products', href: '/shop-products' },
            { label: 'Add new product' },
          ]}
        />
      </div>
      <div className="max-w-4xl mx-auto">
        <AdminProductForm
          mode="create"
          shopOwners={shopOwners}
          categories={categories}
          cancelHref="/shop-products"
          onSuccess={() => router.push('/shop-products')}
        />
      </div>
    </div>
  );
}
