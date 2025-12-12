# Configuration du Cloudflare Worker

## 🚀 Déploiement

### 1. Créer le Worker dans Cloudflare Dashboard

1. Connectez-vous à [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Allez dans **Workers & Pages** > **Create** > **Create Worker**
3. Nommez-le (ex: `reach-form-submit`)
4. Collez le code de `cloudflare-worker.js` dans l'éditeur
5. Cliquez sur **Save and Deploy**

### 2. Configurer les Variables d'Environnement

Dans la page du Worker, allez dans **Settings** > **Variables** :

#### Variables requises :
- `AIRTABLE_WEBHOOK_URL` : `https://hooks.airtable.com/workflows/v1/genericWebhook/appDKRjPsZbEVt0iJ/wflE1Sy1QoDzTUpHL/wtr7nw1o8KVBsecw8`

#### Variables optionnelles :
- `ALLOWED_ORIGIN` : Votre domaine (ex: `https://yourdomain.com`) - laisse vide ou `*` pour autoriser tous
- `RATE_LIMIT_MAX_REQUESTS` : Nombre max de requêtes par IP/heure (défaut: `10`)
- `ENVIRONMENT` : `production` ou `development` (pour les messages d'erreur détaillés)

### 3. Configurer Rate Limiting (Optionnel mais recommandé)

Pour activer le rate limiting, vous devez créer un KV Namespace :

1. Allez dans **Workers & Pages** > **KV**
2. Cliquez sur **Create a namespace**
3. Nommez-le (ex: `rate-limit-kv`)
4. Retournez dans votre Worker > **Settings** > **Variables**
5. Dans **KV Namespace Bindings**, ajoutez :
   - Variable name: `RATE_LIMIT_KV`
   - KV namespace: `rate-limit-kv`

### 4. Obtenir l'URL du Worker

Après le déploiement, vous obtiendrez une URL comme :
```
https://reach-form-submit.your-subdomain.workers.dev
```

## 📝 Mise à jour du formulaire

Une fois le Worker déployé, mettez à jour `form.html` :

1. Remplacez `webhookURL` dans `SECURITY_CONFIG` par l'URL de votre Worker
2. Changez le mode de `'no-cors'` à `'cors'` pour pouvoir lire les réponses
3. Mettez à jour la gestion des erreurs pour utiliser les réponses JSON

## 🔒 Sécurité

✅ **Avantages de cette approche :**
- L'URL Airtable n'est plus visible dans le code source
- Rate limiting pour éviter le spam
- Validation des données côté serveur
- CORS configuré
- Sanitization des données

⚠️ **Note importante :**
- Le mot de passe dans `admin.html` devrait aussi être déplacé vers une variable d'environnement ou un système d'authentification plus sécurisé

## 🧪 Test

Pour tester localement avec Wrangler :

```bash
npm install -g wrangler
wrangler dev cloudflare-worker.js
```

Puis configurez les variables dans `wrangler.toml` :

```toml
name = "reach-form-submit"
compatibility_date = "2024-01-01"

[vars]
AIRTABLE_WEBHOOK_URL = "https://hooks.airtable.com/workflows/v1/genericWebhook/..."
ALLOWED_ORIGIN = "https://yourdomain.com"
RATE_LIMIT_MAX_REQUESTS = "10"
ENVIRONMENT = "development"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-namespace-id"
```


