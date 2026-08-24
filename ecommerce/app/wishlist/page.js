'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import ProductCard from '@/components/ProductCard';
import { useStore } from '@/context/StoreContext';
import { getProductById } from '@/lib/data';

export default function WishlistPage() {
  const { wishlist } = useStore();
  const products = wishlist.map(getProductById).filter(Boolean);

  return (
    <>
      <Header title="Favoris" showSearch={false} />
      <main className="pt-4 px-4 pb-4">
        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-16 text-center">
            <Heart size={40} className="text-ink-300" />
            <p className="text-sm text-ink-500">Aucun favori pour le moment.</p>
            <Link href="/" className="text-sm font-semibold text-brand-600">
              Découvrir des produits
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
