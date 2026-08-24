'use client';

import { Package } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { ORDERS } from '@/lib/data';

const STATUS_STYLE = {
  'En transit': 'bg-brand-50 text-brand-600',
  'Livrée': 'bg-green-50 text-green-600',
};

export default function OrdersPage() {
  return (
    <>
      <Header title="Mes commandes" showSearch={false} />
      <main className="pt-4 px-4 pb-4">
        {ORDERS.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-16 text-center">
            <Package size={40} className="text-ink-300" />
            <p className="text-sm text-ink-500">Aucune commande pour le moment.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ORDERS.map((order) => (
              <div key={order.id} className="bg-white rounded-xl2 shadow-card p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                  <Package size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900">Commande {order.id}</p>
                  <p className="text-xs text-ink-500">{order.eta} · {order.items} article(s)</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[order.status] || 'bg-ink-100 text-ink-700'}`}>
                    {order.status}
                  </span>
                  <span className="text-xs font-bold text-ink-900">{order.total.toFixed(2)}€</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
