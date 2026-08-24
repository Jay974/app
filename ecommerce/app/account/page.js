'use client';

import Link from 'next/link';
import {
  User, Package, Heart, MapPin, CreditCard, Bell, HelpCircle, LogOut, ChevronRight,
} from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

const MENU = [
  { label: 'Mes commandes', icon: Package, href: '/orders' },
  { label: 'Mes favoris', icon: Heart, href: '/wishlist' },
  { label: 'Adresses de livraison', icon: MapPin, href: '#' },
  { label: 'Moyens de paiement', icon: CreditCard, href: '#' },
  { label: 'Notifications', icon: Bell, href: '#' },
  { label: 'Aide & support', icon: HelpCircle, href: '#' },
];

export default function AccountPage() {
  return (
    <>
      <Header title="Mon compte" showSearch={false} />
      <main className="pt-4 px-4 pb-4">
        <div className="bg-white rounded-xl2 shadow-card p-4 flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
            <User size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-ink-900">Utilisateur</p>
            <p className="text-xs text-ink-500">Compléter mon profil</p>
          </div>
        </div>

        <div className="bg-white rounded-xl2 shadow-card overflow-hidden mb-5">
          {MENU.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3.5 ${i !== MENU.length - 1 ? 'border-b border-ink-100' : ''}`}
            >
              <item.icon size={18} className="text-ink-700" />
              <span className="flex-1 text-sm text-ink-900">{item.label}</span>
              <ChevronRight size={16} className="text-ink-300" />
            </Link>
          ))}
        </div>

        <button className="w-full flex items-center justify-center gap-2 text-red-500 text-sm font-semibold py-3">
          <LogOut size={16} /> Se déconnecter
        </button>
      </main>
      <BottomNav />
    </>
  );
}
