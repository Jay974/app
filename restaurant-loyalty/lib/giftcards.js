// Code lisible pour une carte cadeau : évite les caractères ambigus (0/O, 1/I/l)
// pour une saisie manuelle fiable en caisse si le scan QR n'est pas possible.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateGiftCardCode() {
  let code = '';
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 7) code += '-';
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code; // ex: ABCD-EFG-H23
}

export const DEFAULT_GIFT_CARD_SETTINGS = {
  preset_amounts_cents: [1000, 2000, 3000, 5000],
  validity_months: 12,
};
