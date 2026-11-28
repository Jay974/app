/* Outils PDF communs : police intégrée (rendu identique dans tous les lecteurs), fond blanc opaque, nettoyage du texte. */
window.PdfKit = (() => {
  const cache = {};
  const b64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  async function loadFonts(doc) {
    for (const [f, st] of [['Regular', 'normal'], ['Bold', 'bold'], ['Italic', 'italic']]) {
      if (!cache[f]) { const r = await fetch(`/vendor/fonts/LiberationSans-${f}.ttf`); if (!r.ok) throw new Error('police'); cache[f] = b64(await r.arrayBuffer()); }
      doc.addFileToVFS(`LS-${f}.ttf`, cache[f]); doc.addFont(`LS-${f}.ttf`, 'LibSans', st);
    }
    doc.setFont('LibSans', 'normal');
  }
  const paint = doc => { doc.setFillColor(255, 255, 255); doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F'); }; // sinon certains lecteurs affichent un fond noir (mode sombre)
  async function create() {
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    let font = 'LibSans'; try { await loadFonts(doc); } catch { font = 'helvetica'; }
    paint(doc); const add = doc.addPage.bind(doc); doc.addPage = (...a) => { const r = add(...a); paint(doc); return r; };
    doc.__font = font; return doc;
  }
  // espaces insécables → espaces simples ; emojis retirés (absents des polices PDF) ; espaces multiples et retours à la ligne conservés
  const clean = x => String(x == null ? '' : x).replace(/[  ]/g, ' ').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/ +\n/g, '\n');
  return { create, clean };
})();
