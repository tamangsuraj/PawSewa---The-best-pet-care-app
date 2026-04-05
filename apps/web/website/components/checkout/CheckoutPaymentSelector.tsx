'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react';

export type ShopPaymentMethod = 'cod' | 'fonepay' | 'khalti' | 'esewa' | 'card';

type MethodDef = {
  id: ShopPaymentMethod;
  name: string;
  subtitle: string;
  enabled: boolean;
  icon: ReactNode;
};

const METHODS: MethodDef[] = [
  {
    id: 'cod',
    name: 'Cash on Delivery',
    subtitle: 'Pay when your order arrives',
    enabled: true,
    icon: <Banknote className="h-6 w-6" />,
  },
  {
    id: 'fonepay',
    name: 'Fonepay',
    subtitle: 'Pay via Fonepay',
    enabled: true,
    icon: <Smartphone className="h-6 w-6" />,
  },
  {
    id: 'khalti',
    name: 'Khalti',
    subtitle: 'Wallet or linked bank',
    enabled: true,
    icon: <Wallet className="h-6 w-6" />,
  },
  {
    id: 'esewa',
    name: 'eSewa',
    subtitle: 'Shop checkout via eSewa is coming soon',
    enabled: false,
    icon: <Wallet className="h-6 w-6" />,
  },
  {
    id: 'card',
    name: 'Credit / Debit Card',
    subtitle: 'Same as mobile app — coming soon',
    enabled: false,
    icon: <CreditCard className="h-6 w-6" />,
  },
];

type Props = {
  value: ShopPaymentMethod;
  onChange: (m: ShopPaymentMethod) => void;
};

export function CheckoutPaymentSelector({ value, onChange }: Props) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-[#2c241c]">Payment method</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {METHODS.map((m) => {
          const selected = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={!m.enabled}
              onClick={() => m.enabled && onChange(m.id)}
              className={clsx(
                'flex flex-col items-center rounded-2xl border-2 p-3 text-center transition-all',
                !m.enabled && 'cursor-not-allowed opacity-55',
                selected && m.enabled
                  ? 'border-[#703418] bg-[#703418]/[0.06] shadow-[0_8px_24px_rgba(112,52,24,0.12)]'
                  : 'border-[#703418]/15 bg-white hover:border-[#703418]/35'
              )}
            >
              <span
                className={clsx(
                  'mb-2 flex h-11 w-11 items-center justify-center rounded-xl',
                  selected && m.enabled ? 'bg-[#703418]/15 text-[#703418]' : 'bg-[#f3ebe2]/80 text-[#703418]/70'
                )}
              >
                {m.icon}
              </span>
              <span
                className={clsx(
                  'text-xs font-semibold leading-tight',
                  selected && m.enabled ? 'text-[#703418]' : 'text-[#2c241c]'
                )}
              >
                {m.name}
              </span>
              <span className="mt-1 text-[10px] leading-snug text-[#2c241c]/55">{m.subtitle}</span>
              {selected && m.enabled ? (
                <span className="mt-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#703418] text-[10px] font-bold text-white">
                  ✓
                </span>
              ) : (
                <span className="mt-2 h-5 w-5 rounded-full border border-[#703418]/25" />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-[#2c241c]/50">
        COD, Fonepay, and Khalti match the PawSewa app. eSewa for shop orders is not available on the API yet
        (services only).
      </p>
    </div>
  );
}
