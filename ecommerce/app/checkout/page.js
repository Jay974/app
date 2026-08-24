'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import Header from '@/components/Header';
import { useStore } from '@/context/StoreContext';

export default function CheckoutPage() {
  const { cartItems, cartTotal } = useStore();
  const router = useRouter();
  const [placed, setPlaced] = useState(false);

  if (placed) {
    return (
      <main className="pt-24 px-6 flex flex-col items-center text-center gap-3">
        <CheckCircle2 size={56} className="text-green-500" />
        <h1 className="text-lg font-bold text-ink-900">Commande confirmée !</h1>
        <p className="text-sm text-ink-500">Merci pour ton achat. Tu peux suivre ta commande dans l&apos;onglet Commandes.</p>
        <button
          onClick={() => router.push('/orders')}
          className="mt-3 bg-brand-500 text-white font-semibold rounded-full px-6 py-3"
        >
          Voir mes commandes
        </button>
      </main>
    );
  }

  return (
    <>
      <Header title="Paiement" showSearch={false} showBack />
      <main className="pt-4 px-4 pb-28">
        <section className="bg-white rounded-xl2 shadow-card p-4 mb-4">
          <h2 className="text-sm font-semibold text-ink-900 mb-3">Adresse de livraison</h2>
          <div className="flex flex-col gap-2">
            <input placeholder="Nom complet" className="bg-ink-100 rounded-lg px-3 py-2 text-sm outline-none" />
            <input placeholder="Adresse" className="bg-ink-100 rounded-lg px-3 py-2 text-sm outline-none" />
            <div className="flex gap-2">
              <input placeholder="Ville" className="bg-ink-100 rounded-lg px-3 py-2 text-sm outline-none flex-1" />
              <input placeholder="Code postal" className="bg-ink-100 rounded-lg px-3 py-2 text-sm outline-none w-28" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl2 shadow-card p-4 mb-4">
          <h2 className="text-sm font-semibold text-ink-900 mb-3">Récapitulatif</h2>
          <div className="flex flex-col gap-1.5">
            {cartItems.map(({ product, qty }) => (
              <div key={product.id} className="flex justify-between text-sm">
                <span className="text-ink-700 truncate pr-2">{product.name} × {qty}</span>
                <span className="font-medium text-ink-900 shrink-0">{(product.price * qty).toFixed(2)}€</span>
              </div>
            ))}
          </div>
          <div className="border-t border-ink-100 mt-3 pt-3 flex justify-between">
            <span className="text-sm font-semibold text-ink-900">Total</span>
            <span className="text-base font-extrabold text-ink-900">{cartTotal.toFixed(2)}€</span>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-ink-100 p-3 z-30">
        <button
          onClick={() => setPlaced(true)}
          disabled={cartItems.length === 0}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-40 transition text-white font-semibold rounded-full py-3"
        >
          Confirmer la commande
        </button>
      </div>
    </>
  );
}
