'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid3x3, ShoppingCart, Heart, User } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

const TABS = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/categories', label: 'Catégories', icon: Grid3x3 },
  { href: '/cart', label: 'Panier', icon: ShoppingCart, badgeKey: 'cart' },
  { href: '/wishlist', label: 'Favoris', icon: Heart, badgeKey: 'wishlist' },
  { href: '/account', label: 'Compte', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount, wishlist } = useStore();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white shadow-nav border-t border-ink-100 z-30">
      <div className="flex items-stretch justify-between px-2">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const badge = tab.badgeKey === 'cart' ? cartCount : tab.badgeKey === 'wishlist' ? wishlist.length : 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 relative"
            >
              <div className="relative">
                <Icon size={21} className={active ? 'text-brand-600' : 'text-ink-500'} strokeWidth={active ? 2.4 : 2} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ${active ? 'text-brand-600 font-semibold' : 'text-ink-500'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
