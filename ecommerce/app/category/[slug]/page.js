'use client';

import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import ProductCard from '@/components/ProductCard';
import { CATEGORIES, getProductsByCategory } from '@/lib/data';

export default function CategoryDetailPage() {
  const { slug } = useParams();
  const category = CATEGORIES.find((c) => c.slug === slug);
  const products = getProductsByCategory(slug);

  return (
    <>
      <Header title={category?.label || 'Catégorie'} showSearch={false} showBack />
      <main className="pt-4">
        {products.length === 0 ? (
          <p className="text-center text-sm text-ink-500 mt-10">Aucun produit dans cette catégorie pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 mb-4">
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
