# Custom domain gratuit (eu.org) sur le Worker Cloudflare

Objectif : remplacer `dc-watch.depesme-noemie.workers.dev` par une URL propre du type
`veille-dc.eu.org`, gratuitement.

Ordre des opérations (l'ordre compte — problème de « l'œuf ou la poule » sur les nameservers) :

## 1. Ajouter le futur domaine à Cloudflare (pour obtenir les nameservers)
1. Dashboard Cloudflare → **Add a site / Ajouter un domaine**.
2. Saisir le domaine voulu, ex. `veille-dc.eu.org` → choisir le plan **Free**.
3. Cloudflare affiche **2 nameservers** à toi (ex. `aria.ns.cloudflare.com`, `rob.ns.cloudflare.com`). **Note-les.**

## 2. Demander le domaine gratuit sur eu.org
1. Aller sur **https://nic.eu.org** → créer un compte.
2. Faire une demande de domaine (**New domain request**) pour `veille-dc.eu.org`
   (ou un autre nom libre).
3. Dans le formulaire, renseigner comme **serveurs DNS (nameservers)** les **2 de Cloudflare** notés à l'étape 1.
4. Valider. → **Attente de validation manuelle par eu.org** (quelques jours à ~2 semaines).

## 3. Une fois le domaine approuvé
1. Dans Cloudflare, le domaine passe **Active** (les nameservers pointent bien).
   (Si besoin, revérifier dans Cloudflare → le domaine → « Check nameservers ».)

## 4. Attacher le domaine au Worker
1. Cloudflare → **Workers & Pages** → ouvrir le Worker **dc-watch**.
2. Onglet **Settings** → **Domains & Routes** (ou **Triggers → Custom Domains**) → **Add → Custom Domain**.
3. Saisir `veille-dc.eu.org` (ou `www.veille-dc.eu.org`) → **Add**.
   Cloudflare crée automatiquement l'enregistrement DNS + le certificat HTTPS (quelques minutes).

## 5. Prévenir pour la mise à jour du code
Une fois l'URL active, le lien « Voir toute la veille » de la newsletter doit pointer dessus :
→ mettre à jour `siteUrl` dans `newsletter/draft.mjs` (actuellement `https://dc-watch.depesme-noemie.workers.dev`).

## Notes
- L'ancienne URL `...workers.dev` continue de fonctionner en parallèle (pas de rupture).
- Tout est gratuit : eu.org (domaine) + Cloudflare plan Free.
- Si le délai eu.org est trop long, l'alternative instantanée reste un domaine à ~10 €/an (Cloudflare Registrar).
