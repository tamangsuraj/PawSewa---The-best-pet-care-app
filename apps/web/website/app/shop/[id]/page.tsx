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
import { PageContent } from '@/components/layout/PageContent';

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
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/shop" className="-ml-2 rounded-xl p-2 text-paw-bark transition-colors hover:bg-paw-sand/80">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="flex-1 truncate font-display text-lg font-semibold text-paw-ink">{product.name}</h1>
        </div>
      </header>

      <main>
        <PageContent compact className="pb-12 pt-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-[1.35rem] border border-paw-bark/10 bg-white/90 shadow-paw">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paw-haze/50 text-paw-bark/40">
                <Package className="h-16 w-16" strokeWidth={1.25} aria-hidden />
                <span className="text-sm font-medium text-paw-bark/55">No image</span>
              </div>
            )}
          </div>
          <div className="paw-surface-card p-6 md:p-8">
            <p className="paw-eyebrow mb-3 !text-paw-bark/75 before:bg-paw-teal-mid/50">Shop</p>
            <h2 className="font-display text-2xl font-semibold text-paw-ink">{product.name}</h2>
            <p className="mt-2 text-2xl font-bold text-paw-bark">Rs. {product.price.toLocaleString()}</p>
            {product.rating != null && (
              <div className="mb-4 mt-4 flex items-center gap-2">
                <div className="flex text-amber-500">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`h-4 w-4 ${i <= Math.round(product.rating ?? 0) ? 'fill-current' : ''}`} />
                  ))}
                </div>
                <span className="text-sm text-paw-bark/70">
                  {(product.rating ?? 0).toFixed(1)} ({product.reviewCount ?? 0} reviews)
                </span>
              </div>
            )}
            {product.description && <p className="mb-4 text-paw-bark/85 leading-relaxed">{product.description}</p>}
            <p className="mb-6 text-sm text-paw-bark/70">
              {inStock ? `In stock: ${product.stockQuantity}` : 'Out of stock'}
            </p>
            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
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
                className="paw-cta-primary flex flex-1 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
                {justAdded ? 'Added to cart' : 'Add to cart'}
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
                className="paw-cta-secondary flex flex-1 items-center justify-center gap-2 border-paw-bark/25"
              >
                <MessageCircle className="h-5 w-5" />
                Chat with seller
              </button>
            </div>
            {justAdded && (
              <p className="mt-3 text-sm font-medium text-emerald-700">
                Item added.{' '}
                <Link href="/checkout" className="font-semibold underline">
                  View cart & checkout
                </Link>
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
        </PageContent>
      </main>
    </div>
    </PageShell>
  );
}
