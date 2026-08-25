'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import GiftCardVisual from '@/components/GiftCardVisual';

export default function GiftCardPublicPage({ params }) {
  const [card, setCard] = useState(undefined);

  useEffect(() => {
    fetch(`/api/gift-cards/${encodeURIComponent(params.code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCard);
  }, [params.code]);

  return (
    <div className="min-h-screen bg-cream max-w-md mx-auto px-5 py-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 rounded-full bg-sage-100 text-forest-700"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-display font-bold text-xl text-forest-900">Carte cadeau</h1>
      </div>

      {card === undefined && <p className="text-forest-900/40 font-label">Chargement…</p>}
      {card === null && <p className="text-forest-900/60 font-label">Carte cadeau introuvable ou expirée.</p>}
      {card && (
        <>
          <GiftCardVisual card={card} showQr />
          {card.status === 'awaiting_activation' && (
            <p className="text-sm text-forest-900/60 font-label text-center">
              Présentez cette carte au restaurant pour régler son montant et l'activer.
            </p>
          )}
        </>
      )}
    </div>
  );
}
