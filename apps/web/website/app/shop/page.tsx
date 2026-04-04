'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useChatHub } from '@/context/ChatHubContext';
import {
  PawPrint,
  UtensilsCrossed,
  Cross,
  CircleDot,
  Link2,
  ShoppingCart,
  Star,
  MessageCircle,
} from 'lucide-react';
import { PriceRangeDualSlider } from '@/components/shop/PriceRangeDualSlider';
import { ShopFloatingCart } from '@/components/shop/ShopFloatingCart';

const PRICE_CAP = 10000;

type CategoryRef = { _id: string; name: string; slug: string };

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
  badge?: string;
  petTypes?: string[];
  category?: CategoryRef | null;
  seller?: { _id: string; name?: string; profilePicture?: string } | null;
}

type CategoryPreset = 'all' | 'food' | 'health' | 'toys' | 'collars';

const SIDEBAR_GROUPS: {
  preset: CategoryPreset;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { preset: 'all', label: 'All Supplies', icon: PawPrint },
  { preset: 'food', label: 'Pet Food', icon: UtensilsCrossed },
  { preset: 'health', label: 'Health & Wellness', icon: Cross },
  { preset: 'toys', label: 'Toys & Play', icon: CircleDot },
  { preset: 'collars', label: 'Collars & Leashes', icon: Link2 },
];

function resolveCategorySlug(categories: CategoryRef[], preset: CategoryPreset): string | null {
  if (preset === 'all') return null;
  const slugs = categories.map((c) => ({
    slug: c.slug.toLowerCase(),
    name: c.name.toLowerCase(),
    raw: c.slug,
  }));
  const pick = (pred: (c: { slug: string; name: string }) => boolean) => {
    const hit = slugs.find(pred);
    return hit ? hit.raw : null;
  };
  switch (preset) {
    case 'food':
      return pick((c) => c.slug.includes('food') || c.name.includes('food') || c.name.includes('feed'));
    case 'health':
      return pick(
        (c) =>
          c.slug.includes('health') ||
          c.name.includes('health') ||
          c.name.includes('wellness') ||
          c.slug.includes('wellness')
      );
    case 'toys':
      return pick((c) => c.slug.includes('toy') || c.name.includes('toy') || c.name.includes('play'));
    case 'collars':
      return pick(
        (c) =>
          c.slug.includes('collar') ||
          c.slug.includes('leash') ||
          c.name.includes('collar') ||
          c.name.includes('leash')
      );
    default:
      return null;
  }
}

function productBadgeLabel(p: Product): string {
  if (p.badge?.trim()) return p.badge.trim().toUpperCase().slice(0, 14);
  const slug = (p.category?.slug || '') + (p.category?.name || '');
  const n = slug.toLowerCase();
  if (/health|wellness|supplement|medic|joint|deworm/i.test(n)) return 'HEALTH';
  if (/food|kibble|treat|salmon|nutri|feed/i.test(n)) return 'NATURAL';
  if (/toy|chew|play|rubber/i.test(n)) return 'PLAY';
  if (/collar|leash|leather|wear/i.test(n)) return 'STYLE';
  if (/luxury|premium|pro|ceramic|nordic/i.test(n)) return 'LUXURY';
  return 'CARE';
}

function badgeTone(label: string): string {
  const u = label.toUpperCase();
  if (u.includes('HEALTH')) return 'bg-[#6B4C9A] text-white';
  if (u.includes('NATURAL')) return 'bg-[#0f766e] text-white';
  if (u.includes('LUXURY') || u.includes('STYLE')) return 'bg-[#b45309] text-white';
  if (u.includes('PLAY')) return 'bg-[#0369a1] text-white';
  return 'bg-[#57534e] text-white';
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  const full = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 shrink-0 ${
            i <= full ? 'fill-amber-400 text-amber-400' : 'fill-none text-amber-200'
          }`}
        />
      ))}
      <span className="ml-1 text-[11px] text-[#4A2E1B]/55">({count})</span>
    </div>
  );
}

function ShopPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchFromNav = searchParams.get('q')?.trim() ?? '';

  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const { openSellerChat } = useChatHub();

  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activePreset, setActivePreset] = useState<CategoryPreset>('all');
  const [petDog, setPetDog] = useState(false);
  const [petCat, setPetCat] = useState(true);
  const [petRabbit, setPetRabbit] = useState(false);

  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(PRICE_CAP);

  const [sort, setSort] = useState<'recommended' | 'newest' | 'price_asc' | 'price_desc'>(
    'recommended'
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/categories');
        if (!cancelled && res.data?.success) {
          setCategories(res.data.data || []);
        }
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categorySlug = useMemo(
    () => resolveCategorySlug(categories, activePreset),
    [categories, activePreset]
  );

  const petTypesParam = useMemo(() => {
    const s: string[] = [];
    if (petDog) s.push('dog');
    if (petCat) s.push('cat');
    if (petRabbit) s.push('rabbit');
    if (s.length === 3) return '';
    if (s.length === 0) return '';
    return s.join(',');
  }, [petDog, petCat, petRabbit]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {
        limit: '48',
        sort,
      };
      if (categorySlug) params.category = categorySlug;
      if (searchFromNav) params.search = searchFromNav;
      if (petTypesParam) params.petTypes = petTypesParam;
      if (priceMin > 0) params.minPrice = String(priceMin);
      if (priceMax < PRICE_CAP) params.maxPrice = String(priceMax);

      const resp = await api.get('/products', { params });
      const list = resp.data?.data || [];
      setProducts(Array.isArray(list) ? list : []);
      console.log('[WEB-SHOP] Pixel-perfect grid rendered and bound to MongoDB.');
      console.log('[WEB-SHOP] Dynamic filtering and Cart Widget active.');
    } catch (err: unknown) {
      console.error('Error loading products:', err);
      setProducts([]);
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [categorySlug, searchFromNav, petTypesParam, priceMin, priceMax, sort]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleChat = async (productId: string) => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    try {
      await openSellerChat(productId);
    } catch {
      /* openSellerChat handles alert */
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F6F0] pb-32 pt-6 text-[#4A2E1B]">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-8 px-4 lg:grid-cols-[minmax(250px,300px)_1fr] lg:gap-10 lg:px-8">
        <aside className="order-2 h-fit lg:sticky lg:top-[5.5rem] lg:order-1">
          <div className="rounded-2xl border border-[#4A2E1B]/10 bg-white p-5 shadow-[0_4px_24px_rgba(74,46,27,0.06)]">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[#4A2E1B]/50">
              Shop categories
            </p>
            <ul className="space-y-1">
              {SIDEBAR_GROUPS.map(({ preset, label, icon: Icon }) => {
                const active = activePreset === preset;
                return (
                  <li key={preset}>
                    <button
                      type="button"
                      onClick={() => setActivePreset(preset)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        active
                          ? 'bg-[#4A2E1B]/12 font-semibold text-[#4A2E1B]'
                          : 'text-[#4A2E1B]/80 hover:bg-[#F8F6F0]'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0 opacity-80" />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 border-t border-[#4A2E1B]/10 pt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#4A2E1B]/50">
                Pet type
              </p>
              <div className="space-y-2 text-sm">
                {[
                  ['Dogs', petDog, () => setPetDog((v) => !v)] as const,
                  ['Cats', petCat, () => setPetCat((v) => !v)] as const,
                  ['Rabbits', petRabbit, () => setPetRabbit((v) => !v)] as const,
                ].map(([label, checked, toggle]) => (
                  <label
                    key={label}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1 hover:bg-[#F8F6F0]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={toggle}
                      className="h-4 w-4 rounded border-[#4A2E1B]/30 text-[#4A2E1B] focus:ring-[#4A2E1B]"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-[#4A2E1B]/10 pt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#4A2E1B]/50">
                Price range
              </p>
              <PriceRangeDualSlider
                min={0}
                max={PRICE_CAP}
                valueMin={priceMin}
                valueMax={priceMax}
                onChange={(a, b) => {
                  setPriceMin(a);
                  setPriceMax(b);
                }}
              />
            </div>
          </div>
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4A2E1B]/55">
                Premium marketplace
              </p>
              <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-[#4A2E1B] md:text-4xl">
                Curated Care for Every Companion
              </h1>
            </div>
            <div className="relative w-full shrink-0 sm:max-w-[220px]">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="w-full cursor-pointer appearance-none rounded-full border border-[#4A2E1B]/15 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-[#4A2E1B] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/15"
                aria-label="Sort products"
              >
                <option value="recommended">Sort by: Recommended</option>
                <option value="newest">Sort by: Newest</option>
                <option value="price_asc">Sort by: Price (Low → High)</option>
                <option value="price_desc">Sort by: Price (High → Low)</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#4A2E1B]/45">
                ▾
              </span>
            </div>
          </header>

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm"
                >
                  <div className="aspect-[4/5] bg-[#E8E4DC]" />
                  <div className="space-y-2 p-4">
                    <div className="h-3 w-1/3 rounded bg-[#E8E4DC]" />
                    <div className="h-4 w-full rounded bg-[#E8E4DC]" />
                    <div className="h-3 w-2/3 rounded bg-[#E8E4DC]" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#4A2E1B]/20 bg-white/80 px-8 py-16 text-center shadow-sm">
              <PawPrint className="mb-4 h-14 w-14 text-[#4A2E1B]/25" />
              <h2 className="font-display text-xl font-semibold text-[#4A2E1B]">
                No products found in this category
              </h2>
              <p className="mt-2 max-w-md text-sm text-[#4A2E1B]/65">
                Try another category, adjust your filters, or clear the search. New arrivals land here as
                soon as sellers list them.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActivePreset('all');
                  setPetDog(true);
                  setPetCat(true);
                  setPetRabbit(true);
                  setPriceMin(0);
                  setPriceMax(PRICE_CAP);
                  router.replace('/shop', { scroll: false });
                }}
                className="mt-6 rounded-full bg-[#4A2E1B] px-6 py-2.5 text-sm font-semibold text-[#F8F6F0] hover:bg-[#3d2616]"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => {
                const imageUrl = product.images?.[0] || '';
                const badge = productBadgeLabel(product);
                const vendor = (product.seller?.name || 'PawSewa Marketplace').toUpperCase();
                const rating = typeof product.rating === 'number' ? product.rating : 0;
                const reviewCount = typeof product.reviewCount === 'number' ? product.reviewCount : 0;
                const inStock = product.stockQuantity > 0 && product.isAvailable !== false;

                return (
                  <article
                    key={product._id}
                    className="group flex min-h-[400px] flex-col overflow-hidden rounded-2xl border border-[#4A2E1B]/8 bg-white shadow-[0_4px_20px_rgba(74,46,27,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(74,46,27,0.12)]"
                  >
                    <Link
                      href={`/shop/${product._id}`}
                      className="relative min-h-[200px] w-full flex-[3] basis-0 overflow-hidden bg-[#EDE9E2]"
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          unoptimized={imageUrl.startsWith('http://')}
                        />
                      ) : (
                        <div className="flex h-full min-h-[200px] items-center justify-center text-[#4A2E1B]/25">
                          <PawPrint className="h-16 w-16" />
                        </div>
                      )}
                      <span
                        className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeTone(badge)}`}
                      >
                        {badge}
                      </span>
                    </Link>

                    <div className="flex min-h-0 flex-[2] basis-0 flex-col p-4 pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4A2E1B]/45">
                        {vendor}
                      </p>
                      <Link href={`/shop/${product._id}`}>
                        <h2 className="mt-1 line-clamp-2 min-h-[2.75rem] text-base font-bold leading-snug text-[#4A2E1B] hover:underline">
                          {product.name}
                        </h2>
                      </Link>
                      <div className="mt-2">
                        <StarRow rating={rating} count={reviewCount} />
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                        <span className="text-lg font-bold text-[#4A2E1B]">
                          Rs. {Math.round(product.price).toLocaleString('en-NP')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Chat with seller"
                            onClick={() => void handleChat(product._id)}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-white text-[#4A2E1B] shadow-sm transition-all hover:bg-[#F8F6F0] max-sm:opacity-100 sm:translate-x-1 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100"
                          >
                            <MessageCircle className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            title="Add to cart"
                            disabled={!inStock}
                            onClick={() => {
                              if (!inStock) return;
                              addItem({
                                productId: product._id,
                                name: product.name,
                                price: product.price,
                                quantity: 1,
                              });
                            }}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#4A2E1B] text-[#F8F6F0] shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ShoppingCart className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ShopFloatingCart />
    </main>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-[#F8F6F0] text-[#4A2E1B]">
          Loading shop…
        </div>
      }
    >
      <ShopPageInner />
    </Suspense>
  );
}
