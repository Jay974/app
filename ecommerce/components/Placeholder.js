'use client';

// Visuel de remplacement généré (dégradé + initiales) tant qu'aucune image
// produit n'est fournie dans lib/data.js.
export default function Placeholder({ label = '', className = '', rounded = 'rounded-xl2' }) {
  const initials = label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600 font-semibold ${rounded} ${className}`}
      aria-label={label}
    >
      <span className="text-lg">{initials || '?'}</span>
    </div>
  );
}
