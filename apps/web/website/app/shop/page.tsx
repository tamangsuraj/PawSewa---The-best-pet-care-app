'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { ShoppingCart, Plus } from 'lucide-react';

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  isAvailable: boolean;
  images?: string[];
}

export default function ShopPage() {
  const { addItem, totalItems } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const resp = await api.get('/products');
        setProducts(resp.data.data || []);
      } catch (err: any) {
        console.error('Error loading products:', err);
        setError(err.response?.data?.message || 'Failed to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <div className="h-9 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-12 w-28 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="paw-card-glass overflow-hidden flex flex-col">
                <div className="bg-gray-200 w-full animate-pulse" style={{ paddingTop: '100%' }} />
                <div className="p-4 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                  <div className="flex justify-between mt-4">
                    <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                    <div className="h-9 w-16 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">PawSewa Shop</h1>
            <p className="text-gray-600">
              Browse curated products for your pet.
            </p>
          </div>
          <Link
            href="/checkout"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors self-start sm:self-auto"
          >
            <ShoppingCart className="w-5 h-5" />
            Cart ({totalItems})
          </Link>
        </div>

        {error && (
          <div className="mb-6 max-w-xl mx-auto bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {products.length === 0 ? (
          <div className="paw-card-glass border-dashed border-gray-300/80 py-16 text-center text-gray-500">
            No products available yet. Please check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {products.map((product) => {
              const imageUrl = product.images && product.images.length > 0 ? product.images[0] : '';
              const subtitle = product.description
                ? (product.description.length > 50 ? product.description.slice(0, 50) + '...' : product.description)
                : 'Toys';
              return (
                <div
                  key={product._id}
                  className="bg-white rounded-xl overflow-hidden flex flex-col shadow-sm border border-gray-100"
                >
                  <Link href={`/shop/${product._id}`} className="bg-[#F6F1EC] relative w-full aspect-[4/3] flex items-center justify-center">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={product.name}
                        fill
                        className="object-contain p-2"
                        sizes="(max-width: 640px) 50vw, 33vw"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">No image</span>
                    )}
                  </Link>
                  <div className="p-4 flex-1 flex flex-col">
                    <Link href={`/shop/${product._id}`}>
                      <h2 className="font-bold text-gray-900 mb-1 line-clamp-2 hover:text-primary text-base">
                        {product.name}
                      </h2>
                    </Link>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-1 font-normal">
                      {subtitle}
                    </p>
                    <div className="mt-auto flex items-center justify-between">
                      <p className="font-normal text-gray-900 text-sm">
                        Rs. {product.price.toFixed(0)}
                      </p>
                      <button
                        onClick={() =>
                          product.stockQuantity > 0 &&
                          addItem({
                            productId: product._id,
                            name: product.name,
                            price: product.price,
                            quantity: 1,
                          })
                        }
                        disabled={product.stockQuantity <= 0}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

