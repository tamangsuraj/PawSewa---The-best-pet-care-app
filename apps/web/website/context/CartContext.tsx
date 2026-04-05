'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  hydrated: boolean;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  totalItems: number;
}

const CART_VERSION = 1;
/** Current persisted shape: `{ v, items }`. Legacy plain arrays lived under `pawsewa_cart`. */
const CART_STORAGE_KEY = 'pawsewa_cart_v2';
const LEGACY_CART_STORAGE_KEY = 'pawsewa_cart';

function normalizeStoredCart(raw: unknown): CartItem[] {
  let rows: unknown[];
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'items' in raw) {
    const items = (raw as { items?: unknown }).items;
    rows = Array.isArray(items) ? items : [];
  } else if (Array.isArray(raw)) {
    rows = raw;
  } else {
    return [];
  }

  const byId = new Map<string, CartItem>();
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const productId = typeof r.productId === 'string' ? r.productId.trim() : '';
    if (!productId) continue;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) continue;
    const priceNum = typeof r.price === 'number' ? r.price : Number(r.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) continue;

    let quantity = 1;
    if (r.quantity !== undefined && r.quantity !== null) {
      const q = typeof r.quantity === 'number' ? r.quantity : Number(r.quantity);
      if (!Number.isFinite(q)) continue;
      const qi = Math.floor(q);
      if (qi < 1) continue;
      quantity = qi;
    }

    const prev = byId.get(productId);
    if (prev) {
      byId.set(productId, { ...prev, quantity: prev.quantity + quantity });
    } else {
      byId.set(productId, { productId, name, price: priceNum, quantity });
    }
  }
  return Array.from(byId.values());
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const fromV2 = localStorage.getItem(CART_STORAGE_KEY);
      const fromLegacy = localStorage.getItem(LEGACY_CART_STORAGE_KEY);
      const stored = fromV2 ?? fromLegacy;
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        setItems(normalizeStoredCart(parsed));
      }
      if (fromLegacy) {
        localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
      }
    } catch (_) {
      setItems([]);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ v: CART_VERSION, items })
      );
    }
  }, [items, mounted]);

  const addItem = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const qty = item.quantity ?? 1;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + qty }
            : i
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) removeItem(productId);
    else
      setItems((prev) =>
        prev.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        )
      );
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        hydrated: mounted,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
