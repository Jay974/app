/* Facturation (devis / factures PDF) — chargé uniquement pour le compte « propriétaire ». */
(() => {
'use strict';
const A = window.__life.api, { sb, toast, esc, today, addDays, ic, uid } = A;
const B = { rows: null, loading: false, err: '', tab: 'docs', edit: null, filter: 'all', clientEdit: null };
const nb = n => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ');
const eur = n => nb(n) + ' €';
const fdate = s => s ? s.split('-').reverse().join('/') : '';
const digits = x => String(x || '').replace(/\D/g, '');
const group = (x, sizes) => { const d = digits(x); if (!d) return String(x || ''); const out = []; let i = 0; for (const n of sizes) { if (i >= d.length) break; out.push(d.slice(i, i + n)); i += n; } if (i < d.length) out.push(d.slice(i)); return out.join(' '); };
const fmtSiren = x => group(x, [3, 3, 3]), fmtSiret = x => group(x, [3, 3, 3, 5]);
const fmtPhone = x => { const v = String(x || '').trim(), d = digits(v); return /^\+/.test(v) || d.length !== 10 ? v : group(d, [2, 2, 2, 2, 2]); };
const fmtIban = x => String(x || '').replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
const rowsOf = k => (B.rows || []).filter(r => r.kind === k);
const settings = () => (rowsOf('settings')[0] || {}).data || {};
const clients = () => rowsOf('client').sort((a, b) => (a.data.name || '').localeCompare(b.data.name || ''));
const docs = () => (B.rows || []).filter(r => r.kind === 'quote' || r.kind === 'invoice').sort((a, b) => (b.data.date || '').localeCompare(a.data.date || '') || (b.data.number || '').localeCompare(a.data.number || ''));
const totals = (d, s) => { const ht = (d.lines || []).reduce((a, l) => a + (Number(l.q) || 0) * (Number(l.p) || 0), 0), rate = Number(s.vatRate) || 0, tva = ht * rate / 100; return { ht, rate, tva, ttc: ht + tva }; };
const STATUS = { draft: ['Brouillon', ''], issued: ['Émis', ''], accepted: ['Accepté', 'up'], paid: ['Payée', 'up'], canceled: ['Annulé', 'down'] };

/* ---------- données ---------- */
async function load() {
  B.loading = true; A.render(true);
  const { data, error } = await sb.from('billing_docs').select('*').order('created_at');
  B.loading = false; B.err = error ? error.message : ''; if (!error) B.rows = data; A.render(true);
}
async function save(kind, id, data) {
  const q = id ? sb.from('billing_docs').update({ data, updated_at: new Date().toISOString() }).eq('id', id).select().single() : sb.from('billing_docs').insert({ kind, data }).select().single();
  const { data: row, error } = await q; if (error) { toast('Erreur : ' + error.message); return null; }
  B.rows = (B.rows || []).filter(r => r.id !== row.id).concat(row); return row;
}
async function remove(id) { const { error } = await sb.from('billing_docs').delete().eq('id', id); if (error) return toast('Erreur : ' + error.message); B.rows = B.rows.filter(r => r.id !== id); }
function nextNumber(kind) {
  const s = settings(), pre = (kind === 'invoice' ? s.prefixInvoice : s.prefixQuote) || (kind === 'invoice' ? 'F' : 'D'), yr = new Date().getFullYear();
  const used = docs().filter(r => r.kind === kind && r.data.number && r.data.number.startsWith(`${pre}-${yr}-`)).map(r => Number(r.data.number.split('-').pop()) || 0);
  return `${pre}-${yr}-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`;
}
const newDoc = kind => ({ id: null, kind, d: { status: 'draft', number: null, clientId: '', date: today(), due: addDays(today(), 30), lines: [{ d: '', q: 1, u: '', p: 0 }], notes: '', conditions: settings().conditions || '' } });

/* ---------- PDF ---------- */
function pdf(r) {
  const s = settings(), d = { ...r.data }, cl = (rowsOf('client').find(c => c.id === d.clientId) || {}).data || {}, isInv = r.kind === 'invoice', t = totals(d, s);
  if (!(d.conditions || '').trim() && d.status === 'draft') d.conditions = s.conditions || ''; // brouillon : reprend les conditions de « Mon entreprise »
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, M = 15, ACC = [0, 168, 150], H = 297;
  let y = M, left = M;
  doc.setTextColor(30);
  if (s.logo) { try { const p = doc.getImageProperties(s.logo), h = Math.min(20, 40 * p.height / p.width), w = h * p.width / p.height; doc.addImage(s.logo, p.fileType || 'PNG', M, y, w, h); y += h + 4; } catch { /* logo illisible */ } } else y += 2;
  const lines = (txt, x, w, size = 9, lh = 4.2, color = 60) => { doc.setFontSize(size).setTextColor(color).setFont('helvetica', 'normal'); const arr = doc.splitTextToSize(String(txt || ''), w); arr.forEach((l, i) => doc.text(l, x, y + i * lh)); y += arr.length * lh; };
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(20); doc.text(s.name || 'Mon entreprise', M, y); y += 5;
  if (s.legal) lines(s.legal, M, 85, 9, 4.2, 80);
  lines(s.address, M, 85); if (s.siren) lines('SIREN ' + fmtSiren(s.siren) + (s.siret ? '  ·  SIRET ' + fmtSiret(s.siret) : ''), M, 85);
  if (s.activityNote) lines(s.activityNote, M, 85, 8.5);
  if (s.email) lines(s.email, M, 85); if (s.phone) lines(fmtPhone(s.phone), M, 85);
  const leftEnd = y;
  // titre + références à droite
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...ACC); doc.text(isInv ? 'FACTURE' : 'DEVIS', W - M, M + 8, { align: 'right' });
  doc.setFontSize(10).setTextColor(30); doc.text(d.number ? 'N° ' + d.number : 'BROUILLON', W - M, M + 15, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(80);
  doc.text('Date : ' + fdate(d.date), W - M, M + 21, { align: 'right' });
  doc.text((isInv ? 'Échéance : ' : 'Valable jusqu\'au : ') + fdate(d.due), W - M, M + 26, { align: 'right' });
  if (d.fromQuote) doc.text('Réf. devis ' + d.fromQuote, W - M, M + 31, { align: 'right' });
  // destinataire
  y = Math.max(M + 36, 0); let cy = y;
  doc.setDrawColor(210).setFillColor(247, 250, 250).roundedRect(115, cy, W - M - 115, 32, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...ACC); doc.text('DESTINATAIRE', 119, cy + 5);
  y = cy + 10; doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20); doc.text(cl.name || '—', 119, y); y += 4.8;
  lines(cl.address, 119, 72, 9, 4.2, 70); if (cl.siret) lines('SIRET ' + fmtSiret(cl.siret), 119, 72, 8.5); if (cl.email) lines(cl.email, 119, 72, 8.5);
  y = Math.max(leftEnd, cy + 32) + 8;
  // conditions / mentions (bloc éditable) — au-dessus du cadre principal
  if ((d.conditions || '').trim()) {
    doc.setFontSize(8.5); const arr = doc.splitTextToSize(d.conditions.trim(), W - 2 * M - 8), h = arr.length * 3.9 + 9;
    doc.setDrawColor(210).setFillColor(250, 250, 250).roundedRect(M, y, W - 2 * M, h, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...ACC); doc.text('CONDITIONS ET MENTIONS', M + 4, y + 5);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(70); arr.forEach((l, i) => doc.text(l, M + 4, y + 10 + i * 3.9)); y += h + 6;
  }
  // lignes
  doc.autoTable({
    startY: y, margin: { left: M, right: M, bottom: 25 }, theme: 'grid',
    head: [['Description', 'Qté', 'Unité', 'Prix unitaire', 'Total']],
    body: (d.lines || []).filter(l => l.d || Number(l.p)).map(l => [l.d || '', Number.isInteger(Number(l.q)) ? String(Number(l.q)) : nb(l.q), l.u || '', eur(l.p), eur((Number(l.q) || 0) * (Number(l.p) || 0))]),
    headStyles: { fillColor: ACC, textColor: 255, fontSize: 9, halign: 'left' }, styles: { fontSize: 9, cellPadding: 2.5, lineColor: [215, 220, 220], textColor: 40 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', cellWidth: 18 }, 2: { cellWidth: 20 }, 3: { halign: 'right', cellWidth: 32 }, 4: { halign: 'right', cellWidth: 32 } }
  });
  y = doc.lastAutoTable.finalY + 7;
  const ensure = h => { if (y + h > H - 22) { doc.addPage(); y = M; } };
  // totaux
  ensure(40); const bx = 120; doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(60);
  doc.text('Total HT', bx, y); doc.text(eur(t.ht), W - M, y, { align: 'right' }); y += 6;
  if (t.rate) { doc.text(`TVA ${nb(t.rate)} %`, bx, y); doc.text(eur(t.tva), W - M, y, { align: 'right' }); y += 6; }
  doc.setDrawColor(...ACC).setLineWidth(0.5).line(bx, y - 2, W - M, y - 2);
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(20); doc.text(isInv ? 'Net à payer' : 'Total TTC', bx, y + 4); doc.text(eur(t.ttc), W - M, y + 4, { align: 'right' }); y += 10;
  if (!t.rate && s.vatNote) { doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(90); doc.text(s.vatNote, W - M, y, { align: 'right' }); y += 6; }
  y += 4;
  if (d.notes) { ensure(20); doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...ACC); doc.text('NOTES', M, y); y += 4; doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(70); doc.splitTextToSize(d.notes, W - 2 * M).forEach(l => { ensure(5); doc.text(l, M, y); y += 4.2; }); y += 3; }
  if (isInv && (s.iban || s.bic)) { ensure(20); doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...ACC); doc.text('RÈGLEMENT PAR VIREMENT', M, y); y += 4.5; doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(60); if (s.iban) { doc.text('IBAN : ' + fmtIban(s.iban), M, y); y += 4.5; } if (s.bic) { doc.text('BIC : ' + s.bic, M, y); y += 4.5; } }
  if (!isInv) { ensure(30); y += 3; doc.setDrawColor(190).setLineWidth(0.3).roundedRect(115, y, W - M - 115, 24, 2, 2); doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(80); doc.text('Bon pour accord — date et signature', 119, y + 5); }
  // pied de page
  const n = doc.getNumberOfPages(), foot = [s.name, s.legal, s.siren ? 'SIREN ' + fmtSiren(s.siren) : '', s.siret ? 'SIRET ' + fmtSiret(s.siret) : '', (s.address || '').replace(/\n/g, ', ')].filter(Boolean).join(' — ');
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(130); doc.text(doc.splitTextToSize(foot, W - 2 * M - 20), M, H - 12); doc.text(`Page ${i}/${n}`, W - M, H - 12, { align: 'right' }); }
  const safe = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
  doc.save(`${isInv ? 'Facture' : 'Devis'}-${safe(d.number || 'brouillon')}-${safe(cl.name)}.pdf`);
}

/* ---------- vues ---------- */
const field = (l, inner, span = false) => `<div${span ? ' style="grid-column:1/-1"' : ''}><label class="l">${l}</label>${inner}</div>`;
const inp = (k, v, o = '') => `<input class="field" data-bs="${k}" value="${esc(v ?? '')}" ${o}>`;
function viewSettings() {
  const s = settings();
  return `<div class="card c12"><h3>🏢 Mon entreprise (apparaît sur les documents)</h3><form data-bform="settings"><div class="f2" style="gap:12px">
  ${field('Nom (ex. Jean-Chris OULIA)', inp('name', s.name, 'required'))}${field('Forme juridique', inp('legal', s.legal ?? 'Entreprise individuelle (EI)'))}
  ${field('SIREN', inp('siren', s.siren))}${field('SIRET (14 chiffres)', inp('siret', s.siret))}
  ${field('Adresse du siège', `<textarea class="field" data-bs="address" rows="2">${esc(s.address || '')}</textarea>`, true)}
  ${field('Email', inp('email', s.email, 'type="email"'))}${field('Téléphone', inp('phone', s.phone))}
  ${field('IBAN (pour les virements)', inp('iban', s.iban))}${field('BIC', inp('bic', s.bic))}
  ${field('Mention d\'activité (RCS / RM / assurance… si nécessaire)', inp('activityNote', s.activityNote), true)}
  ${field('Taux de TVA (%)', inp('vatRate', s.vatRate ?? 0, 'type="number" step="0.1" min="0"'))}${field('Mention TVA (si taux 0)', inp('vatNote', s.vatNote ?? 'TVA non applicable, art. 293 B du CGI'))}
  ${field('Préfixe devis', inp('prefixQuote', s.prefixQuote ?? 'D'))}${field('Préfixe factures', inp('prefixInvoice', s.prefixInvoice ?? 'F'))}
  ${field('Conditions et mentions par défaut — pénalités de retard, délais de paiement, indemnité de recouvrement… (à éditer librement, affiché au-dessus du cadre principal)', `<textarea class="field" data-bs="conditions" rows="5" placeholder="Laisse vide si tu préfères tout écrire document par document.">${esc(s.conditions || '')}</textarea>`, true)}
  ${field('Logo (PNG/JPG, optionnel)', `<input class="field" type="file" id="b-logo" accept="image/png,image/jpeg">${s.logo ? '<span class="sub">Logo enregistré · <a href="#" data-b="rmlogo">retirer</a></span>' : ''}`, true)}
  </div><div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn pri">Enregistrer</button></div></form></div>`;
}
function viewClients() {
  const cs = clients(), e = B.clientEdit;
  return `<div class="card c6"><h3>👥 Clients (${cs.length})</h3><div class="list">${cs.map(c => `<div class="item"><div class="grow"><div class="t">${esc(c.data.name)}</div><div class="s">${esc((c.data.address || '').split('\n')[0] || c.data.email || '')}</div></div><button class="btn sm" data-b="cledit" data-id="${c.id}">Modifier</button><button class="x" data-b="cldel" data-id="${c.id}" aria-label="Supprimer">${ic('x')}</button></div>`).join('') || '<div class="empty">Aucun client</div>'}</div></div>
  <div class="card c6"><h3>${e && e.id ? 'Modifier le client' : 'Nouveau client'}</h3><form data-bform="client"><input type="hidden" name="id" value="${e ? e.id || '' : ''}"><div class="f2" style="gap:10px">
  ${field('Nom / société', `<input class="field" name="name" required value="${esc(e?.data?.name || '')}">`, true)}${field('Adresse', `<textarea class="field" name="address" rows="2">${esc(e?.data?.address || '')}</textarea>`, true)}
  ${field('Email', `<input class="field" name="email" type="email" value="${esc(e?.data?.email || '')}">`)}${field('Téléphone', `<input class="field" name="phone" value="${esc(e?.data?.phone || '')}">`)}${field('SIRET (si entreprise)', `<input class="field" name="siret" value="${esc(e?.data?.siret || '')}">`, true)}
  </div><div class="row" style="margin-top:12px;justify-content:flex-end">${e ? '<button type="button" class="btn" data-b="clnew">Annuler</button>' : ''}<button class="btn pri">${e && e.id ? 'Mettre à jour' : 'Ajouter'}</button></div></form></div>`;
}
const actions = r => `<button class="btn sm" data-b="pdf" data-id="${r.id}">PDF</button> ${r.data.status === 'draft' ? `<button class="btn sm" data-b="edit" data-id="${r.id}">Modifier</button>` : ''} ${r.kind === 'quote' && r.data.status !== 'draft' && r.data.status !== 'canceled' ? `<button class="btn sm" data-b="toinv" data-id="${r.id}">→ Facture</button>` : ''} ${r.kind === 'invoice' && r.data.status === 'issued' ? `<button class="btn sm" data-b="paid" data-id="${r.id}">Payée ✓</button>` : ''} ${r.kind === 'quote' && r.data.status === 'issued' ? `<button class="btn sm" data-b="accept" data-id="${r.id}">Accepté ✓</button>` : ''} ${r.data.status === 'draft' ? `<button class="x" data-b="del" data-id="${r.id}" aria-label="Supprimer">${ic('x')}</button>` : r.data.status !== 'canceled' && r.data.status !== 'paid' ? `<button class="btn sm danger" data-b="cancel" data-id="${r.id}">Annuler</button>` : ''}`;
function viewList() {
  const s = settings(), list = docs().filter(r => B.filter === 'all' || r.kind === B.filter);
  const cname = id => (rowsOf('client').find(c => c.id === id) || { data: {} }).data.name || '—';
  const chip = r => { const [l, c] = STATUS[r.data.status] || ['', '']; return `<span class="chip ${c}">${l}</span>`; };
  return `<div class="card c12"><div class="row" style="justify-content:space-between;margin-bottom:12px"><div class="seg">${[['all', 'Tout'], ['quote', 'Devis'], ['invoice', 'Factures']].map(([k, l]) => `<button class="${B.filter === k ? 'on' : ''}" data-b="filter" data-v="${k}">${l}</button>`).join('')}</div><div class="row"><button class="btn" data-b="new" data-k="quote">${ic('plus')}Devis</button><button class="btn pri" data-b="new" data-k="invoice">${ic('plus')}Facture</button></div></div>
  ${list.length ? `<table class="table btable"><tr><th>N°</th><th>Client</th><th>Date</th><th>Total</th><th>Statut</th><th></th></tr>${list.map(r => `<tr><td><b>${r.data.number || 'Brouillon'}</b><div class="sub">${r.kind === 'invoice' ? 'Facture' : 'Devis'}</div></td><td>${esc(cname(r.data.clientId))}</td><td>${fdate(r.data.date)}</td><td><b>${eur(totals(r.data, s).ttc)}</b></td><td>${chip(r)}</td>
  <td style="text-align:right;white-space:nowrap">${actions(r)}</td></tr>`).join('')}</table><div class="dcards">${list.map(r => `<div class="item" style="flex-direction:column;align-items:stretch;gap:8px"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div><b>${r.data.number || 'Brouillon'}</b> <span class="sub">${r.kind === 'invoice' ? 'Facture' : 'Devis'}</span><div class="t">${esc(cname(r.data.clientId))}</div><div class="sub">${fdate(r.data.date)}</div></div><div style="text-align:right"><b style="font-size:17px;white-space:nowrap">${eur(totals(r.data, s).ttc)}</b><div>${chip(r)}</div></div></div><div class="row">${actions(r)}</div></div>`).join('')}</div>` : '<div class="empty">Aucun document. Crée ton premier devis ou ta première facture.</div>'}</div>`;
}
function viewEdit() {
  const E = B.edit, d = E.d, s = settings(), isInv = E.kind === 'invoice', cs = clients();
  return `<div class="card c12"><h3>${isInv ? 'Facture' : 'Devis'} ${d.number ? d.number : '(brouillon)'}</h3><div class="f2" style="gap:12px">
  ${field('Client', `<select class="field" data-bd="clientId"><option value="">— choisir —</option>${cs.map(c => `<option value="${c.id}" ${d.clientId === c.id ? 'selected' : ''}>${esc(c.data.name)}</option>`).join('')}</select>${cs.length ? '' : '<span class="sub">Ajoute d\'abord un client (onglet Clients).</span>'}`, true)}
  ${field('Date', `<input class="field" type="date" data-bd="date" value="${d.date}">`)}${field(isInv ? 'Échéance de paiement' : 'Valable jusqu\'au', `<input class="field" type="date" data-bd="due" value="${d.due}">`)}</div>
  <h3 style="margin-top:18px">Lignes</h3><div class="list" id="b-lines">${d.lines.map((l, i) => `<div class="item" style="flex-wrap:wrap;gap:8px"><textarea class="field" style="flex:3;min-width:180px" rows="2" placeholder="Description (les retours à la ligne sont conservés)" data-bl="${i}" data-k="d">${esc(l.d)}</textarea><input class="field" style="width:72px" type="number" step="0.01" placeholder="Qté" data-bl="${i}" data-k="q" value="${l.q}"><input class="field" style="width:84px" placeholder="Unité" data-bl="${i}" data-k="u" value="${esc(l.u)}"><input class="field" style="width:110px" type="number" step="0.01" placeholder="Prix unit." data-bl="${i}" data-k="p" value="${l.p}"><button class="x" data-b="rmline" data-i="${i}" aria-label="Supprimer la ligne">${ic('x')}</button></div>`).join('')}</div>
  <div class="row" style="margin-top:10px;justify-content:space-between"><button class="btn sm" data-b="addline">${ic('plus')}Ajouter une ligne</button><div style="text-align:right"><div class="sub">Total HT <b id="b-ht">${eur(totals(d, s).ht)}</b></div>${totals(d, s).rate ? `<div class="sub">TVA <b>${eur(totals(d, s).tva)}</b></div>` : `<div class="sub">${esc(s.vatNote || '')}</div>`}<div style="font-size:20px;font-weight:800">Total <span id="b-ttc">${eur(totals(d, s).ttc)}</span></div></div></div>
  <div class="f2" style="gap:12px;margin-top:16px">${field('Conditions et mentions (au-dessus du cadre principal) — modifiable', `<textarea class="field" data-bd="conditions" rows="5">${esc(d.conditions)}</textarea>`, true)}${field('Notes (en bas du document)', `<textarea class="field" data-bd="notes" rows="2">${esc(d.notes)}</textarea>`, true)}</div>
  <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-b="cancel-edit">Fermer</button><button class="btn" data-b="save">Enregistrer le brouillon</button><button class="btn" data-b="pdfdraft">PDF (aperçu)</button><button class="btn pri" data-b="issue">Émettre et numéroter</button></div></div>`;
}
function view() {
  if (B.rows === null) { if (!B.loading) load(); return A.head('Facturation', 'Réservé au propriétaire', '') + `<div class="card c12">${B.err ? '<span style="color:var(--bad)">' + esc(B.err) + '</span><p class="sub">Vérifie que <code>supabase/billing.sql</code> a été exécuté et que ton compte est marqué propriétaire.</p>' : 'Chargement…'}</div>`; }
  const tabs = [['docs', 'Documents'], ['clients', 'Clients'], ['settings', 'Mon entreprise']];
  const missing = !settings().name ? '<div class="card c12" style="border-color:var(--warn)"><b>Commence par renseigner « Mon entreprise »</b> (nom, SIREN, adresse…) : ces informations apparaissent sur tes documents.</div>' : '';
  return A.head('Facturation', 'Devis et factures en PDF · réservé à ton compte', `<div class="seg">${tabs.map(([k, l]) => `<button class="${B.tab === k ? 'on' : ''}" data-b="tab" data-v="${k}">${l}</button>`).join('')}</div>`) + `<div class="grid">${missing}${B.edit ? viewEdit() : B.tab === 'settings' ? viewSettings() : B.tab === 'clients' ? viewClients() : viewList()}</div>`;
}

/* ---------- actions ---------- */
const byId = id => (B.rows || []).find(r => r.id === id);
const ACT = {
  tab: el => { B.tab = el.dataset.v; B.edit = null; A.render(true); },
  filter: el => { B.filter = el.dataset.v; A.render(true); },
  new: el => { if (!settings().name) { B.tab = 'settings'; toast('Renseigne d\'abord ton entreprise'); return A.render(true); } B.edit = newDoc(el.dataset.k); A.render(true); },
  edit: el => { const r = byId(el.dataset.id); B.edit = { id: r.id, kind: r.kind, d: JSON.parse(JSON.stringify(r.data)) }; if (!(B.edit.d.conditions || '').trim()) B.edit.d.conditions = settings().conditions || ''; A.render(true); },
  'cancel-edit': () => { B.edit = null; A.render(true); },
  addline: () => { B.edit.d.lines.push({ d: '', q: 1, u: '', p: 0 }); A.render(true); },
  rmline: el => { const L = B.edit.d.lines; if (L.length > 1) L.splice(Number(el.dataset.i), 1); A.render(true); },
  save: async () => { const r = await save(B.edit.kind, B.edit.id, B.edit.d); if (r) { B.edit.id = r.id; toast('Brouillon enregistré ✓'); } },
  pdfdraft: () => pdf({ kind: B.edit.kind, data: B.edit.d }),
  issue: async () => {
    const E = B.edit; if (!E.d.clientId) return toast('Choisis un client');
    if (!E.d.lines.some(l => l.d && Number(l.p))) return toast('Ajoute au moins une ligne avec un prix');
    if (!confirm('Émettre et numéroter ce document ? Il ne pourra plus être modifié (obligation de numérotation continue).')) return;
    E.d.number = nextNumber(E.kind); E.d.status = 'issued'; const r = await save(E.kind, E.id, E.d);
    if (r) { B.edit = null; toast(`${E.d.number} émis ✓`); A.render(true); pdf(r); }
  },
  pdf: el => pdf(byId(el.dataset.id)),
  del: async el => { if (confirm('Supprimer ce brouillon ?')) { await remove(el.dataset.id); A.render(true); } },
  cancel: async el => { const r = byId(el.dataset.id); if (!confirm(`Annuler ${r.data.number} ? Le numéro reste conservé (numérotation continue).`)) return; r.data.status = 'canceled'; await save(r.kind, r.id, r.data); A.render(true); },
  accept: async el => { const r = byId(el.dataset.id); r.data.status = 'accepted'; await save(r.kind, r.id, r.data); A.render(true); },
  toinv: async el => {
    const q = byId(el.dataset.id), inv = newDoc('invoice'); Object.assign(inv.d, { clientId: q.data.clientId, lines: JSON.parse(JSON.stringify(q.data.lines)), notes: q.data.notes, conditions: q.data.conditions || inv.d.conditions, fromQuote: q.data.number });
    const row = await save('invoice', null, inv.d); if (!row) return; q.data.status = 'accepted'; await save('quote', q.id, q.data);
    B.edit = { id: row.id, kind: 'invoice', d: row.data }; toast('Facture brouillon créée depuis le devis'); A.render(true);
  },
  paid: async el => {
    const r = byId(el.dataset.id); r.data.status = 'paid'; r.data.paidAt = today();
    if (confirm(`Ajouter ${eur(totals(r.data, settings()).ttc)} aux revenus de ce mois (onglet Budget) ?`) && !r.data.incomeAdded) { A.put('tx:' + uid(), { date: today(), amount: Math.round(totals(r.data, settings()).ttc * 100) / 100, cat: 'Autre', type: 'inc', note: 'Facture ' + r.data.number }); r.data.incomeAdded = true; }
    await save(r.kind, r.id, r.data); A.render(true);
  },
  cledit: el => { const r = byId(el.dataset.id); B.clientEdit = { id: r.id, data: r.data }; A.render(true); },
  clnew: () => { B.clientEdit = null; A.render(true); },
  cldel: async el => { if (docs().some(d => d.data.clientId === el.dataset.id)) return toast('Ce client a des documents : suppression impossible'); if (confirm('Supprimer ce client ?')) { await remove(el.dataset.id); A.render(true); } },
  rmlogo: async e => { const s = { ...settings() }; delete s.logo; await save('settings', (rowsOf('settings')[0] || {}).id, s); A.render(true); }
};
document.addEventListener('click', e => { const el = e.target.closest('[data-b]'); if (el && ACT[el.dataset.b]) { e.preventDefault(); ACT[el.dataset.b](el, e); } });
function refreshTotals() { const t = totals(B.edit.d, settings()); const a = document.getElementById('b-ht'), b = document.getElementById('b-ttc'); if (a) a.textContent = eur(t.ht); if (b) b.textContent = eur(t.ttc); }
document.addEventListener('change', async e => {
  const el = e.target;
  if (B.edit && el.dataset.bl !== undefined) { const l = B.edit.d.lines[Number(el.dataset.bl)], k = el.dataset.k; l[k] = (k === 'q' || k === 'p') ? Number(el.value) || 0 : el.value; refreshTotals(); }
  else if (B.edit && el.dataset.bd) B.edit.d[el.dataset.bd] = el.value;
  else if (el.id === 'b-logo' && el.files[0]) {
    const f = el.files[0]; if (f.size > 400000) return toast('Logo trop lourd (400 Ko max)');
    const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    const s = { ...settings(), logo: url }; await save('settings', (rowsOf('settings')[0] || {}).id, s); toast('Logo enregistré ✓'); A.render(true);
  }
});
document.addEventListener('submit', async e => {
  const f = e.target, k = f.dataset.bform; if (!k) return; e.preventDefault();
  if (k === 'settings') {
    const s = { ...settings() }; $$('[data-bs]', f).forEach(i => { s[i.dataset.bs] = i.dataset.bs === 'conditions' || i.dataset.bs === 'address' ? i.value.replace(/\s+$/, '') : i.value.trim(); }); s.vatRate = Number(s.vatRate) || 0; s.siren = fmtSiren(s.siren); s.siret = fmtSiret(s.siret); s.phone = fmtPhone(s.phone); s.iban = fmtIban(s.iban);
    if (await save('settings', (rowsOf('settings')[0] || {}).id, s)) toast('Entreprise enregistrée ✓'); A.render(true);
  } else if (k === 'client') {
    const fd = Object.fromEntries(new FormData(f)), id = fd.id || null; delete fd.id; fd.siret = fmtSiret(fd.siret); fd.phone = fmtPhone(fd.phone);
    if (await save('client', id, fd)) { toast(id ? 'Client mis à jour ✓' : 'Client ajouté ✓'); B.clientEdit = null; A.render(true); }
  }
});
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
window.Billing = { view, pdf, _B: B };
})();
