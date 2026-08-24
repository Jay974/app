'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, ChevronLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ProductCard from '@/components/ProductCard';
import { searchProducts } from '@/lib/data';

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(params.get('q') || '');
  const results = searchProducts(query);

  const submit = (e) => {
    e.preventDefault();
    router.replace(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <>
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-100">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center -ml-2">
            <ChevronLeft size={22} className="text-ink-900" />
          </button>
          <form onSubmit={submit} className="flex-1">
            <div className="flex items-center gap-2 bg-ink-100 rounded-full px-3 py-2">
              <Search size={16} className="text-ink-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                className="bg-transparent text-sm flex-1 outline-none placeholder:text-ink-500"
              />
            </div>
          </form>
        </div>
      </div>

      <main className="pt-4">
        {query.trim() === '' ? (
          <p className="text-center text-sm text-ink-500 mt-10">Tape un mot-clé pour chercher un produit.</p>
        ) : results.length === 0 ? (
          <p className="text-center text-sm text-ink-500 mt-10">Aucun résultat pour « {query} ».</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 mb-4">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchInner />
    </Suspense>
  );
}
