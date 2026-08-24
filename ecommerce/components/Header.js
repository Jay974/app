'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Bell, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function Header({ title, showSearch = true, showBack = false }) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-100">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        {showBack ? (
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center -ml-2">
            <ChevronLeft size={22} className="text-ink-900" />
          </button>
        ) : (
          <span className="text-lg font-extrabold text-brand-600 tracking-tight">Shop</span>
        )}
        {title && <h1 className="text-base font-bold text-ink-900 flex-1 truncate">{title}</h1>}
        {!title && showSearch && (
          <form onSubmit={submit} className="flex-1">
            <div className="flex items-center gap-2 bg-ink-100 rounded-full px-3 py-2">
              <Search size={16} className="text-ink-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                className="bg-transparent text-sm flex-1 outline-none placeholder:text-ink-500"
              />
            </div>
          </form>
        )}
        <Link href="/account" className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center relative shrink-0">
          <Bell size={17} className="text-ink-700" />
          <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-500" />
        </Link>
      </div>
    </div>
  );
}
