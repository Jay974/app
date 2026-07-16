'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Users, BarChart3, Calendar, FileText, MessageCircle, Settings,
  LogOut, Menu, Clock, Sparkles, Baby, Smile, Camera, Moon, Coffee,
  Utensils, Sun, Droplets, Music, Flower, Heart, CheckCircle2,
  Plus, Send, ChevronRight, X, TrendingUp, Euro, UserCheck, MapPin,
  ClipboardList, Briefcase, PiggyBank, Image as ImageIcon, Bell,
  Loader2, Mail, Lock, ArrowRight, Sparkle, Wallet, ChevronDown,
  Newspaper, AlertTriangle, Award, FileCheck, Layers, Tag as TagIcon,
  UtensilsCrossed, Package, Video, Paperclip, Trash2, Edit3, Save, Copy,
  Building2, CreditCard, ShieldCheck, Zap, Star, MessageSquare, User
} from 'lucide-react';
import { toast } from 'sonner';

const api = async (path, opts = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tk_token') : null;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
};

const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); } catch { return ''; } };
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

function Avatar({ enfant, user, size = 44 }) {
  const src = enfant || user || {};
  const color = src.avatar_color || (['#3ECDB5','#8B6BE8','#FFA726','#42A5F5','#66BB6A'][((src.prenom||'A').charCodeAt(0))%5]);
  return (
    <div className="flex items-center justify-center rounded-full font-extrabold text-white shadow-softer flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {initials(src?.prenom, src?.nom)}
    </div>
  );
}

// ===== TopBar with crèche switcher =====
function TopBar({ user, onLogout, onMenu, title, activeCreche, creches, onSelectCreche }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative tk-wave text-white">
      <div className="px-4 md:px-8 pt-4 pb-10 flex items-center justify-between relative z-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onMenu} className="md:hidden p-2 rounded-full bg-white/15 active:scale-95 flex-shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-bold opacity-80">TiMétis · Made in 974</div>
            <div className="text-xl md:text-2xl font-extrabold truncate-1">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {creches && creches.length > 1 && (
            <div className="relative">
              <button onClick={()=>setOpen(!open)} className="hidden md:flex items-center gap-2 bg-white/15 rounded-pill px-3 py-1.5 text-xs font-bold">
                <Building2 className="w-4 h-4" />
                <span className="truncate-1 max-w-[140px]">{activeCreche?.nom} · {activeCreche?.ville}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {open && (
                <div className="absolute right-0 top-full mt-2 bg-white text-ink rounded-2xl shadow-soft py-2 min-w-[220px] z-20">
                  {creches.map(c => (
                    <button key={c.id} onClick={()=>{ onSelectCreche(c.id); setOpen(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-teal-light text-sm font-semibold ${activeCreche?.id===c.id?'text-teal-dark bg-teal-light':''}`}>
                      <div className="font-extrabold">{c.nom}</div>
                      <div className="text-xs text-ink-muted">{c.ville}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="p-2 rounded-full bg-white/15 active:scale-95 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral" />
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-white/15 rounded-pill pl-2 pr-3 py-1.5">
            <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center text-xs font-extrabold">
              {initials(user?.prenom, user?.nom)}
            </div>
            <div className="text-xs">
              <div className="font-bold leading-tight truncate-1">{user?.prenom}</div>
              <div className="text-[10px] opacity-80 capitalize">{user?.role?.replace('_', ' ')}</div>
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

// ===== Sidebar =====
function Sidebar({ user, view, setView, open, setOpen }) {
  const menus = {
    super_admin: [
      { key: 'super/dashboard', label: 'Tour de contrôle', icon: BarChart3 },
      { key: 'super/clients', label: 'Mes clients', icon: Users },
      { key: 'super/feedbacks', label: 'Feedbacks', icon: MessageSquare },
      { key: 'super/settings', label: 'Paramètres', icon: Settings },
    ],
    admin: [
      { key: 'admin/dashboard', label: 'Tour de contrôle', icon: Home },
      { key: 'admin/monitoring', label: 'Monitoring live', icon: Zap },
      { key: 'admin/enfants', label: 'Gestion des enfants', icon: Baby },
      { key: 'admin/familles', label: 'Familles', icon: Users },
      { key: 'admin/groupes', label: 'Groupes', icon: Layers },
      { key: 'admin/tags', label: 'Tags', icon: TagIcon },
      { key: 'admin/presences', label: 'Planning enfants', icon: ClipboardList },
      { key: 'admin/synthese', label: 'Synthèse hebdo', icon: FileCheck },
      { key: 'admin/nourriture', label: 'Nourriture', icon: UtensilsCrossed },
      { key: 'admin/rappels', label: 'Rappels', icon: AlertTriangle },
      { key: 'admin/news', label: 'News', icon: Newspaper },
      { key: 'admin/documents', label: 'Documents', icon: FileText },
      { key: 'admin/devis', label: 'Devis', icon: Copy },
      { key: 'admin/factures', label: 'Factures', icon: FileText },
      { key: 'admin/finances', label: 'Finances · CA', icon: TrendingUp },
      { key: 'admin/charges', label: 'Charges & Salaires', icon: PiggyBank },
      { key: 'admin/employes', label: 'Employés', icon: Briefcase },
      { key: 'admin/planning-employes', label: 'Planning employés', icon: Calendar },
      { key: 'admin/messagerie', label: 'Messagerie', icon: MessageCircle },
      { key: 'admin/alarme', label: 'Alarme incendie', icon: AlertTriangle },
      { key: 'admin/abonnement', label: 'Abonnement', icon: CreditCard },
      { key: 'admin/feedback', label: 'Envoyer feedback', icon: Star },
    ],
    pro: [
      { key: 'pro/profil', label: 'Mon profil', icon: User },
      { key: 'pro/pointage', label: 'Pointage', icon: Clock },
      { key: 'pro/activites', label: 'Activités enfants', icon: Sparkles },
      { key: 'pro/enfants', label: 'Gestion enfants', icon: Baby },
      { key: 'pro/nourriture', label: 'Nourriture', icon: UtensilsCrossed },
      { key: 'pro/rappels', label: 'Rappels', icon: AlertTriangle },
      { key: 'pro/messagerie', label: 'Messagerie parents', icon: MessageCircle },
      { key: 'pro/documents', label: 'Documents', icon: FileText },
      { key: 'pro/news', label: 'News', icon: Newspaper },
      { key: 'pro/taches', label: 'Mes tâches', icon: CheckCircle2 },
      { key: 'pro/feedback', label: 'Envoyer feedback', icon: Star },
    ],
    parent: [
      { key: 'parent/live', label: 'Suivi en direct', icon: Sparkles },
      { key: 'parent/journal', label: 'Journal du jour', icon: ClipboardList },
      { key: 'parent/photos', label: 'Album photos', icon: ImageIcon },
      { key: 'parent/reservations', label: 'Réservations', icon: Calendar },
      { key: 'parent/nourriture', label: 'Menu semaine', icon: UtensilsCrossed },
      { key: 'parent/news', label: 'Actualités', icon: Newspaper },
      { key: 'parent/messagerie', label: 'Messagerie', icon: MessageCircle },
      { key: 'parent/documents', label: 'Documents', icon: FileText },
      { key: 'parent/factures', label: 'Mes factures', icon: Wallet },
      { key: 'parent/feedback', label: 'Envoyer feedback', icon: Star },
    ],
  };
  const items = menus[user.role] || [];

  const content = (
    <div className="h-full bg-white flex flex-col w-64">
      <div className="px-6 py-5 flex items-center gap-2 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-teal flex items-center justify-center shadow-soft">
          <Baby className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="font-extrabold text-lg text-ink leading-tight">TiMétis</div>
          <div className="text-[10px] text-ink-muted font-bold uppercase tracking-wider">Made in 974</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3">
        {items.map((it) => {
          const Icon = it.icon;
          const active = view === it.key;
          return (
            <button key={it.key} onClick={() => { setView(it.key); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 my-0.5 rounded-r-pill text-sm font-bold transition-all
                ${active ? 'bg-teal text-white shadow-soft' : 'text-ink-muted hover:bg-teal-light hover:text-teal-dark'}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate-1 text-left text-[13px]">{it.label}</span>
            </button>
          );
        })}
      </div>
      <div className="m-3 px-3 py-3 rounded-2xl bg-teal-light text-teal-dark flex-shrink-0">
        <div className="text-[11px] font-extrabold uppercase tracking-wider">Plan TiMétis</div>
        <div className="text-sm font-bold">79 € / mois</div>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 24 }}
              className="fixed top-0 left-0 h-screen z-50 md:hidden shadow-2xl">{content}</motion.aside>
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
  const [role, setRole] = useState('admin');
  const [crecheNom, setCrecheNom] = useState('');
  const [crecheVille, setCrecheVille] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const body = mode === 'login' ? { email, password: pwd } : { email, password: pwd, prenom, nom, role, creche_nom: crecheNom, creche_ville: crecheVille };
      const data = await api(`auth/${mode}`, { method: 'POST', body: JSON.stringify(body) });
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
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] shadow-soft p-6 md:p-10 w-full max-w-md relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-teal flex items-center justify-center shadow-soft">
            <Baby className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-2xl text-ink leading-tight">TiMétis</div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-teal">Made in 974 · 79€/mois</div>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold mt-6 mb-1">{mode === 'login' ? 'Bon retour 👋' : 'Créer ma crèche'}</h1>
        <p className="text-ink-muted text-sm mb-5">Gestion de crèche pensée pour La Réunion 🌺</p>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input value={prenom} onChange={(e)=>setPrenom(e.target.value)} required placeholder="Prénom" className="px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
                <input value={nom} onChange={(e)=>setNom(e.target.value)} required placeholder="Nom" className="px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
              </div>
              <select value={role} onChange={(e)=>setRole(e.target.value)} className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold">
                <option value="admin">👑 Directrice / Propriétaire de crèche</option>
                <option value="parent">👨‍👩‍👦 Parent</option>
              </select>
              {role === 'admin' && (
                <div className="grid grid-cols-2 gap-3">
                  <input value={crecheNom} onChange={(e)=>setCrecheNom(e.target.value)} placeholder="Nom crèche" className="px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
                  <input value={crecheVille} onChange={(e)=>setCrecheVille(e.target.value)} placeholder="Ville" className="px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
                </div>
              )}
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{mode === 'login' ? 'Se connecter' : 'Créer ma crèche'} <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-sm text-teal-dark font-bold mt-4 hover:underline">
          {mode === 'login' ? "Pas de compte ? Créer une crèche" : 'Déjà inscrit ? Se connecter'}
        </button>
        <div className="mt-5 pt-5 border-t border-bgsoft">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-3">Comptes démo</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => quick('jeanchrisoulia@gmail.com', 'TiMetis974!')} className="btn-pill bg-ink text-white text-xs">
              <ShieldCheck className="w-3 h-3" /> Super Admin
            </button>
            <button onClick={() => quick('admin@demo.re', 'demo1234')} className="btn-pill bg-teal-light text-teal-dark text-xs">👑 Client Admin</button>
            <button onClick={() => quick('pro@demo.re', 'demo1234')} className="btn-pill bg-violet/10 text-violet text-xs">👩‍⚕️ Pro</button>
            <button onClick={() => quick('parent@demo.re', 'demo1234')} className="btn-pill bg-coral/10 text-coral text-xs">👨‍👩‍👦 Parent</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ===== Common cards =====
function StatRow({ icon: Icon, label, color, bg, items }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg p-4 md:p-5 shadow-softer flex items-center gap-4 relative overflow-hidden">
      <div className="rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg, width: 56, height: 56 }}>
        <Icon className="w-7 h-7" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color }}>{label}</div>
        <div className="flex gap-4 mt-1">
          {items.map((it, i) => (
            <div key={i}>
              <div className="text-2xl font-extrabold text-ink leading-none">{it.value}</div>
              <div className="text-[10px] text-ink-muted font-bold uppercase tracking-wider mt-1 truncate-1">{it.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-20" style={{ background: color }} />
    </motion.div>
  );
}

function TimelineEntry({ t, idx, canDelete, onDelete }) {
  const meta = TYPE_META[t.type] || TYPE_META.note;
  const Icon = meta.icon;
  return (
    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
      className="relative pl-8 pb-4">
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
              {t.visible_parents && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bgsoft text-ink-muted">👁 Parents</span>}
              <span className="text-[10px] text-ink-muted">par {t.auteur_nom}</span>
              {canDelete && <button onClick={() => onDelete(t.id)} className="ml-auto text-ink-muted hover:text-coral"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChildHeaderCard({ enfant, onAdd, tags }) {
  if (!enfant) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg p-4 shadow-softer flex items-center gap-4">
      <Avatar enfant={enfant} size={56} />
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-lg text-ink truncate-1">{enfant.prenom}</div>
        <div className="text-sm text-ink-muted">{ageStr(enfant.date_naissance)} · {enfant.groupe}</div>
        {tags && tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {tags.map(t => <span key={t.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.couleur+'22', color: t.couleur }}>{t.nom}</span>)}
          </div>
        )}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="w-10 h-10 rounded-full bg-teal text-white flex items-center justify-center shadow-soft active:scale-95">
          <Plus className="w-5 h-5" />
        </button>
      )}
    </motion.div>
  );
}

function ActivityCard({ type, lastTime, done, onClick }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={onClick}
      className={`activity-card text-left w-full ${done ? 'done' : ''}`}
      style={{ background: done ? meta.bg : '#fff' }}>
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

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 pl-8 py-2">
      <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
      <span className="text-xs text-ink-muted ml-2 font-semibold">L'équipe écrit...</span>
    </div>
  );
}

function Loading() { return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal animate-spin" /></div>; }
function PlaceholderView({ title, subtitle, icon: Icon = Sparkles }) {
  return (
    <div className="bg-white rounded-lg p-10 shadow-softer text-center animate-fade-up">
      <Icon className="w-12 h-12 mx-auto text-teal opacity-50 mb-3" />
      <div className="font-extrabold text-lg">{title}</div>
      <div className="text-sm text-ink-muted mt-1">{subtitle || 'Bientôt disponible dans TiMétis'}</div>
    </div>
  );
}

// ===== Media uploader (Cloudinary) =====
function MediaUploader({ folder = 'chat', onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true); setProgress(0);
    try {
      const sig = await api('media/sign', { method: 'POST', body: JSON.stringify({ folder }) });
      if (!sig.configured) {
        toast.error("Cloudinary non configuré — l'envoi de média est désactivé.");
        setUploading(false);
        return;
      }
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', sig.api_key);
      form.append('timestamp', sig.timestamp);
      form.append('signature', sig.signature);
      form.append('folder', sig.folder);
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded/e.total)*100)); };
      xhr.onload = () => {
        setUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          onUpload({ url: data.secure_url, type: data.resource_type, format: data.format, bytes: data.bytes });
          toast.success('Média envoyé');
        } else {
          toast.error('Échec upload');
        }
      };
      xhr.onerror = () => { setUploading(false); toast.error('Erreur réseau'); };
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloud_name}/auto/upload`);
      xhr.send(form);
    } catch (e) { setUploading(false); toast.error(e.message); }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e)=>handleFile(e.target.files?.[0])} />
      <button type="button" onClick={()=>inputRef.current?.click()} disabled={uploading}
        className="btn-pill bg-bgsoft text-ink-muted text-xs hover:bg-teal-light hover:text-teal-dark">
        {uploading ? <><Loader2 className="w-3 h-3 animate-spin" /> {progress}%</> : <><Paperclip className="w-3 h-3" /> Photo/Vidéo</>}
      </button>
    </>
  );
}

// ===== SUPER ADMIN =====
function SuperDashboard() {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  useEffect(() => { (async()=>{
    try { const s = await api('super/stats'); const c = await api('super/clients'); setStats(s.stats); setClients(c.clients); } catch(e){ toast.error(e.message); }
  })(); }, []);
  if (!stats) return <Loading />;
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-5 shadow-soft relative overflow-hidden">
          <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">MRR</div>
          <div className="text-3xl font-extrabold mt-2">{fmtEur(stats.mrr)}</div>
          <div className="text-xs opacity-80 mt-1">/ mois récurrent</div>
          <TrendingUp className="absolute right-3 top-3 w-6 h-6 opacity-40" />
        </div>
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Clients</div>
          <div className="text-3xl font-extrabold mt-2">{stats.clients}</div>
          <div className="text-xs text-teal-dark mt-1 font-bold">{stats.actifs} actifs · {stats.essais} essais</div>
        </div>
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Crèches</div>
          <div className="text-3xl font-extrabold mt-2">{stats.creches}</div>
          <Building2 className="w-5 h-5 text-violet mt-1" />
        </div>
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Enfants suivis</div>
          <div className="text-3xl font-extrabold mt-2">{stats.enfants}</div>
          <Baby className="w-5 h-5 text-coral mt-1" />
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-4">Mes clients</div>
        <div className="space-y-3">
          {clients.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
              <Avatar user={c} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-extrabold truncate-1">{c.prenom} {c.nom}</div>
                <div className="text-xs text-ink-muted truncate-1">{c.email} · {c.creches?.length || 0} crèche(s) · {c.nb_enfants} enfants</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.subscription?.status==='active'?'bg-teal-light text-teal-dark':c.subscription?.status==='trialing'?'bg-amber/20 text-amber':'bg-coral/20 text-coral'}`}>
                {c.subscription?.status || 'Aucun'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuperClients() {
  const [clients, setClients] = useState([]);
  useEffect(() => { (async()=>{const c=await api('super/clients'); setClients(c.clients);})(); }, []);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up">
      {clients.map(c => (
        <div key={c.id} className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center gap-3 mb-3">
            <Avatar user={c} size={48} />
            <div className="flex-1 min-w-0">
              <div className="font-extrabold truncate-1">{c.prenom} {c.nom}</div>
              <div className="text-xs text-ink-muted truncate-1">{c.email}</div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.subscription?.status==='active'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>
              {c.subscription?.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-bgsoft">
            <div><div className="text-ink-muted">Crèches</div><div className="font-bold">{c.creches?.length}</div></div>
            <div><div className="text-ink-muted">Enfants</div><div className="font-bold">{c.nb_enfants}</div></div>
          </div>
          <div className="mt-3 space-y-1">
            {(c.creches||[]).map(cr => (
              <div key={cr.id} className="text-xs bg-bgsoft rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="font-bold truncate-1">{cr.nom} · {cr.ville}</span>
                <span className="text-ink-muted">{cr.capacite} places</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SuperFeedbacks() {
  const [feedbacks, setFeedbacks] = useState([]);
  useEffect(() => { (async()=>{try{const f=await api('feedbacks'); setFeedbacks(f.feedbacks||[]);}catch(e){}})(); }, []);
  return (
    <div className="space-y-3 animate-fade-up">
      {feedbacks.length === 0 && <PlaceholderView title="Aucun feedback pour l'instant" icon={MessageSquare} />}
      {feedbacks.map(f => (
        <div key={f.id} className="bg-white rounded-lg p-4 shadow-softer">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-ink-muted capitalize">{f.from_role} · {f.from_nom}</span>
            <div className="flex">{Array.from({length: 5}).map((_,i)=><Star key={i} className={`w-3 h-3 ${i<f.rating?'fill-amber text-amber':'text-bgsoft'}`} />)}</div>
          </div>
          <div className="text-sm">{f.message}</div>
        </div>
      ))}
    </div>
  );
}

// ===== ADMIN DASHBOARD =====
function AdminDashboard({ user, activeCId }) {
  const [stats, setStats] = useState(null);
  const [transmissions, setTransmissions] = useState([]);
  const [enfants, setEnfants] = useState([]);
  const load = async () => {
    try {
      const suffix = activeCId ? `?creche_id=${activeCId}` : '';
      const [s, t, e] = await Promise.all([
        api('dashboard/stats'+suffix),
        api(`transmissions?date=${new Date().toISOString().slice(0,10)}${activeCId?`&creche_id=${activeCId}`:''}`),
        api('enfants'+suffix),
      ]);
      setStats(s.stats); setTransmissions(t.transmissions); setEnfants(e.enfants);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); const it = setInterval(load, 5000); return () => clearInterval(it); }, [activeCId]);
  if (!stats) return <Loading />;
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatRow icon={Moon} label="Siestes" color="#42A5F5" bg="#E3F2FD" items={[
          { value: stats.siestes, label: "Aujourd'hui" }, { value: enfants.length, label: 'Enfants' }, { value: '2h', label: 'Moy.' } ]} />
        <StatRow icon={Coffee} label="Biberons" color="#FF6B6B" bg="#FFE9E9" items={[
          { value: stats.biberons, label: "Aujourd'hui" }, { value: '180ml', label: 'Moy.' }, { value: '6', label: 'Prévus' } ]} />
        <StatRow icon={Flower} label="Changes" color="#66BB6A" bg="#E8F5E9" items={[
          { value: stats.changes, label: "Aujourd'hui" }, { value: stats.repas, label: 'Repas' }, { value: stats.activites, label: 'Activités' } ]} />
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
            {transmissions.length === 0 && <div className="text-ink-muted text-sm">Aucune transmission</div>}
            {transmissions.map((t, i) => <TimelineEntry key={t.id} t={t} idx={i} />)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-ink to-[#1A202C] text-white rounded-lg p-5 shadow-softer relative overflow-hidden">
            <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-70">Taux d'occupation</div>
            <div className="text-4xl font-extrabold mt-1">{stats.taux_occupation}%</div>
            <div className="mt-3 h-2 rounded-full bg-white/15">
              <motion.div initial={{ width: 0 }} animate={{ width: `${stats.taux_occupation}%` }} className="h-full bg-teal rounded-full" />
            </div>
            <div className="text-xs opacity-70 mt-2">{stats.enfants_total} enfants inscrits</div>
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

// ===== ADMIN ENFANTS =====
function AdminEnfants({ activeCId }) {
  const [enfants, setEnfants] = useState([]);
  const [filter, setFilter] = useState('Tous');
  const [showAdd, setShowAdd] = useState(false);
  const [tags, setTags] = useState([]);
  const load = async () => {
    try {
      const suffix = activeCId ? `?creche_id=${activeCId}` : '';
      const d = await api('enfants'+suffix); setEnfants(d.enfants);
      const t = await api('tags'+suffix); setTags(t.tags);
    } catch(e){ toast.error(e.message); }
  };
  useEffect(() => { load(); }, [activeCId]);
  const groupes = ['Tous', ...Array.from(new Set(enfants.map(e => e.groupe)))];
  const filtered = filter === 'Tous' ? enfants : enfants.filter(e => e.groupe === filter);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {groupes.map(g => (
            <button key={g} onClick={() => setFilter(g)} className={`btn-pill text-xs flex-shrink-0 ${filter === g ? 'bg-teal text-white' : 'bg-white text-ink-muted'}`}>{g}</button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Ajouter</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((e, i) => {
          const eTags = tags.filter(t => (e.tags||[]).includes(t.id));
          return (
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
              {eTags.length > 0 && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {eTags.map(t => <span key={t.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.couleur+'22', color: t.couleur }}>{t.nom}</span>)}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-bgsoft grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-ink-muted">Contrat</div><div className="font-bold">{e.contrat_heures}h / sem</div></div>
                <div><div className="text-ink-muted">Mensualité</div><div className="font-bold text-teal-dark">{fmtEur(e.mensualite)}</div></div>
              </div>
            </motion.div>
          );
        })}
      </div>
      {showAdd && <AddChildModal activeCId={activeCId} onClose={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddChildModal({ activeCId, onClose }) {
  const [f, setF] = useState({ prenom: '', groupe: 'Tournesol', contrat_heures: 35, mensualite: 520, avatar_color: '#3ECDB5' });
  const palette = ['#3ECDB5','#FF6B6B','#FFA726','#8B6BE8','#42A5F5','#66BB6A','#F06292'];
  const submit = async (e) => {
    e.preventDefault();
    try { await api('enfants', { method: 'POST', body: JSON.stringify({ ...f, creche_id: activeCId }) }); toast.success('Enfant ajouté'); onClose(); }
    catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="font-extrabold text-lg">Nouvel enfant</div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input value={f.prenom} onChange={e=>setF({...f,prenom:e.target.value})} required placeholder="Prénom" className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 font-semibold text-sm" />
          <select value={f.groupe} onChange={e=>setF({...f,groupe:e.target.value})} className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none font-semibold text-sm">
            <option>Tournesol</option><option>Coquelicot</option><option>Marguerite</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={f.contrat_heures} onChange={e=>setF({...f,contrat_heures:+e.target.value})} placeholder="H/sem" className="px-4 py-3 rounded-pill bg-bgsoft outline-none font-semibold text-sm" />
            <input type="number" value={f.mensualite} onChange={e=>setF({...f,mensualite:+e.target.value})} placeholder="€/mois" className="px-4 py-3 rounded-pill bg-bgsoft outline-none font-semibold text-sm" />
          </div>
          <div><div className="text-xs font-bold text-ink-muted mb-2">Couleur avatar</div>
            <div className="flex gap-2 flex-wrap">
              {palette.map(c => <button type="button" key={c} onClick={()=>setF({...f,avatar_color:c})} className={`w-9 h-9 rounded-full ${f.avatar_color===c?'ring-4 ring-offset-2 ring-teal':''}`} style={{ background: c }} />)}
            </div>
          </div>
          <button className="btn-pill w-full bg-teal text-white shadow-soft">Créer</button>
        </form>
      </motion.div>
    </div>
  );
}

// ===== FAMILLES / GROUPES / TAGS =====
function AdminFamilles({ activeCId }) {
  const [items, setItems] = useState([]);
  useEffect(() => { (async()=>{try{const d=await api('familles'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.familles);}catch(e){toast.error(e.message);}})(); }, [activeCId]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up">
      {items.map(f => (
        <div key={f.id} className="bg-white rounded-lg p-5 shadow-softer">
          <div className="font-extrabold text-lg">{f.nom}</div>
          <div className="text-xs text-ink-muted">{f.tel} · {f.adresse}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div><div className="text-ink-muted">Parents</div><div className="font-bold">{(f.parents||[]).length}</div></div>
            <div><div className="text-ink-muted">Enfants</div><div className="font-bold">{(f.enfants||[]).length}</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminGroupes({ activeCId }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try {const d=await api('groupes'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.groupes);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouveau groupe</button></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map(g => (
          <div key={g.id} className="bg-white rounded-lg p-5 shadow-softer">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: g.couleur+'22' }}><Layers className="w-5 h-5" style={{ color: g.couleur }} /></div>
            <div className="font-extrabold text-lg mt-3">{g.nom}</div>
            <div className="text-xs text-ink-muted mt-1">{g.tranche_age}</div>
            <div className="text-sm font-bold mt-2">Capacité : {g.capacite}</div>
          </div>
        ))}
      </div>
      {showAdd && <SimpleAddModal title="Nouveau groupe" fields={[{k:'nom',l:'Nom'},{k:'tranche_age',l:'Tranche âge'},{k:'capacite',l:'Capacité',type:'number'},{k:'couleur',l:'Couleur (hex)'}]} onSubmit={async(d)=>{await api('groupes',{method:'POST',body:JSON.stringify({...d,creche_id:activeCId})});}} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

function AdminTags({ activeCId }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try {const d=await api('tags'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.tags);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouveau tag</button></div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="flex gap-2 flex-wrap">
          {items.map(t => (
            <span key={t.id} className="text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: t.couleur+'22', color: t.couleur }}>{t.nom}</span>
          ))}
        </div>
      </div>
      {showAdd && <SimpleAddModal title="Nouveau tag" fields={[{k:'nom',l:'Nom'},{k:'couleur',l:'Couleur (hex)',default:'#3ECDB5'}]} onSubmit={async(d)=>{await api('tags',{method:'POST',body:JSON.stringify({...d,creche_id:activeCId})});}} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

function SimpleAddModal({ title, fields, onSubmit, onClose }) {
  const [f, setF] = useState(() => Object.fromEntries(fields.map(x=>[x.k, x.default||''])));
  const submit = async (e) => { e.preventDefault(); try { await onSubmit(f); toast.success('Créé'); onClose(); } catch(e){ toast.error(e.message); } };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="font-extrabold text-lg">{title}</div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {fields.map(x => (
            <input key={x.k} type={x.type||'text'} value={f[x.k]||''} onChange={e=>setF({...f,[x.k]:x.type==='number'?+e.target.value:e.target.value})} placeholder={x.l} className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 font-semibold text-sm" />
          ))}
          <button className="btn-pill w-full bg-teal text-white shadow-soft">Créer</button>
        </form>
      </motion.div>
    </div>
  );
}

// ===== FINANCES / CHARGES / FACTURES =====
function AdminFinances({ activeCId }) {
  const [stats, setStats] = useState(null);
  const [factures, setFactures] = useState([]);
  useEffect(() => { (async()=>{try{const s=await api('dashboard/stats'+(activeCId?`?creche_id=${activeCId}`:'')); const f=await api('factures'+(activeCId?`?creche_id=${activeCId}`:'')); setStats(s.stats); setFactures(f.factures);}catch(e){toast.error(e.message);}})(); }, [activeCId]);
  if (!stats) return <Loading />;
  const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  const chart = months.map((m,i) => ({ m, v: 1200 + Math.round(Math.sin(i)*400 + i*150 + stats.ca_attendu/12) }));
  const maxV = Math.max(...chart.map(x=>x.v));
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-5 shadow-softer relative overflow-hidden">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-teal">CA Encaissé</div>
          <div className="text-3xl font-extrabold mt-2">{fmtEur(stats.ca_mensuel)}</div>
          <div className="text-xs text-ink-muted mt-1">Sur {fmtEur(stats.ca_attendu)}</div>
          <Euro className="absolute right-4 top-4 w-7 h-7 text-teal opacity-30" />
        </div>
        <div className="bg-white rounded-lg p-5 shadow-softer relative overflow-hidden">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-violet">Charges CGSS</div>
          <div className="text-3xl font-extrabold mt-2">{fmtEur(stats.ca_mensuel * 0.45)}</div>
          <div className="text-xs text-ink-muted mt-1">~45% + salarial 21%</div>
          <PiggyBank className="absolute right-4 top-4 w-7 h-7 text-violet opacity-30" />
        </div>
        <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-5 shadow-soft relative overflow-hidden">
          <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">Résultat net</div>
          <div className="text-3xl font-extrabold mt-2">{fmtEur(stats.ca_mensuel * 0.34)}</div>
          <TrendingUp className="absolute right-4 top-4 w-7 h-7 opacity-30" />
        </div>
      </div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-4">Évolution CA · 12 mois</div>
        <div className="flex items-end gap-2 h-44">
          {chart.map((c, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div initial={{ height: 0 }} animate={{ height: `${(c.v/maxV)*100}%` }} transition={{ delay: i*0.05 }} className="w-full rounded-t-lg bg-gradient-to-t from-teal to-teal/40" />
              <div className="text-[10px] font-bold text-ink-muted">{c.m}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminCharges({ activeCId }) {
  const [employes, setEmployes] = useState([]);
  useEffect(() => { (async()=>{try{const e=await api('employes'+(activeCId?`?creche_id=${activeCId}`:'')); setEmployes(e.employes);}catch(e){}})(); }, [activeCId]);
  const brut = 1800;
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {employes.map(e => (
          <div key={e.id} className="bg-white rounded-lg p-5 shadow-softer">
            <div className="flex items-center gap-3 mb-3">
              <Avatar user={e} size={40} />
              <div><div className="font-extrabold truncate-1">{e.prenom} {e.nom}</div><div className="text-xs text-ink-muted">Auxiliaire</div></div>
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
      </div>
    </div>
  );
}

// ===== DEVIS =====
function AdminDevis({ activeCId }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try {const d=await api('devis'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.devis);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouveau devis</button></div>
      <div className="bg-white rounded-lg shadow-softer">
        {items.length === 0 && <div className="p-10 text-center text-ink-muted">Aucun devis pour l'instant</div>}
        {items.map(d => (
          <div key={d.id} className="p-4 border-b border-bgsoft last:border-0 flex items-center gap-3 hover:bg-bgsoft transition">
            <div className="w-10 h-10 rounded-xl bg-violet/10 flex items-center justify-center"><Copy className="w-5 h-5 text-violet" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate-1">{d.numero} · {d.famille}</div>
              <div className="text-xs text-ink-muted">Valide jusqu'au {fmtDate(d.valide_jusqu)}</div>
            </div>
            <div className="font-extrabold">{fmtEur(d.total_ttc)}</div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${d.statut==='accepte'?'bg-teal-light text-teal-dark':d.statut==='refuse'?'bg-coral/20 text-coral':d.statut==='envoye'?'bg-sky/20 text-sky':'bg-bgsoft text-ink-muted'}`}>{d.statut}</span>
          </div>
        ))}
      </div>
      {showAdd && <DocumentEditorModal type="devis" activeCId={activeCId} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

function AdminFactures({ activeCId }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try {const d=await api('factures'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.factures);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  const send = async (id) => { try { await api(`factures/${id}/send`, { method: 'POST' }); toast.success('Facture envoyée'); load(); } catch(e){ toast.error(e.message); } };
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouvelle facture</button></div>
      <div className="bg-white rounded-lg shadow-softer">
        {items.map(f => (
          <div key={f.id} className="p-4 border-b border-bgsoft last:border-0 flex items-center gap-3 hover:bg-bgsoft transition">
            <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center"><FileText className="w-5 h-5 text-teal" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate-1">{f.numero||'F-—'} · {f.famille}</div>
              <div className="text-xs text-ink-muted">{f.mois} · Échéance {fmtDate(f.echeance)}</div>
            </div>
            <div className="font-extrabold">{fmtEur(f.total_ttc||f.montant)}</div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${f.statut==='payee'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>{f.statut==='payee'?'Payée':'En attente'}</span>
            {!f.envoyee && <button onClick={()=>send(f.id)} className="btn-pill bg-teal text-white text-xs"><Send className="w-3 h-3" /></button>}
          </div>
        ))}
      </div>
      {showAdd && <DocumentEditorModal type="facture" activeCId={activeCId} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

function DocumentEditorModal({ type, activeCId, onClose }) {
  const [familles, setFamilles] = useState([]);
  const [famille_id, setFamId] = useState('');
  const [articles, setArticles] = useState([{ description: '', quantite: 1, prix_unit: 0, tva: 0 }]);
  const [valide, setValide] = useState(new Date(Date.now()+30*86400000).toISOString().slice(0,10));
  useEffect(() => { (async()=>{try{const d=await api('familles'+(activeCId?`?creche_id=${activeCId}`:'')); setFamilles(d.familles);}catch(e){}})(); }, [activeCId]);
  const total = articles.reduce((s,a)=>s+((+a.prix_unit||0)*(+a.quantite||1)),0);
  const addLine = () => setArticles([...articles, { description: '', quantite: 1, prix_unit: 0, tva: 0 }]);
  const removeLine = (i) => setArticles(articles.filter((_,x)=>x!==i));
  const setLine = (i, k, v) => setArticles(articles.map((a,x)=>x===i?{...a,[k]:v}:a));
  const submit = async () => {
    try {
      const famille = familles.find(f=>f.id===famille_id);
      const body = { creche_id: activeCId, famille_id, famille: famille?.nom||'', articles, ...(type==='devis'?{valide_jusqu:valide,statut:'brouillon'}:{echeance:valide,mois:new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}) };
      await api(type==='devis'?'devis':'factures', { method: 'POST', body: JSON.stringify(body) });
      toast.success(type==='devis'?'Devis créé':'Facture créée'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
        <div className="flex items-center justify-between mb-4">
          <div><div className="font-extrabold text-xl">{type==='devis'?'Nouveau devis':'Nouvelle facture'}</div><div className="text-xs text-ink-muted">TiMétis · Made in 974</div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <select value={famille_id} onChange={e=>setFamId(e.target.value)} className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none font-semibold text-sm">
            <option value="">— Choisir une famille —</option>
            {familles.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
          <input type="date" value={valide} onChange={e=>setValide(e.target.value)} className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none font-semibold text-sm" />
          <div className="space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">Articles</div>
            {articles.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input value={a.description} onChange={e=>setLine(i,'description',e.target.value)} placeholder="Description" className="col-span-6 px-3 py-2 rounded-xl bg-bgsoft outline-none font-semibold text-xs" />
                <input type="number" value={a.quantite} onChange={e=>setLine(i,'quantite',+e.target.value)} placeholder="Qté" className="col-span-2 px-3 py-2 rounded-xl bg-bgsoft outline-none font-semibold text-xs" />
                <input type="number" value={a.prix_unit} onChange={e=>setLine(i,'prix_unit',+e.target.value)} placeholder="PU €" className="col-span-3 px-3 py-2 rounded-xl bg-bgsoft outline-none font-semibold text-xs" />
                <button onClick={()=>removeLine(i)} className="col-span-1 text-coral"><Trash2 className="w-4 h-4 mx-auto" /></button>
              </div>
            ))}
            <button onClick={addLine} className="btn-pill bg-teal-light text-teal-dark text-xs"><Plus className="w-3 h-3" /> Ligne</button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-teal-light">
            <div className="font-extrabold text-teal-dark">Total TTC</div>
            <div className="text-2xl font-extrabold text-teal-dark">{fmtEur(total)}</div>
          </div>
          <button onClick={submit} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </motion.div>
    </div>
  );
}

// ===== EMPLOYES / PLANNING EMPLOYES / PRESENCES =====
function AdminEmployes({ activeCId }) {
  const [employes, setEmployes] = useState([]);
  const [pointages, setPointages] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try{const e=await api('employes'+(activeCId?`?creche_id=${activeCId}`:'')); const p=await api('pointages'+(activeCId?`?creche_id=${activeCId}`:'')); setEmployes(e.employes); setPointages(p.pointages);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouvel employé</button></div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-3">Pointages du jour</div>
        <div className="space-y-2">
          {employes.map(e => {
            const p = pointages.find(x => x.employe_id === e.id && x.date === new Date().toISOString().slice(0,10));
            return (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
                <Avatar user={e} size={40} />
                <div className="flex-1 min-w-0"><div className="font-bold truncate-1">{e.prenom} {e.nom}</div><div className="text-xs text-ink-muted truncate-1">{e.email}</div></div>
                {p ? <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-light text-teal-dark">Pointé {fmtTime(p.heure)}</span>
                   : <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber/20 text-amber">Non pointé</span>}
              </div>
            );
          })}
        </div>
      </div>
      {showAdd && <SimpleAddModal title="Nouvel employé" fields={[{k:'prenom',l:'Prénom'},{k:'nom',l:'Nom'},{k:'email',l:'Email'},{k:'password',l:'Mot de passe temporaire'}]} onSubmit={async(d)=>{await api('employes',{method:'POST',body:JSON.stringify({...d,creche_id:activeCId})});}} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

function AdminPlanningEmployes({ activeCId }) {
  const [employes, setEmployes] = useState([]);
  useEffect(() => { (async()=>{try{const e=await api('employes'+(activeCId?`?creche_id=${activeCId}`:'')); setEmployes(e.employes);}catch(e){}})(); }, [activeCId]);
  const jours = ['Lun','Mar','Mer','Jeu','Ven'];
  return (
    <div className="bg-white rounded-lg p-5 shadow-softer animate-fade-up">
      <div className="font-extrabold text-lg mb-4">Planning cette semaine</div>
      <div className="overflow-x-auto">
        <div className="min-w-[600px] grid grid-cols-6 gap-2">
          <div className="text-xs font-extrabold uppercase tracking-wider text-ink-muted p-2">Employé</div>
          {jours.map(j => <div key={j} className="text-xs font-extrabold uppercase tracking-wider text-ink-muted p-2 text-center">{j}</div>)}
          {employes.map(e => (
            <>
              <div key={e.id} className="flex items-center gap-2 p-2"><Avatar user={e} size={28} /><span className="font-bold text-sm truncate-1">{e.prenom}</span></div>
              {jours.map(j => <div key={j+e.id} className="p-2 rounded-xl bg-teal-light text-center"><div className="text-xs font-bold text-teal-dark">8h-17h</div></div>)}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminPresences({ activeCId }) {
  const [enfants, setEnfants] = useState([]);
  const [selected, setSelected] = useState(null);
  useEffect(() => { (async()=>{try{const d=await api('enfants'+(activeCId?`?creche_id=${activeCId}`:'')); setEnfants(d.enfants); setSelected(d.enfants[0]?.id);}catch(e){}})(); }, [activeCId]);
  const child = enfants.find(e => e.id === selected);
  const days = ['Lun','Mar','Mer','Jeu','Ven'];
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {enfants.map(e => <button key={e.id} onClick={()=>setSelected(e.id)} className={`btn-pill text-xs flex-shrink-0 ${selected===e.id?'bg-teal text-white':'bg-white text-ink-muted'}`}>{e.prenom}</button>)}
      </div>
      {child && (
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center gap-3 mb-4">
            <Avatar enfant={child} size={48} />
            <div><div className="font-extrabold text-lg">{child.prenom}</div><div className="text-xs text-ink-muted">Contrat {child.contrat_heures}h/sem · {fmtEur(child.mensualite)}/mois</div></div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {days.map((d,i) => (
              <div key={d} className="rounded-2xl bg-bgsoft p-3 text-center">
                <div className="text-[10px] font-bold uppercase text-ink-muted">{d}</div>
                <div className="mt-2 w-8 h-8 mx-auto rounded-full bg-teal/20 text-teal-dark flex items-center justify-center font-extrabold text-xs">{Math.random() > 0.2 ? '✓' : '—'}</div>
                <div className="text-[10px] mt-1 font-bold text-ink-muted">8h-17h</div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-2xl bg-teal-light flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-teal-dark" />
            <div><div className="font-extrabold text-teal-dark">Prorata calculé</div><div className="text-xs text-ink-muted">32h / {child.contrat_heures}h · Ajusté à {fmtEur(child.mensualite * 32/child.contrat_heures)}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminSynthese({ activeCId }) {
  const [enfants, setEnfants] = useState([]);
  useEffect(() => { (async()=>{try{const d=await api('enfants'+(activeCId?`?creche_id=${activeCId}`:'')); setEnfants(d.enfants);}catch(e){}})(); }, [activeCId]);
  return (
    <div className="space-y-4 animate-fade-up">
      {enfants.map(e => (
        <div key={e.id} className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center gap-3 mb-3">
            <Avatar enfant={e} size={40} />
            <div><div className="font-extrabold">{e.prenom}</div><div className="text-xs text-ink-muted">{e.groupe} · Semaine {new Date().getWeek?.()||new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</div></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-sky/10"><div className="text-[10px] font-bold uppercase text-sky">Sieste</div><div className="text-lg font-extrabold">8h32</div></div>
            <div className="p-3 rounded-2xl bg-coral/10"><div className="text-[10px] font-bold uppercase text-coral">Biberons</div><div className="text-lg font-extrabold">14</div></div>
            <div className="p-3 rounded-2xl bg-lime/10"><div className="text-[10px] font-bold uppercase text-lime">Changes</div><div className="text-lg font-extrabold">18</div></div>
            <div className="p-3 rounded-2xl bg-violet/10"><div className="text-[10px] font-bold uppercase text-violet">Activités</div><div className="text-lg font-extrabold">7</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== NOURRITURE / RAPPELS / NEWS / DOCUMENTS =====
function NourritureView({ activeCId, canEdit }) {
  const [menus, setMenus] = useState([]);
  useEffect(() => { (async()=>{try{const d=await api('nourriture'+(activeCId?`?creche_id=${activeCId}`:'')); setMenus(d.menus);}catch(e){}})(); }, [activeCId]);
  const current = menus[0];
  return (
    <div className="space-y-4 animate-fade-up">
      {!current && <PlaceholderView title="Aucun menu défini" icon={UtensilsCrossed} />}
      {current && (
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center justify-between mb-4">
            <div><div className="font-extrabold text-lg">Menu de la semaine</div><div className="text-xs text-ink-muted">Semaine du {fmtDate(current.semaine)}</div></div>
            <UtensilsCrossed className="w-6 h-6 text-coral" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {current.repas.map((r,i) => (
              <div key={i} className="p-3 rounded-2xl bg-bgsoft">
                <div className="text-[10px] font-extrabold uppercase text-ink-muted">{r.jour}</div>
                <div className="mt-2"><div className="text-[10px] text-coral font-bold uppercase">🍽️ Midi</div><div className="text-xs font-bold">{r.midi}</div></div>
                <div className="mt-2"><div className="text-[10px] text-amber font-bold uppercase">🍪 Goûter</div><div className="text-xs font-bold">{r.gouter}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RappelsView({ activeCId, canEdit }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try {const d=await api('rappels'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.rappels);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  return (
    <div className="space-y-4 animate-fade-up">
      {canEdit && <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouveau rappel</button></div>}
      <div className="space-y-2">
        {items.length === 0 && <PlaceholderView title="Aucun rappel" icon={AlertTriangle} />}
        {items.map(r => {
          const color = r.priorite==='haute'?'#FF6B6B':r.priorite==='moyenne'?'#FFA726':'#66BB6A';
          return (
            <div key={r.id} className="bg-white rounded-lg p-4 shadow-softer flex items-center gap-3">
              <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color+'22', width: 42, height: 42 }}><AlertTriangle className="w-5 h-5" style={{ color }} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate-1">{r.titre}</div>
                <div className="text-xs text-ink-muted">Échéance {fmtDate(r.echeance)} · Cible {r.cible}</div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: color+'22', color }}>{r.priorite}</span>
            </div>
          );
        })}
      </div>
      {showAdd && <SimpleAddModal title="Nouveau rappel" fields={[{k:'titre',l:'Titre'},{k:'echeance',l:'Échéance',type:'date'},{k:'cible',l:'Cible (admin/pros/parents)'},{k:'priorite',l:'Priorité (haute/moyenne/basse)'}]} onSubmit={async(d)=>{await api('rappels',{method:'POST',body:JSON.stringify({...d,creche_id:activeCId})});}} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

function NewsView({ activeCId, canEdit }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try {const d=await api('news'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.news);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  return (
    <div className="space-y-4 animate-fade-up">
      {canEdit && <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Publier</button></div>}
      <div className="space-y-3">
        {items.map(n => (
          <div key={n.id} className={`bg-white rounded-lg p-5 shadow-softer ${n.pinned?'ring-2 ring-teal/30':''}`}>
            <div className="flex items-center gap-2 mb-2">
              {n.pinned && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-light text-teal-dark">📌 Épinglé</span>}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bgsoft text-ink-muted capitalize">{n.cible}</span>
              <span className="text-xs text-ink-muted ml-auto">{fmtDate(n.created_at)}</span>
            </div>
            <div className="font-extrabold text-lg">{n.titre}</div>
            <div className="text-sm text-ink-muted mt-1">{n.contenu}</div>
          </div>
        ))}
      </div>
      {showAdd && <SimpleAddModal title="Publier une news" fields={[{k:'titre',l:'Titre'},{k:'contenu',l:'Contenu'},{k:'cible',l:'Cible (parents/tous)',default:'parents'}]} onSubmit={async(d)=>{await api('news',{method:'POST',body:JSON.stringify({...d,creche_id:activeCId})});}} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

function DocumentsView({ activeCId, canEdit }) {
  const [items, setItems] = useState([]);
  const load = async () => { try {const d=await api('documents'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.documents);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  const onUpload = async (media) => {
    try { await api('documents', { method: 'POST', body: JSON.stringify({ titre: media.url.split('/').pop(), type: media.format, url: media.url, cible: 'tous', taille: media.bytes, creche_id: activeCId }) }); toast.success('Document ajouté'); load(); }
    catch(e){ toast.error(e.message); }
  };
  return (
    <div className="space-y-4 animate-fade-up">
      {canEdit && <div className="flex justify-end"><MediaUploader folder="documents" onUpload={onUpload} /></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(d => (
          <a key={d.id} href={d.url||'#'} target="_blank" rel="noopener noreferrer" className="bg-white rounded-lg p-4 shadow-softer flex items-center gap-3 hover:shadow-soft hover:-translate-y-0.5 transition-all">
            <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center"><FileText className="w-5 h-5 text-teal" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate-1">{d.titre}</div>
              <div className="text-xs text-ink-muted">{Math.round((d.taille||0)/1024)} Ko · {d.cible}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ===== MESSAGERIE (broadcast admin/pro/parent legacy) =====
function BroadcastMessagerie({ user, activeCId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef();
  const load = async () => { try { const d = await api('messages'+(activeCId?`?creche_id=${activeCId}`:'')); setMessages(d.messages); } catch(e){} };
  useEffect(() => { load(); const it = setInterval(load, 3000); return ()=>clearInterval(it); }, [activeCId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const send = async () => {
    if (!text.trim()) return;
    try { await api('messages', { method: 'POST', body: JSON.stringify({ contenu: text }) }); setText(''); load(); } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="bg-white rounded-lg shadow-softer h-[70vh] flex flex-col animate-fade-up">
      <div className="px-5 py-4 border-b border-bgsoft flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-teal-light text-teal-dark flex items-center justify-center"><MessageCircle className="w-5 h-5" /></div>
        <div><div className="font-extrabold">Messagerie crèche</div><div className="text-xs text-ink-muted">Temps réel · 974 🌺</div></div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-3">
        {messages.map(m => {
          const mine = m.from_id === user.id;
          return (
            <motion.div key={m.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} className={`flex ${mine?'justify-end':'justify-start'}`}>
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

// ===== MESSAGERIE PRO ↔ PARENT (threads 1-to-1 + media) =====
function ThreadedMessagerie({ user }) {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [parents, setParents] = useState([]);
  const [enfants, setEnfants] = useState([]);
  const endRef = useRef();

  const loadThreads = async () => { try { const d = await api('threads'); setThreads(d.threads); } catch(e){} };
  const loadMessages = async () => { if (!active) return; try { const d = await api(`threads/${active.id}/messages`); setMessages(d.messages); } catch(e){} };

  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { loadMessages(); const it = setInterval(loadMessages, 3000); return ()=>clearInterval(it); }, [active]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (showNew) { (async()=>{ try{const p=await api('parents'); const e=await api('enfants'); setParents(p.parents); setEnfants(e.enfants);}catch(e){} })(); } }, [showNew]);

  const send = async (media) => {
    if (!text.trim() && !media) return;
    try {
      await api(`threads/${active.id}/messages`, { method: 'POST', body: JSON.stringify({ contenu: text, media: media?.url||null, media_type: media?.type||null }) });
      setText(''); loadMessages(); loadThreads();
    } catch(e){ toast.error(e.message); }
  };
  const openNew = async (parent_id, enfant_id) => {
    try { const t = await api('threads', { method: 'POST', body: JSON.stringify({ parent_id, enfant_id }) }); setActive(t.thread); setShowNew(false); loadThreads(); }
    catch(e){ toast.error(e.message); }
  };

  return (
    <div className="bg-white rounded-lg shadow-softer h-[75vh] flex overflow-hidden animate-fade-up">
      <div className={`${active?'hidden md:flex':'flex'} w-full md:w-80 border-r border-bgsoft flex-col`}>
        <div className="px-4 py-3 border-b border-bgsoft flex items-center justify-between">
          <div className="font-extrabold">Conversations</div>
          {(user.role==='pro'||user.role==='admin') && <button onClick={()=>setShowNew(true)} className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center"><Plus className="w-4 h-4" /></button>}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {threads.length === 0 && <div className="p-6 text-center text-ink-muted text-sm">Aucune conversation</div>}
          {threads.map(t => {
            const other = t.others?.[0];
            return (
              <button key={t.id} onClick={()=>setActive(t)} className={`w-full p-3 flex items-center gap-3 hover:bg-bgsoft transition text-left ${active?.id===t.id?'bg-teal-light':''}`}>
                <Avatar user={other} enfant={t.enfant} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate-1 text-sm">{other?.prenom} {other?.nom}</div>
                  <div className="text-xs text-ink-muted truncate-1">{t.enfant ? `↔ ${t.enfant.prenom}` : t.enfant_id ? '↔ enfant' : ''}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${active?'flex':'hidden md:flex'} flex-1 flex-col`}>
        {!active && <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">Sélectionne une conversation</div>}
        {active && (
          <>
            <div className="px-4 py-3 border-b border-bgsoft flex items-center gap-3">
              <button onClick={()=>setActive(null)} className="md:hidden text-ink-muted"><ChevronRight className="w-5 h-5 rotate-180" /></button>
              <Avatar user={active.others?.[0]} enfant={active.enfant} size={36} />
              <div className="flex-1 min-w-0"><div className="font-extrabold truncate-1">{active.others?.[0]?.prenom} {active.others?.[0]?.nom}</div><div className="text-xs text-ink-muted">{active.enfant ? `Enfant : ${active.enfant.prenom}` : 'Conversation'}</div></div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-bgsoft/30">
              {messages.map(m => {
                const mine = m.from_id === user.id;
                return (
                  <motion.div key={m.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} className={`flex ${mine?'justify-end':'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine?'bg-teal text-white':'bg-white text-ink shadow-softer'}`}>
                      {!mine && <div className="text-[10px] font-extrabold opacity-70 mb-0.5">{m.from_nom}</div>}
                      {m.media && (m.media_type==='video' ? (
                        <video src={m.media} controls className="max-w-[280px] rounded-xl mb-1" />
                      ) : (
                        <img src={m.media} alt="" className="max-w-[280px] rounded-xl mb-1" />
                      ))}
                      {m.contenu && <div className="text-sm font-semibold whitespace-pre-wrap break-words">{m.contenu}</div>}
                      <div className={`text-[10px] mt-1 ${mine?'opacity-70':'text-ink-muted'}`}>{fmtTime(m.created_at)}</div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="border-t border-bgsoft p-3 flex items-center gap-2">
              <MediaUploader folder={`thread-${active.id}`} onUpload={(m)=>send(m)} />
              <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Message..." className="flex-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
              <button onClick={()=>send()} className="btn-pill bg-teal text-white shadow-soft"><Send className="w-4 h-4" /></button>
            </div>
          </>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4"><div className="font-extrabold text-lg">Nouvelle conversation</div><button onClick={()=>setShowNew(false)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {parents.map(p => (
                <div key={p.id} className="p-3 rounded-2xl bg-bgsoft">
                  <div className="font-bold text-sm">{p.prenom} {p.nom}</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {(p.enfants||[]).map(e => (
                      <button key={e.id} onClick={()=>openNew(p.id, e.id)} className="btn-pill bg-teal text-white text-xs">{e.prenom}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ===== PRO POINTAGE / TACHES / ACTIVITES / PROFIL =====
function ProProfil({ user }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-softer max-w-md animate-fade-up">
      <div className="flex items-center gap-4 mb-4">
        <Avatar user={user} size={72} />
        <div><div className="font-extrabold text-xl">{user.prenom} {user.nom}</div><div className="text-sm text-ink-muted capitalize">{user.role}</div><div className="text-xs text-ink-muted">{user.email}</div></div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="p-3 rounded-2xl bg-bgsoft flex justify-between"><span className="text-ink-muted">Rôle</span><span className="font-bold capitalize">{user.role}</span></div>
        <div className="p-3 rounded-2xl bg-bgsoft flex justify-between"><span className="text-ink-muted">Crèche</span><span className="font-bold">Les P'tits Bouts</span></div>
      </div>
    </div>
  );
}

function ProPointage({ user }) {
  const [now, setNow] = useState(new Date());
  const [logs, setLogs] = useState([]);
  const load = async () => { try { const d = await api('pointages'); setLogs(d.pointages); } catch(e){} };
  useEffect(() => { load(); const it = setInterval(()=>setNow(new Date()), 1000); return ()=>clearInterval(it); }, []);
  const punch = async (type) => { try { await api('pointage', { method: 'POST', body: JSON.stringify({ type }) }); toast.success(`${type === 'arrivee' ? 'Arrivée' : 'Départ'} enregistré`); load(); } catch(e){ toast.error(e.message); } };
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-8 shadow-soft text-center relative overflow-hidden">
        <Clock className="w-10 h-10 mx-auto mb-3 opacity-80" />
        <div className="text-5xl md:text-6xl font-extrabold tabular-nums">{now.toLocaleTimeString('fr-FR')}</div>
        <div className="text-sm opacity-80 mt-2 font-bold">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={()=>punch('arrivee')} className="btn-pill bg-white text-teal-dark shadow-soft"><Sun className="w-4 h-4" /> Arrivée</button>
          <button onClick={()=>punch('depart')} className="btn-pill bg-white/20 text-white border border-white/40"><Moon className="w-4 h-4" /> Départ</button>
        </div>
      </div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-3">Historique</div>
        <div className="space-y-2">
          {logs.slice(0, 10).map(l => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${l.type==='arrivee'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>
                {l.type==='arrivee'?<Sun className="w-4 h-4" />:<Moon className="w-4 h-4" />}
              </div>
              <div className="flex-1"><div className="font-bold text-sm capitalize">{l.type}</div><div className="text-xs text-ink-muted">{new Date(l.heure).toLocaleString('fr-FR')}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
    } catch(e){}
  };
  useEffect(() => { loadAll(); const it = setInterval(loadAll, 4000); return ()=>clearInterval(it); }, [selected]);
  const child = enfants.find(e => e.id === selected);
  const lastByType = useMemo(() => { const m = {}; trans.forEach(t => { if (!m[t.type] || new Date(t.heure) > new Date(m[t.type].heure)) m[t.type] = t; }); return m; }, [trans]);
  const quickAdd = async (type, titre, detail) => {
    try { await api('transmissions', { method: 'POST', body: JSON.stringify({ enfant_id: selected, type, titre: titre || TYPE_META[type].label, detail: detail || '' }) });
      toast.success(`${TYPE_META[type].label} ajouté pour ${child?.prenom}`); setShowForm(null); loadAll();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {enfants.map(e => (
          <button key={e.id} onClick={()=>setSelected(e.id)} className={`flex items-center gap-2 px-3 py-2 rounded-pill text-sm font-bold flex-shrink-0 transition-all ${selected===e.id?'bg-teal text-white shadow-soft':'bg-white text-ink-muted'}`}>
            <Avatar enfant={e} size={28} /> <span>{e.prenom}</span>
          </button>
        ))}
      </div>
      {child && (
        <>
          <ChildHeaderCard enfant={child} />
          <div className="bg-white rounded-lg p-4 shadow-softer">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-3">Humeur</div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {[{k:'happy',e:'😊',l:'Joyeux'},{k:'sleepy',e:'😴',l:'Fatigué'},{k:'sad',e:'😢',l:'Triste'},{k:'angry',e:'😠',l:'Énervé'},{k:'sick',e:'🤒',l:'Malade'},{k:'excited',e:'🤩',l:'Excité'}].map(m => (
                <motion.button whileTap={{ scale: 0.9 }} animate={mood===m.k?{ scale:[1,1.15,1] }:{}} key={m.k} onClick={()=>setMood(m.k)} className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-bold ${mood===m.k?'bg-teal text-white shadow-soft':'bg-bgsoft text-ink-muted'}`}>
                  <span className="text-lg mr-1">{m.e}</span>{m.l}
                </motion.button>
              ))}
            </div>
          </div>
          <div className="activity-grid">
            {ACTIVITY_TYPES.map(t => { const last = lastByType[t]; return <ActivityCard key={t} type={t} done={!!last} lastTime={last?fmtTime(last.heure):null} onClick={() => setShowForm(t)} />; })}
          </div>
          <div className="bg-white rounded-lg p-4 shadow-softer">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-2">Saisie rapide</div>
            <div className="flex gap-2 flex-wrap">
              {['repas','biberon','sieste','change','activite','note'].map(t => <button key={t} onClick={()=>setShowForm(t)} className="btn-pill bg-teal-light text-teal-dark text-xs"><Plus className="w-3 h-3" /> {TYPE_META[t].label}</button>)}
            </div>
          </div>
          {showForm && <QuickForm type={showForm} child={child} onClose={()=>setShowForm(null)} onSubmit={quickAdd} />}
          <div className="bg-white rounded-lg p-5 shadow-softer">
            <div className="flex items-center justify-between mb-3"><div className="font-extrabold text-lg">Journal de {child.prenom}</div><span className="text-[10px] font-bold text-teal-dark bg-teal-light px-2 py-0.5 rounded-full">Temps réel</span></div>
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
          <div className="rounded-xl flex items-center justify-center" style={{ background: meta.bg, width: 42, height: 42 }}><meta.icon className="w-5 h-5" style={{ color: meta.color }} /></div>
          <div className="flex-1"><div className="font-extrabold">{meta.label} · {child.prenom}</div><div className="text-xs text-ink-muted">Saisie rapide</div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <input value={titre} onChange={e=>setTitre(e.target.value)} placeholder="Titre" className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 font-semibold text-sm" />
          <textarea value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Détail (optionnel)..." rows={3} className="w-full px-4 py-3 rounded-2xl bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 font-semibold text-sm resize-none" />
          {type === 'biberon' && <div className="flex gap-2 flex-wrap">{['120ml','150ml','180ml','210ml','240ml'].map(v => <button key={v} onClick={()=>setDetail(`${v} bu`)} className="btn-pill bg-coral/10 text-coral text-xs">{v}</button>)}</div>}
          {type === 'sieste' && <div className="flex gap-2 flex-wrap">{['30 min','1h','1h30','2h'].map(v => <button key={v} onClick={()=>setDetail(`Dort ${v}`)} className="btn-pill bg-sky/10 text-sky text-xs">{v}</button>)}</div>}
          <button onClick={()=>onSubmit(type, titre, detail)} className="btn-pill w-full bg-teal text-white shadow-soft"><CheckCircle2 className="w-4 h-4" /> Enregistrer</button>
        </div>
      </motion.div>
    </div>
  );
}

function ProTaches() {
  const [tasks, setTasks] = useState([
    { id:1, label:'Désinfecter les tables', done: true },
    { id:2, label:'Préparer les couches', done: true },
    { id:3, label:'Ranger les jouets', done: false },
    { id:4, label:'Préparer le goûter', done: false },
    { id:5, label:'Mettre à jour transmissions', done: false },
  ]);
  const done = tasks.filter(t=>t.done).length;
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-gradient-to-br from-violet to-[#6B4FD8] text-white rounded-lg p-6 shadow-soft">
        <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">Mes tâches</div>
        <div className="text-3xl font-extrabold mt-1">{done} / {tasks.length}</div>
        <div className="mt-3 h-2 rounded-full bg-white/20"><motion.div initial={{ width:0 }} animate={{ width: `${(done/tasks.length)*100}%` }} className="h-full bg-white rounded-full" /></div>
      </div>
      <div className="bg-white rounded-lg p-4 shadow-softer space-y-2">
        {tasks.map(t => (
          <button key={t.id} onClick={()=>setTasks(tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x))} className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${t.done?'bg-teal-light':'bg-bgsoft hover:bg-teal-light/50'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${t.done?'bg-teal text-white':'border-2 border-ink-muted'}`}>{t.done && <CheckCircle2 className="w-4 h-4" />}</div>
            <span className={`font-bold text-sm ${t.done?'line-through text-ink-muted':''}`}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== PARENT views =====
function ParentLive({ user }) {
  const [enfants, setEnfants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [trans, setTrans] = useState([]);
  const [lastCount, setLastCount] = useState(0);
  const today = new Date().toISOString().slice(0,10);
  const load = async () => {
    try {
      if (enfants.length === 0) { const e = await api('enfants'); setEnfants(e.enfants); if (!selected && e.enfants[0]) setSelected(e.enfants[0].id); }
      if (selected) {
        const t = await api(`transmissions?date=${today}&enfant_id=${selected}`);
        if (lastCount && t.transmissions.length > lastCount) toast.success(`Nouvelle transmission ! 🌺`);
        setLastCount(t.transmissions.length); setTrans(t.transmissions);
      }
    } catch(e){}
  };
  useEffect(() => { load(); const it = setInterval(load, 3000); return ()=>clearInterval(it); }, [selected, enfants.length]);
  const child = enfants.find(e => e.id === selected);
  const counts = { sieste: trans.filter(t=>t.type==='sieste').length, biberon: trans.filter(t=>t.type==='biberon').length, change: trans.filter(t=>t.type==='change').length };
  return (
    <div className="space-y-4 animate-fade-up">
      {enfants.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {enfants.map(e => <button key={e.id} onClick={()=>setSelected(e.id)} className={`flex items-center gap-2 px-3 py-2 rounded-pill text-sm font-bold flex-shrink-0 ${selected===e.id?'bg-teal text-white shadow-soft':'bg-white text-ink-muted'}`}><Avatar enfant={e} size={28} /> {e.prenom}</button>)}
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
          <div><div className="font-extrabold text-lg">Journée de {child?.prenom}</div><div className="text-xs text-ink-muted">En direct 🌺</div></div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-dark bg-teal-light px-3 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" /> Live</span>
        </div>
        <div className="max-h-[500px] overflow-y-auto scrollbar-thin pr-2">
          {trans.length === 0 && (
            <div className="py-12 text-center text-ink-muted"><Sparkles className="w-10 h-10 mx-auto mb-2 text-teal opacity-50" /><div className="text-sm">Pas encore de transmission</div></div>
          )}
          {trans.map((t, i) => <TimelineEntry key={t.id} t={t} idx={i} />)}
          {trans.length > 0 && <TypingIndicator />}
        </div>
      </div>
    </div>
  );
}

function ParentJournal() {
  const [enfants, setEnfants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [trans, setTrans] = useState([]);
  const today = new Date().toISOString().slice(0,10);
  useEffect(() => { (async()=>{const e = await api('enfants'); setEnfants(e.enfants); if (e.enfants[0]) { setSelected(e.enfants[0].id); const t = await api(`transmissions?date=${today}&enfant_id=${e.enfants[0].id}`); setTrans(t.transmissions); } })(); }, []);
  const child = enfants.find(e=>e.id===selected);
  const lastByType = useMemo(() => { const m = {}; trans.forEach(t => { if (!m[t.type]) m[t.type] = t; }); return m; }, [trans]);
  return (
    <div className="space-y-4 animate-fade-up">
      {child && <ChildHeaderCard enfant={child} />}
      <div className="activity-grid">{ACTIVITY_TYPES.map(t => { const last = lastByType[t]; return <ActivityCard key={t} type={t} done={!!last} lastTime={last?fmtTime(last.heure):null} onClick={()=>{}} />; })}</div>
    </div>
  );
}

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
      <div className="bg-white rounded-lg p-5 shadow-softer"><div className="font-extrabold text-lg mb-1">Album photos</div><div className="text-xs text-ink-muted">Sécurisé 🌺</div></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((p, i) => <motion.div key={i} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }} className="aspect-square rounded-lg overflow-hidden shadow-softer hover:shadow-soft hover:-translate-y-1 transition-all cursor-pointer"><img src={p} alt="" className="w-full h-full object-cover" /></motion.div>)}
      </div>
    </div>
  );
}

function ParentReservations() {
  const days = Array.from({length:7}, (_,i)=>{ const d = new Date(); d.setDate(d.getDate()+i+1); return d; });
  return (
    <div className="bg-white rounded-lg p-5 shadow-softer animate-fade-up">
      <div className="font-extrabold text-lg mb-3">Prochaines journées</div>
      <div className="space-y-2">
        {days.map((d,i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
            <div className="w-12 h-12 rounded-2xl bg-teal-light text-teal-dark flex flex-col items-center justify-center"><div className="text-[10px] font-bold uppercase">{d.toLocaleDateString('fr-FR',{weekday:'short'})}</div><div className="text-lg font-extrabold leading-none">{d.getDate()}</div></div>
            <div className="flex-1"><div className="font-bold capitalize">{d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}</div><div className="text-xs text-ink-muted">8h00 → 17h30</div></div>
            <button className="btn-pill bg-coral/10 text-coral text-xs">Absence</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParentFactures() {
  const [factures, setFactures] = useState([]);
  useEffect(() => { (async()=>{try{const f=await api('factures'); setFactures(f.factures);}catch(e){}})(); }, []);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-6 shadow-soft">
        <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">Total à régler</div>
        <div className="text-4xl font-extrabold mt-2">{fmtEur(factures.filter(f=>f.statut==='en_attente').reduce((s,f)=>s+f.montant,0))}</div>
        <button className="btn-pill bg-white text-teal-dark shadow-soft mt-3">Payer maintenant</button>
      </div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="flex items-center justify-between mb-3"><div className="font-extrabold text-lg">Mes factures</div><button className="btn-pill bg-teal-light text-teal-dark text-xs"><FileText className="w-3 h-3" /> Export CAF</button></div>
        <div className="space-y-2">
          {factures.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
              <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center"><FileText className="w-5 h-5 text-teal" /></div>
              <div className="flex-1 min-w-0"><div className="font-bold truncate-1">{f.numero||'F-—'}</div><div className="text-xs text-ink-muted">{f.mois}</div></div>
              <div className="font-extrabold">{fmtEur(f.montant)}</div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${f.statut==='payee'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>{f.statut==='payee'?'Payée':'En attente'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== ABONNEMENT STRIPE =====
function AbonnementView({ user }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { (async()=>{try{const s=await api('stripe/status'); setStatus(s);}catch(e){}})(); }, []);
  const subscribe = async () => {
    setLoading(true);
    try {
      const d = await api('stripe/checkout', { method: 'POST', body: JSON.stringify({}) });
      if (d.url) window.location.href = d.url;
      else if (d.demo_mode) toast.success(d.message);
      setLoading(false);
    } catch(e){ toast.error(e.message); setLoading(false); }
  };
  const portal = async () => {
    try { const d = await api('stripe/portal', { method: 'POST' }); if (d.url) window.location.href = d.url; }
    catch(e){ toast.error(e.message); }
  };
  const sub = status?.subscription;
  return (
    <div className="space-y-4 animate-fade-up max-w-2xl">
      <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-8 shadow-soft relative overflow-hidden">
        <CreditCard className="absolute right-6 top-6 w-8 h-8 opacity-30" />
        <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">Plan TiMétis</div>
        <div className="text-5xl font-extrabold mt-2">79 €<span className="text-lg opacity-70"> /mois</span></div>
        <div className="text-sm opacity-90 mt-2 font-bold">Prélèvement SEPA · Codes promo acceptés</div>
        <ul className="mt-4 space-y-1 text-sm">
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Crèches illimitées</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Enfants illimités</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Support 974 dédié</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Toutes les fonctionnalités</li>
        </ul>
      </div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="flex items-center justify-between mb-3">
          <div><div className="font-extrabold text-lg">État de mon abonnement</div><div className="text-xs text-ink-muted">{status?.configured ? 'Stripe actif' : 'Mode démo — Stripe non configuré'}</div></div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${sub?.status==='active'?'bg-teal-light text-teal-dark':sub?.status==='trialing'?'bg-amber/20 text-amber':'bg-bgsoft text-ink-muted'}`}>{sub?.status || 'Aucun'}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(!sub || sub.status !== 'active') && <button onClick={subscribe} disabled={loading} className="btn-pill bg-teal text-white shadow-soft">{loading?<Loader2 className="w-4 h-4 animate-spin" />:<><ArrowRight className="w-4 h-4" /> Souscrire</>}</button>}
          {sub?.status === 'active' && status?.configured && <button onClick={portal} className="btn-pill bg-bgsoft text-ink font-bold">Gérer mon abonnement</button>}
        </div>
      </div>
    </div>
  );
}

// ===== FEEDBACK =====
function FeedbackForm({ user }) {
  const [rating, setRating] = useState(5);
  const [msg, setMsg] = useState('');
  const [cat, setCat] = useState('general');
  const submit = async () => {
    if (!msg.trim()) return toast.error('Merci d\'écrire un message');
    try { await api('feedbacks', { method: 'POST', body: JSON.stringify({ rating, message: msg, category: cat }) }); toast.success('Merci pour votre retour ! 🌺'); setMsg(''); setRating(5); }
    catch(e){ toast.error(e.message); }
  };
  return (
    <div className="bg-white rounded-lg p-6 shadow-softer max-w-md animate-fade-up">
      <div className="font-extrabold text-xl mb-1">Un retour à partager ?</div>
      <div className="text-sm text-ink-muted mb-4">On lit tout, promis 🌺</div>
      <div className="flex gap-2 mb-4">
        {[1,2,3,4,5].map(i => <button key={i} onClick={()=>setRating(i)}><Star className={`w-8 h-8 ${i<=rating?'fill-amber text-amber':'text-bgsoft'}`} /></button>)}
      </div>
      <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full px-4 py-3 rounded-pill bg-bgsoft outline-none font-semibold text-sm mb-3">
        <option value="general">Général</option>
        <option value="bug">Bug</option>
        <option value="suggestion">Suggestion</option>
        <option value="compliment">Compliment</option>
      </select>
      <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Votre message..." rows={4} className="w-full px-4 py-3 rounded-2xl bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 font-semibold text-sm resize-none mb-3" />
      <button onClick={submit} className="btn-pill w-full bg-teal text-white shadow-soft"><Send className="w-4 h-4" /> Envoyer</button>
    </div>
  );
}

// ===== ALARME EVACUATION =====
function AlarmeEvacuation({ activeCId }) {
  const [data, setData] = useState(null);
  useEffect(() => { (async()=>{try{const d=await api('alarme/evacuation'+(activeCId?`?creche_id=${activeCId}`:'')); setData(d);}catch(e){}})(); }, [activeCId]);
  const print = () => window.print();
  if (!data) return <Loading />;
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-gradient-to-br from-coral to-[#E53E3E] text-white rounded-lg p-6 shadow-soft">
        <div className="flex items-center gap-3"><AlertTriangle className="w-8 h-8" /><div><div className="font-extrabold text-2xl">Liste d'évacuation</div><div className="text-sm opacity-90">{data.creche?.nom} · {new Date(data.date).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</div></div></div>
        <button onClick={print} className="btn-pill bg-white text-coral shadow-soft mt-4"><FileText className="w-4 h-4" /> Imprimer PDF</button>
      </div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-3">👶 Enfants présents ({data.enfants_presents?.length || 0})</div>
        <div className="space-y-2">
          {(data.enfants_presents || []).map(e => (
            <div key={e.id} className="flex items-center gap-3 p-2 rounded-2xl bg-bgsoft"><Avatar enfant={e} size={36} /><div><div className="font-bold">{e.prenom} {e.nom}</div><div className="text-xs text-ink-muted">{e.groupe} · {ageStr(e.date_naissance)}</div></div></div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-3">👩‍⚕️ Employés présents ({data.employes_presents?.length || 0})</div>
        <div className="space-y-2">
          {(data.employes_presents || []).map(e => (
            <div key={e.id} className="flex items-center gap-3 p-2 rounded-2xl bg-bgsoft"><Avatar user={e} size={36} /><div className="font-bold">{e.prenom} {e.nom}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== MAIN APP =====
function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bootLoaded, setBootLoaded] = useState(false);
  const [creches, setCreches] = useState([]);
  const [activeCId, setActiveCId] = useState(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tk_user') : null;
    const token = typeof window !== 'undefined' ? localStorage.getItem('tk_token') : null;
    if (stored && token) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
        setView(defaultViewFor(u.role));
        if (u.role === 'admin' && u.creche_ids && u.creche_ids.length) setActiveCId(u.creche_ids[0]);
      } catch {}
    }
    setBootLoaded(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin' || user.role === 'super_admin') {
      (async()=>{try{const d=await api('creches'); setCreches(d.creches); if (!activeCId && d.creches[0]) setActiveCId(d.creches[0].id);}catch(e){}})();
    }
  }, [user]);

  const defaultViewFor = (role) => {
    if (role === 'super_admin') return 'super/dashboard';
    if (role === 'admin') return 'admin/dashboard';
    if (role === 'pro') return 'pro/pointage';
    return 'parent/live';
  };

  const handleAuth = (u) => { setUser(u); setView(defaultViewFor(u.role)); if (u.role==='admin'&&u.creche_ids?.[0]) setActiveCId(u.creche_ids[0]); };
  const logout = () => { localStorage.removeItem('tk_token'); localStorage.removeItem('tk_user'); setUser(null); setView(null); setActiveCId(null); setCreches([]); };

  if (!bootLoaded) return null;
  if (!user) return <LoginView onAuth={handleAuth} />;

  const activeCreche = creches.find(c => c.id === activeCId);
  const titleMap = {
    'super/dashboard': 'Tour de contrôle', 'super/clients': 'Mes clients', 'super/feedbacks': 'Feedbacks',
    'admin/dashboard': 'Tour de contrôle', 'admin/monitoring': 'Monitoring live', 'admin/enfants': 'Gestion des enfants',
    'admin/familles': 'Familles', 'admin/groupes': 'Groupes', 'admin/tags': 'Tags',
    'admin/presences': 'Planning enfants', 'admin/synthese': 'Synthèse hebdomadaire',
    'admin/nourriture': 'Nourriture', 'admin/rappels': 'Rappels', 'admin/news': 'News', 'admin/documents': 'Documents',
    'admin/devis': 'Devis', 'admin/factures': 'Factures', 'admin/finances': 'Finances · CA', 'admin/charges': 'Charges & Salaires',
    'admin/employes': 'Employés', 'admin/planning-employes': 'Planning employés', 'admin/messagerie': 'Messagerie',
    'admin/alarme': 'Alarme incendie', 'admin/abonnement': 'Abonnement', 'admin/feedback': 'Envoyer feedback',
    'pro/profil': 'Mon profil', 'pro/pointage': 'Pointage', 'pro/activites': 'Activités enfants',
    'pro/enfants': 'Gestion enfants', 'pro/nourriture': 'Nourriture', 'pro/rappels': 'Rappels',
    'pro/messagerie': 'Messagerie parents', 'pro/documents': 'Documents', 'pro/news': 'News',
    'pro/taches': 'Mes tâches', 'pro/feedback': 'Feedback',
    'parent/live': 'Suivi en direct', 'parent/journal': 'Journal du jour', 'parent/photos': 'Album photos',
    'parent/reservations': 'Réservations', 'parent/nourriture': 'Menu semaine', 'parent/news': 'Actualités',
    'parent/messagerie': 'Messagerie', 'parent/documents': 'Documents', 'parent/factures': 'Mes factures', 'parent/feedback': 'Feedback',
  };

  const canEdit = (user.role === 'admin' || user.role === 'super_admin');

  const renderView = () => {
    switch (view) {
      case 'super/dashboard': return <SuperDashboard />;
      case 'super/clients': return <SuperClients />;
      case 'super/feedbacks': return <SuperFeedbacks />;
      case 'super/settings': return <PlaceholderView title="Paramètres" icon={Settings} />;
      case 'admin/dashboard':
      case 'admin/monitoring': return <AdminDashboard user={user} activeCId={activeCId} />;
      case 'admin/enfants': return <AdminEnfants activeCId={activeCId} />;
      case 'admin/familles': return <AdminFamilles activeCId={activeCId} />;
      case 'admin/groupes': return <AdminGroupes activeCId={activeCId} />;
      case 'admin/tags': return <AdminTags activeCId={activeCId} />;
      case 'admin/presences': return <AdminPresences activeCId={activeCId} />;
      case 'admin/synthese': return <AdminSynthese activeCId={activeCId} />;
      case 'admin/nourriture': return <NourritureView activeCId={activeCId} canEdit={canEdit} />;
      case 'admin/rappels': return <RappelsView activeCId={activeCId} canEdit={canEdit} />;
      case 'admin/news': return <NewsView activeCId={activeCId} canEdit={canEdit} />;
      case 'admin/documents': return <DocumentsView activeCId={activeCId} canEdit={canEdit} />;
      case 'admin/devis': return <AdminDevis activeCId={activeCId} />;
      case 'admin/factures': return <AdminFactures activeCId={activeCId} />;
      case 'admin/finances': return <AdminFinances activeCId={activeCId} />;
      case 'admin/charges': return <AdminCharges activeCId={activeCId} />;
      case 'admin/employes': return <AdminEmployes activeCId={activeCId} />;
      case 'admin/planning-employes': return <AdminPlanningEmployes activeCId={activeCId} />;
      case 'admin/messagerie': return <ThreadedMessagerie user={user} />;
      case 'admin/alarme': return <AlarmeEvacuation activeCId={activeCId} />;
      case 'admin/abonnement': return <AbonnementView user={user} />;
      case 'admin/feedback': return <FeedbackForm user={user} />;
      case 'pro/profil': return <ProProfil user={user} />;
      case 'pro/pointage': return <ProPointage user={user} />;
      case 'pro/activites': return <ProActivites user={user} />;
      case 'pro/enfants': return <AdminEnfants activeCId={user.creche_id} />;
      case 'pro/nourriture': return <NourritureView activeCId={user.creche_id} canEdit />;
      case 'pro/rappels': return <RappelsView activeCId={user.creche_id} canEdit />;
      case 'pro/messagerie': return <ThreadedMessagerie user={user} />;
      case 'pro/documents': return <DocumentsView activeCId={user.creche_id} canEdit />;
      case 'pro/news': return <NewsView activeCId={user.creche_id} canEdit={false} />;
      case 'pro/taches': return <ProTaches />;
      case 'pro/feedback': return <FeedbackForm user={user} />;
      case 'parent/live': return <ParentLive user={user} />;
      case 'parent/journal': return <ParentJournal />;
      case 'parent/photos': return <ParentPhotos />;
      case 'parent/reservations': return <ParentReservations />;
      case 'parent/nourriture': return <NourritureView activeCId={user.creche_id} canEdit={false} />;
      case 'parent/news': return <NewsView activeCId={user.creche_id} canEdit={false} />;
      case 'parent/messagerie': return <ThreadedMessagerie user={user} />;
      case 'parent/documents': return <DocumentsView activeCId={user.creche_id} canEdit={false} />;
      case 'parent/factures': return <ParentFactures />;
      case 'parent/feedback': return <FeedbackForm user={user} />;
      default: return <Loading />;
    }
  };

  return (
    <div className="min-h-screen flex bg-bgsoft tk-main">
      <Sidebar user={user} view={view} setView={setView} open={menuOpen} setOpen={setMenuOpen} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} onLogout={logout} onMenu={()=>setMenuOpen(true)} title={titleMap[view] || ''}
          activeCreche={activeCreche} creches={creches} onSelectCreche={setActiveCId} />
        <div className="px-4 md:px-8 pb-8 -mt-6 relative z-10">{renderView()}</div>
      </main>
    </div>
  );
}

export default App;
