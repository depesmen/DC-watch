# Newsletter hebdo — envoi via ton Gmail (GitHub Actions)

Envoi automatique chaque **vendredi 14h** (heure de Luxembourg), depuis ta boîte Gmail,
à une **liste interne fixe**. Gratuit, dans le cloud (fonctionne Mac éteint), sans domaine ni service tiers.

## 1. Gérer les destinataires
Édite `newsletter/recipients.json` → ajoute/retire les adresses de tes collègues, puis commit + push.

## 2. Créer un « mot de passe d'application » Google
1. Active la **validation en 2 étapes** sur ton compte Google : https://myaccount.google.com/security
2. Va sur https://myaccount.google.com/apppasswords
3. Crée un mot de passe d'application (nom : « DC Watch newsletter ») → **copie les 16 caractères**.

## 3. Ajouter 2 secrets dans GitHub
Repo `depesmen/DC-watch` → **Settings → Secrets and variables → Actions → New repository secret** :
- `GMAIL_USER` = ton adresse Gmail (ex. `depesme.noemie@gmail.com`)
- `GMAIL_APP_PASSWORD` = le mot de passe d'application (16 caractères, sans espaces)

## 4. Tester tout de suite (sans attendre vendredi)
Repo → onglet **Actions** → workflow **« Newsletter hebdo »** → bouton **Run workflow**.
→ envoi immédiat (le garde-fou 14h est ignoré en mode manuel). Vérifie ta boîte.

## C'est tout
- En automatique : le workflow se déclenche vendredi et n'envoie **que** s'il est 14h à Luxembourg (gère été/hiver).
- Le contenu est construit depuis `data/veille.json` + `data/watchlist.json` (mis à jour par la veille).
- Envoi unique avec destinataires en **Cci** (adresses masquées entre elles).
- Désinscription : réponse « stop » → tu retires l'adresse de `recipients.json`.

## Bon à savoir
- Gmail gratuit : ~500 destinataires/jour max (large pour de l'interne).
- GitHub désactive les workflows planifiés si le repo n'a **aucune activité pendant 60 jours** ; un commit de temps en temps (ou les pushes de la veille) suffit à le garder actif.
