'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getProductById } from '@/lib/data';

const StoreContext = createContext(null);

const STORAGE_KEY = 'shop_state_v1';

function loadState() {
  if (typeof window === 'undefined') return { cart: {}, wishlist: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cart: {}, wishlist: [] };
    const parsed = JSON.parse(raw);
    return { cart: parsed.cart || {}, wishlist: parsed.wishlist || [] };
  } catch {
    return { cart: {}, wishlist: [] };
  }
}

export function StoreProvider({ children }) {
  const [cart, setCart] = useState({});
  const [wishlist, setWishlist] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = loadState();
    setCart(s.cart);
    setWishlist(s.wishlist);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart, wishlist }));
  }, [cart, wishlist, hydrated]);

  const addToCart = (productId, qty = 1) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + qty }));
  };

  const removeFromCart = (productId) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const setCartQty = (productId, qty) => {
    setCart((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: qty };
    });
  };

  const toggleWishlist = (productId) => {
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const isWishlisted = (productId) => wishlist.includes(productId);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: getProductById(id), qty }))
        .filter((item) => item.product),
    [cart]
  );

  const cartCount = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.qty, 0),
    [cartItems]
  );

  const value = {
    cart,
    cartItems,
    cartCount,
    cartTotal,
    addToCart,
    removeFromCart,
    setCartQty,
    wishlist,
    toggleWishlist,
    isWishlisted,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
