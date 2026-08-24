'use client';

import Link from 'next/link';
import { Heart, Star } from 'lucide-react';
import Placeholder from './Placeholder';
import { useStore } from '@/context/StoreContext';

export default function ProductCard({ product }) {
  const { toggleWishlist, isWishlisted, addToCart } = useStore();
  const wishlisted = isWishlisted(product.id);

  return (
    <div className="bg-white rounded-xl2 shadow-card overflow-hidden flex flex-col">
      <Link href={`/product/${product.id}`} className="relative block">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.name} className="w-full h-32 object-cover" />
        ) : (
          <Placeholder label={product.name} className="w-full h-32" rounded="rounded-none" />
        )}
        {product.badge && (
          <span className="absolute top-2 left-2 bg-brand-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {product.badge}
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
          aria-label="Ajouter aux favoris"
        >
          <Heart size={15} className={wishlisted ? 'fill-brand-500 text-brand-500' : 'text-ink-500'} />
        </button>
      </Link>
      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <Link href={`/product/${product.id}`}>
          <p className="text-xs font-medium text-ink-900 line-clamp-2 min-h-[2.2em]">{product.name}</p>
        </Link>
        <div className="flex items-center gap-1 text-[11px] text-ink-500">
          <Star size={11} className="fill-brand-500 text-brand-500" />
          <span>{product.rating}</span>
          <span>({product.reviews})</span>
        </div>
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-ink-900">{product.price.toFixed(2)}€</span>
            {product.oldPrice && (
              <span className="text-[11px] text-ink-300 line-through">{product.oldPrice.toFixed(2)}€</span>
            )}
          </div>
        </div>
        <button
          onClick={() => addToCart(product.id, 1)}
          className="mt-1 text-[11px] font-semibold text-brand-600 border border-brand-500 rounded-full py-1 hover:bg-brand-50 transition"
        >
          Ajouter au panier
        </button>
      </div>
    </div>
  );
}
