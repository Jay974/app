'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, Gift, Star, Clock, LogOut, Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn, formatEuros } from '@/lib/utils';
import { enablePush } from '@/lib/push-client';

function LoginGate({ onToken }) {
  const [mode, setMode] = useState('login'); // login | claim
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const path = mode === 'login' ? '/api/clients/login' : '/api/clients/access/claim';
      const payload = mode === 'login' ? { phone, pin } : { phone, code, pin };
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      localStorage.setItem('client_token', data.token);
      onToken(data.token);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-10 gap-6 max-w-md mx-auto bg-cream">
      <div className="text-center flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-forest-900 text-cream flex items-center justify-center font-display font-bold text-2xl">TB</div>
        <h1 className="font-display font-bold text-2xl text-forest-900">La Terrasse de Bourbon</h1>
        <p className="font-script text-2xl text-bordeaux -mt-1">votre carte de fidélité</p>
      </div>

      <div className="flex bg-sage-100 rounded-xl p-1">
        <button
          onClick={() => setMode('login')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-label font-semibold', mode === 'login' ? 'bg-white shadow-sm text-forest-900' : 'text-forest-900/50')}
        >
          J'ai déjà un accès
        </button>
        <button
          onClick={() => setMode('claim')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-label font-semibold', mode === 'claim' ? 'bg-white shadow-sm text-forest-900' : 'text-forest-900/50')}
        >
          Activer mon compte
        </button>
      </div>

      <div className="card p-5 flex flex-col gap-3">
        <label className="text-sm text-forest-900/60 font-label">
          Numéro de téléphone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="0692xxxxxx"
            className="tap-target mt-1 w-full rounded-xl border border-forest-900/10 px-4 text-lg"
          />
        </label>
        {mode === 'claim' && (
          <label className="text-sm text-forest-900/60 font-label">
            Code reçu en caisse
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="123456"
              className="tap-target mt-1 w-full rounded-xl border border-forest-900/10 px-4 text-lg"
            />
          </label>
        )}
        <label className="text-sm text-forest-900/60 font-label">
          {mode === 'claim' ? 'Choisissez un code PIN (4 chiffres)' : 'Code PIN'}
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            type="password"
            placeholder="••••"
            className="tap-target mt-1 w-full rounded-xl border border-forest-900/10 px-4 text-lg tracking-widest"
          />
        </label>
        <button
          disabled={busy || phone.length < 8 || pin.length < 4 || (mode === 'claim' && code.length < 6)}
          onClick={submit}
          className="tap-target rounded-xl bg-amber-500 disabled:opacity-50 text-forest-900 font-label font-extrabold mt-2"
        >
          {busy ? '...' : mode === 'login' ? 'Se connecter' : 'Activer'}
        </button>
      </div>
      <p className="text-xs text-forest-900/40 text-center font-label">
        Pas encore de compte ? Demandez un code d'activation à la caisse lors de votre prochain passage.
      </p>
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [me, setMe] = useState(null);
  const [offers, setOffers] = useState([]);
  const [settings, setSettings] = useState(null);

  const load = useCallback(() => {
    fetch('/api/clients/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setMe);
  }, [token]);

  useEffect(() => {
    load();
    fetch('/api/offers/active').then((r) => r.json()).then(setOffers);
    fetch('/api/settings').then((r) => r.json()).then(setSettings);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, [load]);

  useEffect(() => {
    if (!settings?.restaurant?.lat || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        fetch('/api/clients/proximity-checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [settings, token]);

  const activatePush = async () => {
    try {
      if (!settings?.vapid_public_key) throw new Error('Notifications non configurées par le restaurant.');
      await enablePush(settings.vapid_public_key, token);
      toast.success('Notifications activées !');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!me) return <div className="min-h-screen flex items-center justify-center text-forest-900/40 bg-cream font-label">Chargement…</div>;

  const { client, tier, next_tier, points_to_next, rewards, history } = me;
  const span = next_tier ? next_tier.min_lifetime_points - tier.min_lifetime_points : 1;
  const done = next_tier ? client.lifetime_points - tier.min_lifetime_points : span;
  const pct = next_tier ? (done / span) * 100 : 100;

  return (
    <div className="min-h-screen bg-cream max-w-md mx-auto pb-28">
      <div className="app-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-forest-900 text-cream flex items-center justify-center font-display font-bold">TB</div>
          <div>
            <p className="text-forest-900/50 text-xs font-label">Bonjour</p>
            <p className="font-display font-semibold text-forest-900">{client.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={activatePush} className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-forest-700">
            <Bell className="w-5 h-5" />
          </button>
          <button onClick={onLogout} className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-forest-700">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-5 mt-2 flex flex-col gap-4">
        <div className="hero-card p-6">
          <p className="eyebrow text-cream/70">Vos points fidélité</p>
          <div className="flex items-end justify-between mt-1">
            <p className="text-4xl font-display font-bold">{client.points_balance} <span className="text-lg font-label font-semibold text-cream/70">pts</span></p>
            <p className="eyebrow text-amber-400 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400" /> {tier.label}</p>
          </div>
          {next_tier && (
            <div className="mt-4">
              <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <p className="text-cream/60 text-xs mt-1.5 font-label">{points_to_next} pts avant le statut {next_tier.label}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between px-2">
          <button onClick={activatePush} className="icon-btn">
            <span className="icon-btn-circle"><Bell className="w-5 h-5" /></span>
            Offres
          </button>
          <Link href="/carte-cadeau" className="icon-btn">
            <span className="icon-btn-circle"><Gift className="w-5 h-5" /></span>
            Cadeau
          </Link>
          <a href="#historique" className="icon-btn">
            <span className="icon-btn-circle"><Clock className="w-5 h-5" /></span>
            Historique
          </a>
          <a href="#recompenses" className="icon-btn">
            <span className="icon-btn-circle"><Sparkles className="w-5 h-5" /></span>
            Avantages
          </a>
        </div>

        <div className="promo-card p-5 flex items-center justify-between gap-3">
          <div>
            <p className="font-script text-2xl leading-none text-amber-400">La Terrasse</p>
            <p className="font-display font-bold text-lg leading-tight">de Bourbon</p>
            <p className="text-cream/60 text-xs font-label mt-1">Coffee House · Brunch · Cocktail Bar</p>
          </div>
          <a
            href="https://wa.me/262692253538"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 bg-amber-500 text-forest-900 font-label font-extrabold text-xs px-4 py-2.5 rounded-full flex items-center gap-1"
          >
            Réserver <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div id="recompenses">
          <p className="font-display font-semibold text-forest-900 mb-2 flex items-center gap-1.5"><Gift className="w-4 h-4 text-bordeaux" /> Récompenses</p>
          <div className="grid grid-cols-2 gap-3">
            {rewards.map((r) => (
              <div key={r.id} className={cn('rounded-2xl p-4 bg-forest-900 text-cream', !r.unlocked && 'opacity-40')}>
                <p className="font-dish italic text-lg leading-tight">{r.name}</p>
                {r.description && <p className="text-cream/50 text-xs mt-1">{r.description}</p>}
                <p className="eyebrow text-amber-400 mt-3">{r.points_cost} pts</p>
              </div>
            ))}
            {rewards.length === 0 && <p className="text-sm text-forest-900/40 col-span-2 font-label">Aucune récompense pour le moment.</p>}
          </div>
        </div>

        {offers.length > 0 && (
          <div>
            <p className="font-display font-semibold text-forest-900 mb-2">Offres du moment</p>
            <div className="flex flex-col gap-2">
              {offers.map((o) => (
                <div key={o.id} className="card p-4 border border-bordeaux/10">
                  <p className="font-display font-semibold text-forest-900">{o.title}</p>
                  <p className="text-sm text-forest-900/60 font-body">{o.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div id="historique">
          <p className="font-display font-semibold text-forest-900 mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4 text-bordeaux" /> Historique</p>
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div key={h.id} className="card p-3 flex justify-between items-center text-sm">
                <div>
                  <p className="font-label text-forest-900/60">{new Date(h.created_at).toLocaleDateString('fr-FR')}</p>
                  {h.reward_redeemed && <p className="text-xs text-bordeaux font-label">{h.reward_redeemed.name} échangé (-{h.reward_redeemed.points_cost} pts)</p>}
                </div>
                <div className="text-right">
                  <p className="font-body">{formatEuros(h.amount_cents)} €</p>
                  <p className="text-forest-700 font-label font-semibold">+{h.points_earned} pts</p>
                </div>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-forest-900/40 font-label">Pas encore de visite enregistrée.</p>}
          </div>
        </div>
      </div>

      <nav className="bottom-nav max-w-md mx-auto">
        <span className="bottom-nav-item active">
          <Star className="w-5 h-5" />
          Accueil
        </span>
        <a href="#recompenses" className="bottom-nav-item">
          <Gift className="w-5 h-5" />
          Avantages
        </a>
        <a href="#historique" className="bottom-nav-item">
          <Clock className="w-5 h-5" />
          Historique
        </a>
        <Link href="/carte-cadeau" className="bottom-nav-item">
          <Sparkles className="w-5 h-5" />
          Cadeau
        </Link>
      </nav>
    </div>
  );
}

export default function HomePage() {
  const [token, setToken] = useState(undefined);

  useEffect(() => {
    setToken(localStorage.getItem('client_token'));
  }, []);

  if (token === undefined) return null;
  if (!token) return <LoginGate onToken={setToken} />;

  return (
    <Dashboard
      token={token}
      onLogout={() => {
        localStorage.removeItem('client_token');
        setToken(null);
      }}
    />
  );
}
