'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Delete, Lock, Phone, Check, Gift, ArrowLeft, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatEuros } from '@/lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

function Keypad({ onKey }) {
  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {KEYS.map((k, i) =>
        k === '' ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            onClick={() => onKey(k)}
            className="keypad-btn"
          >
            {k === 'del' ? <Delete className="w-6 h-6" /> : k}
          </button>
        )
      )}
    </div>
  );
}

function PinLock({ onUnlocked }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async (code) => {
    setBusy(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      localStorage.setItem('staff_token', data.token);
      localStorage.setItem('staff_name', data.staff.name);
      localStorage.setItem('staff_role', data.staff.role);
      onUnlocked(data.staff);
    } catch (e) {
      toast.error(e.message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }, [onUnlocked]);

  const onKey = (k) => {
    if (busy) return;
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length >= 4) submit(next);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 bg-ink text-white">
      <div className="flex flex-col items-center gap-2">
        <Lock className="w-8 h-8 text-brand-500" />
        <h1 className="text-xl font-semibold">Caisse — Fidélité</h1>
        <p className="text-white/50 text-sm">Entrez votre code personnel</p>
      </div>
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('w-4 h-4 rounded-full border-2 border-white/30', pin.length > i && 'bg-brand-500 border-brand-500')} />
        ))}
      </div>
      <div className="w-64">
        <Keypad onKey={onKey} />
      </div>
    </div>
  );
}

function AmountStep({ onNext }) {
  const [cents, setCents] = useState(0);

  const onKey = (k) => {
    if (k === 'del') return setCents((c) => Math.floor(c / 10));
    if (cents >= 99999999) return;
    setCents((c) => c * 10 + Number(k));
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-10 px-6">
      <div className="text-center">
        <p className="text-ink/50 text-sm mb-2">Montant réglé par le client</p>
        <div className="text-6xl font-bold tabular-nums">{formatEuros(cents)} €</div>
      </div>
      <div className="w-full max-w-sm">
        <Keypad onKey={onKey} />
        <button
          disabled={cents <= 0}
          onClick={() => onNext(cents)}
          className="tap-target w-full mt-4 rounded-2xl bg-brand-600 disabled:bg-ink/20 text-white font-semibold text-lg flex items-center justify-center gap-2"
        >
          Encaisser <Check className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function PhoneStep({ amountCents, onBack, onNext }) {
  const [phone, setPhone] = useState('');

  const onKey = (k) => {
    if (k === 'del') return setPhone((p) => p.slice(0, -1));
    if (phone.length >= 10) return;
    setPhone((p) => p + k);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-8 px-6">
      <div className="w-full flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full bg-black/5"><ArrowLeft className="w-5 h-5" /></button>
        <p className="text-ink/60 text-sm">Montant attesté : <span className="font-semibold text-ink">{formatEuros(amountCents)} €</span></p>
      </div>
      <div className="text-center">
        <Phone className="w-6 h-6 mx-auto mb-2 text-brand-600" />
        <p className="text-ink/50 text-sm mb-2">Numéro de téléphone du client</p>
        <div className="text-4xl font-bold tabular-nums tracking-wider">{phone || '—'}</div>
      </div>
      <div className="w-full max-w-sm">
        <Keypad onKey={onKey} />
        <button
          disabled={phone.length < 8}
          onClick={() => onNext(phone)}
          className="tap-target w-full mt-4 rounded-2xl bg-brand-600 disabled:bg-ink/20 text-white font-semibold text-lg"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}

function ConfirmStep({ amountCents, phone, staffToken, onBack, onDone }) {
  const [lookup, setLookup] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [selectedReward, setSelectedReward] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${phone}`, { headers: { Authorization: `Bearer ${staffToken}` } })
      .then((r) => r.json())
      .then(setLookup);
    fetch('/api/rewards').then((r) => r.json()).then(setRewards);
  }, [phone, staffToken]);

  const balance = lookup?.client?.points_balance || 0;
  const eligible = rewards.filter((r) => r.points_cost <= balance);

  const validate = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ phone, amount_cents: amountCents, redeem_reward_id: selectedReward }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onDone(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between py-8 px-6">
      <div className="w-full flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full bg-black/5"><ArrowLeft className="w-5 h-5" /></button>
        <p className="text-ink/60 text-sm">{phone}</p>
      </div>

      <div className="card p-6 flex flex-col gap-4">
        <div className="flex justify-between items-baseline">
          <span className="text-ink/60">Montant</span>
          <span className="text-2xl font-bold">{formatEuros(amountCents)} €</span>
        </div>
        {lookup === null ? (
          <p className="text-ink/40 text-sm">Vérification du client…</p>
        ) : lookup.exists ? (
          <>
            <div className="flex justify-between text-sm text-ink/60">
              <span>Solde actuel</span>
              <span>{balance} pts · statut {lookup.tier?.label}</span>
            </div>
            {eligible.length > 0 && (
              <div className="border-t border-black/5 pt-3">
                <p className="text-sm text-ink/60 mb-2 flex items-center gap-1"><Gift className="w-4 h-4" /> Récompense disponible</p>
                <div className="flex flex-col gap-2">
                  {eligible.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReward(selectedReward === r.id ? null : r.id)}
                      className={cn('text-left px-3 py-2 rounded-xl border text-sm', selectedReward === r.id ? 'border-brand-600 bg-brand-50' : 'border-black/10')}
                    >
                      {r.name} — {r.points_cost} pts
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-ink/60">Nouveau client — un compte fidélité va être créé.</p>
        )}
      </div>

      <button
        disabled={busy}
        onClick={validate}
        className="tap-target w-full rounded-2xl bg-brand-600 disabled:opacity-60 text-white font-semibold text-lg"
      >
        {busy ? 'Validation…' : 'Valider l\'encaissement'}
      </button>
    </div>
  );
}

function SuccessStep({ result, onNext }) {
  useEffect(() => {
    const t = setTimeout(onNext, 3200);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center">
        <Check className="w-10 h-10 text-brand-600" />
      </div>
      <p className="text-2xl font-bold">+{result.transaction.points_earned} points</p>
      <p className="text-ink/60">Nouveau solde : {result.client.points_balance} pts</p>
      {result.tier_up && (
        <p className="text-brand-600 font-semibold">Nouveau statut : {result.tier.label} 🎉</p>
      )}
    </div>
  );
}

export default function CaissePage() {
  const [staff, setStaff] = useState(null);
  const [step, setStep] = useState('amount');
  const [amountCents, setAmountCents] = useState(0);
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState(null);
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('staff_token') : null), [staff]);

  useEffect(() => {
    const t = localStorage.getItem('staff_token');
    const name = localStorage.getItem('staff_name');
    const role = localStorage.getItem('staff_role');
    if (t && name) setStaff({ name, role });
  }, []);

  const logout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_name');
    localStorage.removeItem('staff_role');
    setStaff(null);
  };

  if (!staff) return <PinLock onUnlocked={setStaff} />;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-6 py-3 flex items-center justify-between border-b border-black/5 bg-white">
        <span className="font-semibold">{staff.name}</span>
        <button onClick={logout} className="text-ink/50 flex items-center gap-1 text-sm"><LogOut className="w-4 h-4" /> Verrouiller</button>
      </div>

      {step === 'amount' && (
        <AmountStep
          onNext={(c) => {
            setAmountCents(c);
            setStep('phone');
          }}
        />
      )}
      {step === 'phone' && (
        <PhoneStep
          amountCents={amountCents}
          onBack={() => setStep('amount')}
          onNext={(p) => {
            setPhone(p);
            setStep('confirm');
          }}
        />
      )}
      {step === 'confirm' && (
        <ConfirmStep
          amountCents={amountCents}
          phone={phone}
          staffToken={token}
          onBack={() => setStep('phone')}
          onDone={(r) => {
            setResult(r);
            setStep('success');
          }}
        />
      )}
      {step === 'success' && (
        <SuccessStep
          result={result}
          onNext={() => {
            setAmountCents(0);
            setPhone('');
            setResult(null);
            setStep('amount');
          }}
        />
      )}
    </div>
  );
}
