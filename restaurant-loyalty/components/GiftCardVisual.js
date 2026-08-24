'use client';

import { Gift } from 'lucide-react';
import { formatEuros } from '@/lib/utils';

const STATUS_LABEL = {
  awaiting_activation: { label: 'En attente de règlement', tone: 'bg-amber-500/20 text-amber-100' },
  active: { label: 'Active', tone: 'bg-white/20 text-white' },
  used: { label: 'Épuisée', tone: 'bg-white/10 text-white/60' },
  cancelled: { label: 'Annulée', tone: 'bg-white/10 text-white/60' },
};

export default function GiftCardVisual({ card, showQr = false }) {
  const status = STATUS_LABEL[card.status] || STATUS_LABEL.active;
  return (
    <div className="rounded-2xl overflow-hidden text-white" style={{ background: 'linear-gradient(135deg,#14161A,#3f2a1d 60%,#ea580c)' }}>
      <div className="p-6 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            <span className="text-sm font-medium text-white/70">Carte cadeau</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${status.tone}`}>{status.label}</span>
        </div>

        <div>
          <p className="text-3xl font-bold">{formatEuros(card.balance_cents)} €</p>
          {card.balance_cents !== card.amount_cents && (
            <p className="text-white/50 text-xs">sur {formatEuros(card.amount_cents)} € offerts initialement</p>
          )}
        </div>

        {(card.sender_name || card.recipient_name) && (
          <p className="text-sm text-white/80">
            {card.sender_name && <>De <span className="font-semibold">{card.sender_name}</span></>}
            {card.sender_name && card.recipient_name && ' → '}
            {card.recipient_name && <>Pour <span className="font-semibold">{card.recipient_name}</span></>}
          </p>
        )}
        {card.message && <p className="text-sm text-white/70 italic">“{card.message}”</p>}

        <p className="font-mono text-lg tracking-widest">{card.code}</p>
      </div>

      {showQr && (
        <div className="bg-white p-6 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/gift-cards/${encodeURIComponent(card.code)}/qr`} alt="QR code de la carte cadeau" className="w-40 h-40" />
          <p className="text-ink/50 text-xs text-center">
            À présenter en caisse pour {card.status === 'awaiting_activation' ? 'régler et activer' : 'utiliser'} la carte.
          </p>
        </div>
      )}
    </div>
  );
}
