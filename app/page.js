'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Users, BarChart3, Calendar, FileText, MessageCircle, Settings,
  LogOut, Menu, Clock, Sparkles, Baby, Smile, Camera, Moon, Coffee,
  Utensils, Sun, Droplets, Music, Flower, Heart, CheckCircle2,
  Plus, Send, ChevronRight, X, TrendingUp, Euro, UserCheck, MapPin,
  ClipboardList, Briefcase, PiggyBank, Image as ImageIcon, Bell,
  Loader2, Mail, Lock, ArrowRight, Sparkle, Wallet
} from 'lucide-react';
import { toast } from 'sonner';

// ===== API =====
const api = async (path, opts = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tk_token') : null;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
};

// ===== Helpers =====
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const fmtEur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const ageStr = (dob) => {
  if (!dob) return '';
  const d = new Date(dob); const now = new Date();
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m--;
  if (m < 12) return `${m} mois`;
  return `${Math.floor(m / 12)} an${Math.floor(m/12)>1?'s':''}${m%12?' '+(m%12)+'m':''}`;
};
const initials = (p, n) => `${(p||'?')[0]}${(n||'')[0]||''}`.toUpperCase();

// ===== TYPE → ICON / COLOR =====
const TYPE_META = {
  arrivee:  { label: 'Arrivée', icon: Sun, color: '#3ECDB5', bg: '#E6F9F5' },
  repas:    { label: 'Repas',   icon: Utensils, color: '#FF6B6B', bg: '#FFE9E9' },
  biberon:  { label: 'Biberon', icon: Coffee,   color: '#FF6B6B', bg: '#FFE9E9' },
  gouter:   { label: 'Goûter',  icon: Coffee,   color: '#FFA726', bg: '#FFF4E0' },
  change:   { label: 'Change',  icon: Flower,   color: '#66BB6A', bg: '#E8F5E9' },
  bain:     { label: 'Bain',    icon: Droplets, color: '#42A5F5', bg: '#E3F2FD' },
  sante:    { label: 'Santé',   icon: Heart,    color: '#FF6B6B', bg: '#FFE9E9' },
  sieste:   { label: 'Sieste',  icon: Moon,     color: '#42A5F5', bg: '#E3F2FD' },
  activite: { label: 'Activité',icon: Music,    color: '#8B6BE8', bg: '#EFEAFF' },
  sortie:   { label: 'Sortie',  icon: MapPin,   color: '#66BB6A', bg: '#E8F5E9' },
  note:     { label: 'Note',    icon: Sparkle,  color: '#FFA726', bg: '#FFF4E0' },
};

// ===== AVATAR =====
function Avatar({ enfant, size = 44 }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-extrabold text-white shadow-softer flex-shrink-0"
      style={{ width: size, height: size, background: enfant?.avatar_color || '#3ECDB5', fontSize: size * 0.36 }}
    >
      {initials(enfant?.prenom, enfant?.nom)}
    </div>
  );
}

// ===== TOPBAR =====
function TopBar({ user, onLogout, onMenu, title }) {
  return (
    <div className="relative tk-wave text-white">
      <div className="px-4 md:px-8 pt-4 pb-10 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <button onClick={onMenu} className="md:hidden p-2 rounded-full bg-white/15 active:scale-95">
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold opacity-80">TiKréol · Made in 974</div>
            <div className="text-xl md:text-2xl font-extrabold">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full bg-white/15 active:scale-95 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral" />
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-white/15 rounded-pill pl-2 pr-3 py-1.5">
            <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center text-xs font-extrabold">
              {initials(user?.prenom, user?.nom)}
            </div>
            <div className="text-xs">
              <div className="font-bold leading-tight">{user?.prenom}</div>
              <div className="text-[10px] opacity-80 capitalize">{user?.role}</div>
            </div>
          </div>
          <button onClick={onLogout} title="Déconnexion" className="p-2 rounded-full bg-white/15 active:scale-95">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="tk-wave-bottom" />
    </div>
  );
}

// ===== SIDEBAR =====
function Sidebar({ user, view, setView, open, setOpen }) {
  const menus = {
    admin: [
      { key: 'admin/dashboard', label: 'Tableau de bord', icon: Home },
      { key: 'admin/enfants', label: 'Enfants', icon: Baby },
      { key: 'admin/presences', label: 'Présences', icon: ClipboardList },
      { key: 'admin/finances', label: 'Finances · CA', icon: TrendingUp },
      { key: 'admin/charges', label: 'Charges & Salaires', icon: PiggyBank },
      { key: 'admin/factures', label: 'Devis & Factures', icon: FileText },
      { key: 'admin/employes', label: 'Employés', icon: Briefcase },
      { key: 'admin/messagerie', label: 'Messagerie', icon: MessageCircle },
      { key: 'admin/settings', label: 'Administration', icon: Settings },
    ],
    pro: [
      { key: 'pro/pointage', label: 'Pointage', icon: Clock },
      { key: 'pro/activites', label: 'Activités enfants', icon: Sparkles },
      { key: 'pro/taches', label: 'Mes tâches', icon: CheckCircle2 },
      { key: 'pro/documents', label: 'Mes documents', icon: FileText },
    ],
    parent: [
      { key: 'parent/live', label: 'Suivi en direct', icon: Sparkles },
      { key: 'parent/journal', label: 'Journal du jour', icon: ClipboardList },
      { key: 'parent/photos', label: 'Album photos', icon: ImageIcon },
      { key: 'parent/reservations', label: 'Réservations', icon: Calendar },
      { key: 'parent/factures', label: 'Mes factures', icon: Wallet },
      { key: 'parent/messagerie', label: 'Messagerie', icon: MessageCircle },
    ],
  };
  const items = menus[user.role] || [];

  const content = (
    <div className="h-full bg-white px-3 py-6 flex flex-col gap-1 w-64">
      <div className="px-3 mb-6 flex items-center gap-2">
        <div className="w-10 h-10 rounded-2xl bg-teal flex items-center justify-center shadow-soft">
          <Baby className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="font-extrabold text-lg text-ink leading-tight">TiKréol</div>
          <div className="text-[10px] text-ink-muted font-bold uppercase tracking-wider">Made in 974</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {items.map((it) => {
          const Icon = it.icon;
          const active = view === it.key;
          return (
            <button
              key={it.key}
              onClick={() => { setView(it.key); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 my-0.5 rounded-r-pill text-sm font-bold transition-all
                ${active ? 'bg-teal text-white shadow-soft' : 'text-ink-muted hover:bg-teal-light hover:text-teal-dark'}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate-1 text-left">{it.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 px-3 py-3 rounded-2xl bg-teal-light text-teal-dark">
        <div className="text-[11px] font-extrabold uppercase tracking-wider">Plan TiKréol</div>
        <div className="text-sm font-bold">69 € / mois</div>
        <div className="text-[10px] opacity-80">Solution locale 974 🌺</div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:block sticky top-0 h-screen shadow-softer">{content}</aside>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 24 }}
              className="fixed top-0 left-0 h-screen z-50 md:hidden shadow-2xl"
            >{content}</motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ===== LOGIN =====
function LoginView({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [role, setRole] = useState('parent');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await api('auth/login', { method: 'POST', body: JSON.stringify({ email, password: pwd }) })
        : await api('auth/register', { method: 'POST', body: JSON.stringify({ email, password: pwd, prenom, nom, role }) });
      localStorage.setItem('tk_token', data.token);
      localStorage.setItem('tk_user', JSON.stringify(data.user));
      onAuth(data.user);
      toast.success(`Bienvenue ${data.user.prenom} 🌺`);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const quick = async (e, p) => {
    setLoading(true);
    try {
      const data = await api('auth/login', { method: 'POST', body: JSON.stringify({ email: e, password: p }) });
      localStorage.setItem('tk_token', data.token);
      localStorage.setItem('tk_user', JSON.stringify(data.user));
      onAuth(data.user);
      toast.success(`Bienvenue ${data.user.prenom} 🌺`);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen tk-wave flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full bg-white/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] shadow-soft p-8 md:p-10 w-full max-w-md relative z-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-teal flex items-center justify-center shadow-soft">
            <Baby className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-2xl text-ink leading-tight">TiKréol</div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-teal">Made in 974 · 69€/mois</div>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold mt-6 mb-1">{mode === 'login' ? 'Bon retour 👋' : 'Créer un compte'}</h1>
        <p className="text-ink-muted text-sm mb-6">Gestion de crèche pensée pour La Réunion 🌺</p>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input value={prenom} onChange={(e)=>setPrenom(e.target.value)} required placeholder="Prénom" className="px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
                <input value={nom} onChange={(e)=>setNom(e.target.value)} required placeholder="Nom" className="px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
              </div>
              <select value={role} onChange={(e)=>setRole(e.target.value)} className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold">
                <option value="parent">👨‍👩‍👦 Parent</option>
                <option value="pro">👩‍⚕️ Pro (éducatrice)</option>
                <option value="admin">👑 Admin (directrice)</option>
              </select>
            </>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input value={email} onChange={(e)=>setEmail(e.target.value)} required type="email" placeholder="Email" className="w-full pl-11 pr-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input value={pwd} onChange={(e)=>setPwd(e.target.value)} required type="password" placeholder="Mot de passe" className="w-full pl-11 pr-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
          </div>
          <button disabled={loading} className="btn-pill w-full bg-teal text-white shadow-soft hover:shadow-hover">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'} <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-sm text-teal-dark font-bold mt-4 hover:underline">
          {mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà inscrit ? Se connecter'}
        </button>

        <div className="mt-6 pt-6 border-t border-bgsoft">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-3">Comptes démo</div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => quick('admin@demo.re', 'demo1234')} className="btn-pill bg-teal-light text-teal-dark text-xs">👑 Admin</button>
            <button onClick={() => quick('pro@demo.re', 'demo1234')} className="btn-pill bg-violet/10 text-violet text-xs">👩‍⚕️ Pro</button>
            <button onClick={() => quick('parent@demo.re', 'demo1234')} className="btn-pill bg-coral/10 text-coral text-xs">👨‍👩‍👦 Parent</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ===== STAT BUBBLE (Onoco style) =====
function StatRow({ icon: Icon, label, color, bg, items }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg p-4 md:p-5 shadow-softer flex items-center gap-4 relative overflow-hidden"
    >
      <div className="rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg, width: 56, height: 56 }}>
        <Icon className="w-7 h-7" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color }}>{label}</div>
        <div className="flex gap-4 mt-1">
          {items.map((it, i) => (
            <div key={i}>
              <div className="text-2xl font-extrabold text-ink leading-none">{it.value}</div>
              <div className="text-[10px] text-ink-muted font-bold uppercase tracking-wider mt-1">{it.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-20" style={{ background: color }} />
    </motion.div>
  );
}

// ===== TIMELINE =====
function TimelineEntry({ t, idx, canDelete, onDelete }) {
  const meta = TYPE_META[t.type] || TYPE_META.note;
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
      className="relative pl-8 pb-4"
    >
      <div className="absolute left-2 top-2 w-3 h-3 rounded-full ring-4 ring-white" style={{ background: meta.color }} />
      <div className="absolute left-3 top-5 bottom-0 w-px bg-bgsoft" />
      <div className="bg-white rounded-lg p-4 shadow-softer relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: meta.color }} />
        <div className="flex items-start gap-3">
          <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg, width: 42, height: 42 }}>
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold text-ink truncate-1">{t.titre}</div>
              <div className="text-xs text-ink-muted font-bold flex-shrink-0">{fmtTime(t.heure)}</div>
            </div>
            {t.detail && <div className="text-sm text-ink-muted mt-1">{t.detail}</div>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
              {t.visible_parents && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bgsoft text-ink-muted">👁 Visible parents</span>}
              <span className="text-[10px] text-ink-muted">par {t.auteur_nom}</span>
              {canDelete && (
                <button onClick={() => onDelete(t.id)} className="ml-auto text-ink-muted hover:text-coral">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 pl-8 py-2">
      <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
      <span className="text-xs text-ink-muted ml-2 font-semibold">L'équipe écrit...</span>
    </div>
  );
}

// ===== CHILD HEADER CARD =====
function ChildHeaderCard({ enfant, onAdd }) {
  if (!enfant) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg p-4 shadow-softer flex items-center gap-4">
      <Avatar enfant={enfant} size={56} />
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-lg text-ink truncate-1">{enfant.prenom}</div>
        <div className="text-sm text-ink-muted">{ageStr(enfant.date_naissance)} · {enfant.groupe}</div>
      </div>
      {onAdd && (
        <button onClick={onAdd} className="w-10 h-10 rounded-full bg-teal text-white flex items-center justify-center shadow-soft active:scale-95">
          <Plus className="w-5 h-5" />
        </button>
      )}
    </motion.div>
  );
}

// ===== ACTIVITY CARD =====
function ActivityCard({ type, lastTime, done, onClick }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <motion.button
      whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`activity-card text-left w-full ${done ? 'done' : ''}`}
      style={{ background: done ? meta.bg : '#fff' }}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg, width: 42, height: 42 }}>
          <Icon className="w-5 h-5" style={{ color: meta.color }} />
        </div>
        {done && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}
            className="ml-auto w-6 h-6 rounded-full flex items-center justify-center" style={{ background: meta.color }}>
            <CheckCircle2 className="w-4 h-4 text-white" />
          </motion.div>
        )}
      </div>
      <div className="font-extrabold text-ink mt-3 truncate-1">{meta.label}</div>
      <div className="text-xs text-ink-muted mt-0.5 truncate-1">{lastTime ? `Dernier · ${lastTime}` : 'Aucun encore'}</div>
    </motion.button>
  );
}

// ===== ADMIN: DASHBOARD =====
function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [transmissions, setTransmissions] = useState([]);
  const [enfants, setEnfants] = useState([]);

  const load = async () => {
    try {
      const [s, t, e] = await Promise.all([
        api('dashboard/stats'),
        api(`transmissions?date=${new Date().toISOString().slice(0,10)}`),
        api('enfants'),
      ]);
      setStats(s.stats); setTransmissions(t.transmissions); setEnfants(e.enfants);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); const it = setInterval(load, 5000); return () => clearInterval(it); }, []);

  if (!stats) return <Loading />;

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatRow icon={Moon} label="Siestes" color="#42A5F5" bg="#E3F2FD" items={[
          { value: stats.siestes, label: 'Aujourd\'hui' }, { value: enfants.length, label: 'Enfants' }, { value: '2h', label: 'Moy.' },
        ]} />
        <StatRow icon={Coffee} label="Biberons" color="#FF6B6B" bg="#FFE9E9" items={[
          { value: stats.biberons, label: 'Aujourd\'hui' }, { value: '180ml', label: 'Moy.' }, { value: '6', label: 'Prévus' },
        ]} />
        <StatRow icon={Flower} label="Changes" color="#66BB6A" bg="#E8F5E9" items={[
          { value: stats.changes, label: 'Aujourd\'hui' }, { value: stats.repas, label: 'Repas' }, { value: stats.activites, label: 'Activités' },
        ]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center justify-between mb-4">
            <div className="font-extrabold text-lg">Flux d'activité du jour</div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-dark bg-teal-light px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" /> Temps réel
            </span>
          </div>
          <div className="max-h-[460px] overflow-y-auto scrollbar-thin pr-2">
            {transmissions.length === 0 && <div className="text-ink-muted text-sm">Aucune transmission aujourd'hui</div>}
            {transmissions.map((t, i) => (
              <TimelineEntry key={t.id} t={t} idx={i} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gradient-to-br from-ink to-[#1A202C] text-white rounded-lg p-5 shadow-softer relative overflow-hidden">
            <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-70">Taux d'occupation</div>
            <div className="text-4xl font-extrabold mt-1">{stats.taux_occupation}%</div>
            <div className="mt-3 h-2 rounded-full bg-white/15">
              <motion.div initial={{ width: 0 }} animate={{ width: `${stats.taux_occupation}%` }} className="h-full bg-teal rounded-full" />
            </div>
            <div className="text-xs opacity-70 mt-2">{stats.enfants_total} / 24 places</div>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-teal/20" />
          </div>

          <div className="bg-white rounded-lg p-5 shadow-softer">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-2">CA Mensuel</div>
            <div className="text-3xl font-extrabold text-teal-dark">{fmtEur(stats.ca_mensuel)}</div>
            <div className="text-xs text-ink-muted mt-1">/ {fmtEur(stats.ca_attendu)} attendu</div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-softer">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-3">Équipe présente</div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-teal" />
              <div className="text-2xl font-extrabold">{stats.employes_presents} / {stats.employes_total}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== ADMIN: ENFANTS =====
function AdminEnfants() {
  const [enfants, setEnfants] = useState([]);
  const [filter, setFilter] = useState('Tous');
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try { const d = await api('enfants'); setEnfants(d.enfants); } catch(e){ toast.error(e.message); } };
  useEffect(() => { load(); }, []);

  const groupes = ['Tous', ...Array.from(new Set(enfants.map(e => e.groupe)))];
  const filtered = filter === 'Tous' ? enfants : enfants.filter(e => e.groupe === filter);

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {groupes.map(g => (
            <button key={g} onClick={() => setFilter(g)} className={`btn-pill text-xs flex-shrink-0 ${filter === g ? 'bg-teal text-white' : 'bg-white text-ink-muted'}`}>
              {g}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((e, i) => (
          <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-white rounded-lg p-4 shadow-softer hover:shadow-soft hover:-translate-y-1 transition-all">
            <div className="flex items-center gap-3">
              <Avatar enfant={e} size={56} />
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-lg truncate-1">{e.prenom}</div>
                <div className="text-xs text-ink-muted">{ageStr(e.date_naissance)}</div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-teal-light text-teal-dark">{e.groupe}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-bgsoft grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-ink-muted">Contrat</div><div className="font-bold">{e.contrat_heures}h / sem</div></div>
              <div><div className="text-ink-muted">Mensualité</div><div className="font-bold text-teal-dark">{fmtEur(e.mensualite)}</div></div>
            </div>
          </motion.div>
        ))}
      </div>

      {showAdd && <AddChildModal onClose={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddChildModal({ onClose }) {
  const [prenom, setPrenom] = useState(''); const [groupe, setGroupe] = useState('Tournesol');
  const [heures, setHeures] = useState(35); const [mens, setMens] = useState(520);
  const [color, setColor] = useState('#3ECDB5');
  const palette = ['#3ECDB5','#FF6B6B','#FFA726','#8B6BE8','#42A5F5','#66BB6A','#F06292'];
  const submit = async (e) => {
    e.preventDefault();
    try { await api('enfants', { method: 'POST', body: JSON.stringify({ prenom, groupe, contrat_heures: +heures, mensualite: +mens, avatar_color: color }) });
      toast.success('Enfant ajouté'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="font-extrabold text-lg">Nouvel enfant</div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input value={prenom} onChange={e=>setPrenom(e.target.value)} required placeholder="Prénom" className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 font-semibold text-sm" />
          <select value={groupe} onChange={e=>setGroupe(e.target.value)} className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none font-semibold text-sm">
            <option>Tournesol</option><option>Coquelicot</option><option>Marguerite</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={heures} onChange={e=>setHeures(e.target.value)} placeholder="Heures/sem" className="px-4 py-3 rounded-pill bg-bgsoft outline-none font-semibold text-sm" />
            <input type="number" value={mens} onChange={e=>setMens(e.target.value)} placeholder="Mensualité €" className="px-4 py-3 rounded-pill bg-bgsoft outline-none font-semibold text-sm" />
          </div>
          <div>
            <div className="text-xs font-bold text-ink-muted mb-2">Couleur avatar</div>
            <div className="flex gap-2 flex-wrap">
              {palette.map(c => (
                <button type="button" key={c} onClick={() => setColor(c)} className={`w-9 h-9 rounded-full ${color===c?'ring-4 ring-offset-2 ring-teal':''}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <button className="btn-pill w-full bg-teal text-white shadow-soft">Créer</button>
        </form>
      </motion.div>
    </div>
  );
}

// ===== ADMIN: FINANCES =====
function AdminFinances() {
  const [stats, setStats] = useState(null);
  const [factures, setFactures] = useState([]);
  useEffect(() => { (async () => {
    try { const s = await api('dashboard/stats'); const f = await api('factures'); setStats(s.stats); setFactures(f.factures); }
    catch(e){ toast.error(e.message); }
  })(); }, []);
  if (!stats) return <Loading />;

  const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  const fakeChart = months.map((m,i) => ({ m, v: 1200 + Math.round(Math.sin(i)*400 + i*150 + stats.ca_attendu/12) }));

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-5 shadow-softer relative overflow-hidden">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-teal">CA Encaissé</div>
          <div className="text-3xl font-extrabold mt-2">{fmtEur(stats.ca_mensuel)}</div>
          <div className="text-xs text-ink-muted mt-1">Sur {fmtEur(stats.ca_attendu)} attendu</div>
          <Euro className="absolute right-4 top-4 w-7 h-7 text-teal opacity-30" />
        </div>
        <div className="bg-white rounded-lg p-5 shadow-softer relative overflow-hidden">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-violet">Charges CGSS estimées</div>
          <div className="text-3xl font-extrabold mt-2">{fmtEur(stats.ca_mensuel * 0.45)}</div>
          <div className="text-xs text-ink-muted mt-1">Patronal ~45% + Salarial 21%</div>
          <PiggyBank className="absolute right-4 top-4 w-7 h-7 text-violet opacity-30" />
        </div>
        <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-5 shadow-soft relative overflow-hidden">
          <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">Résultat net estimé</div>
          <div className="text-3xl font-extrabold mt-2">{fmtEur(stats.ca_mensuel * 0.34)}</div>
          <div className="text-xs opacity-80 mt-1">Après CGSS et charges</div>
          <TrendingUp className="absolute right-4 top-4 w-7 h-7 opacity-30" />
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-4">Évolution du CA · 12 mois</div>
        <div className="flex items-end gap-2 h-44">
          {fakeChart.map((c, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div initial={{ height: 0 }} animate={{ height: `${(c.v/Math.max(...fakeChart.map(x=>x.v)))*100}%` }}
                transition={{ delay: i*0.05 }} className="w-full rounded-t-lg bg-gradient-to-t from-teal to-teal/40" />
              <div className="text-[10px] font-bold text-ink-muted">{c.m}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-3">Factures du mois</div>
        <div className="space-y-2">
          {factures.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-bgsoft transition">
              <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center"><FileText className="w-5 h-5 text-teal" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate-1">{f.famille}</div>
                <div className="text-xs text-ink-muted">{f.mois}</div>
              </div>
              <div className="font-extrabold">{fmtEur(f.montant)}</div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${f.statut==='payee'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>
                {f.statut==='payee'?'Payée':'En attente'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== ADMIN: FACTURES (alias) =====
function AdminFactures() {
  const [factures, setFactures] = useState([]);
  useEffect(() => { (async()=>{ try{const f=await api('factures'); setFactures(f.factures);}catch(e){toast.error(e.message);} })(); }, []);
  return (
    <div className="bg-white rounded-lg p-5 shadow-softer animate-fade-up">
      <div className="font-extrabold text-lg mb-3">Devis & Factures</div>
      <div className="space-y-2">
        {factures.map(f => (
          <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-bgsoft transition">
            <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center"><FileText className="w-5 h-5 text-teal" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate-1">{f.famille}</div>
              <div className="text-xs text-ink-muted">{f.mois}</div>
            </div>
            <div className="font-extrabold">{fmtEur(f.montant)}</div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${f.statut==='payee'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>
              {f.statut==='payee'?'Payée':'En attente'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== ADMIN: EMPLOYES =====
function AdminEmployes() {
  const [employes, setEmployes] = useState([]);
  const [pointages, setPointages] = useState([]);
  useEffect(() => { (async()=>{ try{const e=await api('employes'); const p=await api('pointages'); setEmployes(e.employes); setPointages(p.pointages);}catch(e){toast.error(e.message);} })(); }, []);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-3">Pointages du jour</div>
        <div className="space-y-2">
          {employes.map(e => {
            const p = pointages.find(x => x.employe_id === e.id && x.date === new Date().toISOString().slice(0,10));
            return (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
                <div className="w-10 h-10 rounded-full bg-violet/20 text-violet flex items-center justify-center font-extrabold">{initials(e.prenom, e.nom)}</div>
                <div className="flex-1">
                  <div className="font-bold">{e.prenom} {e.nom}</div>
                  <div className="text-xs text-ink-muted">{e.email}</div>
                </div>
                {p ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-light text-teal-dark">Pointé à {fmtTime(p.heure)}</span>
                ) : (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber/20 text-amber">Non pointé</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== ADMIN: PRESENCES (placeholder simple) =====
function AdminPresences() {
  const [enfants, setEnfants] = useState([]);
  const [selected, setSelected] = useState(null);
  useEffect(() => { (async()=>{const d=await api('enfants'); setEnfants(d.enfants); setSelected(d.enfants[0]?.id);})(); }, []);
  const child = enfants.find(e => e.id === selected);
  const days = ['Lun','Mar','Mer','Jeu','Ven'];
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {enfants.map(e => (
          <button key={e.id} onClick={()=>setSelected(e.id)} className={`btn-pill text-xs flex-shrink-0 ${selected===e.id?'bg-teal text-white':'bg-white text-ink-muted'}`}>
            {e.prenom}
          </button>
        ))}
      </div>
      {child && (
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center gap-3 mb-4">
            <Avatar enfant={child} size={48} />
            <div>
              <div className="font-extrabold text-lg">{child.prenom}</div>
              <div className="text-xs text-ink-muted">{ageStr(child.date_naissance)} · Contrat {child.contrat_heures}h/sem</div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {days.map((d,i) => (
              <div key={d} className="rounded-2xl bg-bgsoft p-3 text-center">
                <div className="text-[10px] font-bold uppercase text-ink-muted">{d}</div>
                <div className="mt-2 w-8 h-8 mx-auto rounded-full bg-teal/20 text-teal-dark flex items-center justify-center font-extrabold text-xs">
                  {Math.random() > 0.2 ? '✓' : '—'}
                </div>
                <div className="text-[10px] mt-1 font-bold text-ink-muted">8h-17h</div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-2xl bg-teal-light flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-teal-dark" />
            <div>
              <div className="font-extrabold text-teal-dark">Prorata calculé</div>
              <div className="text-xs text-ink-muted">Heures effectives : 32h / 35h contractuelles · Mensualité ajustée : {fmtEur(child.mensualite * 32/35)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== ADMIN: CHARGES =====
function AdminCharges() {
  const [employes, setEmployes] = useState([]);
  useEffect(() => { (async()=>{const e=await api('employes'); setEmployes(e.employes);})(); }, []);
  const brut = 1800;
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {employes.map(e => (
          <div key={e.id} className="bg-white rounded-lg p-5 shadow-softer">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-violet/20 text-violet flex items-center justify-center font-extrabold">{initials(e.prenom, e.nom)}</div>
              <div>
                <div className="font-extrabold">{e.prenom} {e.nom}</div>
                <div className="text-xs text-ink-muted">Auxiliaire</div>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">Brut</span><span className="font-bold">{fmtEur(brut)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">CGSS patronal (45%)</span><span className="font-bold text-violet">{fmtEur(brut*0.45)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">CGSS salarial (21%)</span><span className="font-bold text-coral">−{fmtEur(brut*0.21)}</span></div>
              <div className="border-t border-bgsoft pt-2 flex justify-between font-extrabold"><span>Net</span><span className="text-teal-dark">{fmtEur(brut*0.79)}</span></div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-gradient-to-br from-violet to-[#6B4FD8] text-white rounded-lg p-6 shadow-soft">
        <div className="text-sm opacity-80 font-bold uppercase tracking-wider">À verser à la CGSS Réunion</div>
        <div className="text-4xl font-extrabold mt-2">{fmtEur(employes.length * brut * 0.66)}</div>
        <div className="text-xs opacity-80 mt-1">Total mensuel (patronal + salarial)</div>
      </div>
    </div>
  );
}

// ===== ADMIN: MESSAGERIE =====
function MessagerieView({ user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef();
  const load = async () => { try { const d = await api('messages'); setMessages(d.messages); } catch(e){} };
  useEffect(() => { load(); const it = setInterval(load, 3000); return ()=>clearInterval(it); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const send = async () => {
    if (!text.trim()) return;
    try { await api('messages', { method: 'POST', body: JSON.stringify({ contenu: text }) });
      setText(''); load();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="bg-white rounded-lg shadow-softer h-[70vh] flex flex-col animate-fade-up">
      <div className="px-5 py-4 border-b border-bgsoft flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-teal-light text-teal-dark flex items-center justify-center"><MessageCircle className="w-5 h-5" /></div>
        <div>
          <div className="font-extrabold">Messagerie crèche</div>
          <div className="text-xs text-ink-muted">Temps réel · 974 🌺</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-3">
        {messages.map(m => {
          const mine = m.from_id === user.id;
          return (
            <motion.div key={m.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
              className={`flex ${mine?'justify-end':'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${mine?'bg-teal text-white':'bg-bgsoft text-ink'}`}>
                {!mine && <div className="text-[10px] font-extrabold opacity-70 mb-0.5">{m.from_nom}</div>}
                <div className="text-sm font-semibold">{m.contenu}</div>
                <div className={`text-[10px] mt-1 ${mine?'opacity-70':'text-ink-muted'}`}>{fmtTime(m.created_at)}</div>
              </div>
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-bgsoft p-3 flex gap-2">
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Écrire un message..." className="flex-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
        <button onClick={send} className="btn-pill bg-teal text-white shadow-soft"><Send className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ===== PRO: POINTAGE =====
function ProPointage({ user }) {
  const [now, setNow] = useState(new Date());
  const [logs, setLogs] = useState([]);
  const load = async () => { try { const d = await api('pointages'); setLogs(d.pointages); } catch(e){} };
  useEffect(() => { load(); const it = setInterval(()=>setNow(new Date()), 1000); return ()=>clearInterval(it); }, []);
  const punch = async (type) => {
    try { await api('pointage', { method: 'POST', body: JSON.stringify({ type }) });
      toast.success(`${type === 'arrivee' ? 'Arrivée' : 'Départ'} enregistré`); load();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-8 shadow-soft text-center relative overflow-hidden">
        <Clock className="w-10 h-10 mx-auto mb-3 opacity-80" />
        <div className="text-5xl md:text-6xl font-extrabold tabular-nums">{now.toLocaleTimeString('fr-FR')}</div>
        <div className="text-sm opacity-80 mt-2 font-bold">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={()=>punch('arrivee')} className="btn-pill bg-white text-teal-dark shadow-soft">
            <Sun className="w-4 h-4" /> Pointer mon arrivée
          </button>
          <button onClick={()=>punch('depart')} className="btn-pill bg-white/20 text-white border border-white/40">
            <Moon className="w-4 h-4" /> Pointer départ
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-3">Historique récent</div>
        <div className="space-y-2">
          {logs.slice(0, 10).map(l => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${l.type==='arrivee'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>
                {l.type==='arrivee'?<Sun className="w-4 h-4" />:<Moon className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm capitalize">{l.type}</div>
                <div className="text-xs text-ink-muted">{new Date(l.heure).toLocaleString('fr-FR')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== PRO: ACTIVITES =====
const ACTIVITY_TYPES = ['biberon','repas','gouter','change','bain','sante','sieste','activite','sortie'];

function ProActivites({ user }) {
  const [enfants, setEnfants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mood, setMood] = useState('happy');
  const [trans, setTrans] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const today = new Date().toISOString().slice(0,10);

  const loadAll = async () => {
    try {
      const e = await api('enfants'); setEnfants(e.enfants);
      if (!selected && e.enfants[0]) setSelected(e.enfants[0].id);
      const t = await api(`transmissions?date=${today}${selected ? `&enfant_id=${selected}`:''}`);
      setTrans(t.transmissions);
    } catch(e){ toast.error(e.message); }
  };
  useEffect(() => { loadAll(); const it = setInterval(loadAll, 4000); return ()=>clearInterval(it); }, [selected]);

  const child = enfants.find(e => e.id === selected);
  const lastByType = useMemo(() => {
    const m = {};
    trans.forEach(t => { if (!m[t.type] || new Date(t.heure) > new Date(m[t.type].heure)) m[t.type] = t; });
    return m;
  }, [trans]);

  const quickAdd = async (type, titre, detail) => {
    try {
      await api('transmissions', { method: 'POST', body: JSON.stringify({ enfant_id: selected, type, titre: titre || TYPE_META[type].label, detail: detail || '' }) });
      toast.success(`${TYPE_META[type].label} ajouté pour ${child?.prenom}`);
      setShowForm(null); loadAll();
    } catch(e){ toast.error(e.message); }
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {enfants.map(e => (
          <button key={e.id} onClick={()=>setSelected(e.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-pill text-sm font-bold flex-shrink-0 transition-all ${selected===e.id?'bg-teal text-white shadow-soft':'bg-white text-ink-muted'}`}>
            <Avatar enfant={e} size={28} />
            <span>{e.prenom}</span>
          </button>
        ))}
      </div>

      {child && (
        <>
          <ChildHeaderCard enfant={child} />

          <div className="bg-white rounded-lg p-4 shadow-softer">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-3">Humeur du jour</div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {[
                {k:'happy', e:'😊', l:'Joyeux'},{k:'sleepy', e:'😴', l:'Fatigué'},{k:'sad', e:'😢', l:'Triste'},
                {k:'angry', e:'😠', l:'Énervé'},{k:'sick', e:'🤒', l:'Malade'},{k:'excited', e:'🤩', l:'Excité'},
              ].map(m => (
                <motion.button whileTap={{ scale: 0.9 }} animate={mood===m.k?{ scale:[1,1.15,1] }:{}} key={m.k} onClick={()=>setMood(m.k)}
                  className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-bold ${mood===m.k?'bg-teal text-white shadow-soft':'bg-bgsoft text-ink-muted'}`}>
                  <span className="text-lg mr-1">{m.e}</span>{m.l}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="activity-grid">
            {ACTIVITY_TYPES.map(t => {
              const last = lastByType[t];
              return (
                <ActivityCard key={t} type={t} done={!!last} lastTime={last?fmtTime(last.heure):null}
                  onClick={() => setShowForm(t)} />
              );
            })}
          </div>

          <div className="bg-white rounded-lg p-4 shadow-softer">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-2">Saisie rapide</div>
            <div className="flex gap-2 flex-wrap">
              {['repas','biberon','sieste','change','activite','note'].map(t => (
                <button key={t} onClick={()=>setShowForm(t)} className="btn-pill bg-teal-light text-teal-dark text-xs">
                  <Plus className="w-3 h-3" /> {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          {showForm && (
            <QuickForm type={showForm} child={child} onClose={()=>setShowForm(null)} onSubmit={quickAdd} />
          )}

          <div className="bg-white rounded-lg p-5 shadow-softer">
            <div className="flex items-center justify-between mb-3">
              <div className="font-extrabold text-lg">Journal de {child.prenom}</div>
              <span className="text-[10px] font-bold text-teal-dark bg-teal-light px-2 py-0.5 rounded-full">Temps réel</span>
            </div>
            <div>
              {trans.length === 0 && <div className="text-ink-muted text-sm">Aucune transmission</div>}
              {trans.map((t,i) => <TimelineEntry key={t.id} t={t} idx={i} canDelete onDelete={async(id)=>{ await api(`transmissions/${id}`, { method:'DELETE' }); loadAll(); }} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuickForm({ type, child, onClose, onSubmit }) {
  const meta = TYPE_META[type];
  const [titre, setTitre] = useState(meta.label);
  const [detail, setDetail] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl flex items-center justify-center" style={{ background: meta.bg, width: 42, height: 42 }}>
            <meta.icon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div className="flex-1">
            <div className="font-extrabold">{meta.label} · {child.prenom}</div>
            <div className="text-xs text-ink-muted">Saisie rapide en 2 clics</div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <input value={titre} onChange={e=>setTitre(e.target.value)} placeholder="Titre" className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 font-semibold text-sm" />
          <textarea value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Détail (optionnel)..." rows={3} className="w-full px-4 py-3 rounded-2xl bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 font-semibold text-sm resize-none" />
          {type === 'biberon' && (
            <div className="flex gap-2 flex-wrap">
              {['120ml','150ml','180ml','210ml','240ml'].map(v => (
                <button key={v} onClick={()=>setDetail(`${v} bu`)} className="btn-pill bg-coral/10 text-coral text-xs">{v}</button>
              ))}
            </div>
          )}
          {type === 'sieste' && (
            <div className="flex gap-2 flex-wrap">
              {['30 min','1h','1h30','2h'].map(v => (
                <button key={v} onClick={()=>setDetail(`Dort depuis ${v}`)} className="btn-pill bg-sky/10 text-sky text-xs">{v}</button>
              ))}
            </div>
          )}
          <button onClick={()=>onSubmit(type, titre, detail)} className="btn-pill w-full bg-teal text-white shadow-soft">
            <CheckCircle2 className="w-4 h-4" /> Enregistrer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ===== PRO: TACHES =====
function ProTaches() {
  const [tasks, setTasks] = useState([
    { id:1, label:'Désinfecter les tables', done: true },
    { id:2, label:'Préparer les couches', done: true },
    { id:3, label:'Ranger les jouets', done: false },
    { id:4, label:'Préparer le goûter', done: false },
    { id:5, label:'Mettre à jour les transmissions', done: false },
  ]);
  const done = tasks.filter(t=>t.done).length;
  const pct = (done/tasks.length)*100;
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-gradient-to-br from-violet to-[#6B4FD8] text-white rounded-lg p-6 shadow-soft">
        <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">Mes tâches</div>
        <div className="text-3xl font-extrabold mt-1">{done} / {tasks.length}</div>
        <div className="mt-3 h-2 rounded-full bg-white/20">
          <motion.div initial={{ width:0 }} animate={{ width: `${pct}%` }} className="h-full bg-white rounded-full" />
        </div>
      </div>
      <div className="bg-white rounded-lg p-4 shadow-softer space-y-2">
        {tasks.map(t => (
          <button key={t.id} onClick={()=>setTasks(tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x))}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${t.done?'bg-teal-light':'bg-bgsoft hover:bg-teal-light/50'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${t.done?'bg-teal text-white':'border-2 border-ink-muted'}`}>
              {t.done && <CheckCircle2 className="w-4 h-4" />}
            </div>
            <span className={`font-bold text-sm ${t.done?'line-through text-ink-muted':''}`}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== PARENT: SUIVI LIVE =====
function ParentLive({ user }) {
  const [enfants, setEnfants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [trans, setTrans] = useState([]);
  const [lastCount, setLastCount] = useState(0);
  const today = new Date().toISOString().slice(0,10);

  const load = async () => {
    try {
      if (enfants.length === 0) {
        const e = await api('enfants'); setEnfants(e.enfants);
        if (!selected && e.enfants[0]) setSelected(e.enfants[0].id);
      }
      if (selected) {
        const t = await api(`transmissions?date=${today}&enfant_id=${selected}`);
        if (lastCount && t.transmissions.length > lastCount) {
          toast.success(`Nouvelle transmission ! 🌺`);
        }
        setLastCount(t.transmissions.length);
        setTrans(t.transmissions);
      }
    } catch(e){ /* silent */ }
  };
  useEffect(() => { load(); const it = setInterval(load, 3000); return ()=>clearInterval(it); }, [selected, enfants.length]);

  const child = enfants.find(e => e.id === selected);
  const counts = {
    sieste: trans.filter(t=>t.type==='sieste').length,
    biberon: trans.filter(t=>t.type==='biberon').length,
    change: trans.filter(t=>t.type==='change').length,
  };

  return (
    <div className="space-y-4 animate-fade-up">
      {enfants.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {enfants.map(e => (
            <button key={e.id} onClick={()=>setSelected(e.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-pill text-sm font-bold flex-shrink-0 ${selected===e.id?'bg-teal text-white shadow-soft':'bg-white text-ink-muted'}`}>
              <Avatar enfant={e} size={28} /> {e.prenom}
            </button>
          ))}
        </div>
      )}

      {child && <ChildHeaderCard enfant={child} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatRow icon={Moon} label="Sieste" color="#42A5F5" bg="#E3F2FD" items={[{value:counts.sieste,label:"Aujourd'hui"}]} />
        <StatRow icon={Coffee} label="Biberon" color="#FF6B6B" bg="#FFE9E9" items={[{value:counts.biberon,label:"Aujourd'hui"}]} />
        <StatRow icon={Flower} label="Changes" color="#66BB6A" bg="#E8F5E9" items={[{value:counts.change,label:"Aujourd'hui"}]} />
      </div>

      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-extrabold text-lg">Journée de {child?.prenom}</div>
            <div className="text-xs text-ink-muted">En direct depuis la crèche 🌺</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-dark bg-teal-light px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" /> Live
          </span>
        </div>
        <div className="max-h-[500px] overflow-y-auto scrollbar-thin pr-2">
          {trans.length === 0 && (
            <div className="py-12 text-center text-ink-muted">
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-teal opacity-50" />
              <div className="text-sm">Pas encore de transmission aujourd'hui</div>
              <div className="text-xs mt-1">L'équipe partagera bientôt les moments de votre enfant</div>
            </div>
          )}
          {trans.map((t, i) => <TimelineEntry key={t.id} t={t} idx={i} />)}
          {trans.length > 0 && <TypingIndicator />}
        </div>
      </div>

      <ParentMessageBox user={user} />
    </div>
  );
}

function ParentMessageBox({ user }) {
  const [text, setText] = useState('');
  const send = async () => {
    if (!text.trim()) return;
    try { await api('messages', { method: 'POST', body: JSON.stringify({ contenu: text }) });
      toast.success('Message envoyé à la crèche'); setText('');
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="bg-white rounded-lg p-3 shadow-softer flex gap-2 sticky bottom-3 z-10">
      <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
        placeholder="Envoyer un message à l'équipe..." className="flex-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
      <button onClick={send} className="btn-pill bg-teal text-white shadow-soft"><Send className="w-4 h-4" /></button>
    </div>
  );
}

// ===== PARENT: JOURNAL =====
function ParentJournal() {
  const [enfants, setEnfants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [trans, setTrans] = useState([]);
  const today = new Date().toISOString().slice(0,10);
  useEffect(() => { (async()=>{
    const e = await api('enfants'); setEnfants(e.enfants);
    if (e.enfants[0]) {
      setSelected(e.enfants[0].id);
      const t = await api(`transmissions?date=${today}&enfant_id=${e.enfants[0].id}`);
      setTrans(t.transmissions);
    }
  })(); }, []);
  const child = enfants.find(e=>e.id===selected);
  const lastByType = useMemo(() => {
    const m = {}; trans.forEach(t => { if (!m[t.type]) m[t.type] = t; }); return m;
  }, [trans]);
  return (
    <div className="space-y-4 animate-fade-up">
      {child && <ChildHeaderCard enfant={child} />}
      <div className="activity-grid">
        {ACTIVITY_TYPES.map(t => {
          const last = lastByType[t];
          return <ActivityCard key={t} type={t} done={!!last} lastTime={last?fmtTime(last.heure):null} onClick={()=>{}} />;
        })}
      </div>
    </div>
  );
}

// ===== PARENT: PHOTOS =====
function ParentPhotos() {
  const photos = [
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400',
    'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400',
    'https://images.unsplash.com/photo-1518991669955-9c7e78ec80a4?w=400',
    'https://images.unsplash.com/photo-1607453998774-d533f65dac99?w=400',
    'https://images.unsplash.com/photo-1542037104857-ffbb0b9155fb?w=400',
    'https://images.unsplash.com/photo-1503944168849-8bf86b95eb1c?w=400',
  ];
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-1">Album photos</div>
        <div className="text-xs text-ink-muted">Sécurisé · Visible uniquement par vous 🌺</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <motion.div key={i} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}
            className="aspect-square rounded-lg overflow-hidden shadow-softer hover:shadow-soft hover:-translate-y-1 transition-all cursor-pointer">
            <img src={p} alt="" className="w-full h-full object-cover" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ===== PARENT: RESERVATIONS =====
function ParentReservations() {
  const days = Array.from({length:7}, (_,i)=>{
    const d = new Date(); d.setDate(d.getDate()+i+1); return d;
  });
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-3">Prochaines journées</div>
        <div className="space-y-2">
          {days.map((d,i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
              <div className="w-12 h-12 rounded-2xl bg-teal-light text-teal-dark flex flex-col items-center justify-center">
                <div className="text-[10px] font-bold uppercase">{d.toLocaleDateString('fr-FR',{weekday:'short'})}</div>
                <div className="text-lg font-extrabold leading-none">{d.getDate()}</div>
              </div>
              <div className="flex-1">
                <div className="font-bold capitalize">{d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}</div>
                <div className="text-xs text-ink-muted">8h00 → 17h30 · Groupe Tournesol</div>
              </div>
              <button className="btn-pill bg-coral/10 text-coral text-xs">Déclarer absence</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== PARENT: FACTURES =====
function ParentFactures() {
  const [factures, setFactures] = useState([]);
  useEffect(() => { (async()=>{const f=await api('factures'); setFactures(f.factures);})(); }, []);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-6 shadow-soft">
        <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">Total à régler</div>
        <div className="text-4xl font-extrabold mt-2">{fmtEur(factures.filter(f=>f.statut==='en_attente').reduce((s,f)=>s+f.montant,0))}</div>
        <button className="btn-pill bg-white text-teal-dark shadow-soft mt-3">Payer maintenant</button>
      </div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="flex items-center justify-between mb-3">
          <div className="font-extrabold text-lg">Mes factures</div>
          <button className="btn-pill bg-teal-light text-teal-dark text-xs"><FileText className="w-3 h-3" /> Export CAF</button>
        </div>
        <div className="space-y-2">
          {factures.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
              <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center"><FileText className="w-5 h-5 text-teal" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate-1">{f.famille}</div>
                <div className="text-xs text-ink-muted">{f.mois}</div>
              </div>
              <div className="font-extrabold">{fmtEur(f.montant)}</div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${f.statut==='payee'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>
                {f.statut==='payee'?'Payée':'En attente'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== Misc =====
function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-teal animate-spin" />
    </div>
  );
}

function PlaceholderView({ title }) {
  return (
    <div className="bg-white rounded-lg p-10 shadow-softer text-center animate-fade-up">
      <Sparkles className="w-12 h-12 mx-auto text-teal opacity-50 mb-3" />
      <div className="font-extrabold text-lg">{title}</div>
      <div className="text-sm text-ink-muted mt-1">Bientôt disponible dans TiKréol</div>
    </div>
  );
}

// ===== MAIN APP =====
function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bootLoaded, setBootLoaded] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tk_user') : null;
    const token = typeof window !== 'undefined' ? localStorage.getItem('tk_token') : null;
    if (stored && token) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
        setView(`${u.role}/${u.role==='admin'?'dashboard':u.role==='pro'?'pointage':'live'}`);
      } catch {}
    }
    setBootLoaded(true);
  }, []);

  const handleAuth = (u) => {
    setUser(u);
    setView(`${u.role}/${u.role==='admin'?'dashboard':u.role==='pro'?'pointage':'live'}`);
  };

  const logout = () => {
    localStorage.removeItem('tk_token');
    localStorage.removeItem('tk_user');
    setUser(null); setView(null);
  };

  if (!bootLoaded) return null;
  if (!user) return <LoginView onAuth={handleAuth} />;

  const titleMap = {
    'admin/dashboard': 'Tableau de bord',
    'admin/enfants': 'Enfants',
    'admin/presences': 'Fiche de présences',
    'admin/finances': 'Finances · CA',
    'admin/charges': 'Charges & Salaires',
    'admin/factures': 'Devis & Factures',
    'admin/employes': 'Employés',
    'admin/messagerie': 'Messagerie',
    'admin/settings': 'Administration',
    'pro/pointage': 'Pointage',
    'pro/activites': 'Activités enfants',
    'pro/taches': 'Mes tâches',
    'pro/documents': 'Mes documents',
    'parent/live': 'Suivi en direct',
    'parent/journal': 'Journal du jour',
    'parent/photos': 'Album photos',
    'parent/reservations': 'Réservations',
    'parent/factures': 'Mes factures',
    'parent/messagerie': 'Messagerie',
  };

  const renderView = () => {
    switch (view) {
      case 'admin/dashboard': return <AdminDashboard user={user} />;
      case 'admin/enfants': return <AdminEnfants />;
      case 'admin/presences': return <AdminPresences />;
      case 'admin/finances': return <AdminFinances />;
      case 'admin/charges': return <AdminCharges />;
      case 'admin/factures': return <AdminFactures />;
      case 'admin/employes': return <AdminEmployes />;
      case 'admin/messagerie': return <MessagerieView user={user} />;
      case 'admin/settings': return <PlaceholderView title="Paramètres administration" />;
      case 'pro/pointage': return <ProPointage user={user} />;
      case 'pro/activites': return <ProActivites user={user} />;
      case 'pro/taches': return <ProTaches />;
      case 'pro/documents': return <PlaceholderView title="Mes documents" />;
      case 'parent/live': return <ParentLive user={user} />;
      case 'parent/journal': return <ParentJournal />;
      case 'parent/photos': return <ParentPhotos />;
      case 'parent/reservations': return <ParentReservations />;
      case 'parent/factures': return <ParentFactures />;
      case 'parent/messagerie': return <MessagerieView user={user} />;
      default: return <Loading />;
    }
  };

  return (
    <div className="min-h-screen flex bg-bgsoft tk-main">
      <Sidebar user={user} view={view} setView={setView} open={menuOpen} setOpen={setMenuOpen} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} onLogout={logout} onMenu={()=>setMenuOpen(true)} title={titleMap[view] || ''} />
        <div className="px-4 md:px-8 pb-8 -mt-6 relative z-10">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

export default App;
