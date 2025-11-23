/**
 * Configuration centralisée des promotions
 * 
 * Pour activer/désactiver : changez 'enabled' à true/false
 * Pour changer le type : modifiez 'type' (black-friday, noel, paques, custom)
 * Pour définir les dates : modifiez 'startDate' et 'endDate'
 */

const PROMO_CONFIG = {
  // Activation/désactivation en 1 clic
  enabled: true,
  
  // Type de promotion (black-friday, noel, paques, custom)
  type: 'black-friday',
  
  // Dates de la promotion (format ISO: YYYY-MM-DDTHH:mm:ss)
  startDate: '2025-11-22T00:00:00',
  endDate: '2025-12-31T23:59:59',
  
  // Configuration du popup
  popup: {
    delay: 3000, // Délai avant affichage (en millisecondes)
    showOncePerSession: true, // Afficher une seule fois par session
  },
  
  // Offres promotionnelles
  // Le client paye le prix normal mais la durée est étendue
  offers: {
    1: {
      enabled: false, // Pas d'offre pour 1 mois
      extraMonths: 0,
      label: '1 Month'
    },
    3: {
      enabled: true, // 3 mois + 1 mois offert = 4 mois au total
      extraMonths: 1,
      label: '3 Months + 1 FREE'
    },
    6: {
      enabled: true, // 6 mois + 3 mois offerts = 9 mois au total
      extraMonths: 3,
      label: '6 Months + 3 FREE'
    }
  },
  
  // Textes du popup selon le type
  popupTexts: {
    'black-friday': {
      badge: '🔥 BLACK FRIDAY 🔥',
      title: 'LIMITED TIME<br>ONLY!',
      offer: 'EXTRA MONTHS FREE',
      description: 'Sign up now and get <strong style="color: #ff6413;">extra months completely FREE.</strong><br>This exclusive offer ends soon. Don\'t miss out! ⏰',
      cta: '🎁 CLAIM THE OFFER'
    },
    'noel': {
      badge: '🎄 CHRISTMAS SPECIAL 🎄',
      title: 'HOLIDAY<br>OFFER!',
      offer: 'EXTRA MONTHS FREE',
      description: 'Give yourself the gift of transformation! Get <strong style="color: #ff6413;">extra months FREE</strong> when you sign up.<br>Limited time offer! ⏰',
      cta: '🎁 GET THE OFFER'
    },
    'paques': {
      badge: '🐰 EASTER SPECIAL 🐰',
      title: 'SPRING<br>PROMOTION!',
      offer: 'EXTRA MONTHS FREE',
      description: 'Start your transformation this spring! Get <strong style="color: #ff6413;">extra months FREE</strong> on selected plans.<br>Offer ends soon! ⏰',
      cta: '🎁 CLAIM OFFER'
    },
    'custom': {
      badge: '⚡ SPECIAL OFFER ⚡',
      title: 'LIMITED TIME<br>ONLY!',
      offer: 'EXTRA MONTHS FREE',
      description: 'Sign up now and get <strong style="color: #ff6413;">extra months completely FREE.</strong><br>This exclusive offer ends soon. Don\'t miss out! ⏰',
      cta: '🎁 CLAIM THE OFFER'
    }
  }
};

/**
 * Vérifie si la promotion est actuellement active
 */
function isPromoActive() {
  if (!PROMO_CONFIG.enabled) return false;
  
  const now = new Date();
  const start = new Date(PROMO_CONFIG.startDate);
  const end = new Date(PROMO_CONFIG.endDate);
  
  return now >= start && now <= end;
}

/**
 * Récupère les textes du popup selon le type de promotion
 */
function getPopupTexts() {
  const type = PROMO_CONFIG.type || 'custom';
  return PROMO_CONFIG.popupTexts[type] || PROMO_CONFIG.popupTexts['custom'];
}

/**
 * Formate la date limite pour l'affichage
 */
function formatEndDate() {
  const endDate = new Date(PROMO_CONFIG.endDate);
  const options = { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return endDate.toLocaleDateString('en-US', options);
}

/**
 * Calcule le prix avec promotion (le prix reste le même, seule la durée change)
 */
function getPromoPrice(originalPrice, planDuration) {
  if (!isPromoActive()) return originalPrice;
  
  const offer = PROMO_CONFIG.offers[planDuration];
  if (!offer || !offer.enabled) return originalPrice;
  
  // Le prix reste le même, on retourne juste l'info de la promo
  return {
    price: originalPrice,
    originalDuration: planDuration,
    totalDuration: planDuration + offer.extraMonths,
    extraMonths: offer.extraMonths,
    label: offer.label
  };
}

