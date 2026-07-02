# Newsletter hebdo — brouillon déposé dans ton Gmail

Chaque vendredi matin, GitHub Actions **dépose un brouillon tout prêt** dans ta boîte Gmail
(avec la DA du site, les points clés, les actus et les infos concurrents/partenaires).
Tu le **relis et l'envoies toi-même**. Aucun envoi automatique.

Gratuit, dans le cloud (fonctionne Mac éteint), sans domaine ni service tiers.

## 1. Activer IMAP + mot de passe d'application Google
1. Gmail → ⚙️ → *Voir tous les paramètres* → *Transfert et POP/IMAP* → **Activer IMAP** → Enregistrer.
2. Active la **validation en 2 étapes** : https://myaccount.google.com/security
3. Génère un **mot de passe d'application** : https://myaccount.google.com/apppasswords → copie les 16 caractères.

## 2. Ajouter 2 secrets dans GitHub
Repo `depesmen/DC-watch` → **Settings → Secrets and variables → Actions → New repository secret** :
- `GMAIL_USER` = ton adresse Gmail
- `GMAIL_APP_PASSWORD` = les 16 caractères (sans espaces)

## 3. Ajouter le workflow (via le web GitHub)
Add file → Create new file → nom `.github/workflows/newsletter.yml` → coller le contenu fourni → Commit.

## 4. Gérer les destinataires
Édite `newsletter/recipients.json` (tes collègues). Ils seront pré-remplis en **Cci** dans le brouillon.
Vérifie-les toujours avant d'envoyer (certains clients gèrent le Cci des brouillons différemment).

## 5. Tester
Repo → **Actions** → *Newsletter hebdo* → **Run workflow**. Puis ouvre tes **Brouillons** Gmail : le mail t'attend.

## Notes
- Le brouillon est reconstruit à chaque exécution depuis `data/veille.json` + `data/watchlist.json`.
- Le dossier Brouillons est détecté automatiquement (FR « Brouillons » ou EN « Drafts »).
- GitHub désactive les workflows planifiés après 60 jours **sans activité** sur le repo ; un commit occasionnel suffit à le réactiver.
