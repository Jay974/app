'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Placeholder from '@/components/Placeholder';
import { useStore } from '@/context/StoreContext';

export default function CartPage() {
  const { cartItems, cartTotal, setCartQty, removeFromCart } = useStore();

  return (
    <>
      <Header title="Panier" showSearch={false} />
      <main className="pt-4 pb-32 px-4">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-16 text-center">
            <ShoppingBag size={40} className="text-ink-300" />
            <p className="text-sm text-ink-500">Ton panier est vide.</p>
            <Link href="/" className="text-sm font-semibold text-brand-600">
              Découvrir des produits
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cartItems.map(({ product, qty }) => (
              <div key={product.id} className="bg-white rounded-xl2 shadow-card p-2.5 flex gap-3">
                {product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image} alt={product.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                ) : (
                  <Placeholder label={product.name} className="w-16 h-16 shrink-0" />
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-ink-900 line-clamp-2">{product.name}</p>
                    <button onClick={() => removeFromCart(product.id)} aria-label="Retirer">
                      <Trash2 size={15} className="text-ink-300" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink-900">{product.price.toFixed(2)}€</span>
                    <div className="flex items-center gap-2 bg-ink-100 rounded-full px-2 py-1">
                      <button onClick={() => setCartQty(product.id, qty - 1)} aria-label="Diminuer">
                        <Minus size={13} />
                      </button>
                      <span className="text-xs font-semibold w-4 text-center">{qty}</span>
                      <button onClick={() => setCartQty(product.id, qty + 1)} aria-label="Augmenter">
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {cartItems.length > 0 && (
        <div className="fixed bottom-[64px] left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-ink-100 p-4 z-30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-ink-500">Total</span>
            <span className="text-lg font-extrabold text-ink-900">{cartTotal.toFixed(2)}€</span>
          </div>
          <Link
            href="/checkout"
            className="block text-center w-full bg-brand-500 hover:bg-brand-600 transition text-white font-semibold rounded-full py-3"
          >
            Passer la commande
          </Link>
        </div>
      )}
      <BottomNav />
    </>
  );
}
