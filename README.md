# Darna — annonces immobilières
React (Vite) + Node/Express + **SQLite** (`node:sqlite`) + JWT.
**Fonctionnalités** : recherche multicritères (vente/location, type, ville, fourchette de prix, chambres, tri), pagination, fiche détaillée avec galerie, **dépôt d'annonce avec photos** (redimensionnées dans le navigateur, validées côté serveur), favoris, formulaire de contact propriétaire, espace propriétaire (statut Disponible/Vendu/Loué, suppression, demandes reçues). Illustration SVG générée quand une annonce n'a pas de photo.
**Démo** : owner@darna.tn / owner123
## Lancer (Node 22+)
1. `cd server && npm install && npm start` (API : http://localhost:5006)
2. `cd client && npm install && npm run dev`
## Déploiement
Client → Netlify/Vercel. Serveur → Render/Railway (`JWT_SECRET`). Photos sur disque : prévoir un stockage persistant (volume ou Cloudinary) en production.
