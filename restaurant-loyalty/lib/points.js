// Calcul des points et du palier de fidélité à partir des réglages configurables
// par l'admin (app/admin). Tout est piloté par la collection `settings`, rien n'est
// codé en dur, pour pouvoir ajuster le barème sans redéploiement.

export const DEFAULT_SETTINGS = {
  points_rule: {
    // 1 point gagné toutes les `amount_per_point` centimes dépensés
    amount_per_point: 100, // 1 point / 1€
  },
  tiers: [
    { key: 'bronze', label: 'Bronze', min_lifetime_points: 0, multiplier: 1 },
    { key: 'argent', label: 'Argent', min_lifetime_points: 500, multiplier: 1.1 },
    { key: 'or', label: 'Or', min_lifetime_points: 1500, multiplier: 1.25 },
  ],
  restaurant: {
    name: 'Le Restaurant',
    lat: null,
    lng: null,
    proximity_radius_m: 300,
  },
};

// amountCents: montant encaissé en centimes (entier, pas de flottants)
export function computePoints(amountCents, settings, tierMultiplier = 1) {
  const perPoint = settings?.points_rule?.amount_per_point || DEFAULT_SETTINGS.points_rule.amount_per_point;
  const base = Math.floor(amountCents / perPoint);
  return Math.round(base * tierMultiplier);
}

export function tierForPoints(lifetimePoints, settings) {
  const tiers = (settings?.tiers?.length ? settings.tiers : DEFAULT_SETTINGS.tiers)
    .slice()
    .sort((a, b) => a.min_lifetime_points - b.min_lifetime_points);
  let current = tiers[0];
  let next = null;
  for (let i = 0; i < tiers.length; i++) {
    if (lifetimePoints >= tiers[i].min_lifetime_points) {
      current = tiers[i];
      next = tiers[i + 1] || null;
    }
  }
  return { current, next };
}
