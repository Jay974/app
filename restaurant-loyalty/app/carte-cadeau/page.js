'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Gift, Share2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import GiftCardVisual from '@/components/GiftCardVisual';

const FALLBACK_PRESETS = [1000, 2000, 3000, 5000];

function CreateForm({ token, onCreated }) {
  const [presets, setPresets] = useState(FALLBACK_PRESETS);
  const [amount, setAmount] = useState(FALLBACK_PRESETS[1]);
  const [custom, setCustom] = useState('');
  const [recipient, setRecipient] = useState('');
  const [sender, setSender] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => {
        if (s.gift_cards?.preset_amounts_cents?.length) {
          setPresets(s.gift_cards.preset_amounts_cents);
          setAmount(s.gift_cards.preset_amounts_cents[1] || s.gift_cards.preset_amounts_cents[0]);
        }
      });
  }, []);

  const finalAmount = custom ? Math.round(Number(custom) * 100) : amount;

  const submit = async () => {
    if (!finalAmount || finalAmount <= 0) return toast.error('Choisissez un montant');
    setBusy(true);
    try {
      const res = await fetch('/api/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount_cents: finalAmount, recipient_name: recipient, sender_name: sender, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onCreated(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <p className="text-sm text-forest-900/60 font-label mb-2">Montant</p>
        <div className="grid grid-cols-4 gap-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => {
                setAmount(p);
                setCustom('');
              }}
              className={cn('py-2 rounded-xl border text-sm font-medium', !custom && amount === p ? 'border-amber-500 bg-amber-50' : 'border-forest-900/10')}
            >
              {(p / 100).toFixed(0)} €
            </button>
          ))}
        </div>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
          inputMode="decimal"
          placeholder="Autre montant (€)"
          className="mt-2 w-full rounded-xl border border-forest-900/10 px-3 py-2 text-sm"
        />
      </div>

      <label className="text-sm text-forest-900/60 font-label">
        Pour qui ? (facultatif)
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Prénom du destinataire" className="mt-1 w-full rounded-xl border border-forest-900/10 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm text-forest-900/60 font-label">
        De la part de
        <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Votre prénom" className="mt-1 w-full rounded-xl border border-forest-900/10 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm text-forest-900/60 font-label">
        Message personnalisé
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Joyeux anniversaire !" className="mt-1 w-full rounded-xl border border-forest-900/10 px-3 py-2 text-sm" rows={3} />
      </label>

      <button disabled={busy} onClick={submit} className="tap-target rounded-xl bg-amber-500 disabled:opacity-50 text-forest-900 font-label font-extrabold flex items-center justify-center gap-2">
        <Gift className="w-5 h-5" /> {busy ? 'Création…' : 'Créer ma carte cadeau'}
      </button>
      <p className="text-xs text-forest-900/40 font-label">
        La carte est réservée avec votre personnalisation ; réglez son montant en caisse pour l'activer, ou transférez-la telle
        quelle à votre proche qui pourra le faire à votre place.
      </p>
    </div>
  );
}

function MyCards({ token }) {
  const [cards, setCards] = useState([]);

  const load = useCallback(() => {
    fetch('/api/gift-cards/mine', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setCards);
  }, [token]);

  useEffect(load, [load]);

  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-display font-semibold text-forest-900">Mes cartes cadeaux</p>
      {cards.map((c) => (
        <Link key={c.id} href={`/carte-cadeau/${encodeURIComponent(c.code)}`} className="block">
          <GiftCardVisual card={c} />
        </Link>
      ))}
    </div>
  );
}

export default function GiftCardHome() {
  const [token, setToken] = useState(undefined);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    setToken(localStorage.getItem('client_token'));
  }, []);

  const share = async (card) => {
    const url = `${window.location.origin}/carte-cadeau/${encodeURIComponent(card.code)}`;
    if (navigator.share) {
      navigator.share({ title: 'Une carte cadeau pour vous !', text: card.message, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié !');
    }
  };

  if (token === undefined) return null;

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-cream">
        <p className="text-forest-900/60 font-label">Connectez-vous à votre carte de fidélité pour créer une carte cadeau.</p>
        <Link href="/" className="text-bordeaux font-label font-semibold underline">Retour à l'accueil</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream max-w-md mx-auto px-5 py-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 rounded-full bg-sage-100 text-forest-700"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-display font-bold text-xl text-forest-900">Carte cadeau</h1>
      </div>

      {created ? (
        <div className="flex flex-col gap-4">
          <GiftCardVisual card={created} showQr />
          <button onClick={() => share(created)} className="tap-target rounded-xl border border-forest-900/10 bg-white flex items-center justify-center gap-2 font-medium">
            <Share2 className="w-5 h-5 text-bordeaux" /> Partager
          </button>
          <button onClick={() => setCreated(null)} className="text-sm text-forest-900/50 font-label underline self-center">Créer une autre carte</button>
        </div>
      ) : (
        <CreateForm token={token} onCreated={setCreated} />
      )}

      {!created && <MyCards token={token} />}
    </div>
  );
}
