'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { PawSewaPromoModal } from '@/components/PawSewaPromoModal';

type ActivePromo = {
  id: string;
  title: string;
  description: string;
  promoCode: string;
  imageUrl: string;
  active: boolean;
};

const DISMISS_KEY = 'pawsewa-promo-dismissed-id';

export function PromoModalHost() {
  const [promo, setPromo] = useState<ActivePromo | null>(null);
  const [open, setOpen] = useState(false);

  const shouldShow = useMemo(() => {
    if (!promo?.active) return false;
    if (typeof window === 'undefined') return false;
    const dismissed = (localStorage.getItem(DISMISS_KEY) || '').trim();
    return dismissed !== promo.id;
  }, [promo]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await api.get<{ success: boolean; data?: ActivePromo | null }>(
          '/promotions/active',
        );
        if (cancelled) return;
        const data = resp.data?.data ?? null;
        setPromo(data && data.active ? data : null);
      } catch {
        if (!cancelled) setPromo(null);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (shouldShow) setOpen(true);
  }, [shouldShow]);

  if (!promo) return null;

  return (
    <PawSewaPromoModal
      open={open}
      title={promo.title}
      offerText={promo.promoCode ? '10% OFF' : 'New offer'}
      subtitle={promo.description}
      promoCode={promo.promoCode}
      promoHint="Applies to pre-payment only"
      ctaText="Order now"
      imageSrc={promo.imageUrl || 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1400&q=80'}
      onClose={() => {
        localStorage.setItem(DISMISS_KEY, promo.id);
        setOpen(false);
      }}
      onCta={() => {
        localStorage.setItem(DISMISS_KEY, promo.id);
        setOpen(false);
      }}
    />
  );
}

