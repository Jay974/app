'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import CategoryPill from '@/components/CategoryPill';
import ProductCard from '@/components/ProductCard';
import SectionHeader from '@/components/SectionHeader';
import Link from 'next/link';
import { Package, ChevronRight } from 'lucide-react';
import { CATEGORIES, PRODUCTS, BANNERS, ORDERS } from '@/lib/data';

export default function HomePage() {
  const bestSellers = PRODUCTS.filter((p) => p.badge === 'Best seller').concat(
    PRODUCTS.filter((p) => p.badge !== 'Best seller')
  ).slice(0, 4);
  const newArrivals = [...PRODUCTS].reverse().slice(0, 4);
  const activeOrder = ORDERS[0];

  return (
    <>
      <Header showSearch />

      <main className="pt-3">
        {/* Bannière promo */}
        <div className="px-4 mb-5">
          <div
            className="rounded-xl2 p-5 text-white flex flex-col gap-1 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${BANNERS[0].color}, #FFB25C)` }}
          >
            <span className="text-xs font-semibold opacity-90">{BANNERS[0].subtitle}</span>
            <span className="text-xl font-extrabold leading-tight max-w-[70%]">{BANNERS[0].title}</span>
            <Link
              href={BANNERS[0].href}
              className="mt-2 inline-flex items-center gap-1 bg-white text-brand-600 text-xs font-bold px-3 py-1.5 rounded-full w-fit"
            >
              {BANNERS[0].cta} <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Catégories */}
        <SectionHeader title="Catégories" href="/categories" />
        <div className="flex gap-4 px-4 overflow-x-auto scrollbar-none pb-1 mb-6">
          {CATEGORIES.map((cat) => (
            <CategoryPill key={cat.slug} category={cat} />
          ))}
        </div>

        {/* Suivi de commande */}
        {activeOrder && (
          <div className="px-4 mb-6">
            <Link
              href="/orders"
              className="bg-white rounded-xl2 shadow-card p-3 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                <Package size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-500">Commande {activeOrder.id}</p>
                <p className="text-sm font-semibold text-ink-900">{activeOrder.eta}</p>
              </div>
              <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded-full shrink-0">
                {activeOrder.status}
              </span>
            </Link>
          </div>
        )}

        {/* Best sellers */}
        <SectionHeader title="Meilleures ventes" href="/categories" />
        <div className="grid grid-cols-2 gap-3 px-4 mb-6">
          {bestSellers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {/* Nouveautés */}
        <SectionHeader title="Nouveautés" href="/categories" />
        <div className="grid grid-cols-2 gap-3 px-4 mb-4">
          {newArrivals.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>

      <BottomNav />
    </>
  );
}
