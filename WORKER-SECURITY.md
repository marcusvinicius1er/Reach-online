# Sécurité du Worker (worker-reach-online)

Pour éviter les abus et les milliers d’appels indésirables (comme sur l’autre page), ce Worker est configuré de façon stricte.

## 1. CORS restreint (obligatoire)

- **Ne jamais** utiliser `*` pour `ALLOWED_ORIGIN`.
- Dans Cloudflare Dashboard → Worker → **Settings** → **Variables** :
  - **ALLOWED_ORIGIN** : votre domaine exact, par ex. `https://online.reach.fitness`
  - Plusieurs domaines : liste séparée par des virgules, sans espace après la virgule, ex. :  
    `https://online.reach.fitness,https://reach-online.pages.dev`

Si `ALLOWED_ORIGIN` est vide ou absent, le Worker renverra **503** (pas d’origine autorisée configurée).

## 2. Validation Origin / Referer

- Toute requête de formulaire doit provenir d’un navigateur qui envoie l’en-tête **Origin** (ou **Referer**).
- Les requêtes sans Origin/Referer (bots, curl, scripts) sont rejetées avec **403 Forbidden**.
- Seules les origines listées dans `ALLOWED_ORIGIN` sont acceptées (comparaison exacte).

## 3. Rate limiting

- Le Worker utilise **RATE_LIMIT_KV** (namespace KV lié au Worker) et **RATE_LIMIT_MAX_REQUESTS** (ex. `10` par IP par heure).
- Sans KV configuré, le rate limiting est désactivé ; la restriction par origine limite déjà les abus.

## 4. Champ « Origin » dans Airtable

Le Worker envoie le champ **Origin** (origine HTTP de la requête) à Airtable pour le débogage et l’analyse.

- Dans votre base Airtable, ajoutez une colonne **Origin** (type **Texte sur une ligne** ou **URL**) si elle n’existe pas.
- Vous pourrez ainsi voir dans Airtable depuis quels domaines proviennent les soumissions.

## Checklist

- [ ] **ALLOWED_ORIGIN** défini avec le(s) domaine(s) exact(s), sans `*`
- [ ] Colonne **Origin** ajoutée dans la table Airtable (optionnel mais recommandé)
- [ ] Rate limiting : namespace KV créé et lié au Worker, **RATE_LIMIT_MAX_REQUESTS** défini (optionnel)
