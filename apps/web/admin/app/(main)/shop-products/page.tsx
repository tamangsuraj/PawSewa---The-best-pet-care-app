'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Package, PackagePlus, Edit, Trash2, Tag } from 'lucide-react';
import type { AdminProductShape } from '@/components/shop/AdminProductForm';

function sellerLabel(p: AdminProductShape): string {
  const s = p.seller;
  if (!s) return 'Unassigned';
  if (typeof s === 'object') {
    const shop = s.shopName ? String(s.shopName) : '';
    const nm = s.name ? String(s.name) : '';
    if (shop && nm) return `${shop} (${nm})`;
    return shop || nm || s.email || 'Shop owner';
  }
  return String(s);
}

export default function ShopProductsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<AdminProductShape[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/products', { params: { limit: 500, page: 1 } });
      setProducts(response.data.data || []);
      if (typeof console !== 'undefined' && console.log) {
        console.log('[SUCCESS] Product inventory synced with PawSewa-Cluster.');
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (typeof console !== 'undefined' && console.log) {
      console.log('[INFO] Shop Management: All products view loaded.');
    }
    void load();
  }, [isAuthenticated, router, load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      await api.delete(`/products/${id}`);
      await load();
    } catch {
      /* surface via toast optional */
    }
  };

  const productFallbackImg = (id: string) =>
    `https://source.unsplash.com/featured/?pet-food,dog-toy&sig=${encodeURIComponent(id)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gray-50">
        <div className="text-gray-500">Loading catalogue...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 p-6 md:p-8">
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Shop Management', href: '/shop-products' },
            { label: 'All products' },
          ]}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Package className="w-8 h-8 text-primary shrink-0" />
            All products
          </h1>
          <p className="text-gray-600 mt-1">
            Full inventory in PawSewa-Cluster. Seller assignment drives automated shop routing on
            orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/shop-products/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary/90 shadow-sm"
          >
            <PackagePlus className="w-4 h-4" />
            Add new product
          </Link>
          <Link
            href="/shop-products/categories"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg font-medium text-sm hover:bg-gray-900"
          >
            <Tag className="w-4 h-4" />
            Categories
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="admin-table-scroll overflow-x-auto">
          <div className="admin-data-table-inner">
            <table className="admin-table-sticky-first admin-table-sticky-last min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Image</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Price</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Stock</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Seller</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      No products found. Add a product or check API connectivity.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const img = product.images && product.images[0];
                    const inStock = product.stockQuantity > 0;
                    const src = (img && String(img).trim()) ? String(img) : productFallbackImg(product._id);
                    return (
                      <tr key={product._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                            <img
                              src={src}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                if (typeof console !== 'undefined' && console.log) {
                                  console.log(
                                    `[INFO] Applying dynamic image fallback for Product: ${product._id}.`
                                  );
                                }
                                (e.currentTarget as HTMLImageElement).src = productFallbackImg(product._id + '-fallback');
                              }}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium max-w-[220px]">
                          <span className="line-clamp-2">{product.name}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                          NPR {Number(product.price).toFixed(0)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {product.stockQuantity}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!product.isAvailable ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
                              Inactive
                            </span>
                          ) : inStock ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-800 border-emerald-200">
                              In stock
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium border bg-amber-50 text-amber-900 border-amber-200">
                              Out of stock
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                          <span className="line-clamp-2">{sellerLabel(product)}</span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/shop-products/edit/${product._id}`}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(product._id)}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
