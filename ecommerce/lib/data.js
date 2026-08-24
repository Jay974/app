// ---------------------------------------------------------------------------
// PLACEHOLDER DATA
// Remplace ce fichier par tes vrais produits, catégories et contenus.
// Chaque produit accepte un champ `image` (URL) — tant qu'il est vide,
// un visuel de remplacement généré automatiquement est affiché.
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  { slug: 'mode', label: 'Mode', icon: 'Shirt' },
  { slug: 'electronique', label: 'Électronique', icon: 'Headphones' },
  { slug: 'maison', label: 'Maison', icon: 'Armchair' },
  { slug: 'beaute', label: 'Beauté', icon: 'Sparkles' },
  { slug: 'sport', label: 'Sport', icon: 'Dumbbell' },
  { slug: 'enfants', label: 'Enfants', icon: 'Baby' },
  { slug: 'high-tech', label: 'High-tech', icon: 'Smartphone' },
  { slug: 'plus', label: 'Plus', icon: 'Grid3x3' },
];

export const BANNERS = [
  {
    id: 'b1',
    title: 'Nouvelle collection',
    subtitle: 'Découvre les dernières arrivées',
    cta: 'Acheter',
    href: '/categories',
    color: '#F7931E',
  },
  {
    id: 'b2',
    title: 'Ventes flash -30%',
    subtitle: 'Offres limitées cette semaine',
    cta: 'Voir les offres',
    href: '/categories',
    color: '#14161A',
  },
];

// image: laisse vide ('') pour utiliser le visuel de remplacement automatique
export const PRODUCTS = [
  { id: 'p1', name: 'Montre connectée Sport', price: 129.99, oldPrice: 159.99, rating: 4.6, reviews: 128, category: 'high-tech', image: '', badge: 'Best seller' },
  { id: 'p2', name: 'Sac à main cuir', price: 89.99, oldPrice: null, rating: 4.7, reviews: 64, category: 'mode', image: '', badge: null },
  { id: 'p3', name: 'Sneakers blanches', price: 69.99, oldPrice: 89.99, rating: 4.5, reviews: 210, category: 'mode', image: '', badge: 'Promo' },
  { id: 'p4', name: 'Casque audio sans fil', price: 59.99, oldPrice: null, rating: 4.4, reviews: 97, category: 'electronique', image: '', badge: null },
  { id: 'p5', name: 'Fauteuil scandinave', price: 199.99, oldPrice: 249.99, rating: 4.8, reviews: 33, category: 'maison', image: '', badge: 'Nouveau' },
  { id: 'p6', name: 'Palette maquillage', price: 24.99, oldPrice: null, rating: 4.3, reviews: 152, category: 'beaute', image: '', badge: null },
  { id: 'p7', name: 'Tapis de yoga', price: 19.99, oldPrice: 29.99, rating: 4.6, reviews: 88, category: 'sport', image: '', badge: 'Promo' },
  { id: 'p8', name: 'Peluche doudou', price: 14.99, oldPrice: null, rating: 4.9, reviews: 41, category: 'enfants', image: '', badge: null },
  { id: 'p9', name: 'Smartphone 128Go', price: 349.99, oldPrice: 399.99, rating: 4.5, reviews: 302, category: 'high-tech', image: '', badge: 'Best seller' },
  { id: 'p10', name: 'Veste en jean', price: 54.99, oldPrice: null, rating: 4.2, reviews: 56, category: 'mode', image: '', badge: null },
  { id: 'p11', name: 'Lampe de bureau LED', price: 29.99, oldPrice: 39.99, rating: 4.4, reviews: 72, category: 'maison', image: '', badge: null },
  { id: 'p12', name: 'Enceinte Bluetooth', price: 44.99, oldPrice: null, rating: 4.6, reviews: 119, category: 'electronique', image: '', badge: 'Nouveau' },
];

export const ORDERS = [
  { id: '#12568', status: 'En transit', eta: 'Arrive demain', items: 2, total: 219.98 },
  { id: '#12530', status: 'Livrée', eta: 'Livrée le 12 août', items: 1, total: 69.99 },
];

export function getProductById(id) {
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductsByCategory(slug) {
  if (!slug || slug === 'plus') return PRODUCTS;
  return PRODUCTS.filter((p) => p.category === slug);
}

export function searchProducts(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return PRODUCTS.filter((p) => p.name.toLowerCase().includes(q));
}
