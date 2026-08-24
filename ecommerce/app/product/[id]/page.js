'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Heart, Star, Minus, Plus, ChevronLeft, ShoppingCart } from 'lucide-react';
import Placeholder from '@/components/Placeholder';
import { getProductById } from '@/lib/data';
import { useStore } from '@/context/StoreContext';

export default function ProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const product = getProductById(id);
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <main className="pt-16 px-4 text-center">
        <p className="text-sm text-ink-500">Produit introuvable.</p>
      </main>
    );
  }

  const wishlisted = isWishlisted(product.id);

  const handleAdd = () => {
    addToCart(product.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <>
      <div className="relative">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.name} className="w-full h-72 object-cover" />
        ) : (
          <Placeholder label={product.name} className="w-full h-72" rounded="rounded-none" />
        )}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-card"
        >
          <ChevronLeft size={20} className="text-ink-900" />
        </button>
        <button
          onClick={() => toggleWishlist(product.id)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-card"
        >
          <Heart size={18} className={wishlisted ? 'fill-brand-500 text-brand-500' : 'text-ink-700'} />
        </button>
      </div>

      <main className="px-4 pt-4 pb-28">
        {product.badge && (
          <span className="inline-block bg-brand-50 text-brand-600 text-[11px] font-semibold px-2 py-0.5 rounded-full mb-2">
            {product.badge}
          </span>
        )}
        <h1 className="text-lg font-bold text-ink-900 mb-1">{product.name}</h1>
        <div className="flex items-center gap-1.5 text-sm text-ink-500 mb-3">
          <Star size={14} className="fill-brand-500 text-brand-500" />
          <span className="font-medium text-ink-900">{product.rating}</span>
          <span>({product.reviews} avis)</span>
        </div>
        <div className="flex items-baseline gap-2 mb-5">
          <span className="text-2xl font-extrabold text-ink-900">{product.price.toFixed(2)}€</span>
          {product.oldPrice && (
            <span className="text-sm text-ink-300 line-through">{product.oldPrice.toFixed(2)}€</span>
          )}
        </div>

        <div className="mb-5">
          <h2 className="text-sm font-semibold text-ink-900 mb-1.5">Description</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            Description à compléter avec les détails réels du produit : matières, dimensions,
            garantie, etc.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-ink-900">Quantité</span>
          <div className="flex items-center gap-3 bg-ink-100 rounded-full px-3 py-1.5">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuer">
              <Minus size={15} />
            </button>
            <span className="text-sm font-semibold w-4 text-center">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} aria-label="Augmenter">
              <Plus size={15} />
            </button>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-ink-100 p-3 z-30">
        <button
          onClick={handleAdd}
          className="w-full bg-brand-500 hover:bg-brand-600 transition text-white font-semibold rounded-full py-3 flex items-center justify-center gap-2"
        >
          <ShoppingCart size={17} />
          {added ? 'Ajouté au panier ✓' : 'Ajouter au panier'}
        </button>
      </div>
    </>
  );
}
