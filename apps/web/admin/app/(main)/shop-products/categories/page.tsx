'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Tag } from 'lucide-react';

interface CategoryRow {
  _id: string;
  name: string;
  slug: string;
  image?: string;
}

export default function ShopProductCategoriesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    void load();
  }, [isAuthenticated, router, load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      if (image) {
        fd.append('image', image);
      }
      await api.post('/categories', fd);
      setName('');
      setImage(null);
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setFormError(ax.response?.data?.message || 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gray-50">
        <div className="text-gray-500">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 p-6 md:p-8">
      <div className="mb-4 max-w-5xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'All products', href: '/shop-products' },
            { label: 'Categories' },
          ]}
        />
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Tag className="w-8 h-8 text-primary shrink-0" />
              Product categories
            </h1>
            <p className="text-gray-600 mt-1">
              Tags such as Dog Food, Cat Toys, and Medicine. Used when creating products.
            </p>
          </div>
          <Link
            href="/shop-products"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to all products
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add category</h2>
          {formError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={onCreate} className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                placeholder="e.g. Dog Food"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Image (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Create category'}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="admin-table-scroll overflow-x-auto">
            <div className="admin-data-table-inner">
              <table className="admin-table-sticky-first min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Image</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Slug</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-gray-500">
                        No categories yet. Add one above.
                      </td>
                    </tr>
                  ) : (
                    categories.map((c) => (
                      <tr key={c._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                            {c.image ? (
                              <Image src={c.image} alt="" fill className="object-cover" sizes="40px" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                —
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.slug}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
