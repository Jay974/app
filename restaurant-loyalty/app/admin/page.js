'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Send, Lock, LogOut, Users, Settings2, Gift, Megaphone, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function AdminLogin({ onToken }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [name, setName] = useState('');

  const login = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.staff.role !== 'admin') throw new Error('Ce code n\'a pas les droits admin.');
      localStorage.setItem('staff_token', data.token);
      onToken(data.token);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const bootstrap = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/staff/bootstrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, pin }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('staff_token', data.token);
      onToken(data.token);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
      <Lock className="w-8 h-8 text-brand-600" />
      <h1 className="text-xl font-bold">Administration</h1>
      {needsBootstrap && (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" className="tap-target w-64 rounded-xl border border-black/10 px-4" />
      )}
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        type="password"
        inputMode="numeric"
        placeholder="Code PIN admin"
        className="tap-target w-64 rounded-xl border border-black/10 px-4 text-center tracking-widest text-lg"
      />
      <button disabled={busy} onClick={needsBootstrap ? bootstrap : login} className="tap-target w-64 rounded-xl bg-brand-600 text-white font-semibold">
        {needsBootstrap ? 'Créer le compte admin' : 'Se connecter'}
      </button>
      <button onClick={() => setNeedsBootstrap((v) => !v)} className="text-xs text-ink/40 underline">
        {needsBootstrap ? 'J\'ai déjà un compte' : 'Premier lancement ? Créer le compte admin'}
      </button>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <p className="font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-brand-600" /> {title}</p>
      {children}
    </div>
  );
}

function PointsRuleSection({ settings, token, refresh }) {
  const [euros, setEuros] = useState(1);

  useEffect(() => {
    if (settings) setEuros((settings.points_rule.amount_per_point || 100) / 100);
  }, [settings]);

  const save = async () => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ ...settings, points_rule: { amount_per_point: Math.round(euros * 100) } }),
    });
    toast.success('Barème mis à jour');
    refresh();
  };

  return (
    <Section icon={Settings2} title="Barème de points">
      <label className="text-sm text-ink/60 flex items-center gap-2">
        1 point tous les
        <input type="number" min="0.1" step="0.1" value={euros} onChange={(e) => setEuros(Number(e.target.value))} className="w-24 rounded-lg border border-black/10 px-2 py-1" />
        € dépensés
      </label>
      <button onClick={save} className="self-start rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium">Enregistrer</button>
    </Section>
  );
}

function TiersSection({ settings, token, refresh }) {
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    if (settings) setTiers(settings.tiers.map((t) => ({ ...t })));
  }, [settings]);

  const update = (i, key, val) => setTiers((ts) => ts.map((t, idx) => (idx === i ? { ...t, [key]: val } : t)));

  const save = async () => {
    await fetch('/api/settings', { method: 'PUT', headers: authHeaders(token), body: JSON.stringify({ ...settings, tiers }) });
    toast.success('Statuts mis à jour');
    refresh();
  };

  return (
    <Section icon={Users} title="Statuts de fidélité">
      {tiers.map((t, i) => (
        <div key={t.key} className="grid grid-cols-3 gap-2 items-center text-sm">
          <span className="font-medium">{t.label}</span>
          <label className="flex items-center gap-1 text-ink/50">
            dès
            <input type="number" value={t.min_lifetime_points} onChange={(e) => update(i, 'min_lifetime_points', Number(e.target.value))} className="w-20 rounded-lg border border-black/10 px-2 py-1" />
            pts
          </label>
          <label className="flex items-center gap-1 text-ink/50">
            x
            <input type="number" step="0.05" value={t.multiplier} onChange={(e) => update(i, 'multiplier', Number(e.target.value))} className="w-16 rounded-lg border border-black/10 px-2 py-1" />
          </label>
        </div>
      ))}
      <button onClick={save} className="self-start rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium">Enregistrer</button>
    </Section>
  );
}

function RestaurantSection({ settings, token, refresh }) {
  const [r, setR] = useState({ name: '', lat: '', lng: '', proximity_radius_m: 300 });

  useEffect(() => {
    if (settings?.restaurant) setR({ ...settings.restaurant });
  }, [settings]);

  const useMyPosition = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setR((x) => ({ ...x, lat: pos.coords.latitude, lng: pos.coords.longitude }));
    });
  };

  const save = async () => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ ...settings, restaurant: { ...r, lat: r.lat ? Number(r.lat) : null, lng: r.lng ? Number(r.lng) : null, proximity_radius_m: Number(r.proximity_radius_m) } }),
    });
    toast.success('Établissement mis à jour');
    refresh();
  };

  return (
    <Section icon={MapPin} title="Établissement & notifications de proximité">
      <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="Nom du restaurant" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <input value={r.lat ?? ''} onChange={(e) => setR({ ...r, lat: e.target.value })} placeholder="Latitude" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
        <input value={r.lng ?? ''} onChange={(e) => setR({ ...r, lng: e.target.value })} placeholder="Longitude" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
      </div>
      <button onClick={useMyPosition} type="button" className="self-start text-xs text-brand-600 underline">Utiliser ma position actuelle</button>
      <label className="text-sm text-ink/60 flex items-center gap-2">
        Rayon de détection
        <input type="number" value={r.proximity_radius_m} onChange={(e) => setR({ ...r, proximity_radius_m: e.target.value })} className="w-24 rounded-lg border border-black/10 px-2 py-1" />
        mètres
      </label>
      <button onClick={save} className="self-start rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium">Enregistrer</button>
    </Section>
  );
}

function RewardsSection({ token }) {
  const [rewards, setRewards] = useState([]);
  const [form, setForm] = useState({ name: '', points_cost: '', description: '' });

  const load = useCallback(() => {
    fetch('/api/rewards').then((r) => r.json()).then(setRewards);
  }, []);
  useEffect(load, [load]);

  const add = async () => {
    if (!form.name || !form.points_cost) return;
    await fetch('/api/rewards', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ ...form, points_cost: Number(form.points_cost) }) });
    setForm({ name: '', points_cost: '', description: '' });
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/rewards/${id}`, { method: 'DELETE', headers: authHeaders(token) });
    load();
  };

  return (
    <Section icon={Gift} title="Récompenses (produits offerts)">
      {rewards.map((r) => (
        <div key={r.id} className="flex justify-between items-center text-sm border-b border-black/5 pb-2">
          <div>
            <p className="font-medium">{r.name}</p>
            <p className="text-ink/50 text-xs">{r.points_cost} pts</p>
          </div>
          <button onClick={() => remove(r.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Dessert offert" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
        <input value={form.points_cost} onChange={(e) => setForm({ ...form, points_cost: e.target.value })} type="number" placeholder="Coût en points" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
        <button onClick={add} className="self-start rounded-lg bg-ink text-white px-4 py-2 text-sm font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Ajouter</button>
      </div>
    </Section>
  );
}

function OffersSection({ token }) {
  const [offers, setOffers] = useState([]);
  const [form, setForm] = useState({ title: '', message: '', type: 'scheduled', scheduled_at: '' });

  const load = useCallback(() => {
    fetch('/api/offers', { headers: authHeaders(token) }).then((r) => r.json()).then(setOffers);
  }, [token]);
  useEffect(load, [load]);

  const add = async () => {
    if (!form.title || !form.message) return;
    await fetch('/api/offers', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(form) });
    setForm({ title: '', message: '', type: 'scheduled', scheduled_at: '' });
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/offers/${id}`, { method: 'DELETE', headers: authHeaders(token) });
    load();
  };

  const sendNow = async (id) => {
    const res = await fetch(`/api/offers/${id}/send-now`, { method: 'POST', headers: authHeaders(token) });
    const data = await res.json();
    toast.success(`Envoyée à ${data.sent} client(s)`);
  };

  return (
    <Section icon={Megaphone} title="Offres & notifications push">
      {offers.map((o) => (
        <div key={o.id} className="flex justify-between items-center text-sm border-b border-black/5 pb-2 gap-2">
          <div>
            <p className="font-medium">{o.title}</p>
            <p className="text-ink/50 text-xs">{o.type === 'proximity' ? 'À proximité' : o.scheduled_at ? new Date(o.scheduled_at).toLocaleString('fr-FR') : 'Immédiate'}{o.sent_at ? ' · envoyée' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => sendNow(o.id)} className="text-brand-600"><Send className="w-4 h-4" /></button>
            <button onClick={() => remove(o.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titre" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
        <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-lg border border-black/10 px-3 py-2 text-sm">
            <option value="scheduled">Date programmée</option>
            <option value="proximity">À proximité</option>
          </select>
          {form.type === 'scheduled' && (
            <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="rounded-lg border border-black/10 px-3 py-2 text-sm flex-1" />
          )}
        </div>
        <button onClick={add} className="self-start rounded-lg bg-ink text-white px-4 py-2 text-sm font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Créer l'offre</button>
      </div>
      <p className="text-xs text-ink/40">Pas de planificateur automatique branché : utilisez l'icône d'envoi pour déclencher une offre programmée le moment venu.</p>
    </Section>
  );
}

function StaffSection({ token }) {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', pin: '', role: 'caissier' });

  const load = useCallback(() => {
    fetch('/api/staff', { headers: authHeaders(token) }).then((r) => r.json()).then(setStaff);
  }, [token]);
  useEffect(load, [load]);

  const add = async () => {
    if (!form.name || form.pin.length < 4) return;
    const res = await fetch('/api/staff', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(form) });
    if (!res.ok) {
      const d = await res.json();
      return toast.error(d.error);
    }
    setForm({ name: '', pin: '', role: 'caissier' });
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/staff/${id}`, { method: 'DELETE', headers: authHeaders(token) });
    load();
  };

  return (
    <Section icon={Users} title="Équipe (accès caisse)">
      {staff.map((s) => (
        <div key={s.id} className="flex justify-between items-center text-sm border-b border-black/5 pb-2">
          <span>{s.name} <span className="text-ink/40">· {s.role}</span></span>
          <button onClick={() => remove(s.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
        <input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} placeholder="Code PIN (4 chiffres min)" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-black/10 px-3 py-2 text-sm">
          <option value="caissier">Caissier</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={add} className="self-start rounded-lg bg-ink text-white px-4 py-2 text-sm font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Ajouter</button>
      </div>
    </Section>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(undefined);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    setToken(localStorage.getItem('staff_token'));
  }, []);

  const refresh = useCallback(() => {
    fetch('/api/settings').then((r) => r.json()).then(setSettings);
  }, []);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  if (token === undefined) return null;
  if (!token) return <AdminLogin onToken={setToken} />;

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-5 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Administration fidélité</h1>
        <button
          onClick={() => {
            localStorage.removeItem('staff_token');
            setToken(null);
          }}
          className="text-ink/50 flex items-center gap-1 text-sm"
        >
          <LogOut className="w-4 h-4" /> Déconnexion
        </button>
      </div>
      {settings && (
        <>
          <PointsRuleSection settings={settings} token={token} refresh={refresh} />
          <TiersSection settings={settings} token={token} refresh={refresh} />
          <RewardsSection token={token} />
          <OffersSection token={token} />
          <RestaurantSection settings={settings} token={token} refresh={refresh} />
          <StaffSection token={token} />
        </>
      )}
    </div>
  );
}
