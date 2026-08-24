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
    <div className="min-h-screen max-w-md mx-auto px-5 py-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 rounded-full bg-black/5"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-xl font-bold">Carte cadeau</h1>
      </div>

      {card === undefined && <p className="text-ink/40">Chargement…</p>}
      {card === null && <p className="text-ink/60">Carte cadeau introuvable ou expirée.</p>}
      {card && (
        <>
          <GiftCardVisual card={card} showQr />
          {card.status === 'awaiting_activation' && (
            <p className="text-sm text-ink/60 text-center">
              Présentez cette carte au restaurant pour régler son montant et l'activer.
            </p>
          )}
        </>
      )}
    </div>
  );
}
