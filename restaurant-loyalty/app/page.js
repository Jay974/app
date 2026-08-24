'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, Gift, Star, Clock, LogOut, KeyRound, Smartphone } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col justify-center px-6 py-10 gap-6 max-w-md mx-auto">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto mb-3 text-2xl font-bold">F</div>
        <h1 className="text-xl font-bold">Carte de fidélité</h1>
        <p className="text-ink/50 text-sm mt-1">Le Restaurant</p>
      </div>

      <div className="flex bg-black/5 rounded-xl p-1">
        <button
          onClick={() => setMode('login')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-medium', mode === 'login' ? 'bg-white shadow-sm' : 'text-ink/50')}
        >
          J'ai déjà un accès
        </button>
        <button
          onClick={() => setMode('claim')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-medium', mode === 'claim' ? 'bg-white shadow-sm' : 'text-ink/50')}
        >
          Activer mon compte
        </button>
      </div>

      <div className="card p-5 flex flex-col gap-3">
        <label className="text-sm text-ink/60">
          Numéro de téléphone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="0692xxxxxx"
            className="tap-target mt-1 w-full rounded-xl border border-black/10 px-4 text-lg"
          />
        </label>
        {mode === 'claim' && (
          <label className="text-sm text-ink/60">
            Code reçu en caisse
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="123456"
              className="tap-target mt-1 w-full rounded-xl border border-black/10 px-4 text-lg"
            />
          </label>
        )}
        <label className="text-sm text-ink/60">
          {mode === 'claim' ? 'Choisissez un code PIN (4 chiffres)' : 'Code PIN'}
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            type="password"
            placeholder="••••"
            className="tap-target mt-1 w-full rounded-xl border border-black/10 px-4 text-lg tracking-widest"
          />
        </label>
        <button
          disabled={busy || phone.length < 8 || pin.length < 4 || (mode === 'claim' && code.length < 6)}
          onClick={submit}
          className="tap-target rounded-xl bg-brand-600 disabled:opacity-50 text-white font-semibold mt-2"
        >
          {busy ? '...' : mode === 'login' ? 'Se connecter' : 'Activer'}
        </button>
      </div>
      <p className="text-xs text-ink/40 text-center">
        Pas encore de compte ? Demandez un code d'activation à la caisse lors de votre prochain passage.
      </p>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden">
      <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, value)}%` }} />
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

  if (!me) return <div className="min-h-screen flex items-center justify-center text-ink/40">Chargement…</div>;

  const { client, tier, next_tier, points_to_next, rewards, history } = me;
  const span = next_tier ? next_tier.min_lifetime_points - tier.min_lifetime_points : 1;
  const done = next_tier ? client.lifetime_points - tier.min_lifetime_points : span;
  const pct = next_tier ? (done / span) * 100 : 100;

  return (
    <div className="min-h-screen max-w-md mx-auto px-5 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-ink/40 text-xs">Bonjour</p>
          <p className="font-semibold">{client.phone}</p>
        </div>
        <button onClick={onLogout} className="text-ink/40"><LogOut className="w-5 h-5" /></button>
      </div>

      <div className="rounded-2xl p-6 text-white flex flex-col gap-4" style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wide">Statut</p>
            <p className="text-2xl font-bold flex items-center gap-1"><Star className="w-5 h-5 fill-white" /> {tier.label}</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs">Solde</p>
            <p className="text-2xl font-bold">{client.points_balance} pts</p>
          </div>
        </div>
        {next_tier && (
          <div>
            <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="text-white/70 text-xs mt-1">{points_to_next} pts avant le statut {next_tier.label}</p>
          </div>
        )}
      </div>

      <button
        onClick={activatePush}
        className="tap-target rounded-xl border border-black/10 bg-white flex items-center justify-center gap-2 font-medium"
      >
        <Bell className="w-5 h-5 text-brand-600" /> Recevoir les offres du restaurant
      </button>

      <div>
        <p className="font-semibold mb-2 flex items-center gap-1"><Gift className="w-4 h-4" /> Récompenses</p>
        <div className="flex flex-col gap-2">
          {rewards.map((r) => (
            <div key={r.id} className={cn('card p-3 flex justify-between items-center', !r.unlocked && 'opacity-50')}>
              <div>
                <p className="font-medium">{r.name}</p>
                {r.description && <p className="text-xs text-ink/50">{r.description}</p>}
              </div>
              <span className="text-sm font-semibold">{r.points_cost} pts</span>
            </div>
          ))}
          {rewards.length === 0 && <p className="text-sm text-ink/40">Aucune récompense pour le moment.</p>}
        </div>
      </div>

      {offers.length > 0 && (
        <div>
          <p className="font-semibold mb-2">Offres du moment</p>
          <div className="flex flex-col gap-2">
            {offers.map((o) => (
              <div key={o.id} className="card p-3 bg-brand-50">
                <p className="font-medium">{o.title}</p>
                <p className="text-sm text-ink/60">{o.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="font-semibold mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Historique</p>
        <div className="flex flex-col gap-2">
          {history.map((h) => (
            <div key={h.id} className="card p-3 flex justify-between items-center text-sm">
              <div>
                <p>{new Date(h.created_at).toLocaleDateString('fr-FR')}</p>
                {h.reward_redeemed && <p className="text-xs text-brand-600">{h.reward_redeemed.name} échangé (-{h.reward_redeemed.points_cost} pts)</p>}
              </div>
              <div className="text-right">
                <p>{formatEuros(h.amount_cents)} €</p>
                <p className="text-brand-600 font-semibold">+{h.points_earned} pts</p>
              </div>
            </div>
          ))}
          {history.length === 0 && <p className="text-sm text-ink/40">Pas encore de visite enregistrée.</p>}
        </div>
      </div>
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
