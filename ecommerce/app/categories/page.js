'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import CategoryPill from '@/components/CategoryPill';
import ProductCard from '@/components/ProductCard';
import { CATEGORIES, PRODUCTS } from '@/lib/data';

export default function CategoriesPage() {
  return (
    <>
      <Header title="Catégories" showSearch={false} />
      <main className="pt-4">
        <div className="grid grid-cols-4 gap-y-4 px-4 mb-6">
          {CATEGORIES.map((cat) => (
            <CategoryPill key={cat.slug} category={cat} />
          ))}
        </div>

        <div className="px-4 mb-2.5">
          <h2 className="text-[15px] font-bold text-ink-900">Tous les produits</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 mb-4">
          {PRODUCTS.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
