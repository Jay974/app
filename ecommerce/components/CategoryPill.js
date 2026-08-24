'use client';

import Link from 'next/link';
import {
  Shirt, Headphones, Armchair, Sparkles, Dumbbell, Baby, Smartphone, Grid3x3,
} from 'lucide-react';

const ICONS = { Shirt, Headphones, Armchair, Sparkles, Dumbbell, Baby, Smartphone, Grid3x3 };

export default function CategoryPill({ category }) {
  const Icon = ICONS[category.icon] || Grid3x3;
  return (
    <Link href={`/category/${category.slug}`} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
      <div className="w-12 h-12 rounded-full bg-white shadow-card flex items-center justify-center text-brand-600">
        <Icon size={20} />
      </div>
      <span className="text-[11px] text-ink-700 text-center leading-tight">{category.label}</span>
    </Link>
  );
}
