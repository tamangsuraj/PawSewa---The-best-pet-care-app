'use client';

import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export function ShopFloatingCart() {
  const { subtotal, totalItems, hydrated } = useCart();

  if (!hydrated) return null;

  const deliveryLabel = subtotal > 0 ? 'FREE' : '—';

  return (
    <div className="pointer-events-none fixed bottom-6 right-4 z-40 w-[min(100%,320px)] sm:right-8">
      <div
        className="pointer-events-auto rounded-2xl border border-white/40 bg-white/75 p-5 shadow-[0_12px_40px_rgba(74,46,27,0.18)] backdrop-blur-md"
        style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(248,246,240,0.88) 100%)' }}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4A2E1B]/10 text-[#4A2E1B]">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="font-semibold text-[#4A2E1B]">Cart Summary</span>
          </div>
          <span className="rounded-full bg-[#4A2E1B] px-2.5 py-0.5 text-xs font-bold text-[#F8F6F0]">
            {totalItems} {totalItems === 1 ? 'Item' : 'Items'}
          </span>
        </div>
        <div className="space-y-2 border-b border-[#4A2E1B]/10 pb-4 text-sm">
          <div className="flex justify-between text-[#4A2E1B]/80">
            <span>Subtotal</span>
            <span className="font-semibold text-[#4A2E1B]">
              Rs. {Math.round(subtotal).toLocaleString('en-NP')}
            </span>
          </div>
          <div className="flex justify-between text-[#4A2E1B]/80">
            <span>Delivery</span>
            <span className="font-semibold text-emerald-700">{deliveryLabel}</span>
          </div>
        </div>
        <Link
          href="/checkout"
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all ${
            totalItems > 0
              ? 'bg-[#4A2E1B] text-[#F8F6F0] shadow-md hover:bg-[#3d2616]'
              : 'cursor-not-allowed bg-[#4A2E1B]/30 text-white/80'
          }`}
          aria-disabled={totalItems === 0}
          onClick={(e) => {
            if (totalItems === 0) e.preventDefault();
          }}
        >
          Checkout Now
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
