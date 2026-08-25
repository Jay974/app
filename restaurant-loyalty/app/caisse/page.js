'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Delete, Lock, Phone, Check, Gift, ArrowLeft, LogOut, ScanLine, Sparkles, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatEuros } from '@/lib/utils';
import QrScanner from '@/components/QrScanner';
import GiftCardVisual from '@/components/GiftCardVisual';

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
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 bg-forest-900 text-cream">
      <div className="flex flex-col items-center gap-2">
        <Lock className="w-8 h-8 text-amber-400" />
        <h1 className="text-xl font-semibold">Caisse — Fidélité</h1>
        <p className="text-cream/50 text-sm">Entrez votre code personnel</p>
      </div>
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('w-4 h-4 rounded-full border-2 border-cream/30', pin.length > i && 'bg-amber-500 border-amber-500')} />
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
        <p className="text-forest-900/50 text-sm mb-2">Montant réglé par le client</p>
        <div className="text-6xl font-bold tabular-nums">{formatEuros(cents)} €</div>
      </div>
      <div className="w-full max-w-sm">
        <Keypad onKey={onKey} />
        <button
          disabled={cents <= 0}
          onClick={() => onNext(cents)}
          className="tap-target w-full mt-4 rounded-2xl bg-amber-500 disabled:bg-forest-900/20 text-forest-900 font-semibold text-lg flex items-center justify-center gap-2"
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
        <button onClick={onBack} className="p-2 rounded-full bg-sage-100"><ArrowLeft className="w-5 h-5" /></button>
        <p className="text-forest-900/60 text-sm">Montant attesté : <span className="font-semibold text-forest-900">{formatEuros(amountCents)} €</span></p>
      </div>
      <div className="text-center">
        <Phone className="w-6 h-6 mx-auto mb-2 text-bordeaux" />
        <p className="text-forest-900/50 text-sm mb-2">Numéro de téléphone du client</p>
        <div className="text-4xl font-bold tabular-nums tracking-wider">{phone || '—'}</div>
      </div>
      <div className="w-full max-w-sm">
        <Keypad onKey={onKey} />
        <button
          disabled={phone.length < 8}
          onClick={() => onNext(phone)}
          className="tap-target w-full mt-4 rounded-2xl bg-amber-500 disabled:bg-forest-900/20 text-forest-900 font-semibold text-lg"
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
        <button onClick={onBack} className="p-2 rounded-full bg-sage-100"><ArrowLeft className="w-5 h-5" /></button>
        <p className="text-forest-900/60 text-sm">{phone}</p>
      </div>

      <div className="card p-6 flex flex-col gap-4">
        <div className="flex justify-between items-baseline">
          <span className="text-forest-900/60">Montant</span>
          <span className="text-2xl font-bold">{formatEuros(amountCents)} €</span>
        </div>
        {lookup === null ? (
          <p className="text-forest-900/40 text-sm">Vérification du client…</p>
        ) : lookup.exists ? (
          <>
            <div className="flex justify-between text-sm text-forest-900/60">
              <span>Solde actuel</span>
              <span>{balance} pts · statut {lookup.tier?.label}</span>
            </div>
            {eligible.length > 0 && (
              <div className="border-t border-forest-900/10 pt-3">
                <p className="text-sm text-forest-900/60 mb-2 flex items-center gap-1"><Gift className="w-4 h-4" /> Récompense disponible</p>
                <div className="flex flex-col gap-2">
                  {eligible.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReward(selectedReward === r.id ? null : r.id)}
                      className={cn('text-left px-3 py-2 rounded-xl border text-sm', selectedReward === r.id ? 'border-amber-500 bg-amber-50' : 'border-forest-900/10')}
                    >
                      {r.name} — {r.points_cost} pts
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-forest-900/60">Nouveau client — un compte fidélité va être créé.</p>
        )}
      </div>

      <button
        disabled={busy}
        onClick={validate}
        className="tap-target w-full rounded-2xl bg-amber-500 disabled:opacity-60 text-forest-900 font-semibold text-lg"
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
      <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
        <Check className="w-10 h-10 text-bordeaux" />
      </div>
      <p className="text-2xl font-bold">+{result.transaction.points_earned} points</p>
      <p className="text-forest-900/60">Nouveau solde : {result.client.points_balance} pts</p>
      {result.tier_up && (
        <p className="text-bordeaux font-semibold">Nouveau statut : {result.tier.label} 🎉</p>
      )}
    </div>
  );
}

function CheckoutFlow({ token }) {
  const [step, setStep] = useState('amount');
  const [amountCents, setAmountCents] = useState(0);
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState(null);

  return (
    <>
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
    </>
  );
}

function CodeEntry({ value, onChange, onScan, placeholder }) {
  const [scanning, setScanning] = useState(false);

  const handleDecode = (text) => {
    // Le QR encode une URL /carte-cadeau/{code} : on ne garde que le code.
    const code = decodeURIComponent(text.split('/').filter(Boolean).pop() || text);
    setScanning(false);
    onScan(code);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
          className="tap-target flex-1 rounded-xl border border-forest-900/10 px-4 text-lg font-mono tracking-widest uppercase"
        />
        <button onClick={() => setScanning(true)} className="tap-target px-4 rounded-xl bg-forest-900 text-cream flex items-center gap-2">
          <ScanLine className="w-5 h-5" /> Scanner
        </button>
      </div>
      {scanning && <QrScanner onDecode={handleDecode} onClose={() => setScanning(false)} />}
    </div>
  );
}

function GiftCardCreateStep({ token, onBack, onDone }) {
  const [cents, setCents] = useState(0);
  const [recipient, setRecipient] = useState('');
  const [sender, setSender] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const onKey = (k) => {
    if (k === 'del') return setCents((c) => Math.floor(c / 10));
    if (cents >= 99999999) return;
    setCents((c) => c * 10 + Number(k));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount_cents: cents, recipient_name: recipient, sender_name: sender, message }),
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
    <div className="flex-1 flex flex-col gap-4 py-6 px-6 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full bg-sage-100"><ArrowLeft className="w-5 h-5" /></button>
        <p className="font-semibold">Créer & activer une carte cadeau</p>
      </div>

      <div className="text-center">
        <p className="text-forest-900/50 text-sm mb-2">Montant réglé par le client</p>
        <div className="text-5xl font-bold tabular-nums">{formatEuros(cents)} €</div>
      </div>
      <div className="max-w-sm mx-auto w-full">
        <Keypad onKey={onKey} />
      </div>

      <div className="card p-4 flex flex-col gap-2 max-w-sm mx-auto w-full">
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Pour qui ? (facultatif)" className="rounded-xl border border-forest-900/10 px-3 py-2 text-sm" />
        <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="De la part de (facultatif)" className="rounded-xl border border-forest-900/10 px-3 py-2 text-sm" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message personnalisé (facultatif)" className="rounded-xl border border-forest-900/10 px-3 py-2 text-sm" rows={2} />
      </div>

      <button
        disabled={busy || cents <= 0}
        onClick={submit}
        className="tap-target max-w-sm mx-auto w-full rounded-2xl bg-amber-500 disabled:bg-forest-900/20 text-forest-900 font-semibold text-lg"
      >
        {busy ? 'Création…' : 'Encaisser et activer'}
      </button>
    </div>
  );
}

function GiftCardActivateStep({ token, onBack, onDone }) {
  const [code, setCode] = useState('');
  const [card, setCard] = useState(null);
  const [busy, setBusy] = useState(false);

  const lookup = async (c) => {
    setCode(c);
    setCard(null);
    if (!c) return;
    const res = await fetch(`/api/gift-cards/${encodeURIComponent(c)}`);
    if (res.ok) setCard(await res.json());
  };

  const activate = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/gift-cards/${encodeURIComponent(code)}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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
    <div className="flex-1 flex flex-col gap-4 py-6 px-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full bg-sage-100"><ArrowLeft className="w-5 h-5" /></button>
        <p className="font-semibold">Activer une carte créée par un client</p>
      </div>
      <CodeEntry value={code} onChange={lookup} onScan={lookup} placeholder="Code de la carte" />
      {card && (
        <>
          <GiftCardVisual card={card} />
          {card.status === 'awaiting_activation' ? (
            <button disabled={busy} onClick={activate} className="tap-target rounded-2xl bg-amber-500 disabled:opacity-60 text-forest-900 font-semibold text-lg">
              {busy ? 'Activation…' : `Confirmer le règlement de ${formatEuros(card.amount_cents)} € et activer`}
            </button>
          ) : (
            <p className="text-sm text-forest-900/50 text-center">Cette carte est déjà {card.status === 'active' ? 'active' : 'traitée'}.</p>
          )}
        </>
      )}
    </div>
  );
}

function GiftCardRedeemStep({ token, onBack, onDone }) {
  const [code, setCode] = useState('');
  const [card, setCard] = useState(null);
  const [cents, setCents] = useState(0);
  const [busy, setBusy] = useState(false);

  const lookup = async (c) => {
    setCode(c);
    setCard(null);
    setCents(0);
    if (!c) return;
    const res = await fetch(`/api/gift-cards/${encodeURIComponent(c)}`);
    if (res.ok) {
      const data = await res.json();
      setCard(data);
      setCents(data.balance_cents);
    }
  };

  const onKey = (k) => {
    if (k === 'del') return setCents((c) => Math.floor(c / 10));
    setCents((c) => Math.min(card?.balance_cents || 0, c * 10 + Number(k)));
  };

  const redeem = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/gift-cards/${encodeURIComponent(code)}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount_cents: cents }),
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
    <div className="flex-1 flex flex-col gap-4 py-6 px-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full bg-sage-100"><ArrowLeft className="w-5 h-5" /></button>
        <p className="font-semibold">Utiliser une carte cadeau</p>
      </div>
      <CodeEntry value={code} onChange={lookup} onScan={lookup} placeholder="Code de la carte" />
      {card && card.status === 'active' && (
        <>
          <GiftCardVisual card={card} />
          <div className="text-center">
            <p className="text-forest-900/50 text-sm mb-1">Montant à déduire (max {formatEuros(card.balance_cents)} €)</p>
            <div className="text-4xl font-bold tabular-nums">{formatEuros(cents)} €</div>
          </div>
          <div className="max-w-sm mx-auto w-full">
            <Keypad onKey={onKey} />
          </div>
          <button
            disabled={busy || cents <= 0 || cents > card.balance_cents}
            onClick={redeem}
            className="tap-target max-w-sm mx-auto w-full rounded-2xl bg-amber-500 disabled:opacity-60 text-forest-900 font-semibold text-lg"
          >
            {busy ? 'Validation…' : `Déduire ${formatEuros(cents)} €`}
          </button>
        </>
      )}
      {card && card.status !== 'active' && (
        <p className="text-sm text-forest-900/50 text-center">Cette carte n'est pas utilisable ({card.status === 'awaiting_activation' ? 'pas encore activée' : card.status}).</p>
      )}
    </div>
  );
}

function GiftCardSuccessStep({ card, onNext }) {
  useEffect(() => {
    const t = setTimeout(onNext, 4000);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 overflow-y-auto">
      <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
        <Check className="w-10 h-10 text-bordeaux" />
      </div>
      <GiftCardVisual card={card} showQr />
    </div>
  );
}

function GiftCardFlow({ token }) {
  const [mode, setMode] = useState('menu'); // menu | create | activate | redeem
  const [result, setResult] = useState(null);

  if (result) return <GiftCardSuccessStep card={result} onNext={() => { setResult(null); setMode('menu'); }} />;

  if (mode === 'create') return <GiftCardCreateStep token={token} onBack={() => setMode('menu')} onDone={setResult} />;
  if (mode === 'activate') return <GiftCardActivateStep token={token} onBack={() => setMode('menu')} onDone={setResult} />;
  if (mode === 'redeem') return <GiftCardRedeemStep token={token} onBack={() => setMode('menu')} onDone={setResult} />;

  return (
    <div className="flex-1 flex flex-col gap-3 justify-center px-6 py-10 max-w-sm mx-auto w-full">
      <button onClick={() => setMode('create')} className="tap-target rounded-2xl bg-white border border-forest-900/10 flex items-center gap-3 px-5 font-semibold">
        <Sparkles className="w-5 h-5 text-bordeaux" /> Créer & activer (vente au comptoir)
      </button>
      <button onClick={() => setMode('activate')} className="tap-target rounded-2xl bg-white border border-forest-900/10 flex items-center gap-3 px-5 font-semibold">
        <Check className="w-5 h-5 text-bordeaux" /> Activer une carte créée par un client
      </button>
      <button onClick={() => setMode('redeem')} className="tap-target rounded-2xl bg-white border border-forest-900/10 flex items-center gap-3 px-5 font-semibold">
        <Wallet className="w-5 h-5 text-bordeaux" /> Utiliser une carte cadeau
      </button>
    </div>
  );
}

export default function CaissePage() {
  const [staff, setStaff] = useState(null);
  const [mode, setMode] = useState('checkout'); // checkout | giftcard
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
      <div className="px-6 py-3 flex items-center justify-between border-b border-forest-900/10 bg-white">
        <span className="font-semibold">{staff.name}</span>
        <button onClick={logout} className="text-forest-900/50 flex items-center gap-1 text-sm"><LogOut className="w-4 h-4" /> Verrouiller</button>
      </div>

      <div className="flex bg-sage-100 mx-6 mt-3 rounded-xl p-1">
        <button
          onClick={() => setMode('checkout')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-medium', mode === 'checkout' ? 'bg-white shadow-sm' : 'text-forest-900/50')}
        >
          Encaissement
        </button>
        <button
          onClick={() => setMode('giftcard')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1', mode === 'giftcard' ? 'bg-white shadow-sm' : 'text-forest-900/50')}
        >
          <Gift className="w-4 h-4" /> Carte cadeau
        </button>
      </div>

      {mode === 'checkout' ? <CheckoutFlow token={token} /> : <GiftCardFlow token={token} />}
    </div>
  );
}
