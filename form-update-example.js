/**
 * EXEMPLE DE MODIFICATIONS POUR form.html
 * 
 * Après avoir déployé le Cloudflare Worker, remplacez les sections suivantes :
 */

// ============================================
// 1. MISE À JOUR DE SECURITY_CONFIG
// ============================================
// AVANT (ligne 132-143) :
/*
const SECURITY_CONFIG = {
  localStorageKey: 'reachFormSubmissions',
  webhookURL: 'https://hooks.airtable.com/workflows/v1/genericWebhook/appDKRjPsZbEVt0iJ/wflE1Sy1QoDzTUpHL/wtr7nw1o8KVBsecw8',
  retryIntervalMinutes: 5,
  email: { ... }
};
*/

// APRÈS :
const SECURITY_CONFIG = {
  localStorageKey: 'reachFormSubmissions',
  // Remplacez par l'URL de votre Cloudflare Worker
  webhookURL: 'https://reach-form-submit.your-subdomain.workers.dev',
  retryIntervalMinutes: 5,
  email: {
    enabled: false,
    publicKey: '',
    serviceId: '',
    templateId: '',
    toEmail: ''
  }
};

// ============================================
// 2. MISE À JOUR DE sendToAirtable()
// ============================================
// AVANT (ligne 321-331) :
/*
async function sendToAirtable(payload) {
  const submissionBody = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    submissionBody.append(key, value ?? '');
  });
  await fetch(SECURITY_CONFIG.webhookURL, {
    method: 'POST',
    mode: 'no-cors',
    body: submissionBody
  });
}
*/

// APRÈS :
async function sendToAirtable(payload) {
  try {
    const response = await fetch(SECURITY_CONFIG.webhookURL, {
      method: 'POST',
      mode: 'cors', // Changé de 'no-cors' à 'cors'
      headers: {
        'Content-Type': 'application/json', // Envoyer en JSON
      },
      body: JSON.stringify(payload) // Envoyer en JSON au lieu de URLSearchParams
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    // Gérer les erreurs de réseau ou de validation
    throw error;
  }
}

// ============================================
// 3. MISE À JOUR DE attemptSubmissionRecord()
// ============================================
// Modifier la gestion des erreurs pour utiliser les réponses JSON
// Le Worker retourne maintenant des messages d'erreur structurés

// Dans la fonction attemptSubmissionRecord (ligne 333-366),
// la gestion des erreurs reste similaire mais vous pouvez maintenant
// lire les messages d'erreur du Worker :

/*
catch (submissionError) {
  // Le Worker retourne des erreurs JSON, vous pouvez les parser
  let errorMessage = 'Network error';
  if (submissionError.message) {
    errorMessage = submissionError.message;
  }
  // ... reste du code
}
*/

// ============================================
// 4. GESTION DES ERREURS RATE LIMIT
// ============================================
// Le Worker peut retourner un 429 (Rate Limit), vous pouvez gérer ça :

/*
if (response.status === 429) {
  const errorData = await response.json();
  throw new Error(errorData.error || 'Too many requests. Please try again later.');
}
*/

// ============================================
// NOTES IMPORTANTES
// ============================================
// 1. Le Worker valide déjà les champs requis, mais gardez la validation côté client
// 2. Le Worker sanitize les données, mais gardez une validation stricte côté client
// 3. Testez bien après la migration pour vérifier que tout fonctionne
// 4. Surveillez les logs Cloudflare pour détecter les problèmes


