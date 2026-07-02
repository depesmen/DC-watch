# Mise en place — Newsletter hebdomadaire (vendredi 14h)

Envoi automatique via **Cloudflare Worker** (cron) + **Resend** (envoi d'emails).
Le code est prêt ; il reste les étapes qui dépendent de tes comptes.

## 1. Resend (service d'envoi)
1. Créer un compte sur https://resend.com (gratuit jusqu'à 3 000 emails/mois).
2. **Vérifier un domaine d'envoi** : Resend → *Domains* → *Add Domain* → saisir ton domaine → ajouter les enregistrements DNS fournis (SPF/DKIM) dans Cloudflare (onglet DNS). Sans ça, impossible d'envoyer aux inscrits.
3. Créer une **clé API** : Resend → *API Keys* → *Create* → copier la clé (commence par `re_...`).
4. Choisir l'adresse d'expéditeur, ex. `newsletter@ton-domaine` → à reporter dans `FROM_EMAIL`.

## 2. Renseigner wrangler.toml
- `id` du namespace KV `SUBSCRIBERS` : Cloudflare → *Workers & Pages* → *KV* → copier l'ID du namespace déjà utilisé par le formulaire.
- `SITE_URL` : l'URL publique du site (ex. `https://dc-watch.pages.dev` ou ton domaine).
- `FROM_EMAIL` : ex. `Data Center Watch <newsletter@ton-domaine>`.

## 3. Déployer le Worker
```bash
cd newsletter-worker
npx wrangler login                 # connecte ton compte Cloudflare
npx wrangler secret put RESEND_API_KEY   # coller la clé re_...
npx wrangler secret put UNSUB_SECRET     # coller une longue chaîne aléatoire (garde-la)
npx wrangler deploy
```

## 4. Côté site (désinscription)
Dans le projet **Pages** (le site), ajouter deux variables d'environnement (Settings → Environment variables) :
- `UNSUB_SECRET` = **exactement la même** chaîne qu'à l'étape 3.
- (le binding KV `SUBSCRIBERS` est déjà en place pour le formulaire.)
Puis redéployer le site.

## 5. Tester sans attendre vendredi
Ouvrir dans le navigateur : `https://dc-watch-newsletter.<ton-sous-domaine>.workers.dev/?key=<UNSUB_SECRET>`
→ déclenche un envoi immédiat (utile pour vérifier le rendu). En prod, le Worker n'envoie que le vendredi à 14h (heure de Luxembourg, gérée automatiquement été/hiver).

## Notes
- Chaque inscrit reçoit un email **individuel** (jamais tous en copie) avec son propre lien de désinscription.
- Le contenu est construit automatiquement depuis `data/veille.json` et `data/watchlist.json` du site.
- Fréquence gratuite Resend largement suffisante pour une liste interne.
