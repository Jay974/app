# Shop — base e-commerce

Base d'application e-commerce mobile-first (Next.js + Tailwind), prête à être
complétée avec de vrais produits et contenus.

## Démarrer

```bash
cd ecommerce
npm install
npm run dev
```

L'app tourne sur http://localhost:3100.

## Structure

- `app/` — pages (accueil, catégories, produit, panier, favoris, commandes, compte, paiement, recherche)
- `components/` — composants UI réutilisables (carte produit, nav basse, header/recherche...)
- `context/StoreContext.js` — panier et favoris, persistés en localStorage
- `lib/data.js` — **toutes les données de démo** (catégories, produits, bannières, commandes)

## Compléter avec tes vrais produits

Tout se passe dans `lib/data.js` :

- `CATEGORIES` : liste des catégories (slug, label, icône Lucide)
- `PRODUCTS` : tes produits (nom, prix, prix barré, note, avis, catégorie, image, badge)
  - Laisse `image: ''` pour garder un visuel de remplacement automatique tant que
    tu n'as pas d'images définitives.
- `BANNERS` : bannières promo de la page d'accueil
- `ORDERS` : commandes de démonstration affichées sur la page Compte/Commandes

Aucune autre modification n'est nécessaire pour ajouter du contenu : les pages
lisent directement ce fichier.

## Prochaines étapes possibles

- Remplacer les données statiques par un vrai backend/API (routes `app/api/`)
- Authentification utilisateur
- Paiement réel (Stripe, etc.)
- Filtres et tri sur la page catégorie/recherche
