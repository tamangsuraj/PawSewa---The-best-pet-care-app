'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useChatHub } from '@/context/ChatHubContext';
import { ChevronLeft, Plus, Star, Package, MessageCircle } from 'lucide-react';
import { Reviews } from '@/components/Reviews';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';
import { PageShell } from '@/components/layout/PageShell';

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  isAvailable: boolean;
  images?: string[];
  rating?: number;
  reviewCount?: number;
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const { openSellerChat } = useChatHub();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [justAdded, setJustAdded] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${params.id}`);
        setProduct(res.data?.data ?? null);
      } catch (e) {
        console.error('Failed to fetch product', e);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [params.id]);

  if (loading) {
    return (
      <PageShell className="flex min-h-screen flex-col items-center justify-center gap-4">
        <PawSewaLogoSpinner size={56} />
        <p className="text-sm text-paw-bark/60">Loading product…</p>
      </PageShell>
    );
  }
  if (!product) {
    return (
      <PageShell className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-paw-bark/75">Product not found.</p>
        <Link href="/shop" className="text-paw-teal-mid font-semibold hover:underline">
          Back to shop
        </Link>
      </PageShell>
    );
  }

  const imageUrl = product.images?.length ? product.images[0] : '';
  const inStock = product.stockQuantity > 0;

  return (
    <PageShell>
    <div className="pb-8">
      <header className="sticky top-0 z-10 border-b border-paw-bark/10 bg-paw-cream/90 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/shop" className="p-2 -ml-2 rounded-xl hover:bg-paw-sand/80 text-paw-bark transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-semibold text-paw-ink truncate flex-1 font-display">Product</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                unoptimized={imageUrl.startsWith('http://')}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 bg-gray-50">
                <Package className="w-16 h-16" strokeWidth={1.25} aria-hidden />
                <span className="text-sm font-medium">No image</span>
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-paw-bark mb-2">{product.name}</h2>
            <p className="text-2xl font-bold text-paw-bark mb-4">NPR {product.price.toLocaleString()}</p>
            {product.rating != null && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex text-amber-500">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`w-4 h-4 ${i <= Math.round(product.rating ?? 0) ? 'fill-current' : ''}`} />
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  {(product.rating ?? 0).toFixed(1)} ({(product.reviewCount ?? 0)} reviews)
                </span>
              </div>
            )}
            {product.description && (
              <p className="text-gray-700 mb-4">{product.description}</p>
            )}
            <p className="text-sm text-gray-600 mb-4">
              {inStock ? `In stock: ${product.stockQuantity}` : 'Out of stock'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (!inStock) return;
                  addItem({
                    productId: product._id,
                    name: product.name,
                    price: product.price,
                    quantity: 1,
                  });
                  setJustAdded(true);
                  setTimeout(() => setJustAdded(false), 2500);
                }}
                disabled={!inStock}
                className="flex items-center justify-center gap-2 flex-1 px-6 py-3 bg-paw-bark text-white rounded-xl font-semibold hover:bg-paw-bark/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                {justAdded ? 'Added to Cart!' : 'Add to Cart'}
              </button>
              <button
                type="button"
                disabled={chatBusy}
                onClick={async () => {
                  if (!isAuthenticated) {
                    router.push(`/login?next=/shop/${params.id}`);
                    return;
                  }
                  setChatBusy(true);
                  try {
                    await openSellerChat(product._id);
                  } catch (e) {
                    console.error(e);
                    alert('Could not start seller chat. Try the PawSewa app.');
                  } finally {
                    setChatBusy(false);
                  }
                }}
                className="flex items-center justify-center gap-2 flex-1 px-6 py-3 border-2 border-paw-bark text-paw-bark rounded-xl font-semibold hover:bg-paw-bark/5"
              >
                <MessageCircle className="w-5 h-5" />
                Chat with Seller
              </button>
            </div>
            {justAdded && (
              <p className="mt-2 text-sm text-green-600 font-medium">
                Item added.{' '}
                <Link href="/checkout" className="underline font-semibold">View cart & checkout</Link>
              </p>
            )}
          </div>
        </div>

        <Reviews
          targetType="product"
          targetId={product._id}
          averageRating={product.rating}
          reviewCount={product.reviewCount}
          title="Customer Reviews"
        />
      </main>
    </div>
    </PageShell>
  );
}
