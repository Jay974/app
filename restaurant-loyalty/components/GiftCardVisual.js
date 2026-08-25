'use client';

import { Gift } from 'lucide-react';
import { formatEuros } from '@/lib/utils';

const STATUS_LABEL = {
  awaiting_activation: { label: 'En attente de règlement', tone: 'bg-amber-500/20 text-amber-300' },
  active: { label: 'Active', tone: 'bg-white/20 text-cream' },
  used: { label: 'Épuisée', tone: 'bg-white/10 text-cream/60' },
  cancelled: { label: 'Annulée', tone: 'bg-white/10 text-cream/60' },
};

export default function GiftCardVisual({ card, showQr = false }) {
  const status = STATUS_LABEL[card.status] || STATUS_LABEL.active;
  return (
    <div className="rounded-2xl overflow-hidden text-cream" style={{ background: 'linear-gradient(135deg,#1A2F1A,#2D6040 55%,#B8294A 130%)' }}>
      <div className="p-6 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" />
            <span className="eyebrow text-cream/70">Carte cadeau</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-label font-semibold ${status.tone}`}>{status.label}</span>
        </div>

        <div>
          <p className="text-3xl font-display font-bold">{formatEuros(card.balance_cents)} €</p>
          {card.balance_cents !== card.amount_cents && (
            <p className="text-cream/50 text-xs font-label">sur {formatEuros(card.amount_cents)} € offerts initialement</p>
          )}
        </div>

        {(card.sender_name || card.recipient_name) && (
          <p className="text-sm text-cream/80 font-body">
            {card.sender_name && <>De <span className="font-semibold">{card.sender_name}</span></>}
            {card.sender_name && card.recipient_name && ' → '}
            {card.recipient_name && <>Pour <span className="font-semibold">{card.recipient_name}</span></>}
          </p>
        )}
        {card.message && <p className="font-dish italic text-cream/85 text-lg">“{card.message}”</p>}

        <p className="font-label text-lg tracking-widest">{card.code}</p>
      </div>

      {showQr && (
        <div className="bg-cream p-6 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/gift-cards/${encodeURIComponent(card.code)}/qr`} alt="QR code de la carte cadeau" className="w-40 h-40" />
          <p className="text-forest-900/50 text-xs text-center font-label">
            À présenter en caisse pour {card.status === 'awaiting_activation' ? 'régler et activer' : 'utiliser'} la carte.
          </p>
        </div>
      )}
    </div>
  );
}
