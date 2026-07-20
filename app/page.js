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
  Building2, CreditCard, ShieldCheck, Zap, Star, MessageSquare, User,
  Check, Download
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

function Avatar({ enfant, user, size = 44, onClick }) {
  const src = enfant || user || {};
  const color = src.avatar_color || (['#3ECDB5','#8B6BE8','#FFA726','#42A5F5','#66BB6A'][((src.prenom||'A').charCodeAt(0))%5]);
  const hasPhoto = !!src.avatar_url;
  return (
    <div onClick={onClick}
      className={`flex items-center justify-center rounded-full font-extrabold text-white shadow-softer flex-shrink-0 overflow-hidden ${onClick?'cursor-pointer hover:ring-2 hover:ring-teal/40 transition':''}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {hasPhoto ? <img src={src.avatar_url} alt="" className="w-full h-full object-cover" /> : initials(src?.prenom, src?.nom)}
    </div>
  );
}

// ===== Child Avatar upload modal =====
function AvatarUploadModal({ enfant, onClose, onSaved }) {
  const [color, setColor] = useState(enfant.avatar_color || '#3ECDB5');
  const [preview, setPreview] = useState(enfant.avatar_url || null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();
  const palette = ['#3ECDB5','#FF6B6B','#FFA726','#8B6BE8','#42A5F5','#66BB6A','#F06292','#26A69A'];

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Image requise'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('Image trop lourde (max 3 Mo)'); return; }
    setUploading(true);
    try {
      // Try Cloudinary first
      const sig = await api('media/sign', { method: 'POST', body: JSON.stringify({ folder: 'enfants' }) });
      if (sig.configured) {
        const form = new FormData();
        form.append('file', file); form.append('api_key', sig.api_key); form.append('timestamp', sig.timestamp);
        form.append('signature', sig.signature); form.append('folder', sig.folder);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/auto/upload`, { method: 'POST', body: form });
        const data = await res.json();
        setPreview(data.secure_url);
      } else {
        // Fallback : base64 (limité mais fonctionnel)
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(file);
      }
    } catch(e){ toast.error(e.message); }
    finally { setUploading(false); }
  };

  const save = async () => {
    try { await api(`enfants/${enfant.id}/avatar`, { method: 'PUT', body: JSON.stringify({ url: preview, color }) });
      toast.success(`Photo mise à jour pour ${enfant.prenom} 🌺`); onSaved?.(); onClose(); }
    catch(e){ toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div><div className="font-extrabold text-lg">Photo de {enfant.prenom}</div><div className="text-xs text-ink-muted">Glisser une image ou choisir une couleur</div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div onDragOver={(e)=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
          onDrop={(e)=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files?.[0]);}}
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 transition ${dragOver?'border-teal bg-teal-light':'border-bgsoft'}`}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center font-extrabold text-white text-3xl overflow-hidden" style={{ background: color }}>
            {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : initials(enfant.prenom, enfant.nom)}
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e)=>handleFile(e.target.files?.[0])} />
          <div className="flex gap-2">
            <button onClick={()=>inputRef.current?.click()} disabled={uploading} className="btn-pill bg-teal text-white text-xs shadow-soft">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />} {preview ? 'Changer' : 'Choisir une photo'}
            </button>
            {preview && <button onClick={()=>setPreview(null)} className="btn-pill bg-coral/10 text-coral text-xs"><Trash2 className="w-3 h-3" /> Retirer</button>}
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs font-extrabold uppercase tracking-wider text-ink-muted mb-2">Couleur avatar (si pas de photo)</div>
          <div className="flex gap-2 flex-wrap">
            {palette.map(c => <button key={c} onClick={()=>setColor(c)} className={`w-9 h-9 rounded-full ${color===c?'ring-4 ring-offset-2 ring-teal':''}`} style={{ background: c }} />)}
          </div>
        </div>
        <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft mt-5"><Save className="w-4 h-4" /> Enregistrer</button>
      </motion.div>
    </div>
  );
}

// ===== TopBar with crèche switcher =====
function TopBar({ user, onLogout, onMenu, title, activeCreche, creches, onSelectCreche }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative tk-wave text-white">
      <div className="px-4 md:px-8 pt-4 pb-6 flex items-center justify-between relative gap-3">
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
            <div className="relative z-40">
              <button onClick={()=>setOpen(!open)} className="hidden md:flex items-center gap-2 bg-white/15 rounded-pill px-3 py-1.5 text-xs font-bold hover:bg-white/25 transition">
                <Building2 className="w-4 h-4" />
                <span className="truncate-1 max-w-[160px]">{activeCreche?.nom} · {activeCreche?.ville}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${open?'rotate-180':''}`} />
              </button>
              <AnimatePresence>
                {open && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={()=>setOpen(false)} />
                    <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                      className="absolute right-0 top-full mt-2 bg-white text-ink rounded-2xl shadow-soft py-2 min-w-[260px] z-50 border border-bgsoft">
                      <div className="px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted border-b border-bgsoft">Mes crèches</div>
                      {creches.map(c => (
                        <button key={c.id} onClick={()=>{ onSelectCreche(c.id); setOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-teal-light text-sm transition ${activeCreche?.id===c.id?'text-teal-dark bg-teal-light/60':''}`}>
                          <div className="font-extrabold truncate-1">{c.nom}</div>
                          <div className="text-xs text-ink-muted truncate-1">{c.ville} · {c.capacite||20} places</div>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
          <button onClick={async ()=>{ const r=await registerPush(); if(r.ok){ await api('push/test',{method:'POST'}); toast.success('Notifications activées ! (test envoyé)'); } else { toast.error(r.reason==='denied'?'Permission refusée dans le navigateur':(r.reason==='unsupported'?'Navigateur non compatible':'Erreur : '+r.reason)); } }} title="Activer les notifications push" className="p-2 rounded-full bg-white/15 active:scale-95 relative">
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
  const [preinscriptionsCount, setPreinscriptionsCount] = useState(0);
  useEffect(() => {
    if (user.role !== 'admin') return;
    (async () => {
      try {
        const d = await api('preinscriptions');
        const pending = (d.preinscriptions||[]).filter(p => !p.statut || p.statut === 'nouveau' || p.statut === 'en_attente').length;
        setPreinscriptionsCount(pending);
      } catch(e){}
    })();
    const t = setInterval(async () => {
      try {
        const d = await api('preinscriptions');
        const pending = (d.preinscriptions||[]).filter(p => !p.statut || p.statut === 'nouveau' || p.statut === 'en_attente').length;
        setPreinscriptionsCount(pending);
      } catch(e){}
    }, 30000);
    return () => clearInterval(t);
  }, [user.role]);
  const menus = {
    super_admin: [
      { key: 'super/dashboard', label: 'Cockpit', icon: BarChart3 },
      { key: 'super/clients', label: 'Mes clients', icon: Users },
      { key: 'super/prospects', label: 'Pré-inscriptions crèches', icon: UserCheck },
      { key: 'super/factures', label: 'Devis & factures', icon: FileText },
      { key: 'super/feedbacks', label: 'Avis & suggestions', icon: MessageSquare },
      { key: 'super/settings', label: 'Paramètres', icon: Settings },
    ],
    admin: [
      { key: 'admin/dashboard', label: 'Cockpit', icon: Home },
      { key: 'admin/preinscriptions', label: 'Pré-inscriptions', icon: UserCheck, highlight: true, badgeKey: 'preinscriptions' },
      { key: 'admin/enfants', label: 'Enfants', icon: Baby },
      { key: 'admin/familles', label: 'Foyers', icon: Users },
      { key: 'admin/groupes', label: 'Sections', icon: Layers },
      { key: 'admin/tags', label: 'Étiquettes', icon: TagIcon },
      { key: 'admin/presences', label: 'Présences hebdo', icon: ClipboardList },
      { key: 'admin/reservations', label: 'Réservations · Planning', icon: Calendar },
      { key: 'admin/synthese', label: 'Bilan hebdo', icon: FileCheck },
      { key: 'admin/nourriture', label: 'Restauration', icon: UtensilsCrossed },
      { key: 'admin/rappels', label: 'Alertes', icon: AlertTriangle },
      { key: 'admin/news', label: 'Actus', icon: Newspaper },
      { key: 'admin/documents', label: 'Espace docs', icon: FileText },
      { key: 'admin/devis', label: 'Devis', icon: Copy },
      { key: 'admin/factures', label: 'Factures', icon: FileText },
      { key: 'admin/finances', label: 'Finances · CA', icon: TrendingUp },
      { key: 'admin/charges', label: 'Charges & Salaires', icon: PiggyBank },
      { key: 'admin/employes', label: 'Équipe', icon: Briefcase },
      { key: 'admin/planning-employes', label: 'Horaires équipe', icon: Calendar },
      { key: 'admin/fiches-paie', label: 'Fiches de paie', icon: Wallet },
      { key: 'admin/notifications', label: 'Notifications', icon: Bell },
      { key: 'admin/statistiques', label: 'Statistiques', icon: BarChart3 },
      { key: 'admin/administration', label: 'Administration', icon: Settings },
      { key: 'admin/rgpd', label: 'RGPD & conditions', icon: ShieldCheck },
      { key: 'admin/albums', label: 'Albums photos', icon: ImageIcon },
      { key: 'admin/messagerie', label: 'Discussions', icon: MessageCircle },
      { key: 'admin/alarme', label: 'Sécurité incendie', icon: AlertTriangle },
      { key: 'admin/abonnement', label: 'Abonnement', icon: CreditCard },
      { key: 'admin/feedback', label: 'Envoyer un avis', icon: Star },
    ],
    pro: [
      { key: 'pro/profil', label: 'Mon profil', icon: User },
      { key: 'pro/pointage', label: 'Pointage', icon: Clock },
      { key: 'pro/mes-horaires', label: 'Mes horaires', icon: Calendar },
      { key: 'pro/fiches-paie', label: 'Mes fiches de paie', icon: Wallet },
      { key: 'pro/activites', label: 'Activités enfants', icon: Sparkles },
      { key: 'pro/enfants', label: 'Enfants', icon: Baby },
      { key: 'pro/nourriture', label: 'Restauration', icon: UtensilsCrossed },
      { key: 'pro/rappels', label: 'Alertes', icon: AlertTriangle },
      { key: 'pro/messagerie', label: 'Discussions parents', icon: MessageCircle },
      { key: 'pro/documents', label: 'Espace docs', icon: FileText },
      { key: 'pro/news', label: 'Actus', icon: Newspaper },
      { key: 'pro/taches', label: 'Mes tâches', icon: CheckCircle2 },
      { key: 'pro/albums', label: 'Albums photos', icon: ImageIcon },
      { key: 'pro/feedback', label: 'Envoyer un avis', icon: Star },
    ],
    parent: [
      { key: 'parent/live', label: 'Suivi en direct', icon: Sparkles },
      { key: 'parent/journal', label: 'Journal du jour', icon: ClipboardList },
      { key: 'parent/photos', label: 'Album photos', icon: ImageIcon },
      { key: 'parent/reservations', label: 'Réservations', icon: Calendar },
      { key: 'parent/nourriture', label: 'Menu de la semaine', icon: UtensilsCrossed },
      { key: 'parent/news', label: 'Actus', icon: Newspaper },
      { key: 'parent/messagerie', label: 'Discussions', icon: MessageCircle },
      { key: 'parent/documents', label: 'Espace docs', icon: FileText },
      { key: 'parent/factures', label: 'Mes factures', icon: Wallet },
      { key: 'parent/feedback', label: 'Envoyer un avis', icon: Star },
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
          const badge = it.badgeKey === 'preinscriptions' && preinscriptionsCount > 0 ? preinscriptionsCount : null;
          return (
            <button key={it.key} onClick={() => { setView(it.key); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 my-0.5 rounded-r-pill text-sm font-bold transition-all relative
                ${active ? 'bg-teal text-white shadow-soft'
                  : it.highlight ? 'bg-coral/10 text-coral hover:bg-coral hover:text-white'
                  : 'text-ink-muted hover:bg-teal-light hover:text-teal-dark'}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate-1 text-left text-[13px] flex-1">{it.label}</span>
              {badge != null && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${active?'bg-white text-teal-dark':'bg-coral text-white'}`}>{badge}</span>
              )}
              {it.highlight && badge == null && !active && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-coral text-white">NEW</span>
              )}
            </button>
          );
        })}
      </div>
      {user.role === 'admin' && (
        <div className="m-3 px-3 py-3 rounded-2xl bg-teal-light text-teal-dark flex-shrink-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wider">Plan TiMétis</div>
          <div className="text-sm font-bold">79 € / mois</div>
          <div className="text-[10px] opacity-80">Solution locale 974 🌺</div>
        </div>
      )}
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
// ===== GOOGLE SIGN-IN + WEB PUSH HELPERS =====
function GoogleSignInBlock({ onLogged }) {
  const btnRef = useRef(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  useEffect(() => {
    if (!clientId) return;
    const init = () => {
      if (!window.google?.accounts?.id || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          try {
            const r = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: resp.credential }) });
            if (!r.ok) { const e = await r.json(); throw new Error(e.error||'Erreur Google'); }
            const d = await r.json();
            toast.success(`Bienvenue ${d.user.prenom} !`);
            onLogged(d.token, d.user);
          } catch(e){ toast.error(e.message); }
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 280, locale: 'fr' });
    };
    if (window.google?.accounts?.id) init();
    else {
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
      s.onload = init; document.head.appendChild(s);
    }
  }, [clientId]);
  if (!clientId) return null;
  return (
    <div className="mt-4 flex flex-col items-center">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted mb-2">Ou pour les parents · inscription instantanée</div>
      <div ref={btnRef} />
      <div className="text-[10px] text-ink-muted mt-1">Auto-création · en attente d'assignation à une crèche</div>
    </div>
  );
}

async function registerPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { ok:false, reason:'unsupported' };
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') return { ok:false, reason:'denied' };
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const r = await api('push/vapid-key'); if (!r.publicKey) return { ok:false, reason:'no-vapid' };
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(r.publicKey) });
    }
    await api('push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), ua: navigator.userAgent }) });
    return { ok:true };
  } catch(e){ return { ok:false, reason: e.message }; }
}
function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length%4)%4);
  const s = (b64+pad).replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(s); const arr = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

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

        <GoogleSignInBlock onLogged={(t,u) => { localStorage.setItem('tk_token', t); localStorage.setItem('tk_user', JSON.stringify(u)); if (onAuth) onAuth(t, u); else window.location.reload(); }} />

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

function TimelineEntry({ t, idx, canDelete, onDelete, child }) {
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
          {child ? (
            <div className="flex-shrink-0"><Avatar enfant={child} size={42} /></div>
          ) : (
            <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg, width: 42, height: 42 }}>
              <Icon className="w-5 h-5" style={{ color: meta.color }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                {child && <div className="text-xs font-extrabold" style={{ color: meta.color }}>{child.prenom}</div>}
                <div className="font-extrabold text-ink truncate-1 flex items-center gap-1.5">
                  {child && <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: meta.color }} />}
                  {t.titre}
                </div>
              </div>
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
  const [edit, setEdit] = useState(null);
  const load = async () => { try { const c=await api('super/clients'); setClients(c.clients);} catch(e){ toast.error(e.message); } };
  useEffect(() => { load(); }, []);
  return (
    <div className="animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {clients.map(c => (
        <div key={c.id} className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center gap-3 mb-3">
            <Avatar user={c} size={48} />
            <div className="flex-1 min-w-0">
              <div className="font-extrabold truncate-1">{c.prenom} {c.nom}</div>
              <div className="text-xs text-ink-muted truncate-1">{c.email}</div>
              {c.tel && <div className="text-xs text-ink-muted truncate-1">📞 {c.tel}</div>}
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.subscription?.status==='active'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>
              {c.subscription?.status || 'inactif'}
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
          <div className="mt-3 flex gap-2">
            <button onClick={()=>setEdit(c)} className="btn-pill flex-1 bg-teal text-white text-xs shadow-soft"><Edit3 className="w-3 h-3" /> Éditer client</button>
          </div>
        </div>
      ))}
      </div>
      {edit && <SuperClientEditor client={edit} onClose={()=>{setEdit(null);load();}} />}
    </div>
  );
}

function SuperClientEditor({ client, onClose }) {
  const [f, setF] = useState({
    prenom: client.prenom||'', nom: client.nom||'', email: client.email||'', tel: client.tel||'',
    password: '', plan_prix: client.plan_prix||79, notes_admin: client.notes_admin||'',
    subscription: client.subscription || { status: 'trialing', plan: 'timetis-standard' },
  });
  const save = async () => {
    try {
      const body = { ...f };
      if (!body.password) delete body.password;
      await api(`users/${client.id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast.success('Client mis à jour'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-md my-6">
        <div className="flex items-center justify-between mb-4">
          <div><div className="font-extrabold text-lg">Éditer client</div><div className="text-xs text-ink-muted">{client.email}</div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Prénom</label>
              <input value={f.prenom} onChange={e=>setF({...f,prenom:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Nom</label>
              <input value={f.nom} onChange={e=>setF({...f,nom:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          </div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Email</label>
            <input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Téléphone</label>
            <input value={f.tel} onChange={e=>setF({...f,tel:e.target.value})} placeholder="0692 …" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Nouveau mot de passe (optionnel)</label>
            <input type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="Laissez vide pour conserver" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Prix mensuel (€)</label>
              <input type="number" value={f.plan_prix} onChange={e=>setF({...f,plan_prix:+e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Statut abo</label>
              <select value={f.subscription?.status||'trialing'} onChange={e=>setF({...f,subscription:{...(f.subscription||{}), status:e.target.value}})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold">
                <option value="trialing">Essai</option>
                <option value="active">Actif</option>
                <option value="past_due">Impayé</option>
                <option value="canceled">Résilié</option>
              </select></div>
          </div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Notes internes</label>
            <textarea value={f.notes_admin} onChange={e=>setF({...f,notes_admin:e.target.value})} rows={3} placeholder="Notes visibles uniquement en Super Admin…" className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-bgsoft outline-none text-sm font-semibold resize-none" /></div>
          <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </motion.div>
    </div>
  );
}

function SuperDevisFactures() {
  const [tab, setTab] = useState('devis');
  const [devis, setDevis] = useState([]);
  const [factures, setFactures] = useState([]);
  const [clients, setClients] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const load = async () => {
    try {
      const d = await api('super/devis'); setDevis(d.devis||[]);
      const f = await api('super/factures'); setFactures(f.factures||[]);
      const c = await api('super/clients'); setClients(c.clients||[]);
    } catch(e){ toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const sendDoc = async (doc) => {
    try {
      const type = doc.type === 'devis' ? 'devis' : 'factures';
      const r = await api(`super/${type}/${doc.id}/send`, { method: 'POST' });
      // Ouvrir client mail (mailto:) avec sujet + corps pré-remplis
      window.location.href = r.mailto;
      toast.success('Client mail ouvert · document marqué envoyé');
      setTimeout(load, 500);
    } catch(e){ toast.error(e.message); }
  };
  const deleteDoc = async (doc) => {
    if (!confirm(`Supprimer ce ${doc.type} ${doc.numero} ?`)) return;
    try {
      const type = doc.type === 'devis' ? 'devis' : 'factures';
      await api(`super/${type}/${doc.id}`, { method: 'DELETE' });
      toast.success('Supprimé'); load();
    } catch(e){ toast.error(e.message); }
  };
  const items = tab === 'devis' ? devis : factures;

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <button onClick={()=>setTab('devis')} className={`btn-pill text-sm ${tab==='devis'?'bg-teal text-white shadow-soft':'bg-bgsoft text-ink-muted'}`}><Copy className="w-4 h-4" /> Devis ({devis.length})</button>
          <button onClick={()=>setTab('factures')} className={`btn-pill text-sm ${tab==='factures'?'bg-teal text-white shadow-soft':'bg-bgsoft text-ink-muted'}`}><FileText className="w-4 h-4" /> Factures ({factures.length})</button>
        </div>
        <button onClick={()=>setShowCreate(true)} className="btn-pill bg-coral text-white shadow-soft"><Plus className="w-4 h-4" /> Nouveau {tab==='devis'?'devis':'facture'}</button>
      </div>

      {items.length === 0 && <PlaceholderView title={`Aucun ${tab==='devis'?'devis':'facture'} pour l'instant`} icon={FileText} subtitle="Créez votre premier document et envoyez-le directement par email au client." />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(d => (
          <div key={d.id} className="bg-white rounded-lg p-4 shadow-softer">
            <div className="flex items-center justify-between mb-2">
              <div className="font-extrabold">{d.numero}</div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${d.envoye?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>{d.envoye?'Envoyé':'Brouillon'}</span>
            </div>
            <div className="text-sm font-bold truncate-1">{d.client_nom}</div>
            <div className="text-xs text-ink-muted truncate-1">{d.client_email}</div>
            <div className="text-xs text-ink-muted mt-2">{d.description}</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-ink-muted">Période : <b>{d.periode}</b></div>
              <div className="text-lg font-extrabold text-teal-dark">{d.montant_ttc}€</div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={()=>sendDoc(d)} className="btn-pill flex-1 bg-teal text-white text-xs shadow-soft"><Send className="w-3 h-3" /> {d.envoye?'Renvoyer':'Envoyer par email'}</button>
              <button onClick={()=>deleteDoc(d)} className="btn-pill bg-coral/10 text-coral text-xs"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && <SuperDocCreate type={tab} clients={clients} onClose={()=>{setShowCreate(false);load();}} />}
    </div>
  );
}

function SuperDocCreate({ type, clients, onClose }) {
  const [f, setF] = useState({
    client_id: clients[0]?.id || '',
    description: 'Abonnement TiMétis · Solution de gestion de crèche',
    periode: new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'}),
    echeance: new Date(Date.now()+30*86400000).toISOString().slice(0,10),
    notes: '',
    lignes: [{ label: 'Abonnement TiMétis (1ʳᵉ crèche)', qte: 1, pu: 79, total: 79 }],
    tva: 0,
  });
  const [autoPreset, setAutoPreset] = useState(true);

  // Auto-remplir en fonction du nombre de crèches du client
  useEffect(() => {
    if (!autoPreset || !f.client_id) return;
    const c = clients.find(x=>x.id===f.client_id);
    if (!c) return;
    const nb = c.creches?.length || 1;
    const lignes = [{ label: 'Abonnement TiMétis · 1ʳᵉ crèche', qte: 1, pu: 79, total: 79 }];
    if (nb > 1) lignes.push({ label: `Crèches supplémentaires (${nb-1} × 40€)`, qte: nb-1, pu: 40, total: (nb-1)*40 });
    setF(x => ({ ...x, lignes }));
  }, [f.client_id, autoPreset, clients]);

  const total_ht = f.lignes.reduce((s,l)=>s+(l.total||0),0);
  const total_ttc = total_ht + (f.tva||0);

  const updateLigne = (i, k, v) => {
    const nl = [...f.lignes];
    nl[i] = { ...nl[i], [k]: k==='label' ? v : +v };
    if (k==='qte' || k==='pu') nl[i].total = (nl[i].qte||0) * (nl[i].pu||0);
    setF({ ...f, lignes: nl });
    setAutoPreset(false);
  };
  const addLigne = () => { setF({ ...f, lignes: [...f.lignes, { label:'', qte:1, pu:0, total:0 }] }); setAutoPreset(false); };
  const delLigne = (i) => { setF({ ...f, lignes: f.lignes.filter((_,x)=>x!==i) }); setAutoPreset(false); };

  const submit = async (sendNow) => {
    try {
      if (!f.client_id) return toast.error('Choisissez un client');
      const body = { ...f, montant_ht: total_ht, montant_ttc: total_ttc };
      const created = await api(`super/${type}`, { method: 'POST', body: JSON.stringify(body) });
      const doc = created[type==='devis'?'devis':'facture'];
      toast.success(`${type==='devis'?'Devis':'Facture'} créé(e)`);
      if (sendNow && doc?.id) {
        const r = await api(`super/${type==='devis'?'devis':'factures'}/${doc.id}/send`, { method: 'POST' });
        window.location.href = r.mailto;
      }
      onClose();
    } catch(e){ toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-lg my-6">
        <div className="flex items-center justify-between mb-4">
          <div><div className="font-extrabold text-lg">Nouveau {type==='devis'?'devis':'facture'} SaaS</div><div className="text-xs text-ink-muted">Envoi direct par email au client</div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Client (crèche)</label>
            <select value={f.client_id} onChange={e=>{setF({...f,client_id:e.target.value}); setAutoPreset(true);}} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold">
              <option value="">-- Choisir --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom} · {c.email}</option>)}
            </select></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Description</label>
            <input value={f.description} onChange={e=>setF({...f,description:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Période</label>
              <input value={f.periode} onChange={e=>setF({...f,periode:e.target.value})} placeholder="juillet 2026" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Échéance</label>
              <input type="date" value={f.echeance} onChange={e=>setF({...f,echeance:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          </div>

          <div className="bg-bgsoft rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold uppercase text-ink-muted">Lignes</div>
              <button onClick={addLigne} className="btn-pill bg-white text-teal text-xs"><Plus className="w-3 h-3" /> Ajouter</button>
            </div>
            {f.lignes.map((l,i)=>(
              <div key={i} className="grid grid-cols-12 gap-1 items-center">
                <input value={l.label} onChange={e=>updateLigne(i,'label',e.target.value)} placeholder="Libellé" className="col-span-6 px-2 py-1.5 rounded-lg bg-white outline-none text-xs font-semibold" />
                <input type="number" value={l.qte} onChange={e=>updateLigne(i,'qte',e.target.value)} className="col-span-2 px-2 py-1.5 rounded-lg bg-white outline-none text-xs font-semibold" />
                <input type="number" step="0.01" value={l.pu} onChange={e=>updateLigne(i,'pu',e.target.value)} className="col-span-3 px-2 py-1.5 rounded-lg bg-white outline-none text-xs font-semibold" />
                <button onClick={()=>delLigne(i)} className="col-span-1 text-coral"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-white text-xs">
              <span className="text-ink-muted">Total HT</span>
              <b>{total_ht}€</b>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-muted">TVA</span>
              <input type="number" value={f.tva} onChange={e=>setF({...f,tva:+e.target.value})} className="w-20 px-2 py-1 rounded bg-white outline-none text-xs font-semibold text-right" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <b>Total TTC</b>
              <b className="text-teal-dark text-lg">{total_ttc}€</b>
            </div>
          </div>

          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Notes / conditions</label>
            <textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} rows={2} placeholder="Ex : règlement par virement IBAN FR76…" className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-bgsoft outline-none text-sm font-semibold resize-none" /></div>

          <div className="flex gap-2">
            <button onClick={()=>submit(false)} className="btn-pill flex-1 bg-bgsoft text-ink-strong text-sm"><Save className="w-4 h-4" /> Enregistrer</button>
            <button onClick={()=>submit(true)} className="btn-pill flex-1 bg-teal text-white shadow-soft text-sm"><Send className="w-4 h-4" /> Créer & envoyer</button>
          </div>
        </div>
      </motion.div>
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
// ===== Urgent Alerts Banner (admin/pro) =====
const ALERT_META = {
  retard: { label: 'Retard prévu', icon: Clock, color: '#FFA726', bg: '#FFF4E0' },
  changement_horaire: { label: 'Changement horaire', icon: Calendar, color: '#8B6BE8', bg: '#EFEAFF' },
  medical: { label: 'Traitement / alimentation', icon: Heart, color: '#FF6B6B', bg: '#FFE9E9' },
  recuperation: { label: 'Récupération anticipée', icon: Zap, color: '#3ECDB5', bg: '#E6F9F5' },
};

function UrgentAlertsBanner({ alertes, onDone }) {
  const traiter = async (id) => {
    try { await api(`parent/alertes/${id}`, { method: 'PUT' }); toast.success('Alerte traitée'); onDone?.(); }
    catch(e){ toast.error(e.message); }
  };
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-coral to-[#E53E3E] text-white rounded-lg p-4 shadow-soft">
      <div className="flex items-center gap-3 mb-3">
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Bell className="w-5 h-5" />
        </motion.div>
        <div className="flex-1">
          <div className="font-extrabold">{alertes.length} alerte{alertes.length>1?'s':''} parent{alertes.length>1?'s':''} en attente</div>
          <div className="text-xs opacity-90">Message urgent — à traiter rapidement</div>
        </div>
      </div>
      <div className="space-y-2">
        {alertes.slice(0, 3).map(a => {
          const meta = ALERT_META[a.alert_type] || { label: 'Alerte', icon: AlertTriangle };
          const Icon = meta.icon;
          return (
            <div key={a.id} className="bg-white/15 backdrop-blur rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wider opacity-80">{meta.label} · {a.from_nom}</div>
                <div className="text-sm font-semibold truncate-1">{a.contenu}</div>
                {a.heure_prevue && <div className="text-[10px] opacity-80">Heure prévue : {fmtTime(a.heure_prevue)}</div>}
              </div>
              <button onClick={()=>traiter(a.id)} className="btn-pill bg-white text-coral text-xs font-extrabold shadow-soft">
                <CheckCircle2 className="w-3 h-3" /> Traiter
              </button>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function AdminDashboard({ user, activeCId }) {
  const [stats, setStats] = useState(null);
  const [transmissions, setTransmissions] = useState([]);
  const [enfants, setEnfants] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const load = async () => {
    try {
      const suffix = activeCId ? `?creche_id=${activeCId}` : '';
      const [s, t, e, a] = await Promise.all([
        api('dashboard/stats'+suffix),
        api(`transmissions?date=${new Date().toISOString().slice(0,10)}${activeCId?`&creche_id=${activeCId}`:''}`),
        api('enfants'+suffix),
        api('parent/alertes'+suffix).catch(()=>({alertes:[]})),
      ]);
      setStats(s.stats); setTransmissions(t.transmissions); setEnfants(e.enfants); setAlertes(a.alertes||[]);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); const it = setInterval(load, 5000); return () => clearInterval(it); }, [activeCId]);
  if (!stats) return <Loading />;
  const alertesNonLues = alertes.filter(x => !x.lu);
  return (
    <div className="space-y-4 animate-fade-up">
      {alertesNonLues.length > 0 && <UrgentAlertsBanner alertes={alertesNonLues} onDone={load} />}
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
            {transmissions.map((t, i) => <TimelineEntry key={t.id} t={t} idx={i} child={enfants.find(e=>e.id===t.enfant_id)} />)}
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
  const [editAvatar, setEditAvatar] = useState(null);
  const [editSante, setEditSante] = useState(null);
  const [editProfil, setEditProfil] = useState(null);
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
                <Avatar enfant={e} size={56} onClick={()=>setEditAvatar(e)} />
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
              <div className="mt-2 flex gap-2">
                <button onClick={()=>setEditProfil(e)} className="btn-pill bg-teal-light text-teal-dark text-xs flex-1"><Edit3 className="w-3 h-3" /> Éditer</button>
                <button onClick={()=>setEditAvatar(e)} className="btn-pill bg-bgsoft text-ink-muted text-xs"><Camera className="w-3 h-3" /></button>
                <button onClick={()=>setEditSante(e)} className="btn-pill bg-coral/10 text-coral text-xs"><Heart className="w-3 h-3" /></button>
              </div>
            </motion.div>
          );
        })}
      </div>
      {showAdd && <AddChildModal activeCId={activeCId} onClose={() => { setShowAdd(false); load(); }} />}
      {editAvatar && <AvatarUploadModal enfant={editAvatar} onClose={()=>setEditAvatar(null)} onSaved={load} />}
      {editSante && <FicheSanteModal enfant={editSante} onClose={()=>setEditSante(null)} onSaved={load} />}
      {editProfil && <EnfantEditorModal enfant={editProfil} tags={tags} onClose={()=>{setEditProfil(null);load();}} />}
    </div>
  );
}

function EnfantEditorModal({ enfant, tags, onClose }) {
  const [f, setF] = useState({
    prenom: enfant.prenom || '',
    nom: enfant.nom || '',
    date_naissance: enfant.date_naissance || '',
    groupe: enfant.groupe || 'Tournesol',
    contrat_heures: enfant.contrat_heures || 35,
    mensualite: enfant.mensualite || 500,
    notes: enfant.notes || '',
    tags: enfant.tags || [],
  });
  const toggleTag = (id) => setF({...f, tags: f.tags.includes(id) ? f.tags.filter(x=>x!==id) : [...f.tags, id] });
  const save = async () => {
    try { await api(`enfants/${enfant.id}`, { method: 'PUT', body: JSON.stringify(f) });
      toast.success('Profil mis à jour'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-lg my-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3"><Avatar enfant={enfant} size={44} /><div><div className="font-extrabold text-lg">Éditer {enfant.prenom}</div><div className="text-xs text-ink-muted">Profil complet</div></div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Prénom</label>
              <input value={f.prenom} onChange={e=>setF({...f,prenom:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Nom</label>
              <input value={f.nom} onChange={e=>setF({...f,nom:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          </div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Date de naissance</label>
            <input type="date" value={f.date_naissance} onChange={e=>setF({...f,date_naissance:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Section</label>
            <select value={f.groupe} onChange={e=>setF({...f,groupe:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold">
              <option>Tournesol</option><option>Coquelicot</option><option>Marguerite</option>
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Contrat (h/sem)</label>
              <input type="number" value={f.contrat_heures} onChange={e=>setF({...f,contrat_heures:+e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Mensualité (€)</label>
              <input type="number" value={f.mensualite} onChange={e=>setF({...f,mensualite:+e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          </div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Étiquettes</label>
            <div className="flex gap-2 flex-wrap mt-1">
              {tags.map(t => (
                <button key={t.id} onClick={()=>toggleTag(t.id)} className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${f.tags.includes(t.id)?'ring-2':''}`} style={{ background: t.couleur+'22', color: t.couleur, ringColor: t.couleur }}>{t.nom}</button>
              ))}
            </div></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Notes</label>
            <textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} placeholder="Habitudes, personnalité, particularités..." rows={3} className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-bgsoft outline-none text-sm font-semibold resize-none" /></div>
          <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </motion.div>
    </div>
  );
}

function FicheSanteModal({ enfant, onClose, onSaved }) {
  const [f, setF] = useState({
    allergies: enfant.allergies || '',
    regime_alimentaire: enfant.regime_alimentaire || '',
    medecin: enfant.medecin || '',
    contacts_urgence: enfant.contacts_urgence || [{ nom: '', tel: '', lien: '' }],
    vaccins: enfant.vaccins || '',
    notes_sante: enfant.notes_sante || '',
  });
  const save = async () => {
    try { await api(`enfants/${enfant.id}/sante`, { method: 'PUT', body: JSON.stringify(f) });
      toast.success('Fiche santé mise à jour'); onSaved?.(); onClose();
    } catch(e){ toast.error(e.message); }
  };
  const setCU = (i, k, v) => setF({...f, contacts_urgence: f.contacts_urgence.map((c,x)=>x===i?{...c,[k]:v}:c)});
  const addCU = () => setF({...f, contacts_urgence: [...f.contacts_urgence, {nom:'',tel:'',lien:''}]});
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-lg my-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3"><Heart className="w-6 h-6 text-coral" /><div><div className="font-extrabold text-lg">Fiche santé de {enfant.prenom}</div><div className="text-xs text-ink-muted">Confidentiel</div></div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Allergies connues</label>
            <input value={f.allergies} onChange={e=>setF({...f,allergies:e.target.value})} placeholder="Ex : Lait de vache, gluten..." className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Régime alimentaire</label>
            <input value={f.regime_alimentaire} onChange={e=>setF({...f,regime_alimentaire:e.target.value})} placeholder="Ex : Végétarien, sans porc..." className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Médecin traitant</label>
            <input value={f.medecin} onChange={e=>setF({...f,medecin:e.target.value})} placeholder="Dr. Dupont · 0262 21 00 00" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" /></div>
          <div>
            <label className="text-xs font-extrabold uppercase text-ink-muted">Contacts d'urgence</label>
            {f.contacts_urgence.map((c,i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mt-2">
                <input value={c.nom} onChange={e=>setCU(i,'nom',e.target.value)} placeholder="Nom" className="px-3 py-2 rounded-xl bg-bgsoft outline-none text-xs font-semibold" />
                <input value={c.tel} onChange={e=>setCU(i,'tel',e.target.value)} placeholder="Téléphone" className="px-3 py-2 rounded-xl bg-bgsoft outline-none text-xs font-semibold" />
                <input value={c.lien} onChange={e=>setCU(i,'lien',e.target.value)} placeholder="Lien (papa, mamie...)" className="px-3 py-2 rounded-xl bg-bgsoft outline-none text-xs font-semibold" />
              </div>
            ))}
            <button onClick={addCU} className="btn-pill bg-teal-light text-teal-dark text-xs mt-2"><Plus className="w-3 h-3" /> Contact</button>
          </div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Vaccins</label>
            <textarea value={f.vaccins} onChange={e=>setF({...f,vaccins:e.target.value})} placeholder="DTP à jour, ROR..." rows={2} className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold resize-none" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Notes santé</label>
            <textarea value={f.notes_sante} onChange={e=>setF({...f,notes_sante:e.target.value})} placeholder="Traitements en cours, particularités..." rows={2} className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold resize-none" /></div>
          <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </motion.div>
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
  const [enfants, setEnfants] = useState([]);
  const [edit, setEdit] = useState(null); // famille object or 'new'
  const load = async () => {
    try {
      const d = await api('familles'+(activeCId?`?creche_id=${activeCId}`:''));
      setItems(d.familles);
      const en = await api('enfants'+(activeCId?`?creche_id=${activeCId}`:''));
      setEnfants(en.enfants||[]);
    } catch(e){ toast.error(e.message); }
  };
  useEffect(() => { load(); }, [activeCId]);
  const enfantsPourFamille = (f) => {
    const linked = enfants.filter(e => (f.enfants||[]).includes(e.id));
    return linked;
  };
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setEdit('new')} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouveau foyer</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(f => {
          const linked = enfantsPourFamille(f);
          return (
          <div key={f.id} className="bg-white rounded-lg p-5 shadow-softer">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-lg truncate-1">{f.nom}</div>
                <div className="text-xs text-ink-muted">{f.tel} · {f.adresse || '—'}</div>
                {f.email && <div className="text-xs text-ink-muted mt-0.5">{f.email}</div>}
              </div>
              <button onClick={()=>setEdit(f)} className="btn-pill bg-bgsoft text-ink-muted text-xs"><Edit3 className="w-3 h-3" /> Éditer</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-ink-muted">Parents</div><div className="font-bold">{(f.parents||[]).length}</div></div>
              <div><div className="text-ink-muted">Enfants rattachés</div><div className="font-bold">{linked.length}</div></div>
            </div>
            {linked.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {linked.map(en => <span key={en.id} className="text-[10px] font-bold bg-teal-light text-teal-dark px-2 py-0.5 rounded-full">{en.prenom}</span>)}
              </div>
            )}
            {f.notes && <div className="mt-3 pt-3 border-t border-bgsoft text-xs text-ink-muted italic">{f.notes}</div>}
          </div>
        );})}
      </div>
      {edit && <FamilleEditor famille={edit==='new'?null:edit} enfantsAll={enfants} activeCId={activeCId} onClose={()=>{setEdit(null);load();}} />}
    </div>
  );
}

function FamilleEditor({ famille, enfantsAll, activeCId, onClose }) {
  const [f, setF] = useState(famille || { nom:'', tel:'', email:'', adresse:'', notes:'', enfants: [] });
  const toggleEnfant = (id) => {
    const cur = f.enfants||[];
    setF({ ...f, enfants: cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id] });
  };
  const save = async () => {
    try {
      if (famille?.id) await api(`familles/${famille.id}`, { method: 'PUT', body: JSON.stringify(f) });
      else await api('familles', { method: 'POST', body: JSON.stringify({...f, creche_id: activeCId}) });
      toast.success(famille?'Foyer mis à jour':'Foyer créé'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  const del = async () => {
    if (!famille?.id || !confirm('Supprimer ce foyer ?')) return;
    try { await api(`familles/${famille.id}`, { method: 'DELETE' }); toast.success('Foyer supprimé'); onClose(); } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-md my-6">
        <div className="flex items-center justify-between mb-4">
          <div><div className="font-extrabold text-lg">{famille?'Éditer le foyer':'Nouveau foyer'}</div><div className="text-xs text-ink-muted">Coordonnées & enfants rattachés</div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Nom du foyer</label>
            <input value={f.nom} onChange={e=>setF({...f,nom:e.target.value})} placeholder="Famille Dupont" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Téléphone</label>
            <input value={f.tel} onChange={e=>setF({...f,tel:e.target.value})} placeholder="0692 11 22 33" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Email</label>
            <input type="email" value={f.email||''} onChange={e=>setF({...f,email:e.target.value})} placeholder="famille@email.com" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Adresse</label>
            <input value={f.adresse} onChange={e=>setF({...f,adresse:e.target.value})} placeholder="12 rue des Flamboyants, 97400 Saint-Denis" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase text-ink-muted">Enfants rattachés</label>
              <span className="text-xs font-bold text-teal-dark">{(f.enfants||[]).length} sélectionné{(f.enfants||[]).length>1?'s':''}</span>
            </div>
            <div className="mt-2 bg-bgsoft rounded-2xl p-2 max-h-48 overflow-y-auto space-y-1">
              {(enfantsAll||[]).length === 0 && <div className="text-xs text-ink-muted italic p-2">Aucun enfant enregistré. Créez d'abord un enfant depuis la vue "Enfants".</div>}
              {(enfantsAll||[]).map(en => {
                const checked = (f.enfants||[]).includes(en.id);
                return (
                  <label key={en.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer ${checked?'bg-teal text-white':'bg-white'}`}>
                    <input type="checkbox" checked={checked} onChange={()=>toggleEnfant(en.id)} className="w-4 h-4 accent-teal-dark" />
                    <span className="text-sm font-semibold flex-1 truncate">{en.prenom} {en.nom}</span>
                    <span className={`text-[10px] font-bold ${checked?'text-white/80':'text-ink-muted'}`}>{en.groupe||''}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-1 text-[11px] text-ink-muted">Cochez pour rattacher/dératacher un enfant à ce foyer.</div>
          </div>

          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Notes</label>
            <textarea value={f.notes||''} onChange={e=>setF({...f,notes:e.target.value})} placeholder="Informations complémentaires..." rows={3} className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-bgsoft outline-none text-sm font-semibold resize-none" /></div>
          <div className="flex gap-2">
            {famille && <button onClick={del} className="btn-pill bg-coral/10 text-coral text-xs"><Trash2 className="w-3 h-3" /> Supprimer</button>}
            <button onClick={save} className="btn-pill flex-1 bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
          </div>
        </div>
      </motion.div>
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
  const [edit, setEdit] = useState(null);
  const load = async () => { try {const d=await api('tags'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.tags);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  const del = async (t) => {
    if (!confirm(`Supprimer l'étiquette "${t.nom}" ? Elle sera retirée de tous les enfants concernés.`)) return;
    try { await api(`tags/${t.id}`, { method: 'DELETE' }); toast.success('Étiquette supprimée'); load(); }
    catch(e){ toast.error(e.message); }
  };
  // Regroupement par catégorie (première lettre ou par couleur si absent)
  const grouped = items.reduce((acc, t) => {
    const cat = t.categorie || 'Général';
    (acc[cat] = acc[cat] || []).push(t);
    return acc;
  }, {});
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-ink-muted">Classez les étiquettes par catégorie (Allergies, Comportement, Régime alimentaire…). Cliquez pour éditer, croix rouge pour supprimer.</div>
        <button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouvelle étiquette</button>
      </div>
      {Object.entries(grouped).map(([cat, tags]) => (
        <div key={cat} className="bg-white rounded-lg p-5 shadow-softer">
          <div className="font-extrabold text-sm uppercase tracking-wider text-ink-muted mb-3">{cat}</div>
          <div className="flex gap-2 flex-wrap">
            {tags.map(t => (
              <div key={t.id} className="group relative flex items-center gap-1 pl-3 pr-1 py-1 rounded-full font-bold text-sm cursor-pointer transition hover:shadow-soft" style={{ background: t.couleur+'22', color: t.couleur }} onClick={()=>setEdit(t)}>
                <span>{t.nom}</span>
                <button onClick={(e)=>{e.stopPropagation();del(t);}} className="ml-1 w-5 h-5 rounded-full bg-white/60 hover:bg-coral hover:text-white flex items-center justify-center transition"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {tags.length === 0 && <div className="text-xs text-ink-muted italic">Aucune étiquette dans cette catégorie</div>}
          </div>
        </div>
      ))}
      {items.length === 0 && <PlaceholderView title="Aucune étiquette" icon={TagIcon} subtitle="Créez des étiquettes pour classer les enfants (allergies, régimes, comportements…)" />}
      {showAdd && <TagEditorModal activeCId={activeCId} onClose={()=>{setShowAdd(false);load();}} />}
      {edit && <TagEditorModal tag={edit} activeCId={activeCId} onClose={()=>{setEdit(null);load();}} />}
    </div>
  );
}

function TagEditorModal({ tag, activeCId, onClose }) {
  const CATS = ['Général', 'Allergies', 'Régime alimentaire', 'Comportement', 'Santé', 'Sommeil', 'Autres'];
  const COLORS = ['#3ECDB5','#FF6B6B','#FFA726','#66BB6A','#8B6BE8','#42A5F5','#EC407A','#26A69A','#7E57C2'];
  const [f, setF] = useState(tag || { nom:'', couleur:'#3ECDB5', categorie:'Général' });
  const save = async () => {
    if (!f.nom.trim()) return toast.error('Nom obligatoire');
    try {
      if (tag) await api(`tags/${tag.id}`, { method: 'PUT', body: JSON.stringify(f) });
      else await api('tags', { method: 'POST', body: JSON.stringify({ ...f, creche_id: activeCId }) });
      toast.success(tag?'Étiquette mise à jour':'Étiquette créée'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-lg p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="font-extrabold text-lg">{tag?'Éditer l\'étiquette':'Nouvelle étiquette'}</div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Nom</label>
            <input value={f.nom} onChange={e=>setF({...f,nom:e.target.value})} placeholder="Ex : Allergie lait" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Catégorie</label>
            <select value={f.categorie||'Général'} onChange={e=>setF({...f,categorie:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold">
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Couleur</label>
            <div className="mt-2 flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={()=>setF({...f,couleur:c})} className={`w-8 h-8 rounded-full transition ${f.couleur===c?'ring-4 ring-offset-2 ring-teal':''}`} style={{background:c}} />
              ))}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-bgsoft flex items-center justify-center">
            <span className="px-3 py-1.5 rounded-full font-bold text-sm" style={{background:f.couleur+'22', color:f.couleur}}>{f.nom || 'Aperçu'}</span>
          </div>
          <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </motion.div>
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
  const changeStatut = async (d, s) => {
    try { await api(`devis/${d.id}`, { method: 'PUT', body: JSON.stringify({ statut: s }) }); toast.success('Statut mis à jour'); load(); }
    catch(e){ toast.error(e.message); }
  };
  const del = async (d) => { if (!confirm(`Supprimer le devis ${d.numero} ?`)) return; try { await api(`devis/${d.id}`, { method: 'DELETE' }); toast.success('Devis supprimé'); load(); } catch(e){ toast.error(e.message); } };
  const downloadPDF = (d) => generateDocPDF(d, 'devis');
  const STATUTS = [{v:'en_cours', l:'En cours', c:'bg-sky/20 text-sky'}, {v:'en_attente', l:'En attente', c:'bg-amber/20 text-amber'}, {v:'envoye', l:'Envoyé', c:'bg-teal-light text-teal-dark'}];
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouveau devis</button></div>
      <div className="bg-white rounded-lg shadow-softer">
        {items.length === 0 && <div className="p-10 text-center text-ink-muted">Aucun devis pour l'instant</div>}
        {items.map(d => (
          <div key={d.id} className="p-4 border-b border-bgsoft last:border-0 flex items-center gap-3 hover:bg-bgsoft transition flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-violet/10 flex items-center justify-center flex-shrink-0"><Copy className="w-5 h-5 text-violet" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate-1">{d.numero} · {d.famille}</div>
              <div className="text-xs text-ink-muted">Du {fmtDate(d.date_debut||d.date||d.created_at)} au {fmtDate(d.valide_jusqu||d.date_fin)}</div>
            </div>
            <div className="font-extrabold">{fmtEur(d.total_ttc)}</div>
            <select value={d.statut||'en_cours'} onChange={e=>changeStatut(d, e.target.value)} className={`text-[10px] font-bold px-2 py-1 rounded-full outline-none cursor-pointer ${STATUTS.find(s=>s.v===d.statut)?.c || 'bg-bgsoft text-ink-muted'}`}>
              {STATUTS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <button onClick={()=>downloadPDF(d)} className="btn-pill text-xs bg-teal text-white shadow-soft"><Download className="w-3 h-3" /> PDF</button>
            <button onClick={()=>del(d)} className="btn-pill text-xs bg-coral/10 text-coral"><Trash2 className="w-3 h-3" /></button>
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
  const changeStatut = async (f, s) => {
    try { await api(`factures/${f.id}`, { method: 'PUT', body: JSON.stringify({ statut: s }) }); toast.success('Statut mis à jour'); load(); }
    catch(e){ toast.error(e.message); }
  };
  const del = async (f) => { if (!confirm(`Supprimer la facture ${f.numero} ?`)) return; try { await api(`factures/${f.id}`, { method: 'DELETE' }); toast.success('Facture supprimée'); load(); } catch(e){ toast.error(e.message); } };
  const downloadPDF = (f) => generateDocPDF(f, 'facture');
  const STATUTS = [{v:'en_cours', l:'En cours', c:'bg-sky/20 text-sky'}, {v:'en_attente', l:'En attente', c:'bg-amber/20 text-amber'}, {v:'payee', l:'Payée', c:'bg-teal-light text-teal-dark'}];
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouvelle facture</button></div>
      <div className="bg-white rounded-lg shadow-softer">
        {items.length === 0 && <div className="p-10 text-center text-ink-muted">Aucune facture pour l'instant</div>}
        {items.map(f => (
          <div key={f.id} className="p-4 border-b border-bgsoft last:border-0 flex items-center gap-3 hover:bg-bgsoft transition flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-teal" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate-1">{f.numero||'F-—'} · {f.famille}</div>
              <div className="text-xs text-ink-muted">{f.mois} · Échéance {fmtDate(f.echeance)}</div>
            </div>
            <div className="font-extrabold">{fmtEur(f.total_ttc||f.montant)}</div>
            <select value={f.statut||'en_cours'} onChange={e=>changeStatut(f, e.target.value)} className={`text-[10px] font-bold px-2 py-1 rounded-full outline-none cursor-pointer ${STATUTS.find(s=>s.v===f.statut)?.c || 'bg-bgsoft text-ink-muted'}`}>
              {STATUTS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <button onClick={()=>downloadPDF(f)} className="btn-pill text-xs bg-teal text-white shadow-soft"><Download className="w-3 h-3" /> PDF</button>
            <button onClick={()=>del(f)} className="btn-pill text-xs bg-coral/10 text-coral"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
      {showAdd && <DocumentEditorModal type="facture" activeCId={activeCId} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

// Génération PDF simplifiée via window.print d'un blob HTML (pas de dépendance)
function generateDocPDF(doc, type) {
  const isDevis = type === 'devis';
  const total = (doc.articles||[]).reduce((s,a)=>s+((+a.prix_unit||0)*(+a.quantite||1)),0);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${doc.numero||''}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#2D3748;max-width:800px;margin:auto;}
      header{border-bottom:3px solid #3ECDB5;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:flex-start;}
      .brand{color:#3ECDB5;font-weight:900;font-size:32px;}.brand small{display:block;font-size:11px;color:#718096;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-top:4px;}
      .meta{text-align:right;font-size:12px;color:#718096;}
      h1{color:#2D3748;font-size:22px;margin:20px 0 8px;}
      .info{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px;font-size:13px;}
      .info b{display:block;color:#3ECDB5;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
      table{width:100%;border-collapse:collapse;margin:20px 0;}
      th{background:#F5F7F9;padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#718096;letter-spacing:1px;}
      td{padding:10px;border-bottom:1px solid #E2E8F0;font-size:13px;}
      td:last-child,th:last-child{text-align:right;}
      .total{background:#E6F9F5;padding:20px;border-radius:12px;text-align:right;font-size:16px;margin-top:20px;}
      .total b{font-size:24px;color:#3ECDB5;}
      footer{margin-top:60px;padding-top:20px;border-top:1px solid #E2E8F0;font-size:11px;color:#718096;text-align:center;}
      @media print { body { padding: 20px; } }
    </style></head><body>
    <header>
      <div><div class="brand">TiMétis<small>Made in 974 · Crèche</small></div></div>
      <div class="meta"><b>${isDevis?'DEVIS':'FACTURE'}</b><br/>N° ${doc.numero||''}<br/>${new Date().toLocaleDateString('fr-FR')}</div>
    </header>
    <div class="info">
      <div><b>Client</b>${doc.famille||'—'}</div>
      <div><b>${isDevis?'Validité':'Échéance'}</b>${fmtDate(isDevis?(doc.valide_jusqu||doc.date_fin):doc.echeance)}</div>
      ${isDevis?`<div><b>Période</b>Du ${fmtDate(doc.date_debut||doc.date||doc.created_at)} au ${fmtDate(doc.valide_jusqu||doc.date_fin)}</div>`:`<div><b>Période</b>${doc.mois||''}</div>`}
      <div><b>Statut</b>${(doc.statut||'—').replace('_',' ')}</div>
    </div>
    <table><thead><tr><th>Description</th><th>Qté</th><th>Prix unit.</th><th>Total</th></tr></thead>
    <tbody>${(doc.articles||[]).map(a => `<tr><td>${a.description||''}</td><td>${a.quantite||1}</td><td>${(+a.prix_unit||0).toFixed(2)} €</td><td><b>${((+a.prix_unit||0)*(+a.quantite||1)).toFixed(2)} €</b></td></tr>`).join('')}</tbody></table>
    <div class="total">Total TTC : <b>${total.toFixed(2)} €</b></div>
    <footer>TiMétis · Solution locale de gestion de crèche · Made in 974 🌺<br/>${isDevis?'Devis à valider et retourner signé pour accord.':'Règlement à réception. Merci pour votre confiance.'}</footer>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);};</script>
    </body></html>`;
  const w = window.open('', '_blank', 'width=800,height=900');
  if (w) { w.document.write(html); w.document.close(); }
  else toast.error('Pop-up bloqué — autorisez les pop-ups pour télécharger le PDF');
}

function DocumentEditorModal({ type, activeCId, onClose }) {
  const [familles, setFamilles] = useState([]);
  const [famille_id, setFamId] = useState('');
  const [articles, setArticles] = useState([{ description: '', quantite: 1, prix_unit: 0, tva: 0 }]);
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0,10));
  const [dateFin, setDateFin] = useState(new Date(Date.now()+30*86400000).toISOString().slice(0,10));
  useEffect(() => { (async()=>{try{const d=await api('familles'+(activeCId?`?creche_id=${activeCId}`:'')); setFamilles(d.familles);}catch(e){}})(); }, [activeCId]);
  const total = articles.reduce((s,a)=>s+((+a.prix_unit||0)*(+a.quantite||1)),0);
  const addLine = () => setArticles([...articles, { description: '', quantite: 1, prix_unit: 0, tva: 0 }]);
  const removeLine = (i) => setArticles(articles.filter((_,x)=>x!==i));
  const setLine = (i, k, v) => setArticles(articles.map((a,x)=>x===i?{...a,[k]:v}:a));
  const submit = async () => {
    try {
      const famille = familles.find(f=>f.id===famille_id);
      const body = { creche_id: activeCId, famille_id, famille: famille?.nom||'', articles,
        date_debut: dateDebut, date_fin: dateFin,
        ...(type==='devis'?{valide_jusqu:dateFin, statut:'en_cours'}:{echeance:dateFin, mois:new Date(dateDebut).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}), statut:'en_cours'})
      };
      await api(type==='devis'?'devis':'factures', { method: 'POST', body: JSON.stringify(body) });
      toast.success(type==='devis'?'Devis créé':'Facture créée'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-2xl my-6">
        <div className="flex items-center justify-between mb-4">
          <div><div className="font-extrabold text-xl">{type==='devis'?'Nouveau devis':'Nouvelle facture'}</div><div className="text-xs text-ink-muted">TiMétis · Made in 974</div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Famille (client)</label>
            <select value={famille_id} onChange={e=>setFamId(e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none font-semibold text-sm">
              <option value="">— Choisir une famille —</option>
              {familles.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">{type==='devis'?'Début de période':'Date d\'émission'}</label>
              <input type="date" value={dateDebut} onChange={e=>setDateDebut(e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none font-semibold text-sm" /></div>
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">{type==='devis'?'Fin de période / validité':'Échéance de paiement'}</label>
              <input type="date" value={dateFin} onChange={e=>setDateFin(e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none font-semibold text-sm" /></div>
          </div>
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
  const del = async (e) => {
    if (!confirm(`Supprimer définitivement l'employé ${e.prenom} ${e.nom} ?\nCela supprimera également ses pointages et fiches de paie.`)) return;
    try { await api(`employes/${e.id}`, { method: 'DELETE' }); toast.success('Employé supprimé'); load(); }
    catch(err){ toast.error(err.message); }
  };
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouvel employé</button></div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="font-extrabold text-lg mb-3">Pointages du jour</div>
        <div className="space-y-2">
          {employes.length === 0 && <div className="text-sm text-ink-muted text-center py-6">Aucun employé enregistré. Créez-en un avec « Nouvel employé ».</div>}
          {employes.map(e => {
            const p = pointages.find(x => x.employe_id === e.id && x.date === new Date().toISOString().slice(0,10));
            return (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft">
                <Avatar user={e} size={40} />
                <div className="flex-1 min-w-0"><div className="font-bold truncate-1">{e.prenom} {e.nom}</div><div className="text-xs text-ink-muted truncate-1">{e.email} · {e.poste||'Auxiliaire'}</div></div>
                {p ? <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-light text-teal-dark">Pointé {fmtTime(p.heure)}</span>
                   : <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber/20 text-amber">Non pointé</span>}
                <button onClick={()=>del(e)} title="Supprimer" className="p-2 rounded-full bg-coral/10 text-coral hover:bg-coral hover:text-white transition"><Trash2 className="w-4 h-4" /></button>
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
  const [selected, setSelected] = useState(null);
  const [planning, setPlanning] = useState(null);
  const [edit, setEdit] = useState(false);
  const [semaine, setSemaine] = useState(new Date().toISOString().slice(0,10));

  const loadEmployes = async () => { try{const e=await api('employes'+(activeCId?`?creche_id=${activeCId}`:'')); setEmployes(e.employes); if (!selected && e.employes[0]) setSelected(e.employes[0].id);}catch(e){} };
  const loadPlanning = async () => { if (!selected) return; try {const p=await api(`employes/${selected}/planning?semaine=${semaine}`); setPlanning(p);}catch(e){toast.error(e.message);} };

  useEffect(() => { loadEmployes(); }, [activeCId]);
  useEffect(() => { loadPlanning(); }, [selected, semaine]);

  const statutMeta = {
    a_l_heure: { color: '#3ECDB5', bg: '#E6F9F5', label: 'À l\'heure' },
    depasse: { color: '#8B6BE8', bg: '#EFEAFF', label: 'Dépassé' },
    court: { color: '#FFA726', bg: '#FFF4E0', label: 'Court' },
    absent: { color: '#FF6B6B', bg: '#FFE9E9', label: 'Absent' },
    a_venir: { color: '#718096', bg: '#F5F7F9', label: 'À venir' },
    en_cours: { color: '#42A5F5', bg: '#E3F2FD', label: 'En cours' },
    repos: { color: '#CBD5E0', bg: '#F5F7F9', label: 'Repos' },
  };
  const emp = employes.find(e => e.id === selected);

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {employes.map(e => (
            <button key={e.id} onClick={()=>setSelected(e.id)} className={`flex items-center gap-2 px-3 py-2 rounded-pill text-sm font-bold flex-shrink-0 ${selected===e.id?'bg-teal text-white shadow-soft':'bg-white text-ink-muted'}`}>
              <Avatar user={e} size={26} /> {e.prenom}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={semaine} onChange={e=>setSemaine(e.target.value)} className="px-3 py-2 rounded-pill bg-white outline-none text-xs font-semibold shadow-softer" />
          {emp && <button onClick={()=>setEdit(true)} className="btn-pill bg-teal text-white shadow-soft text-xs"><Edit3 className="w-3 h-3" /> Modifier contrat</button>}
        </div>
      </div>

      {planning && emp && (
        <>
          <div className="bg-white rounded-lg p-4 shadow-softer text-xs text-ink-muted">
            <b className="text-ink-strong">💡 Comment lire ce planning ?</b> — <b>Prévu</b> = heures théoriques du contrat ; <b>Effectif</b> = heures réellement pointées cette semaine ; <b>Prorata</b> = ratio effectif / prévu (100% = contrat respecté) ; <b>Salaire estimé</b> = taux horaire × heures effectives. La grille ci-dessous détaille jour par jour (arrivée → départ prévus vs réels, écart en minutes).
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-4 shadow-softer">
              <div className="text-[11px] font-extrabold uppercase text-ink-muted">Heures prévues</div>
              <div className="text-2xl font-extrabold mt-1">{Math.floor(planning.total_prevu_min/60)}h{String(planning.total_prevu_min%60).padStart(2,'0')}</div>
              <div className="text-[10px] text-ink-muted mt-0.5">selon contrat hebdo</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-softer">
              <div className="text-[11px] font-extrabold uppercase text-ink-muted">Heures effectuées</div>
              <div className="text-2xl font-extrabold text-teal-dark mt-1">{Math.floor(planning.total_effectif_min/60)}h{String(planning.total_effectif_min%60).padStart(2,'0')}</div>
              <div className="text-[10px] text-ink-muted mt-0.5">pointages réels</div>
            </div>
            <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-4 shadow-soft">
              <div className="text-[11px] font-extrabold uppercase opacity-80">Prorata contrat</div>
              <div className="text-2xl font-extrabold mt-1">{planning.prorata_pct}%</div>
              <div className="text-[10px] opacity-80 mt-0.5">effectif ÷ prévu</div>
            </div>
            {planning.salaire_estime !== undefined && (
              <div className="bg-white rounded-lg p-4 shadow-softer">
                <div className="text-[11px] font-extrabold uppercase text-ink-muted">Salaire estimé</div>
                <div className="text-2xl font-extrabold text-violet mt-1">{fmtEur(planning.salaire_estime)}</div>
                <div className="text-[10px] text-ink-muted mt-0.5">brut · taux × heures</div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-5 shadow-softer overflow-x-auto">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div>
                <div className="font-extrabold text-lg">Semaine du {fmtDate(planning.semaine_du)}</div>
                <div className="text-xs text-ink-muted">Chaque colonne = 1 jour · Chiffres = arrivée → départ · Delta = écart entre prévu et réel</div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                {Object.entries(statutMeta).map(([k,v]) => <span key={k} className="px-2 py-1 rounded-full font-bold" style={{background:v.bg,color:v.color}}>{v.label}</span>)}
              </div>
            </div>
            <div className="min-w-[720px] grid grid-cols-7 gap-2">
              {planning.jours.map((j,i) => {
                const st = statutMeta[j.statut] || statutMeta.repos;
                const jourLabel = j.jour.charAt(0).toUpperCase() + j.jour.slice(1,3);
                return (
                  <motion.div key={i} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.03 }}
                    className="rounded-2xl p-3 flex flex-col gap-1 min-h-[130px]" style={{ background: st.bg }}>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-extrabold uppercase" style={{ color: st.color }}>{jourLabel}</div>
                      <div className="text-[10px] font-bold text-ink-muted">{new Date(j.date).getDate()}</div>
                    </div>
                    {j.prevu && (
                      <div className="text-[11px] mt-1"><div className="text-ink-muted font-bold">Prévu</div><div className="font-extrabold">{j.prevu.arrivee} → {j.prevu.depart}</div></div>
                    )}
                    {j.effectif && (
                      <div className="text-[11px] mt-1"><div className="text-ink-muted font-bold">Réel</div><div className="font-extrabold" style={{ color: st.color }}>{j.effectif.arrivee || '—'} → {j.effectif.depart || '—'}</div></div>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: st.color+'33', color: st.color }}>{st.label}</span>
                      {j.delta_min !== 0 && j.effectif && <span className="text-[10px] font-extrabold" style={{ color: st.color }} title="Écart en minutes (positif = dépassement, négatif = manqué)">{j.delta_min>0?'+':''}{j.delta_min}min</span>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {edit && emp && <ContratEditorModal employe={emp} onClose={()=>{setEdit(false);loadEmployes();loadPlanning();}} />}
    </div>
  );
}

function ContratEditorModal({ employe, onClose }) {
  const jours = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  const [contrat, setContrat] = useState(employe.contrat_horaires || { heures_hebdo: 35, jours: {} });
  const [taux, setTaux] = useState(employe.taux_horaire || 12);
  const [poste, setPoste] = useState(employe.poste || 'Auxiliaire');

  const setJour = (jour, k, v) => setContrat({ ...contrat, jours: { ...contrat.jours, [jour]: { ...(contrat.jours[jour]||{arrivee:'08:00',depart:'17:00',pause_min:30}), [k]: v } } });
  const toggleJour = (jour) => {
    const has = contrat.jours[jour];
    setContrat({ ...contrat, jours: { ...contrat.jours, [jour]: has ? null : { arrivee:'08:00', depart:'17:00', pause_min: 30 } } });
  };
  const totalHebdo = useMemo(() => {
    return Object.values(contrat.jours || {}).reduce((s,j) => {
      if (!j) return s;
      const [ah,am] = j.arrivee.split(':').map(Number); const [dh,dm] = j.depart.split(':').map(Number);
      return s + Math.max(0, (dh*60+dm) - (ah*60+am) - (j.pause_min||0));
    }, 0) / 60;
  }, [contrat]);

  const save = async () => {
    try { await api(`employes/${employe.id}`, { method: 'PUT', body: JSON.stringify({ contrat_horaires: { ...contrat, heures_hebdo: Math.round(totalHebdo*10)/10 }, taux_horaire: +taux, poste }) });
      toast.success('Contrat mis à jour'); onClose();
    } catch(e){ toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg p-6 w-full max-w-xl my-6">
        <div className="flex items-center justify-between mb-4">
          <div><div className="font-extrabold text-lg">Contrat de {employe.prenom} {employe.nom}</div><div className="text-xs text-ink-muted">Horaires hebdomadaires · taux horaire</div></div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Poste</label>
            <input value={poste} onChange={e=>setPoste(e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Taux horaire (€/h)</label>
            <input type="number" step="0.1" value={taux} onChange={e=>setTaux(e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
        </div>
        <div className="space-y-2">
          {jours.map(j => {
            const c = contrat.jours?.[j];
            return (
              <div key={j} className="grid grid-cols-12 items-center gap-2 p-2 rounded-2xl bg-bgsoft">
                <button onClick={()=>toggleJour(j)} className={`col-span-3 btn-pill text-xs ${c?'bg-teal text-white':'bg-white text-ink-muted'}`}>{j.charAt(0).toUpperCase()+j.slice(1)}</button>
                {c ? <>
                  <input type="time" value={c.arrivee} onChange={e=>setJour(j,'arrivee',e.target.value)} className="col-span-3 px-3 py-2 rounded-xl bg-white outline-none text-xs font-semibold" />
                  <input type="time" value={c.depart} onChange={e=>setJour(j,'depart',e.target.value)} className="col-span-3 px-3 py-2 rounded-xl bg-white outline-none text-xs font-semibold" />
                  <input type="number" value={c.pause_min} onChange={e=>setJour(j,'pause_min',+e.target.value)} placeholder="Pause min" className="col-span-3 px-3 py-2 rounded-xl bg-white outline-none text-xs font-semibold" />
                </> : <div className="col-span-9 text-xs text-ink-muted italic pl-3">Repos</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-4 rounded-2xl bg-teal-light text-teal-dark flex items-center justify-between">
          <div className="font-extrabold">Total hebdomadaire</div>
          <div className="text-2xl font-extrabold">{Math.floor(totalHebdo)}h{String(Math.round((totalHebdo%1)*60)).padStart(2,'0')}</div>
        </div>
        <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft mt-4"><Save className="w-4 h-4" /> Enregistrer</button>
      </motion.div>
    </div>
  );
}

// ===== PRO : Mes horaires (self-view) =====
function ProMesHoraires({ user }) {
  const [planning, setPlanning] = useState(null);
  const [semaine, setSemaine] = useState(new Date().toISOString().slice(0,10));
  useEffect(() => { (async()=>{try{const p=await api(`employes/${user.id}/planning?semaine=${semaine}`); setPlanning(p);}catch(e){toast.error(e.message);}})(); }, [semaine, user.id]);
  if (!planning) return <Loading />;
  const statutMeta = {
    a_l_heure: { color: '#3ECDB5', bg: '#E6F9F5', label: 'À l\'heure', icon: CheckCircle2 },
    depasse: { color: '#8B6BE8', bg: '#EFEAFF', label: 'Dépassé', icon: TrendingUp },
    court: { color: '#FFA726', bg: '#FFF4E0', label: 'Écourté', icon: AlertTriangle },
    absent: { color: '#FF6B6B', bg: '#FFE9E9', label: 'Absent', icon: X },
    a_venir: { color: '#718096', bg: '#F5F7F9', label: 'À venir', icon: Clock },
    en_cours: { color: '#42A5F5', bg: '#E3F2FD', label: 'En cours', icon: Zap },
    repos: { color: '#CBD5E0', bg: '#F5F7F9', label: 'Repos', icon: Moon },
  };
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-4 shadow-softer"><div className="text-[11px] font-extrabold uppercase text-ink-muted">Prévu cette semaine</div><div className="text-2xl font-extrabold mt-1">{Math.floor(planning.total_prevu_min/60)}h{String(planning.total_prevu_min%60).padStart(2,'0')}</div></div>
        <div className="bg-white rounded-lg p-4 shadow-softer"><div className="text-[11px] font-extrabold uppercase text-ink-muted">Effectué</div><div className="text-2xl font-extrabold text-teal-dark mt-1">{Math.floor(planning.total_effectif_min/60)}h{String(planning.total_effectif_min%60).padStart(2,'0')}</div></div>
        <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-4 shadow-soft"><div className="text-[11px] font-extrabold uppercase opacity-80">Prorata</div><div className="text-2xl font-extrabold mt-1">{planning.prorata_pct}%</div></div>
        {planning.salaire_estime && <div className="bg-white rounded-lg p-4 shadow-softer"><div className="text-[11px] font-extrabold uppercase text-ink-muted">Salaire estimé</div><div className="text-2xl font-extrabold text-violet mt-1">{fmtEur(planning.salaire_estime)}</div></div>}
      </div>
      <div className="flex items-center gap-2 justify-end">
        <input type="date" value={semaine} onChange={e=>setSemaine(e.target.value)} className="px-3 py-2 rounded-pill bg-white outline-none text-xs font-semibold shadow-softer" />
      </div>
      <div className="space-y-2">
        {planning.jours.map((j,i) => {
          const st = statutMeta[j.statut] || statutMeta.repos;
          const StIcon = st.icon;
          return (
            <motion.div key={i} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.04 }}
              className="bg-white rounded-lg p-4 shadow-softer flex items-center gap-4">
              <div className="rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: st.bg, width: 52, height: 52 }}>
                <StIcon className="w-6 h-6" style={{ color: st.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold capitalize">{j.jour} <span className="text-ink-muted text-sm font-bold">{fmtDate(j.date)}</span></div>
                <div className="text-xs text-ink-muted mt-0.5">
                  {j.prevu ? `Prévu ${j.prevu.arrivee}-${j.prevu.depart}` : 'Jour de repos'}
                  {j.effectif && ` · Réel ${j.effectif.arrivee || '—'}-${j.effectif.depart || '—'}`}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full block" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                {j.delta_min !== 0 && j.effectif && <div className="text-xs font-extrabold mt-1" style={{ color: st.color }}>{j.delta_min>0?'+':''}{j.delta_min} min</div>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AdminPresences({ activeCId }) {
  const [enfants, setEnfants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({});
  const load = async () => {
    try {const d=await api('enfants'+(activeCId?`?creche_id=${activeCId}`:'')); setEnfants(d.enfants); if (!selected) setSelected(d.enfants[0]?.id);}catch(e){}
  };
  useEffect(() => { load(); }, [activeCId]);
  const child = enfants.find(e => e.id === selected);
  const jours = [['lundi','Lundi'],['mardi','Mardi'],['mercredi','Mercredi'],['jeudi','Jeudi'],['vendredi','Vendredi']];
  useEffect(() => {
    if (child) {
      const def = {}; jours.forEach(([k]) => { def[k] = child.presences_hebdo?.[k] || { present: false, arrivee:'08:00', depart:'17:00' }; });
      setDraft(def);
    }
  }, [selected, child?.id]);

  const setJour = (k, field, v) => setDraft({ ...draft, [k]: { ...(draft[k]||{}), [field]: v } });
  const save = async () => {
    try {
      await api(`enfants/${selected}`, { method: 'PUT', body: JSON.stringify({ presences_hebdo: draft }) });
      toast.success('Présences hebdo enregistrées'); setEdit(false); load();
    } catch(e){ toast.error(e.message); }
  };

  // Calcul heures prévues et prorata basé sur présences réelles cochées
  const heuresPrevues = jours.reduce((s,[k]) => {
    const p = draft[k]; if (!p?.present) return s;
    const [ah,am] = (p.arrivee||'08:00').split(':').map(Number); const [dh,dm] = (p.depart||'17:00').split(':').map(Number);
    return s + Math.max(0, (dh*60+dm)-(ah*60+am))/60;
  }, 0);
  const heuresContrat = child?.contrat_heures || 35;
  const factureRecalc = child ? (child.mensualite * Math.min(1, heuresPrevues/heuresContrat)) : 0;

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {enfants.map(e => <button key={e.id} onClick={()=>{setSelected(e.id);setEdit(false);}} className={`btn-pill text-xs flex-shrink-0 ${selected===e.id?'bg-teal text-white':'bg-white text-ink-muted'}`}>{e.prenom}</button>)}
      </div>
      {child && (
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3"><Avatar enfant={child} size={48} /><div><div className="font-extrabold text-lg">{child.prenom} {child.nom}</div><div className="text-xs text-ink-muted">Contrat {heuresContrat}h/sem · {fmtEur(child.mensualite)}/mois</div></div></div>
            {!edit ? <button onClick={()=>setEdit(true)} className="btn-pill bg-teal text-white shadow-soft text-xs"><Edit3 className="w-3 h-3" /> Éditer les jours</button>
                   : <div className="flex gap-2"><button onClick={()=>setEdit(false)} className="btn-pill bg-bgsoft text-ink-muted text-xs">Annuler</button><button onClick={save} className="btn-pill bg-teal text-white shadow-soft text-xs"><Save className="w-3 h-3" /> Enregistrer</button></div>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {jours.map(([k,label]) => {
              const p = draft[k] || { present:false, arrivee:'08:00', depart:'17:00' };
              return (
                <div key={k} className={`rounded-2xl p-3 ${p.present?'bg-teal-light':'bg-bgsoft'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-extrabold uppercase text-ink-muted">{label}</div>
                    {edit ? <input type="checkbox" checked={p.present} onChange={e=>setJour(k,'present',e.target.checked)} className="w-4 h-4 accent-teal" />
                          : <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${p.present?'bg-teal text-white':'bg-white text-ink-muted'}`}>{p.present?'✓':'—'}</div>}
                  </div>
                  {p.present && (
                    edit ? (
                      <div className="space-y-1">
                        <input type="time" value={p.arrivee} onChange={e=>setJour(k,'arrivee',e.target.value)} className="w-full px-2 py-1 rounded-lg bg-white outline-none text-xs font-semibold" />
                        <input type="time" value={p.depart} onChange={e=>setJour(k,'depart',e.target.value)} className="w-full px-2 py-1 rounded-lg bg-white outline-none text-xs font-semibold" />
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold text-teal-dark">{p.arrivee} → {p.depart}</div>
                    )
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-bgsoft"><div className="text-[10px] font-bold uppercase text-ink-muted">Heures prévues / sem</div><div className="text-2xl font-extrabold mt-1">{heuresPrevues.toFixed(1)}h</div></div>
            <div className="p-4 rounded-2xl bg-bgsoft"><div className="text-[10px] font-bold uppercase text-ink-muted">Contrat</div><div className="text-2xl font-extrabold mt-1">{heuresContrat}h</div></div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal to-teal-dark text-white"><div className="text-[10px] font-bold uppercase opacity-80">Facture prévisionnelle</div><div className="text-2xl font-extrabold mt-1">{fmtEur(factureRecalc)}</div><div className="text-[10px] opacity-80">recalculée au prorata</div></div>
          </div>
        </div>
      )}
      {enfants.length === 0 && <PlaceholderView title="Aucun enfant" icon={Baby} />}
    </div>
  );
}

function AdminSynthese({ activeCId }) {
  const [enfants, setEnfants] = useState([]);
  const [tags, setTags] = useState([]);
  useEffect(() => { (async()=>{try{
    const d=await api('enfants'+(activeCId?`?creche_id=${activeCId}`:'')); setEnfants(d.enfants);
    const t=await api('tags'+(activeCId?`?creche_id=${activeCId}`:'')); setTags(t.tags||[]);
  }catch(e){}})(); }, [activeCId]);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="text-xs text-ink-muted bg-white rounded-lg p-3 shadow-softer">📄 Cliquez sur « PDF » pour télécharger un bilan hebdomadaire prêt à imprimer et à partager avec les parents.</div>
      {enfants.map(e => {
        const eTags = tags.filter(t => (e.tags||[]).includes(t.id));
        return (
        <div key={e.id} className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Avatar enfant={e} size={40} />
              <div><div className="font-extrabold">{e.prenom}</div><div className="text-xs text-ink-muted">{e.groupe} · Semaine {new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</div></div>
            </div>
            <button onClick={()=>generateBilanHebdoPDF(e, null, eTags)} className="btn-pill bg-teal text-white shadow-soft text-xs"><Download className="w-3 h-3" /> PDF Bilan</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-sky/10"><div className="text-[10px] font-bold uppercase text-sky">Sieste</div><div className="text-lg font-extrabold">8h32</div></div>
            <div className="p-3 rounded-2xl bg-coral/10"><div className="text-[10px] font-bold uppercase text-coral">Biberons</div><div className="text-lg font-extrabold">14</div></div>
            <div className="p-3 rounded-2xl bg-lime/10"><div className="text-[10px] font-bold uppercase text-lime">Changes</div><div className="text-lg font-extrabold">18</div></div>
            <div className="p-3 rounded-2xl bg-violet/10"><div className="text-[10px] font-bold uppercase text-violet">Activités</div><div className="text-lg font-extrabold">7</div></div>
          </div>
        </div>
      );})}
    </div>
  );
}

// ===== NOURRITURE / RAPPELS / NEWS / DOCUMENTS =====
function NourritureView({ activeCId, canEdit }) {
  const [menus, setMenus] = useState([]);
  const [enfants, setEnfants] = useState([]);
  const [tags, setTags] = useState([]);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(null);
  const load = async () => {
    try {
      const d = await api('nourriture'+(activeCId?`?creche_id=${activeCId}`:'')); setMenus(d.menus);
      const e = await api('enfants'+(activeCId?`?creche_id=${activeCId}`:'')); setEnfants(e.enfants||[]);
      const t = await api('tags'+(activeCId?`?creche_id=${activeCId}`:'')); setTags(t.tags||[]);
    } catch(err){}
  };
  useEffect(() => { load(); }, [activeCId]);
  const current = menus[0];

  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(current || { repas: ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'].map(j=>({jour:j,midi:'',gouter:''})) }))); setEdit(true); };
  const save = async () => {
    try {
      if (current?.id) await api(`nourriture/${current.id}`, { method:'PUT', body: JSON.stringify({ repas: draft.repas }) });
      else await api('nourriture', { method: 'POST', body: JSON.stringify({ ...draft, semaine: new Date().toISOString().slice(0,10), creche_id: activeCId }) });
      toast.success('Menus enregistrés'); setEdit(false); load();
    } catch(e){ toast.error(e.message); }
  };
  const setRepas = (i, k, v) => setDraft({ ...draft, repas: draft.repas.map((r,x)=>x===i?{...r,[k]:v}:r) });

  // Détecter les enfants avec allergies (tags contenant "allerg" ou catégorie "Allergies")
  const isAllergyTag = (t) => t.categorie === 'Allergies' || /allerg/i.test(t.nom||'');
  const enfantsAvecAllergies = enfants.map(en => {
    const allergyTags = tags.filter(t => (en.tags||[]).includes(t.id) && isAllergyTag(t));
    return { enfant: en, allergies: allergyTags };
  }).filter(x => x.allergies.length > 0);

  return (
    <div className="space-y-4 animate-fade-up">
      {canEdit && !edit && <div className="flex justify-end"><button onClick={startEdit} className="btn-pill bg-teal text-white shadow-soft"><Edit3 className="w-4 h-4" /> {current?'Modifier':'Créer le menu'}</button></div>}

      {/* ---- ALERTE ALLERGIES enfants par enfants ---- */}
      <div className="bg-white rounded-lg p-5 shadow-softer border-l-4 border-coral">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-coral" />
          <div className="font-extrabold text-coral">⚠️ Rappel allergies · à respecter impérativement</div>
        </div>
        {enfantsAvecAllergies.length === 0 && <div className="text-sm text-ink-muted italic">Aucun enfant avec allergie déclarée. Ajoutez les allergies via l'onglet "Étiquettes" puis rattachez-les aux enfants.</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {enfantsAvecAllergies.map(({enfant, allergies}) => (
            <div key={enfant.id} className="flex items-center gap-2 p-2 rounded-2xl bg-coral/5 border border-coral/20">
              <Avatar enfant={enfant} size={36} />
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-sm truncate-1">{enfant.prenom} {enfant.nom}</div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {allergies.map(a => <span key={a.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:a.couleur+'22',color:a.couleur}}>{a.nom}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!current && !edit && <PlaceholderView title="Aucun menu défini" icon={UtensilsCrossed} />}
      {current && !edit && (
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center justify-between mb-4">
            <div><div className="font-extrabold text-lg">Menu de la semaine</div><div className="text-xs text-ink-muted">Semaine du {fmtDate(current.semaine)}</div></div>
            <UtensilsCrossed className="w-6 h-6 text-coral" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {current.repas.map((r,i) => (
              <div key={i} className="p-3 rounded-2xl bg-bgsoft">
                <div className="text-[10px] font-extrabold uppercase text-ink-muted">{r.jour}</div>
                <div className="mt-2"><div className="text-[10px] text-coral font-bold uppercase">🍽️ Midi</div><div className="text-xs font-bold">{r.midi || '—'}</div></div>
                <div className="mt-2"><div className="text-[10px] text-amber font-bold uppercase">🍪 Goûter</div><div className="text-xs font-bold">{r.gouter || '—'}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {edit && draft && (
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="flex items-center justify-between mb-4"><div className="font-extrabold text-lg">Édition menu semaine</div>
            <div className="flex gap-2"><button onClick={()=>setEdit(false)} className="btn-pill bg-bgsoft text-ink-muted text-xs">Annuler</button><button onClick={save} className="btn-pill bg-teal text-white shadow-soft text-xs"><Save className="w-3 h-3" /> Enregistrer</button></div>
          </div>
          <div className="space-y-3">
            {draft.repas.map((r,i) => (
              <div key={i} className="p-3 rounded-2xl bg-bgsoft">
                <div className="text-xs font-extrabold uppercase text-ink-muted mb-2">{r.jour}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div><label className="text-[10px] text-coral font-bold uppercase">🍽️ Midi</label>
                    <input value={r.midi} onChange={e=>setRepas(i,'midi',e.target.value)} placeholder="Plat du midi..." className="w-full mt-1 px-3 py-2 rounded-xl bg-white outline-none text-xs font-semibold" /></div>
                  <div><label className="text-[10px] text-amber font-bold uppercase">🍪 Goûter</label>
                    <input value={r.gouter} onChange={e=>setRepas(i,'gouter',e.target.value)} placeholder="Goûter..." className="w-full mt-1 px-3 py-2 rounded-xl bg-white outline-none text-xs font-semibold" /></div>
                </div>
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
  const [edit, setEdit] = useState(null); // null | 'new' | rappel object
  const load = async () => { try {const d=await api('rappels'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.rappels);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  const togglePin = async (r) => {
    try { await api(`rappels/${r.id}`, { method: 'PUT', body: JSON.stringify({ pinned: !r.pinned }) }); toast.success(r.pinned?'Désépinglé':'Épinglé'); load(); }
    catch(e){ toast.error(e.message); }
  };
  const notify = async (r) => {
    // Notification navigateur locale (Web Notifications API)
    try {
      if (!('Notification' in window)) return toast.error('Notifications non supportées');
      if (Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') return toast.error('Permission refusée'); }
      new Notification('🔔 TiMétis · ' + r.titre, { body: `Échéance : ${fmtDate(r.echeance)} · ${r.cible}`, icon: '/icon.png' });
      await api(`rappels/${r.id}`, { method: 'PUT', body: JSON.stringify({ notifie_at: new Date() }) });
      toast.success('Notification envoyée');
    } catch(e){ toast.error(e.message); }
  };
  const del = async (r) => { if (!confirm(`Supprimer l'alerte "${r.titre}" ?`)) return; try { await api(`rappels/${r.id}`, { method: 'DELETE' }); toast.success('Alerte supprimée'); load(); } catch(e){ toast.error(e.message); } };
  const sorted = [...items].sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0));
  return (
    <div className="space-y-4 animate-fade-up">
      {canEdit && <div className="flex justify-end"><button onClick={()=>setEdit('new')} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouvelle alerte</button></div>}
      <div className="space-y-2">
        {items.length === 0 && <PlaceholderView title="Aucune alerte" icon={AlertTriangle} />}
        {sorted.map(r => {
          const color = r.priorite==='haute'?'#FF6B6B':r.priorite==='moyenne'?'#FFA726':'#66BB6A';
          return (
            <div key={r.id} className={`bg-white rounded-lg p-4 shadow-softer flex items-center gap-3 ${r.pinned?'ring-2 ring-coral':''}`}>
              {r.pinned && <span className="absolute -top-2 -left-2 text-xs bg-coral text-white rounded-full w-6 h-6 flex items-center justify-center">📌</span>}
              <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color+'22', width: 42, height: 42 }}><AlertTriangle className="w-5 h-5" style={{ color }} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate-1 flex items-center gap-2">{r.titre} {r.pinned && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-coral text-white">Épinglé</span>}</div>
                <div className="text-xs text-ink-muted">Échéance {fmtDate(r.echeance)} · Cible {r.cible}{r.contenu?` · ${r.contenu}`:''}</div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: color+'22', color }}>{r.priorite}</span>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={()=>togglePin(r)} title={r.pinned?'Désépingler':'Épingler'} className={`p-2 rounded-full ${r.pinned?'bg-coral text-white':'bg-bgsoft text-ink-muted'} hover:bg-coral hover:text-white transition`}>📌</button>
                  <button onClick={()=>notify(r)} title="Envoyer notification" className="p-2 rounded-full bg-bgsoft text-ink-muted hover:bg-teal hover:text-white transition"><Bell className="w-4 h-4" /></button>
                  <button onClick={()=>setEdit(r)} title="Éditer" className="p-2 rounded-full bg-bgsoft text-ink-muted hover:bg-teal hover:text-white transition"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={()=>del(r)} title="Supprimer" className="p-2 rounded-full bg-bgsoft text-coral hover:bg-coral hover:text-white transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {edit && <RappelEditorModal rappel={edit==='new'?null:edit} activeCId={activeCId} onClose={()=>{setEdit(null);load();}} />}
    </div>
  );
}

function RappelEditorModal({ rappel, activeCId, onClose }) {
  const [f, setF] = useState(rappel || { titre:'', contenu:'', echeance:new Date().toISOString().slice(0,10), cible:'parents', priorite:'moyenne', pinned:false });
  const save = async () => {
    if (!f.titre.trim()) return toast.error('Titre obligatoire');
    try {
      if (rappel) await api(`rappels/${rappel.id}`, { method: 'PUT', body: JSON.stringify(f) });
      else await api('rappels', { method: 'POST', body: JSON.stringify({ ...f, creche_id: activeCId }) });
      toast.success(rappel?'Alerte mise à jour':'Alerte créée'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-lg p-6 w-full max-w-md my-6">
        <div className="flex items-center justify-between mb-4"><div className="font-extrabold text-lg">{rappel?'Éditer l\'alerte':'Nouvelle alerte'}</div><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Titre</label><input value={f.titre} onChange={e=>setF({...f,titre:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Détail / message</label><textarea value={f.contenu||''} onChange={e=>setF({...f,contenu:e.target.value})} rows={3} className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-bgsoft outline-none text-sm font-semibold resize-none" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Échéance</label><input type="date" value={f.echeance} onChange={e=>setF({...f,echeance:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Priorité</label>
              <select value={f.priorite} onChange={e=>setF({...f,priorite:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold">
                <option value="haute">Haute</option><option value="moyenne">Moyenne</option><option value="basse">Basse</option>
              </select></div>
          </div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Cible</label>
            <select value={f.cible} onChange={e=>setF({...f,cible:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold">
              <option value="parents">Parents</option><option value="pros">Employés</option><option value="tous">Tous</option><option value="admin">Admin uniquement</option>
            </select></div>
          <label className="flex items-center gap-2 p-2 rounded-2xl bg-bgsoft cursor-pointer">
            <input type="checkbox" checked={!!f.pinned} onChange={e=>setF({...f,pinned:e.target.checked})} className="w-4 h-4 accent-coral" />
            <span className="text-sm font-semibold">📌 Épingler en haut de liste</span>
          </label>
          <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </motion.div>
    </div>
  );
}

function NewsView({ activeCId, canEdit }) {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = async () => { try {const d=await api('news'+(activeCId?`?creche_id=${activeCId}`:'')); setItems(d.news);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  const togglePin = async (n) => { try { await api(`news/${n.id}`, { method: 'PUT', body: JSON.stringify({ pinned: !n.pinned }) }); toast.success(n.pinned?'Désépinglé':'Épinglé'); load(); } catch(e){ toast.error(e.message); } };
  const notify = async (n) => {
    try {
      if (!('Notification' in window)) return toast.error('Notifications non supportées');
      if (Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') return toast.error('Permission refusée'); }
      new Notification('📰 TiMétis · ' + n.titre, { body: n.contenu?.slice(0,120) || '', icon: '/icon.png' });
      await api(`news/${n.id}`, { method: 'PUT', body: JSON.stringify({ notifie_at: new Date() }) });
      toast.success('Notification envoyée');
    } catch(e){ toast.error(e.message); }
  };
  const del = async (n) => { if (!confirm(`Supprimer la publication "${n.titre}" ?`)) return; try { await api(`news/${n.id}`, { method: 'DELETE' }); toast.success('Publication supprimée'); load(); } catch(e){ toast.error(e.message); } };
  const sorted = [...items].sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0));
  return (
    <div className="space-y-4 animate-fade-up">
      {canEdit && <div className="flex justify-end"><button onClick={()=>setEdit('new')} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Publier</button></div>}
      <div className="space-y-3">
        {items.length === 0 && <PlaceholderView title="Aucune actu" icon={Newspaper} />}
        {sorted.map(n => (
          <div key={n.id} className={`bg-white rounded-lg p-5 shadow-softer relative ${n.pinned?'ring-2 ring-teal':''}`}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {n.pinned && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-light text-teal-dark">📌 Épinglé</span>}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bgsoft text-ink-muted capitalize">{n.cible}</span>
              <span className="text-xs text-ink-muted ml-auto">{fmtDate(n.created_at)}</span>
            </div>
            <div className="font-extrabold text-lg">{n.titre}</div>
            <div className="text-sm text-ink-muted mt-1 whitespace-pre-wrap">{n.contenu}</div>
            {canEdit && (
              <div className="mt-3 flex gap-2 pt-3 border-t border-bgsoft">
                <button onClick={()=>togglePin(n)} className={`btn-pill text-xs ${n.pinned?'bg-teal text-white':'bg-bgsoft text-ink-muted'}`}>📌 {n.pinned?'Désépingler':'Épingler'}</button>
                <button onClick={()=>notify(n)} className="btn-pill text-xs bg-coral text-white"><Bell className="w-3 h-3" /> Notifier</button>
                <button onClick={()=>setEdit(n)} className="btn-pill text-xs bg-bgsoft text-ink-muted"><Edit3 className="w-3 h-3" /> Éditer</button>
                <button onClick={()=>del(n)} className="btn-pill text-xs bg-coral/10 text-coral"><Trash2 className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      {edit && <NewsEditorModal news={edit==='new'?null:edit} activeCId={activeCId} onClose={()=>{setEdit(null);load();}} />}
    </div>
  );
}

function NewsEditorModal({ news, activeCId, onClose }) {
  const [f, setF] = useState(news || { titre:'', contenu:'', cible:'parents', pinned:false });
  const save = async () => {
    if (!f.titre.trim()) return toast.error('Titre obligatoire');
    try {
      if (news) await api(`news/${news.id}`, { method: 'PUT', body: JSON.stringify(f) });
      else await api('news', { method: 'POST', body: JSON.stringify({ ...f, creche_id: activeCId }) });
      toast.success(news?'Actu mise à jour':'Actu publiée'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-lg p-6 w-full max-w-md my-6">
        <div className="flex items-center justify-between mb-4"><div className="font-extrabold text-lg">{news?'Éditer l\'actu':'Nouvelle actu'}</div><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Titre</label><input value={f.titre} onChange={e=>setF({...f,titre:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Contenu</label><textarea value={f.contenu||''} onChange={e=>setF({...f,contenu:e.target.value})} rows={5} className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-bgsoft outline-none text-sm font-semibold resize-none" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Cible</label>
            <select value={f.cible} onChange={e=>setF({...f,cible:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold">
              <option value="parents">Parents</option><option value="pros">Employés</option><option value="tous">Tous</option>
            </select></div>
          <label className="flex items-center gap-2 p-2 rounded-2xl bg-bgsoft cursor-pointer">
            <input type="checkbox" checked={!!f.pinned} onChange={e=>setF({...f,pinned:e.target.checked})} className="w-4 h-4 accent-teal" />
            <span className="text-sm font-semibold">📌 Épingler en haut</span>
          </label>
          <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Publier</button>
        </div>
      </motion.div>
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
  const del = async (d) => {
    if (!confirm(`Supprimer le document "${d.titre}" ?`)) return;
    try { await api(`documents/${d.id}`, { method: 'DELETE' }); toast.success('Document supprimé'); load(); }
    catch(e){ toast.error(e.message); }
  };
  const download = (d) => {
    // Ouvre un onglet pour téléchargement direct (le navigateur gère PDF/image/vidéo)
    if (!d.url) return toast.error('URL du fichier introuvable');
    const a = document.createElement('a'); a.href = d.url; a.download = d.titre || 'document'; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-white rounded-lg p-3 shadow-softer text-xs text-ink-muted">📁 Espace documents partagés · Cliquez sur « Télécharger » pour récupérer le fichier (PDF ou tout format). {canEdit ? 'En tant qu\'employeur, vous pouvez déposer et supprimer.' : 'Seul l\'employeur peut ajouter ou supprimer.'}</div>
      {canEdit && <div className="flex justify-end"><MediaUploader folder="documents" onUpload={onUpload} /></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.length === 0 && <div className="col-span-full"><PlaceholderView title="Aucun document partagé" icon={FileText} /></div>}
        {items.map(d => (
          <div key={d.id} className="bg-white rounded-lg p-4 shadow-softer flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-teal" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate-1">{d.titre}</div>
              <div className="text-xs text-ink-muted truncate-1">{Math.round((d.taille||0)/1024)} Ko · {d.cible} · {fmtDate(d.created_at)}</div>
            </div>
            <button onClick={()=>download(d)} className="btn-pill bg-teal text-white text-xs shadow-soft"><Download className="w-3 h-3" /> Télécharger</button>
            {canEdit && <button onClick={()=>del(d)} className="btn-pill bg-coral/10 text-coral text-xs"><Trash2 className="w-3 h-3" /></button>}
          </div>
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
    <div className="bg-white rounded-lg shadow-softer h-[calc(100vh-140px)] max-h-[720px] flex flex-col md:flex-row overflow-hidden animate-fade-up min-w-0 w-full">
      <div className={`${active?'hidden md:flex':'flex'} w-full md:w-72 border-b md:border-b-0 md:border-r border-bgsoft flex-col flex-shrink-0 min-w-0`}>
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

      <div className={`${active?'flex':'hidden md:flex'} flex-1 flex-col min-w-0 w-full`}>
        {!active && <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">Sélectionne une conversation</div>}
        {active && (
          <>
            <div className="px-4 py-3 border-b border-bgsoft flex items-center gap-3">
              <button onClick={()=>setActive(null)} className="md:hidden text-ink-muted"><ChevronRight className="w-5 h-5 rotate-180" /></button>
              <Avatar user={active.others?.[0]} enfant={active.enfant} size={36} />
              <div className="flex-1 min-w-0"><div className="font-extrabold truncate-1">{active.others?.[0]?.prenom} {active.others?.[0]?.nom}</div><div className="text-xs text-ink-muted">{active.enfant ? `Enfant : ${active.enfant.prenom}` : 'Conversation'}</div></div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin px-2 md:px-3 py-3 space-y-3 bg-bgsoft/30 min-w-0">
              {messages.map(m => {
                const mine = m.from_id === user.id;
                return (
                  <motion.div key={m.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} className={`flex ${mine?'justify-end':'justify-start'} w-full min-w-0`}>
                    <div className={`max-w-[80%] md:max-w-[75%] rounded-2xl px-3 py-2 min-w-0 ${mine?'bg-teal text-white':'bg-white text-ink shadow-softer'}`}>
                      {!mine && <div className="text-[10px] font-extrabold opacity-70 mb-0.5">{m.from_nom}</div>}
                      {m.media && (m.media_type==='video' ? (
                        <video src={m.media} controls className="w-full max-w-full rounded-xl mb-1" />
                      ) : (
                        <img src={m.media} alt="" className="w-full max-w-full rounded-xl mb-1" />
                      ))}
                      {m.contenu && <div className="text-sm font-semibold whitespace-pre-wrap break-words">{m.contenu}</div>}
                      <div className={`text-[10px] mt-1 ${mine?'opacity-70':'text-ink-muted'}`}>{fmtTime(m.created_at)}</div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="border-t border-bgsoft p-2 flex items-center gap-2 min-w-0">
              <MediaUploader folder={`thread-${active.id}`} onUpload={(m)=>send(m)} />
              <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Message..." className="flex-1 min-w-0 px-3 py-2.5 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
              <button onClick={()=>send()} className="btn-pill bg-teal text-white shadow-soft flex-shrink-0"><Send className="w-4 h-4" /></button>
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
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0,10));
  const [showAdd, setShowAdd] = useState(false);
  const [edit, setEdit] = useState(null);
  const [reminderInterval, setReminderInterval] = useState(null);

  const load = async () => {
    try { const d = await api(`taches-pro?date=${selectedDate}`); setTasks(d.taches||[]); } catch(e){}
  };
  useEffect(() => { load(); }, [selectedDate]);

  // Système de rappels : check toutes les 30s si un rappel est dû
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') { Notification.requestPermission(); }
    const check = async () => {
      try {
        const now = new Date();
        const nowKey = now.toISOString().slice(0,10);
        const d = await api(`taches-pro?date=${nowKey}`);
        (d.taches||[]).forEach(t => {
          if (t.done || t.notifie || !t.heure_rappel) return;
          const [h,m] = t.heure_rappel.split(':').map(Number);
          const rappelDate = new Date(t.date+'T'+t.heure_rappel);
          const avantMs = (t.rappel_avant_min||0) * 60 * 1000;
          const alertMoment = rappelDate.getTime() - avantMs;
          if (now.getTime() >= alertMoment && now.getTime() <= alertMoment + 60000) {
            if (Notification.permission === 'granted') {
              new Notification(`⏰ ${t.label}`, { body: `Tâche prévue à ${t.heure_rappel}${t.quantite>1?` · ${t.quantite}${t.unite?' '+t.unite:''}`:''}` });
            }
            toast.info(`⏰ Rappel : ${t.label} à ${t.heure_rappel}`);
            api(`taches-pro/${t.id}`, { method: 'PUT', body: JSON.stringify({ notifie: true }) }).catch(()=>{});
          }
        });
      } catch(e){}
    };
    const it = setInterval(check, 30000);
    check();
    setReminderInterval(it);
    return () => clearInterval(it);
  }, []);

  const toggle = async (t) => {
    try { await api(`taches-pro/${t.id}`, { method: 'PUT', body: JSON.stringify({ done: !t.done }) }); load(); }
    catch(e){ toast.error(e.message); }
  };
  const del = async (t) => { if (!confirm('Supprimer cette tâche ?')) return; try { await api(`taches-pro/${t.id}`, { method: 'DELETE' }); toast.success('Supprimée'); load(); } catch(e){ toast.error(e.message); } };
  const done = tasks.filter(t=>t.done).length;

  // Calendrier 14 prochains jours
  const days = Array.from({length:14}, (_,i) => { const d = new Date(); d.setDate(d.getDate()+i); return d; });

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-gradient-to-br from-violet to-[#6B4FD8] text-white rounded-lg p-6 shadow-soft">
        <div className="flex items-center justify-between mb-2">
          <div><div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">Tâches du {fmtDate(selectedDate)}</div><div className="text-3xl font-extrabold mt-1">{done} / {tasks.length}</div></div>
          <button onClick={()=>setShowAdd(true)} className="btn-pill bg-white text-violet shadow-soft"><Plus className="w-4 h-4" /> Nouvelle tâche</button>
        </div>
        <div className="h-2 rounded-full bg-white/20"><motion.div initial={{ width:0 }} animate={{ width: `${tasks.length?(done/tasks.length)*100:0}%` }} className="h-full bg-white rounded-full" /></div>
      </div>

      {/* Calendrier 14j horizontal */}
      <div className="bg-white rounded-lg p-3 shadow-softer overflow-x-auto scrollbar-thin">
        <div className="text-xs font-extrabold uppercase text-ink-muted mb-2 px-1">Planning · programmez à l'avance</div>
        <div className="flex gap-2">
          {days.map(d => {
            const dstr = d.toISOString().slice(0,10);
            const active = dstr === selectedDate;
            const isToday = dstr === new Date().toISOString().slice(0,10);
            return (
              <button key={dstr} onClick={()=>setSelectedDate(dstr)} className={`flex-shrink-0 rounded-2xl p-3 min-w-[70px] transition ${active?'bg-teal text-white shadow-soft':'bg-bgsoft text-ink-muted hover:bg-teal-light hover:text-teal-dark'}`}>
                <div className="text-[10px] font-bold uppercase">{d.toLocaleDateString('fr-FR',{weekday:'short'})}</div>
                <div className="text-xl font-extrabold">{d.getDate()}</div>
                <div className="text-[10px]">{d.toLocaleDateString('fr-FR',{month:'short'})}</div>
                {isToday && <div className={`text-[9px] font-bold mt-0.5 ${active?'text-white':'text-coral'}`}>Aujourd'hui</div>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 shadow-softer space-y-2">
        {tasks.length === 0 && <div className="text-sm text-ink-muted text-center py-8">Aucune tâche pour cette date.<br/>Ajoutez-en une avec « Nouvelle tâche ».</div>}
        {tasks.map(t => (
          <div key={t.id} className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${t.done?'bg-teal-light':'bg-bgsoft'}`}>
            <button onClick={()=>toggle(t)} className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${t.done?'bg-teal text-white':'border-2 border-ink-muted'}`}>{t.done && <CheckCircle2 className="w-4 h-4" />}</button>
            <div className="flex-1 min-w-0" onClick={()=>toggle(t)}>
              <div className={`font-bold text-sm ${t.done?'line-through text-ink-muted':''}`}>{t.label} {t.quantite>1 && <span className="text-xs text-violet font-extrabold">· ×{t.quantite}{t.unite?' '+t.unite:''}</span>}</div>
              {t.heure_rappel && <div className="text-[11px] text-ink-muted">⏰ {t.heure_rappel}{t.rappel_avant_min?` · rappel ${t.rappel_avant_min} min avant`:''}</div>}
            </div>
            <div className="flex gap-1">
              <button onClick={()=>setEdit(t)} className="p-2 rounded-full bg-white text-ink-muted hover:bg-teal hover:text-white transition"><Edit3 className="w-3 h-3" /></button>
              <button onClick={()=>del(t)} className="p-2 rounded-full bg-white text-coral hover:bg-coral hover:text-white transition"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>
      {showAdd && <TacheEditorModal date={selectedDate} onClose={()=>{setShowAdd(false);load();}} />}
      {edit && <TacheEditorModal tache={edit} onClose={()=>{setEdit(null);load();}} />}
    </div>
  );
}

function TacheEditorModal({ tache, date, onClose }) {
  const todayISO = () => new Date().toISOString().slice(0,10);
  const [f, setF] = useState(tache || { label:'', quantite:1, unite:'', date: date||todayISO(), heure_rappel:'', rappel_avant_min:0 });
  const save = async () => {
    if (!f.label.trim()) return toast.error('Décrivez la tâche');
    try {
      if (tache) await api(`taches-pro/${tache.id}`, { method: 'PUT', body: JSON.stringify(f) });
      else await api('taches-pro', { method: 'POST', body: JSON.stringify(f) });
      toast.success(tache?'Tâche mise à jour':'Tâche ajoutée'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  const RAPPELS = [{v:0,l:'Aucun'},{v:5,l:'5 min avant'},{v:15,l:'15 min avant'},{v:30,l:'30 min avant'},{v:60,l:'1 heure avant'},{v:1440,l:'1 jour avant'}];
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-lg p-6 w-full max-w-md my-6">
        <div className="flex items-center justify-between mb-4"><div className="font-extrabold text-lg">{tache?'Éditer la tâche':'Nouvelle tâche'}</div><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Tâche à faire</label>
            <input value={f.label} onChange={e=>setF({...f,label:e.target.value})} placeholder="Ex : Préparer 5 biberons" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Quantité</label>
              <input type="number" min="1" value={f.quantite} onChange={e=>setF({...f,quantite:+e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Unité (opt.)</label>
              <input value={f.unite} onChange={e=>setF({...f,unite:e.target.value})} placeholder="biberons, couches…" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          </div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Date</label>
            <input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Heure prévue (optionnelle)</label>
            <input type="time" value={f.heure_rappel||''} onChange={e=>setF({...f,heure_rappel:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          {f.heure_rappel && (
            <div><label className="text-xs font-extrabold uppercase text-ink-muted">Rappel programmé</label>
              <select value={f.rappel_avant_min||0} onChange={e=>setF({...f,rappel_avant_min:+e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold">
                {RAPPELS.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
              <div className="text-[11px] text-ink-muted mt-1">🔔 Vous recevrez une notification navigateur à l'heure programmée.</div>
            </div>
          )}
          <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </motion.div>
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
      {enfants.length > 0 && (
        <div className="bg-white rounded-lg p-3 shadow-softer">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted mb-2 px-1">
            {enfants.length > 1 ? `Mes enfants (${enfants.length}) — cliquez pour changer` : 'Mon enfant'}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {enfants.map(e => (
              <button key={e.id} onClick={()=>setSelected(e.id)} className={`flex items-center gap-2 px-3 py-2 rounded-pill text-sm font-bold flex-shrink-0 transition ${selected===e.id?'bg-teal text-white shadow-soft':'bg-bgsoft text-ink-muted hover:bg-teal-light hover:text-teal-dark'}`}>
                <Avatar enfant={e} size={28} /> {e.prenom}
                {selected===e.id && <span className="text-[10px] bg-white/25 px-1.5 rounded-full">actif</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {child && <ChildHeaderCard enfant={child} />}
      <ParentQuickAlerts enfant={child} />
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

// ===== Parent Quick Alerts (urgent notifications to admin) =====
function ParentQuickAlerts({ enfant }) {
  const [open, setOpen] = useState(null);
  const [contenu, setContenu] = useState('');
  const [heure, setHeure] = useState('');
  const [sending, setSending] = useState(false);

  const alerts = [
    { key: 'retard', label: 'Retard prévu', icon: Clock, color: '#FFA726', bg: '#FFF4E0',
      placeholder: 'Ex : Je serai en retard de 15 min à cause d\'un embouteillage', needsHeure: true, heureLabel: 'Heure d\'arrivée prévue' },
    { key: 'changement_horaire', label: 'Changement horaire', icon: Calendar, color: '#8B6BE8', bg: '#EFEAFF',
      placeholder: 'Ex : Aujourd\'hui je récupère à 15h au lieu de 17h30', needsHeure: true, heureLabel: 'Nouvelle heure de départ' },
    { key: 'medical', label: 'Traitement / alimentation', icon: Heart, color: '#FF6B6B', bg: '#FFE9E9',
      placeholder: 'Ex : Doliprane 5ml à 14h. Ou : allergie ponctuelle aux fruits rouges' },
    { key: 'recuperation', label: 'Récupération anticipée', icon: Zap, color: '#3ECDB5', bg: '#E6F9F5',
      placeholder: 'Ex : Je suis en route, j\'arrive dans 10 min', needsHeure: true, heureLabel: 'Heure d\'arrivée' },
  ];

  const send = async () => {
    const a = alerts.find(x => x.key === open);
    setSending(true);
    try {
      await api('parent/alertes', { method: 'POST', body: JSON.stringify({
        alert_type: open, contenu: contenu || a.label,
        heure_prevue: heure ? new Date(new Date().toISOString().slice(0,10)+'T'+heure).toISOString() : null,
        enfant_id: enfant?.id || null
      }) });
      toast.success(`Alerte envoyée à la crèche 🚨`);
      setOpen(null); setContenu(''); setHeure('');
    } catch(e){ toast.error(e.message); }
    finally { setSending(false); }
  };

  const activeAlert = alerts.find(x => x.key === open);

  return (
    <>
      <div className="bg-white rounded-lg p-4 shadow-softer">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-coral/15 flex items-center justify-center"><Zap className="w-4 h-4 text-coral" /></div>
          <div className="flex-1">
            <div className="font-extrabold text-sm">Alertes rapides</div>
            <div className="text-[10px] text-ink-muted">Prévenir la crèche en 1 clic</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {alerts.map(a => {
            const Icon = a.icon;
            return (
              <motion.button key={a.key} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={()=>setOpen(a.key)}
                className="text-left p-3 rounded-2xl transition-all hover:shadow-softer" style={{ background: a.bg }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: a.color+'22' }}>
                  <Icon className="w-5 h-5" style={{ color: a.color }} />
                </div>
                <div className="text-xs font-extrabold" style={{ color: a.color }}>{a.label}</div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {open && activeAlert && (
          <div className="fixed inset-0 bg-black/40 z-[80] flex items-end md:items-center justify-center p-4">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: activeAlert.bg }}>
                  <activeAlert.icon className="w-6 h-6" style={{ color: activeAlert.color }} />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-lg" style={{ color: activeAlert.color }}>{activeAlert.label}</div>
                  <div className="text-xs text-ink-muted">Notification urgente à la crèche</div>
                </div>
                <button onClick={()=>setOpen(null)}><X className="w-5 h-5" /></button>
              </div>
              {activeAlert.needsHeure && (
                <div className="mb-3">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">{activeAlert.heureLabel}</label>
                  <input type="time" value={heure} onChange={e=>setHeure(e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold" />
                </div>
              )}
              <div className="mb-3">
                <label className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">Message</label>
                <textarea value={contenu} onChange={e=>setContenu(e.target.value)} placeholder={activeAlert.placeholder} rows={4}
                  className="w-full mt-1 px-4 py-3 rounded-2xl bg-bgsoft outline-none focus:ring-2 focus:ring-teal/30 text-sm font-semibold resize-none" />
              </div>
              {enfant && <div className="text-xs text-ink-muted mb-3">Concerne : <span className="font-extrabold text-ink">{enfant.prenom}</span></div>}
              <button onClick={send} disabled={sending} className="btn-pill w-full text-white shadow-soft" style={{ background: activeAlert.color }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Envoyer l'alerte</>}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
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
  const [me, setMe] = useState(null);
  useEffect(() => { (async()=>{try{const f=await api('factures'); setFactures(f.factures); const m=await api('auth/me'); setMe(m.user);}catch(e){}})(); }, []);
  const total_a_regler = factures.filter(f=>f.statut==='en_attente' || f.statut==='en_cours').reduce((s,f)=>s+(f.total_ttc||f.montant||0),0);
  const totalPayeAnnee = factures.filter(f=>f.statut==='payee' && new Date(f.created_at).getFullYear() === new Date().getFullYear()).reduce((s,f)=>s+(f.total_ttc||f.montant||0),0);

  const downloadPDF = (f) => generateDocPDF(f, 'facture');
  const exportCAF = () => {
    // Export CAF : format récapitulatif annuel pour attestation crédit d'impôt / CAF
    const y = new Date().getFullYear();
    const payees = factures.filter(f=>f.statut==='payee' && new Date(f.created_at).getFullYear() === y);
    const total = payees.reduce((s,f)=>s+(f.total_ttc||f.montant||0),0);
    const lignes = payees.map(f => `<tr><td>${f.numero||'—'}</td><td>${f.mois||fmtDate(f.created_at)}</td><td>${fmtDate(f.paid_at||f.created_at)}</td><td style="text-align:right"><b>${(f.total_ttc||f.montant||0).toFixed(2)} €</b></td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Attestation CAF ${y}</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#2D3748;max-width:800px;margin:auto;}
        header{border-bottom:3px solid #3ECDB5;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between;}
        .brand{color:#3ECDB5;font-weight:900;font-size:28px;}.brand small{display:block;font-size:11px;color:#718096;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-top:4px;}
        h1{color:#2D3748;font-size:22px;}
        .box{background:#F5F7F9;padding:20px;border-radius:12px;margin:20px 0;}
        table{width:100%;border-collapse:collapse;margin:20px 0;}
        th{background:#3ECDB5;color:white;padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;}
        th:last-child{text-align:right;}
        td{padding:10px;border-bottom:1px solid #E2E8F0;font-size:13px;}
        .total{background:#E6F9F5;padding:20px;border-radius:12px;text-align:right;font-size:16px;margin-top:20px;}
        .total b{font-size:28px;color:#3ECDB5;}
        footer{margin-top:60px;padding-top:20px;border-top:1px solid #E2E8F0;font-size:11px;color:#718096;text-align:center;}
        .info{font-size:13px;line-height:1.6;}
        @media print { body { padding: 20px; } }
      </style></head><body>
      <header><div><div class="brand">TiMétis<small>Made in 974 · Attestation fiscale</small></div></div><div style="text-align:right;font-size:12px;color:#718096;"><b>Année</b> ${y}<br/>Édité le ${new Date().toLocaleDateString('fr-FR')}</div></header>
      <h1>Attestation de règlements — Frais de garde ${y}</h1>
      <div class="box info">
        <b style="color:#3ECDB5;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Bénéficiaire</b>
        <div style="font-size:16px;font-weight:900;margin-top:5px;">${me?.prenom||''} ${me?.nom||''}</div>
        <div style="color:#718096;">${me?.email||''}</div>
      </div>
      <p class="info">Nous certifions que la personne susnommée a réglé à TiMétis les sommes suivantes, correspondant aux frais de garde d'enfant au cours de l'année ${y}. Ce document peut être utilisé pour la déclaration à la CAF et pour bénéficier du crédit d'impôt pour frais de garde d'enfant.</p>
      <table>
        <thead><tr><th>N° facture</th><th>Période</th><th>Date paiement</th><th>Montant</th></tr></thead>
        <tbody>${lignes || '<tr><td colspan="4" style="text-align:center;color:#718096;padding:30px;">Aucun règlement enregistré pour '+y+'.</td></tr>'}</tbody>
      </table>
      <div class="total">Total versé en ${y} : <b>${total.toFixed(2)} €</b></div>
      <footer>Document généré automatiquement · TiMétis · Made in 974 🌺<br/>Ce récapitulatif ne remplace pas une attestation fiscale officielle mais tient lieu de justificatif de paiement.</footer>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);};</script></body></html>`;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (w) { w.document.write(html); w.document.close(); }
    else toast.error('Pop-up bloqué — autorisez les pop-ups');
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-6 shadow-soft">
        <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">Total à régler</div>
        <div className="text-4xl font-extrabold mt-2">{fmtEur(total_a_regler)}</div>
        <div className="text-xs opacity-80 mt-2">Payé en {new Date().getFullYear()} : <b>{fmtEur(totalPayeAnnee)}</b></div>
      </div>
      <div className="bg-white rounded-lg p-5 shadow-softer">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="font-extrabold text-lg">Mes factures</div>
          <button onClick={exportCAF} className="btn-pill bg-teal-light text-teal-dark text-xs" title={`Attestation ${new Date().getFullYear()} pour la CAF / crédit d'impôt`}><FileText className="w-3 h-3" /> Export CAF · Attestation {new Date().getFullYear()}</button>
        </div>
        <div className="text-xs text-ink-muted mb-3">💡 « Export CAF » génère un récapitulatif annuel des règlements pour votre déclaration.</div>
        <div className="space-y-2">
          {factures.length === 0 && <div className="text-center text-ink-muted text-sm py-8">Aucune facture pour l'instant.</div>}
          {factures.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bgsoft flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-teal" /></div>
              <div className="flex-1 min-w-0"><div className="font-bold truncate-1">{f.numero||'F-—'}</div><div className="text-xs text-ink-muted">{f.mois || fmtDate(f.created_at)}</div></div>
              <div className="font-extrabold">{fmtEur(f.total_ttc||f.montant)}</div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${f.statut==='payee'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>{f.statut==='payee'?'Payée':(f.statut==='en_cours'?'En cours':'En attente')}</span>
              <button onClick={()=>downloadPDF(f)} className="btn-pill bg-teal text-white text-xs shadow-soft"><Download className="w-3 h-3" /> PDF</button>
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
        <div className="mt-3 inline-flex items-center gap-2 bg-white/15 rounded-pill px-3 py-1.5 text-xs font-bold">
          <Plus className="w-3 h-3" /> +40 €/mois par crèche supplémentaire
        </div>
        <ul className="mt-4 space-y-1 text-sm">
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> 1 crèche incluse (jusqu'à 24 enfants)</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Enfants et employés illimités</li>
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
// ===== V8 New views =====
function ProfileEditor({ user, onSaved }) {
  const [f, setF] = useState({ prenom: user.prenom||'', nom: user.nom||'', tel: user.tel||'', password: '' });
  const save = async () => {
    try { const b = { ...f }; if (!b.password) delete b.password;
      await api('me', { method: 'PUT', body: JSON.stringify(b) });
      toast.success('Profil mis à jour'); onSaved?.();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="bg-white rounded-lg p-6 shadow-softer max-w-md animate-fade-up">
      <div className="flex items-center gap-4 mb-4"><Avatar user={user} size={72} /><div><div className="font-extrabold text-xl">{user.prenom} {user.nom}</div><div className="text-sm text-ink-muted capitalize">{user.role?.replace('_',' ')}</div><div className="text-xs text-ink-muted">{user.email}</div></div></div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Prénom</label><input value={f.prenom} onChange={e=>setF({...f,prenom:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Nom</label><input value={f.nom} onChange={e=>setF({...f,nom:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
        </div>
        <div><label className="text-xs font-extrabold uppercase text-ink-muted">Téléphone</label><input value={f.tel} onChange={e=>setF({...f,tel:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
        <div><label className="text-xs font-extrabold uppercase text-ink-muted">Nouveau mot de passe (optionnel)</label><input type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="Laisser vide pour ne pas changer" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
        <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
      </div>
    </div>
  );
}

function PreinscriptionsView({ activeCId, canEdit }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try{const d=await api('preinscriptions'); setItems(d.preinscriptions||[]);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouvelle pré-inscription</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.length===0 && <PlaceholderView title="Aucune pré-inscription" icon={UserCheck} />}
        {items.map(p => (
          <div key={p.id} className="bg-white rounded-lg p-5 shadow-softer">
            <div className="flex items-center justify-between mb-2"><div className="font-extrabold">{p.enfant_prenom} {p.enfant_nom}</div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.statut==='accepte'?'bg-teal-light text-teal-dark':p.statut==='refuse'?'bg-coral/20 text-coral':'bg-amber/20 text-amber'}`}>{p.statut}</span></div>
            <div className="text-xs text-ink-muted">Né(e) le {fmtDate(p.date_naissance)}</div>
            <div className="text-xs text-ink-muted">Souhaite entrer le {fmtDate(p.date_souhaitee)}</div>
            <div className="mt-3 pt-3 border-t border-bgsoft text-xs">
              <div className="font-bold">{p.parent_nom}</div>
              <div className="text-ink-muted">{p.parent_email} · {p.parent_tel}</div>
            </div>
            {p.notes && <div className="mt-2 text-xs italic text-ink-muted">{p.notes}</div>}
            {canEdit && (
              <div className="mt-3 flex gap-2">
                <button onClick={async()=>{await api(`preinscriptions/${p.id}`,{method:'PUT',body:JSON.stringify({statut:'accepte'})}); load();}} className="btn-pill bg-teal text-white text-xs flex-1">Accepter</button>
                <button onClick={async()=>{await api(`preinscriptions/${p.id}`,{method:'PUT',body:JSON.stringify({statut:'refuse'})}); load();}} className="btn-pill bg-coral/10 text-coral text-xs flex-1">Refuser</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {showAdd && <SimpleAddModal title="Nouvelle pré-inscription" fields={[
        {k:'enfant_prenom',l:'Prénom enfant'},{k:'enfant_nom',l:'Nom enfant'},
        {k:'date_naissance',l:'Date de naissance',type:'date'},
        {k:'parent_nom',l:'Nom parent'},{k:'parent_email',l:'Email parent'},{k:'parent_tel',l:'Téléphone'},
        {k:'date_souhaitee',l:'Date entrée souhaitée',type:'date'},
        {k:'contrat_heures',l:'Heures/semaine',type:'number',default:35},
        {k:'notes',l:'Notes'}
      ]} onSubmit={async(d)=>{await api('preinscriptions',{method:'POST',body:JSON.stringify({...d,creche_id:activeCId})});}} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

function FichesPaieView({ user, activeCId }) {
  const [items, setItems] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [openEmp, setOpenEmp] = useState(null); // employé actif (drawer admin)
  const [showAdd, setShowAdd] = useState(false); // modal dépôt (admin)
  const load = async () => {
    try {
      const d = await api('fiches-paie'); setItems(d.fiches||[]);
      if (user.role === 'admin') { const e = await api('employes'+(activeCId?`?creche_id=${activeCId}`:'')); setEmployes(e.employes||[]); }
    } catch(e){}
  };
  useEffect(() => { load(); }, [activeCId]);

  // --- Vue Pro : uniquement SES fiches (backend filtre par employe_id) ---
  if (user.role === 'pro') {
    return (
      <div className="space-y-4 animate-fade-up">
        <div className="bg-white rounded-lg p-4 shadow-softer flex items-center gap-3">
          <Avatar user={user} size={44} />
          <div className="flex-1 min-w-0"><div className="font-extrabold truncate-1">{user.prenom} {user.nom}</div><div className="text-xs text-ink-muted">Mes bulletins de salaire · {items.length} document{items.length>1?'s':''}</div></div>
          <Wallet className="w-6 h-6 text-teal" />
        </div>
        {items.length === 0 && <PlaceholderView title="Aucune fiche disponible" icon={Wallet} subtitle="Votre employeur n'a pas encore déposé de bulletin. Vous serez notifié dès qu'une fiche sera disponible." />}
        <div className="space-y-2">
          {items.map(f => (
            <div key={f.id} className="bg-white rounded-lg p-4 shadow-softer flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-teal-light flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-teal-dark" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold truncate-1">{f.periode}</div>
                <div className="text-xs text-ink-muted">Déposée le {fmtDate(f.created_at)}</div>
                {(f.montant_brut>0 || f.montant_net>0) && <div className="text-xs text-ink-muted mt-0.5">Brut : <b>{f.montant_brut}€</b> · Net : <b className="text-teal-dark">{f.montant_net}€</b></div>}
              </div>
              {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" download className="btn-pill bg-teal text-white text-xs shadow-soft"><Download className="w-3 h-3" /> Télécharger</a>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Vue Admin : cards employés cliquables ---
  const fichesByEmp = employes.reduce((acc, e) => {
    acc[e.id] = items.filter(f => f.employe_id === e.id);
    return acc;
  }, {});

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-white rounded-lg p-4 shadow-softer">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-extrabold text-lg">Fiches de paie</div>
            <div className="text-xs text-ink-muted">Cliquez sur un employé pour déposer / consulter ses bulletins de salaire</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Users className="w-4 h-4" /> <b>{employes.length}</b> employé{employes.length>1?'s':''}
            <FileText className="w-4 h-4 ml-2" /> <b>{items.length}</b> bulletin{items.length>1?'s':''}
          </div>
        </div>
      </div>

      {employes.length === 0 && <PlaceholderView title="Aucun employé dans cette crèche" icon={Users} subtitle="Ajoutez d'abord des employés depuis la vue « Équipe »." />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {employes.map(e => {
          const nb = (fichesByEmp[e.id]||[]).length;
          const lastF = (fichesByEmp[e.id]||[])[0];
          return (
            <button key={e.id} onClick={()=>setOpenEmp(e)} className="bg-white rounded-lg p-4 shadow-softer text-left hover:shadow-soft transition group">
              <div className="flex items-center gap-3">
                <Avatar user={e} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold truncate-1">{e.prenom} {e.nom}</div>
                  <div className="text-xs text-ink-muted truncate-1">{e.email}</div>
                </div>
                <div className={`text-[10px] font-extrabold px-2 py-1 rounded-full ${nb>0?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>{nb} fiche{nb>1?'s':''}</div>
              </div>
              <div className="mt-3 pt-3 border-t border-bgsoft flex items-center justify-between text-xs">
                <span className="text-ink-muted">{lastF ? `Dernière : ${lastF.periode}` : 'Aucun bulletin déposé'}</span>
                <span className="text-teal-dark font-bold group-hover:translate-x-1 transition">Ouvrir →</span>
              </div>
            </button>
          );
        })}
      </div>

      {openEmp && (
        <EmployePayslipsDrawer
          employe={openEmp}
          fiches={fichesByEmp[openEmp.id]||[]}
          activeCId={activeCId}
          onClose={()=>{setOpenEmp(null); load();}}
        />
      )}
    </div>
  );
}

function EmployePayslipsDrawer({ employe, fiches, activeCId, onClose }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ periode: '', montant_brut: 0, montant_net: 0, note: '', url: null });

  const submit = async () => {
    if (!form.periode) return toast.error('Renseignez une période (ex : juin 2026)');
    if (!form.url) return toast.error('Veuillez déposer un fichier PDF ou image');
    try {
      await api('fiches-paie', { method: 'POST', body: JSON.stringify({
        employe_id: employe.id, employe_nom: `${employe.prenom} ${employe.nom}`,
        creche_id: activeCId,
        periode: form.periode, url: form.url,
        montant_brut: +form.montant_brut || 0, montant_net: +form.montant_net || 0,
        note: form.note || '',
      }) });
      toast.success(`Fiche déposée pour ${employe.prenom}`);
      setForm({ periode: '', montant_brut: 0, montant_net: 0, note: '', url: null });
      setShowAdd(false);
      onClose(); // refresh
    } catch(e){ toast.error(e.message); }
  };

  const del = async (f) => {
    if (!confirm(`Supprimer la fiche « ${f.periode} » de ${employe.prenom} ?`)) return;
    try { await api(`fiches-paie/${f.id}`, { method: 'DELETE' }); toast.success('Fiche supprimée'); onClose(); }
    catch(e){ toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-lg w-full max-w-lg my-6 shadow-soft">
        {/* Header */}
        <div className="p-5 border-b border-bgsoft flex items-center gap-3">
          <Avatar user={employe} size={56} />
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-lg truncate-1">{employe.prenom} {employe.nom}</div>
            <div className="text-xs text-ink-muted truncate-1">{employe.email}</div>
            <div className="text-xs text-ink-muted">{fiches.length} bulletin{fiches.length>1?'s':''} déposé{fiches.length>1?'s':''}</div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {!showAdd && (
            <button onClick={()=>setShowAdd(true)} className="btn-pill w-full bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Déposer un nouveau bulletin</button>
          )}

          {showAdd && (
            <div className="bg-bgsoft rounded-2xl p-4 space-y-3">
              <div className="font-extrabold text-sm">Nouveau bulletin de salaire</div>
              <div><label className="text-xs font-extrabold uppercase text-ink-muted">Période</label>
                <input value={form.periode} onChange={e=>setForm({...form,periode:e.target.value})} placeholder="ex : juin 2026" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-white outline-none text-sm font-semibold" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-extrabold uppercase text-ink-muted">Brut (€)</label>
                  <input type="number" value={form.montant_brut} onChange={e=>setForm({...form,montant_brut:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-white outline-none text-sm font-semibold" /></div>
                <div><label className="text-xs font-extrabold uppercase text-ink-muted">Net (€)</label>
                  <input type="number" value={form.montant_net} onChange={e=>setForm({...form,montant_net:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-white outline-none text-sm font-semibold" /></div>
              </div>
              <div><label className="text-xs font-extrabold uppercase text-ink-muted">Note (optionnelle)</label>
                <input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="ex : bonus, prime, …" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-white outline-none text-sm font-semibold" /></div>
              <div><label className="text-xs font-extrabold uppercase text-ink-muted">Fichier PDF ou image</label>
                <div className="mt-1">
                  <MediaUploader folder={`fiches-paie/${employe.id}`} onUpload={(m)=>{ setForm(f=>({...f, url:m.url})); toast.success('Fichier prêt'); }} />
                </div>
                {form.url && <div className="text-[11px] text-teal-dark font-bold mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Fichier prêt : <a href={form.url} target="_blank" rel="noopener noreferrer" className="underline">aperçu</a></div>}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>{setShowAdd(false); setForm({ periode:'', montant_brut:0, montant_net:0, note:'', url:null });}} className="btn-pill bg-white text-ink-muted text-xs flex-1">Annuler</button>
                <button onClick={submit} className="btn-pill bg-teal text-white text-xs shadow-soft flex-1"><Save className="w-3 h-3" /> Déposer</button>
              </div>
            </div>
          )}

          {/* Historique */}
          <div>
            <div className="text-xs font-extrabold uppercase text-ink-muted mb-2">Historique</div>
            {fiches.length === 0 && <div className="bg-bgsoft rounded-2xl p-4 text-sm text-ink-muted text-center">Aucun bulletin déposé pour cet employé.</div>}
            <div className="space-y-2">
              {fiches.map(f => (
                <div key={f.id} className="bg-bgsoft rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-teal-dark" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold truncate-1">{f.periode}</div>
                    <div className="text-[11px] text-ink-muted">Déposée le {fmtDate(f.created_at)}</div>
                    {(f.montant_brut>0 || f.montant_net>0) && <div className="text-[11px] text-ink-muted">Brut {f.montant_brut}€ · Net <b className="text-teal-dark">{f.montant_net}€</b></div>}
                    {f.note && <div className="text-[11px] text-ink-muted italic mt-0.5">{f.note}</div>}
                  </div>
                  <div className="flex gap-1">
                    {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" download className="btn-pill bg-teal text-white text-[10px] shadow-soft"><Download className="w-3 h-3" /></a>}
                    <button onClick={()=>del(f)} className="btn-pill bg-coral/10 text-coral text-[10px]"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatistiquesView({ activeCId }) {
  const [s, setS] = useState(null);
  useEffect(() => { (async()=>{try{const d=await api('statistiques'+(activeCId?`?creche_id=${activeCId}`:'')); setS(d.stats);}catch(e){}})(); }, [activeCId]);
  if (!s) return <Loading />;
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-softer"><div className="text-[11px] font-extrabold uppercase text-teal">Enfants</div><div className="text-3xl font-extrabold mt-1">{s.enfants}</div></div>
        <div className="bg-white rounded-lg p-4 shadow-softer"><div className="text-[11px] font-extrabold uppercase text-violet">Employés</div><div className="text-3xl font-extrabold mt-1">{s.employes}</div></div>
        <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-4 shadow-soft"><div className="text-[11px] font-extrabold uppercase opacity-80">CA mois</div><div className="text-3xl font-extrabold mt-1">{fmtEur(s.ca_mois)}</div></div>
        <div className="bg-white rounded-lg p-4 shadow-softer"><div className="text-[11px] font-extrabold uppercase text-coral">Impayés</div><div className="text-3xl font-extrabold mt-1">{s.factures_impayees}</div></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-5 shadow-softer"><div className="font-extrabold text-lg mb-3">Répartition par section</div>
          <div className="space-y-2">{Object.entries(s.enfants_par_groupe).map(([g,c]) => <div key={g} className="flex items-center justify-between p-2 rounded-2xl bg-bgsoft"><span className="font-bold text-sm">{g}</span><span className="font-extrabold text-teal-dark">{c}</span></div>)}</div>
        </div>
        <div className="bg-white rounded-lg p-5 shadow-softer"><div className="font-extrabold text-lg mb-3">Activités enregistrées</div>
          <div className="space-y-2">{Object.entries(s.transmissions_par_type).slice(0,6).map(([t,c]) => { const meta = TYPE_META[t]||TYPE_META.note; return <div key={t} className="flex items-center justify-between p-2 rounded-2xl bg-bgsoft"><span className="font-bold text-sm capitalize">{meta.label}</span><span className="font-extrabold" style={{color:meta.color}}>{c}</span></div>; })}</div>
        </div>
      </div>
    </div>
  );
}

function NotificationsView({ activeCId, canSend }) {
  const [items, setItems] = useState([]);
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [cible, setCible] = useState('tous');
  const load = async () => { try{const d=await api('notifications'); setItems(d.notifications||[]);}catch(e){} };
  useEffect(() => { load(); }, [activeCId]);
  const send = async () => {
    if (!titre.trim() || !contenu.trim()) return toast.error('Titre + contenu requis');
    try { await api('notifications', { method: 'POST', body: JSON.stringify({ titre, contenu, cible, creche_id: activeCId }) });
      toast.success('Notification envoyée'); setTitre(''); setContenu(''); load(); }
    catch(e){ toast.error(e.message); }
  };
  return (
    <div className="space-y-4 animate-fade-up">
      {canSend && (
        <div className="bg-white rounded-lg p-5 shadow-softer">
          <div className="font-extrabold text-lg mb-3">Envoyer une notification</div>
          <div className="space-y-3">
            <input value={titre} onChange={e=>setTitre(e.target.value)} placeholder="Titre" className="w-full px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" />
            <textarea value={contenu} onChange={e=>setContenu(e.target.value)} placeholder="Contenu..." rows={3} className="w-full px-4 py-2.5 rounded-2xl bg-bgsoft outline-none text-sm font-semibold resize-none" />
            <div className="flex gap-2 items-center">
              <select value={cible} onChange={e=>setCible(e.target.value)} className="flex-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold">
                <option value="tous">Tout le monde</option><option value="parent">Parents uniquement</option><option value="pro">Employés uniquement</option>
              </select>
              <button onClick={send} className="btn-pill bg-teal text-white shadow-soft"><Send className="w-4 h-4" /> Envoyer</button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.length===0 && <PlaceholderView title="Aucune notification" icon={Bell} />}
        {items.map(n => (
          <div key={n.id} className="bg-white rounded-lg p-4 shadow-softer">
            <div className="flex items-center gap-2 mb-1"><Bell className="w-4 h-4 text-teal" /><div className="font-bold">{n.titre}</div><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bgsoft ml-auto capitalize">{n.cible}</span></div>
            <div className="text-sm text-ink-muted">{n.contenu}</div>
            <div className="text-xs text-ink-muted mt-1">Par {n.from_nom} · {fmtDate(n.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdministrationHub({ setView }) {
  const modules = [
    { key: 'admin/enfants', label: 'Enfants', icon: Baby, desc: 'Profils, photos, fiches santé, étiquettes' },
    { key: 'admin/familles', label: 'Foyers', icon: Users, desc: 'Coordonnées, nombre d\'enfants' },
    { key: 'admin/employes', label: 'Équipe', icon: Briefcase, desc: 'Comptes, mots de passe, poste' },
    { key: 'admin/planning-employes', label: 'Contrats & horaires', icon: Calendar, desc: 'Contrats hebdo, prorata, taux' },
    { key: 'admin/fiches-paie', label: 'Fiches de paie', icon: Wallet, desc: 'Dépôt et historique' },
    { key: 'admin/devis', label: 'Devis & factures', icon: FileText, desc: 'Création, envoi, suivi' },
    { key: 'admin/notifications', label: 'Notifications', icon: Bell, desc: 'Envoi groupé parents/employés' },
    { key: 'admin/statistiques', label: 'Statistiques', icon: BarChart3, desc: 'CA, effectifs, activités' },
    { key: 'admin/rgpd', label: 'RGPD & conditions', icon: ShieldCheck, desc: 'Clauses, conditions d\'utilisation' },
    { key: 'admin/abonnement', label: 'Abonnement', icon: CreditCard, desc: 'Plan, factures, arrangements' },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
      {modules.map(m => { const Icon = m.icon; return (
        <button key={m.key} onClick={()=>setView(m.key)} className="bg-white rounded-lg p-5 shadow-softer hover:shadow-soft hover:-translate-y-1 transition-all text-left">
          <div className="w-12 h-12 rounded-2xl bg-teal-light flex items-center justify-center mb-3"><Icon className="w-6 h-6 text-teal-dark" /></div>
          <div className="font-extrabold text-lg">{m.label}</div>
          <div className="text-xs text-ink-muted mt-1">{m.desc}</div>
        </button>
      ); })}
    </div>
  );
}

function RGPDView() {
  return (
    <div className="space-y-4 animate-fade-up max-w-3xl">
      <div className="bg-white rounded-lg p-6 shadow-softer">
        <div className="flex items-center gap-3 mb-4"><ShieldCheck className="w-8 h-8 text-teal" /><div><div className="font-extrabold text-xl">RGPD & conditions</div><div className="text-xs text-ink-muted">Vos clauses, mentions légales et politique de confidentialité</div></div></div>
        <div className="space-y-3 text-sm text-ink-muted">
          <div className="p-4 rounded-2xl bg-bgsoft"><div className="font-extrabold text-ink mb-1">📋 Conditions d'utilisation</div><p>Éditez ici vos conditions générales d'utilisation applicables à vos parents et employés.</p></div>
          <div className="p-4 rounded-2xl bg-bgsoft"><div className="font-extrabold text-ink mb-1">🔒 Politique de confidentialité</div><p>Traitement des données personnelles, durée de conservation, droits des utilisateurs (accès, rectification, suppression).</p></div>
          <div className="p-4 rounded-2xl bg-bgsoft"><div className="font-extrabold text-ink mb-1">🍪 Cookies & traceurs</div><p>Aucun cookie tiers de tracking. Uniquement session sécurisée.</p></div>
          <div className="p-4 rounded-2xl bg-teal-light text-teal-dark"><div className="font-extrabold mb-1">📞 Contact DPO</div><p className="text-ink-muted">Pour toute question : rgpd@timetis.re</p></div>
        </div>
      </div>
    </div>
  );
}

function SuperProspects() {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => { try{const d=await api('super/prospects'); setItems(d.prospects||[]);}catch(e){} };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouveau prospect</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.length===0 && <PlaceholderView title="Aucun prospect" icon={UserCheck} />}
        {items.map(p => (
          <div key={p.id} className="bg-white rounded-lg p-5 shadow-softer">
            <div className="flex items-center justify-between"><div className="font-extrabold text-lg">{p.nom}</div><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.statut==='converti'?'bg-teal-light text-teal-dark':'bg-amber/20 text-amber'}`}>{p.statut}</span></div>
            <div className="text-xs text-ink-muted mt-1">{p.contact} · {p.ville}</div>
            <div className="text-xs text-ink-muted">{p.email} · {p.tel}</div>
            {p.notes && <div className="text-xs italic text-ink-muted mt-2">{p.notes}</div>}
          </div>
        ))}
      </div>
      {showAdd && <SimpleAddModal title="Nouveau prospect crèche" fields={[{k:'nom',l:'Nom crèche'},{k:'contact',l:'Contact'},{k:'email',l:'Email'},{k:'tel',l:'Téléphone'},{k:'ville',l:'Ville'},{k:'notes',l:'Notes'}]} onSubmit={async(d)=>{await api('super/prospects',{method:'POST',body:JSON.stringify(d)});}} onClose={()=>{setShowAdd(false);load();}} />}
    </div>
  );
}

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
    // Auto-inscription push (silencieuse - demande permission au premier click)
    if (typeof window !== 'undefined' && Notification?.permission === 'granted') {
      registerPush().catch(()=>{});
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
    'super/dashboard': 'Cockpit', 'super/clients': 'Mes clients', 'super/feedbacks': 'Avis & suggestions',
    'admin/dashboard': 'Cockpit', 'admin/enfants': 'Enfants',
    'admin/familles': 'Foyers', 'admin/groupes': 'Sections', 'admin/tags': 'Étiquettes',
    'admin/presences': 'Présences hebdo', 'admin/synthese': 'Bilan hebdo',
    'admin/nourriture': 'Restauration', 'admin/rappels': 'Alertes', 'admin/news': 'Actus', 'admin/documents': 'Espace docs',
    'admin/devis': 'Devis', 'admin/factures': 'Factures', 'admin/finances': 'Finances · CA', 'admin/charges': 'Charges & Salaires',
    'admin/employes': 'Équipe', 'admin/planning-employes': 'Horaires équipe', 'admin/messagerie': 'Discussions',
    'admin/alarme': 'Sécurité incendie', 'admin/abonnement': 'Abonnement', 'admin/feedback': 'Envoyer un avis',
    'pro/profil': 'Mon profil', 'pro/pointage': 'Pointage', 'pro/mes-horaires': 'Mes horaires',
    'pro/activites': 'Activités enfants', 'pro/enfants': 'Enfants', 'pro/nourriture': 'Restauration',
    'pro/rappels': 'Alertes', 'pro/messagerie': 'Discussions parents', 'pro/documents': 'Espace docs',
    'pro/news': 'Actus', 'pro/taches': 'Mes tâches', 'pro/feedback': 'Envoyer un avis',
    'parent/live': 'Suivi en direct', 'parent/journal': 'Journal du jour', 'parent/photos': 'Album photos',
    'parent/reservations': 'Réservations', 'parent/nourriture': 'Menu de la semaine', 'parent/news': 'Actus',
    'parent/messagerie': 'Discussions', 'parent/documents': 'Espace docs', 'parent/factures': 'Mes factures', 'parent/feedback': 'Envoyer un avis',
  };

  const canEdit = (user.role === 'admin' || user.role === 'super_admin');

  const renderView = () => {
    switch (view) {
      case 'super/dashboard': return <SuperDashboard />;
      case 'super/clients': return <SuperClients />;
      case 'super/prospects': return <SuperProspects />;
      case 'super/factures': return <SuperDevisFactures />;
      case 'super/feedbacks': return <SuperFeedbacks />;
      case 'super/settings': return <ProfileEditor user={user} />;
      case 'admin/dashboard': return <AdminDashboard user={user} activeCId={activeCId} />;
      case 'admin/preinscriptions': return <PreinscriptionsView activeCId={activeCId} canEdit />;
      case 'admin/fiches-paie': return <FichesPaieView user={user} activeCId={activeCId} />;
      case 'admin/notifications': return <NotificationsView activeCId={activeCId} canSend />;
      case 'admin/statistiques': return <StatistiquesView activeCId={activeCId} />;
      case 'admin/administration': return <AdministrationHub setView={setView} />;
      case 'admin/rgpd': return <RGPDView />;
      case 'admin/enfants': return <AdminEnfants activeCId={activeCId} />;
      case 'admin/familles': return <AdminFamilles activeCId={activeCId} />;
      case 'admin/groupes': return <AdminGroupes activeCId={activeCId} />;
      case 'admin/tags': return <AdminTags activeCId={activeCId} />;
      case 'admin/presences': return <AdminPresences activeCId={activeCId} />;
      case 'admin/reservations': return <AdminReservations activeCId={activeCId} />;
      case 'admin/albums': return <AlbumsView activeCId={activeCId} user={user} />;
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
      case 'pro/profil': return <ProfileEditor user={user} />;
      case 'pro/pointage': return <ProPointage user={user} />;
      case 'pro/mes-horaires': return <ProMesHoraires user={user} />;
      case 'pro/fiches-paie': return <FichesPaieView user={user} activeCId={user.creche_id} />;
      case 'pro/activites': return <ProActivites user={user} />;
      case 'pro/enfants': return <AdminEnfants activeCId={user.creche_id} />;
      case 'pro/nourriture': return <NourritureView activeCId={user.creche_id} canEdit />;
      case 'pro/rappels': return <RappelsView activeCId={user.creche_id} canEdit />;
      case 'pro/messagerie': return <ThreadedMessagerie user={user} />;
      case 'pro/documents': return <DocumentsView activeCId={user.creche_id} canEdit />;
      case 'pro/news': return <NewsView activeCId={user.creche_id} canEdit={false} />;
      case 'pro/taches': return <ProTaches />;
      case 'pro/albums': return <AlbumsView activeCId={user.creche_id} user={user} />;
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
        <div className="px-4 md:px-8 pt-4 pb-8 relative">{renderView()}</div>
      </main>
    </div>
  );
}

function ParentPhotos() {
  const [data, setData] = useState({ albums: [], chat_medias: [] });
  const [tab, setTab] = useState('albums');
  const [openAlbum, setOpenAlbum] = useState(null);
  useEffect(() => { (async()=>{try{const d = await api('parent/photos'); setData(d);}catch(e){}})(); }, []);
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-white rounded-lg p-4 shadow-softer flex items-center gap-3">
        <ImageIcon className="w-8 h-8 text-teal" />
        <div className="flex-1"><div className="font-extrabold text-lg">Album photos</div><div className="text-xs text-ink-muted">Sécurisé 🌺 · vos souvenirs de la crèche</div></div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-teal-light text-teal-dark">{(data.albums||[]).length} albums · {(data.chat_medias||[]).length} médias</span>
      </div>
      <div className="flex gap-2">
        <button onClick={()=>setTab('albums')} className={`btn-pill text-sm ${tab==='albums'?'bg-teal text-white shadow-soft':'bg-white text-ink-muted'}`}>📸 Albums ({(data.albums||[]).length})</button>
        <button onClick={()=>setTab('chat')} className={`btn-pill text-sm ${tab==='chat'?'bg-teal text-white shadow-soft':'bg-white text-ink-muted'}`}>💬 Depuis les discussions ({(data.chat_medias||[]).length})</button>
      </div>
      {tab === 'albums' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data.albums||[]).length === 0 && <div className="col-span-full"><PlaceholderView title="Aucun album pour l'instant" icon={ImageIcon} subtitle="Vos éducateurs et l'employeur créent des albums (sorties, thèmes…). Vous serez notifié à chaque ajout." /></div>}
          {(data.albums||[]).map(a => (
            <button key={a.id} onClick={()=>setOpenAlbum(a)} className="bg-white rounded-lg overflow-hidden shadow-softer hover:shadow-soft hover:-translate-y-1 transition text-left">
              <div className="aspect-video bg-bgsoft relative">
                {a.medias?.[0] ? <img src={a.medias[0].url} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-ink-muted"><ImageIcon className="w-10 h-10 opacity-40" /></div>}
                <div className="absolute top-2 right-2 bg-white/90 text-teal-dark text-[10px] font-bold px-2 py-1 rounded-full">{(a.medias||[]).length} médias</div>
              </div>
              <div className="p-3"><div className="font-extrabold truncate-1">{a.nom}</div><div className="text-xs text-ink-muted">{a.theme || 'Album'} · {fmtDate(a.date||a.created_at)}</div></div>
            </button>
          ))}
        </div>
      )}
      {tab === 'chat' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(data.chat_medias||[]).length === 0 && <div className="col-span-full text-center text-ink-muted text-sm py-8">Aucun média partagé via les discussions.</div>}
          {(data.chat_medias||[]).map((m,i) => (
            <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden shadow-softer relative group">
              {m.type==='video' ? <video src={m.url} className="w-full h-full object-cover" /> : <img src={m.url} alt="" className="w-full h-full object-cover" />}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition">
                <div>{m.from_nom}</div><div>{fmtDate(m.created_at)}</div>
              </div>
            </a>
          ))}
        </div>
      )}
      {openAlbum && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 overflow-y-auto" onClick={()=>setOpenAlbum(null)}>
          <div onClick={e=>e.stopPropagation()} className="bg-white rounded-lg p-5 w-full max-w-3xl my-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-3"><div><div className="font-extrabold text-lg">{openAlbum.nom}</div><div className="text-xs text-ink-muted">{openAlbum.theme || 'Album'} · {fmtDate(openAlbum.date||openAlbum.created_at)}</div></div><button onClick={()=>setOpenAlbum(null)}><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(openAlbum.medias||[]).map((m,i) => (
                <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden shadow-softer">
                  {m.type==='video' ? <video src={m.url} controls className="w-full h-full object-cover" /> : <img src={m.url} alt="" className="w-full h-full object-cover" />}
                </a>
              ))}
              {(openAlbum.medias||[]).length === 0 && <div className="col-span-full text-center text-ink-muted text-sm py-8">Album vide pour l'instant.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlbumsView({ activeCId, user }) {
  const [albums, setAlbums] = useState([]);
  const [enfants, setEnfants] = useState([]);
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);
  const load = async () => {
    try {
      const a = await api('albums'+(activeCId?`?creche_id=${activeCId}`:'')); setAlbums(a.albums||[]);
      const e = await api('enfants'+(activeCId?`?creche_id=${activeCId}`:'')); setEnfants(e.enfants||[]);
    } catch(err){}
  };
  useEffect(() => { load(); }, [activeCId]);
  const del = async (a) => { if (!confirm(`Supprimer l'album "${a.nom}" ?`)) return; try { await api(`albums/${a.id}`, { method: 'DELETE' }); toast.success('Album supprimé'); load(); } catch(e){ toast.error(e.message); } };
  const onUploadTo = async (albumId, media) => {
    try { await api(`albums/${albumId}/medias`, { method: 'POST', body: JSON.stringify({ url: media.url, type: media.format?.startsWith('video')?'video':'image' }) }); toast.success('Média ajouté'); load(); }
    catch(e){ toast.error(e.message); }
  };
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-ink-muted">Créez des albums thématiques (sortie parc, atelier peinture, anniversaires…) et ajoutez photos/vidéos. Les parents concernés reçoivent une notification.</div>
        <button onClick={()=>setEdit('new')} className="btn-pill bg-teal text-white shadow-soft"><Plus className="w-4 h-4" /> Nouvel album</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {albums.length === 0 && <div className="col-span-full"><PlaceholderView title="Aucun album" icon={ImageIcon} subtitle="Créez votre premier album" /></div>}
        {albums.map(a => (
          <div key={a.id} className="bg-white rounded-lg overflow-hidden shadow-softer">
            <button onClick={()=>setOpen(a)} className="w-full aspect-video bg-bgsoft relative">
              {a.medias?.[0] ? <img src={a.medias[0].url} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-ink-muted"><ImageIcon className="w-10 h-10 opacity-40" /></div>}
              <div className="absolute top-2 right-2 bg-white/90 text-teal-dark text-[10px] font-bold px-2 py-1 rounded-full">{(a.medias||[]).length} médias</div>
            </button>
            <div className="p-3">
              <div className="font-extrabold truncate-1">{a.nom}</div>
              <div className="text-xs text-ink-muted truncate-1">{a.theme || 'Album'} · {fmtDate(a.date||a.created_at)}</div>
              {a.enfants_ids?.length > 0 && <div className="text-[10px] text-ink-muted mt-1">👶 {a.enfants_ids.length} enfant{a.enfants_ids.length>1?'s':''} concerné{a.enfants_ids.length>1?'s':''}</div>}
              <div className="mt-2 flex gap-1">
                <MediaUploader folder={`albums/${a.id}`} onUpload={(m)=>onUploadTo(a.id, m)} />
                <button onClick={()=>setEdit(a)} className="btn-pill bg-bgsoft text-ink-muted text-xs"><Edit3 className="w-3 h-3" /></button>
                <button onClick={()=>del(a)} className="btn-pill bg-coral/10 text-coral text-xs"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {edit && <AlbumEditorModal album={edit==='new'?null:edit} enfants={enfants} activeCId={activeCId} onClose={()=>{setEdit(null);load();}} />}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 overflow-y-auto" onClick={()=>setOpen(null)}>
          <div onClick={e=>e.stopPropagation()} className="bg-white rounded-lg p-5 w-full max-w-3xl my-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-3"><div className="font-extrabold text-lg">{open.nom}</div><button onClick={()=>setOpen(null)}><X className="w-5 h-5" /></button></div>
            <MediaUploader folder={`albums/${open.id}`} onUpload={(m)=>onUploadTo(open.id, m)} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {(open.medias||[]).map((m,i) => (
                <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden shadow-softer">
                  {m.type==='video' ? <video src={m.url} controls className="w-full h-full object-cover" /> : <img src={m.url} alt="" className="w-full h-full object-cover" />}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlbumEditorModal({ album, enfants, activeCId, onClose }) {
  const [f, setF] = useState(album || { nom:'', theme:'', date: new Date().toISOString().slice(0,10), enfants_ids: [] });
  const toggle = (id) => { const cur = f.enfants_ids || []; setF({ ...f, enfants_ids: cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id] }); };
  const save = async () => {
    if (!f.nom.trim()) return toast.error('Nommez l\'album');
    try {
      if (album) await api(`albums/${album.id}`, { method: 'PUT', body: JSON.stringify(f) });
      else await api('albums', { method: 'POST', body: JSON.stringify({ ...f, creche_id: activeCId }) });
      toast.success(album?'Album mis à jour':'Album créé'); onClose();
    } catch(e){ toast.error(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-lg p-6 w-full max-w-md my-6">
        <div className="flex items-center justify-between mb-4"><div className="font-extrabold text-lg">{album?'Éditer l\'album':'Nouvel album'}</div><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Nom</label><input value={f.nom} onChange={e=>setF({...f,nom:e.target.value})} placeholder="Ex : Sortie parc du 15/07" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Thème</label><input value={f.theme||''} onChange={e=>setF({...f,theme:e.target.value})} placeholder="Sortie, atelier, anniversaire…" className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div><label className="text-xs font-extrabold uppercase text-ink-muted">Date</label><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})} className="w-full mt-1 px-4 py-2.5 rounded-pill bg-bgsoft outline-none text-sm font-semibold" /></div>
          <div>
            <div className="flex items-center justify-between"><label className="text-xs font-extrabold uppercase text-ink-muted">Enfants concernés (optionnel)</label><span className="text-xs text-ink-muted">{(f.enfants_ids||[]).length} sélectionnés</span></div>
            <div className="mt-2 bg-bgsoft rounded-2xl p-2 max-h-40 overflow-y-auto space-y-1">
              {enfants.map(en => {
                const checked = (f.enfants_ids||[]).includes(en.id);
                return <label key={en.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer ${checked?'bg-teal text-white':'bg-white'}`}><input type="checkbox" checked={checked} onChange={()=>toggle(en.id)} className="w-4 h-4 accent-teal-dark" /><span className="text-sm font-semibold">{en.prenom} {en.nom}</span></label>;
              })}
              {enfants.length === 0 && <div className="text-xs text-ink-muted p-2 italic">Aucun enfant enregistré.</div>}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Vide = album visible par toutes les familles</div>
          </div>
          <button onClick={save} className="btn-pill w-full bg-teal text-white shadow-soft"><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </motion.div>
    </div>
  );
}

// ===== ADMIN RÉSERVATIONS (planning mensuel) =====
function AdminReservations({ activeCId }) {
  const [enfants, setEnfants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7)); // YYYY-MM
  const [reservations, setReservations] = useState([]);
  const load = async () => {
    try {
      const e = await api('enfants'+(activeCId?`?creche_id=${activeCId}`:'')); setEnfants(e.enfants); if (!selected) setSelected(e.enfants[0]?.id);
    } catch(err){}
  };
  const loadRes = async () => {
    if (!selected) return;
    try { const r = await api(`reservations?enfant_id=${selected}&month=${month}`); setReservations(r.reservations||[]); } catch(e){}
  };
  useEffect(() => { load(); }, [activeCId]);
  useEffect(() => { loadRes(); }, [selected, month]);

  const child = enfants.find(e => e.id === selected);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDay = new Date(y, m-1, 1).getDay(); // 0=Sun
  const offset = firstDay === 0 ? 6 : firstDay - 1; // aligner lundi

  const toggleDay = async (dstr) => {
    if (!child) return;
    const existing = reservations.find(r => r.date === dstr);
    try {
      const arrivee = existing?.arrivee || (child.presences_hebdo?.[getJourFr(dstr)]?.arrivee) || '08:00';
      const depart = existing?.depart || (child.presences_hebdo?.[getJourFr(dstr)]?.depart) || '17:00';
      const present = !existing?.present;
      await api('reservations', { method: 'POST', body: JSON.stringify({ enfant_id: child.id, creche_id: activeCId, date: dstr, present, arrivee, depart }) });
      loadRes();
    } catch(e){ toast.error(e.message); }
  };

  // Calcul du prévisionnel de facture
  const nbJoursPrevus = reservations.filter(r=>r.present).length;
  const heuresMois = reservations.filter(r=>r.present).reduce((s,r) => {
    const [ah,am] = (r.arrivee||'08:00').split(':').map(Number); const [dh,dm] = (r.depart||'17:00').split(':').map(Number);
    return s + Math.max(0, (dh*60+dm)-(ah*60+am))/60;
  }, 0);
  const heuresContratMensuel = (child?.contrat_heures||35) * 4.33;
  const factureMois = child ? (child.mensualite * Math.min(1, heuresMois/heuresContratMensuel)) : 0;

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-white rounded-lg p-4 shadow-softer">
        <div className="text-xs text-ink-muted mb-2">📅 Planifiez les jours & horaires de présence prévus par mois. La facture est recalculée automatiquement au prorata (les jours non cochés = absence = déduction).</div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {enfants.map(e => <button key={e.id} onClick={()=>setSelected(e.id)} className={`btn-pill text-xs flex-shrink-0 ${selected===e.id?'bg-teal text-white':'bg-white text-ink-muted'}`}><Avatar enfant={e} size={22} /> {e.prenom}</button>)}
        </div>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="px-3 py-2 rounded-pill bg-white outline-none text-sm font-semibold shadow-softer" />
      </div>
      {child && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-4 shadow-softer"><div className="text-[11px] font-extrabold uppercase text-ink-muted">Jours prévus</div><div className="text-2xl font-extrabold mt-1">{nbJoursPrevus}</div></div>
            <div className="bg-white rounded-lg p-4 shadow-softer"><div className="text-[11px] font-extrabold uppercase text-ink-muted">Heures prévues</div><div className="text-2xl font-extrabold mt-1">{heuresMois.toFixed(0)}h</div><div className="text-[10px] text-ink-muted">sur {heuresContratMensuel.toFixed(0)}h contrat mensuel</div></div>
            <div className="bg-gradient-to-br from-teal to-teal-dark text-white rounded-lg p-4 shadow-soft"><div className="text-[11px] font-extrabold uppercase opacity-80">Facture prévisionnelle</div><div className="text-2xl font-extrabold mt-1">{fmtEur(factureMois)}</div><div className="text-[10px] opacity-80">recalculée au prorata</div></div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-softer">
            <div className="text-xs font-extrabold uppercase text-ink-muted mb-2">Cliquez sur un jour pour cocher/décocher la présence</div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-muted mb-1">
              {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({length: offset}, (_,i) => <div key={'sp'+i} />)}
              {Array.from({length: daysInMonth}, (_,i) => {
                const day = i+1;
                const dstr = `${month}-${String(day).padStart(2,'0')}`;
                const r = reservations.find(x => x.date === dstr);
                const isWknd = [0,6].includes(new Date(y, m-1, day).getDay());
                return (
                  <button key={dstr} onClick={()=>toggleDay(dstr)} className={`aspect-square rounded-2xl p-1 transition ${r?.present?'bg-teal text-white shadow-soft':isWknd?'bg-bgsoft/40 text-ink-muted':'bg-bgsoft text-ink-muted hover:bg-teal-light hover:text-teal-dark'}`}>
                    <div className="text-sm font-extrabold">{day}</div>
                    {r?.present && <div className="text-[8px] font-bold">{r.arrivee}→{r.depart}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function getJourFr(dstr) { const d = new Date(dstr); const j = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']; return j[d.getDay()]; }

// ===== Bilan hebdo PDF generation =====
function generateBilanHebdoPDF(enfant, stats, tags) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Bilan hebdo — ${enfant.prenom} ${enfant.nom}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#2D3748;max-width:800px;margin:auto;}
      header{border-bottom:3px solid #3ECDB5;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:flex-start;}
      .brand{color:#3ECDB5;font-weight:900;font-size:28px;}.brand small{display:block;font-size:11px;color:#718096;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-top:4px;}
      h1{color:#2D3748;font-size:24px;margin:0;}
      .child{display:flex;gap:15px;align-items:center;margin-bottom:20px;background:#F5F7F9;padding:15px;border-radius:16px;}
      .child-info b{display:block;font-size:11px;color:#3ECDB5;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0;}
      .stat{padding:15px;border-radius:12px;text-align:center;}
      .stat b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
      .stat .val{font-size:22px;font-weight:900;}
      .tags{display:flex;flex-wrap:wrap;gap:6px;margin:15px 0;}
      .tag{padding:4px 10px;border-radius:999px;font-weight:700;font-size:11px;}
      footer{margin-top:60px;padding-top:20px;border-top:1px solid #E2E8F0;font-size:11px;color:#718096;text-align:center;}
      @media print { body { padding: 20px; } }
    </style></head><body>
    <header><div><div class="brand">TiMétis<small>Made in 974 · Bilan hebdomadaire</small></div></div><div style="text-align:right;font-size:12px;color:#718096;"><b>Semaine du</b><br/>${new Date().toLocaleDateString('fr-FR')}</div></header>
    <h1>Bilan hebdomadaire</h1>
    <div class="child">
      <div style="width:60px;height:60px;border-radius:50%;background:#3ECDB5;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;">${(enfant.prenom||'?').charAt(0)}${(enfant.nom||'?').charAt(0)}</div>
      <div class="child-info"><b>Enfant</b><div style="font-size:20px;font-weight:900;">${enfant.prenom} ${enfant.nom}</div><div style="font-size:12px;color:#718096;">Section ${enfant.groupe||'—'} · Contrat ${enfant.contrat_heures||35}h/sem</div></div>
    </div>
    ${tags && tags.length > 0 ? `<div class="tags">${tags.map(t=>`<span class="tag" style="background:${t.couleur}22;color:${t.couleur};">${t.nom}</span>`).join('')}</div>` : ''}
    <div class="grid">
      <div class="stat" style="background:#E3F2FD;color:#42A5F5"><b>Sieste</b><div class="val">${stats?.sieste||'8h30'}</div></div>
      <div class="stat" style="background:#FFE9E9;color:#FF6B6B"><b>Biberons</b><div class="val">${stats?.biberons||14}</div></div>
      <div class="stat" style="background:#E8F5E9;color:#66BB6A"><b>Changes</b><div class="val">${stats?.changes||18}</div></div>
      <div class="stat" style="background:#EFEAFF;color:#8B6BE8"><b>Activités</b><div class="val">${stats?.activites||7}</div></div>
    </div>
    <h2 style="color:#3ECDB5;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:30px;">Observations de la semaine</h2>
    <div style="background:#F5F7F9;padding:20px;border-radius:12px;font-size:13px;line-height:1.6;">
      <p>${enfant.prenom} a passé une belle semaine à la crèche. Éveil, socialisation et petits moments doux au programme. Toute l'équipe est ravie de partager ces bilans avec vous.</p>
      <p style="color:#718096;font-size:11px;font-style:italic;">📝 Cet espace peut être personnalisé par l'équipe éducative.</p>
    </div>
    <footer>TiMétis · Solution locale de gestion de crèche · Made in 974 🌺<br/>Bilan édité automatiquement — Merci pour votre confiance.</footer>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);};</script>
    </body></html>`;
  const w = window.open('', '_blank', 'width=800,height=900');
  if (w) { w.document.write(html); w.document.close(); }
  else toast.error('Pop-up bloqué — autorisez les pop-ups');
}

export default App;
