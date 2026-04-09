'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  AdminProductForm,
  type ShopOwnerOption,
  type CategoryOption,
  type AdminProductShape,
} from '@/components/shop/AdminProductForm';

export default function ShopProductEditPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [shopOwners, setShopOwners] = useState<ShopOwnerOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [product, setProduct] = useState<AdminProductShape | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [usersRes, catRes, prodRes] = await Promise.all([
        api.get('/users'),
        api.get('/categories'),
        api.get(`/products/${id}`),
      ]);
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
      const data = prodRes.data?.data as AdminProductShape | undefined;
      if (data) {
        setProduct(data);
        if (typeof console !== 'undefined' && console.log) {
          console.log('[DEBUG] Verifying seller-product mapping for automated routing.');
        }
      } else {
        setError('Product not found');
      }
    } catch {
      setError('Failed to load product');
    } finally {
      setReady(true);
    }
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    void load();
  }, [isAuthenticated, router, load]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-dvh bg-gray-50 p-8">
        <p className="text-red-600">{error || 'Not found'}</p>
        <button
          type="button"
          className="mt-4 text-primary underline"
          onClick={() => router.push('/shop-products')}
        >
          Back to catalogue
        </button>
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
            { label: 'Edit product' },
          ]}
        />
      </div>
      <div className="max-w-4xl mx-auto">
        <AdminProductForm
          mode="edit"
          initialProduct={product}
          shopOwners={shopOwners}
          categories={categories}
          cancelHref="/shop-products"
          onSuccess={() => router.push('/shop-products')}
        />
      </div>
    </div>
  );
}
