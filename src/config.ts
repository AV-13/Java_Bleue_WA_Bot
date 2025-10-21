/**
 * La Java Bleue Bot Configuration
 * Contains all restaurant information and bot settings
 */

export const RESTAURANT_INFO = {
  name: 'La Java Bleue',
  slogan: 'Restaurant à viande et burgers - Ouvert 7j/7 en continu',

  contact: {
    address: '2 cours Fauriel, 42100 Saint-Etienne',
    phone: '04 77 21 80 68',
    emails: {
      reservations: 'contact@restaurant-lajavableue.fr',
      general: 'contact@restaurant-lajavableue.fr',
    },
    facebook: 'https://www.facebook.com/lajavableuesaintetienne/',
    website: 'https://www.restaurant-lajavableue.fr/',
  },

  hours: {
    monday: '11h30 - 21h30',
    tuesday: '11h30 - 21h30',
    wednesday: '11h30 - 21h30',
    thursday: '11h30 - 21h30',
    friday: '11h30 - 21h30',
    saturday: '11h30 - 21h30',
    sunday: '11h30 - 21h30',
    closed: [],
  },

  policies: {
    dressCode: 'Décontractée',
    reservationPhone: '04 77 21 80 68',
    reservationEmail: 'contact@restaurant-lajavableue.fr',
  },

  dining: {
    cuisineType: 'Restaurant à viande et burgers, cuisine de marché',
    specialties: [
      'Viandes françaises (Charolaise, Salers, Limousine, Aubrac)',
      'Burgers au bœuf charolais élevé en Haute-Loire',
      'Frites maisons à la graisse de bœuf',
      'Sauces maisons (tartare, sarasson, Fourme de Montbrison)',
      'Fromages locaux BIO',
      'Plat du jour en semaine',
    ],
    atmosphere: 'Bistrot convivial avec ambiance hors du temps',
  },

  location: {
    description: '2 cours Fauriel à Saint-Etienne',
    beachFront: false,
  },

  menu: {
    url: 'https://www.restaurant-lajavableue.fr/la-carte-de-la-java-bleue/',
    type: 'Carte avec viandes et burgers, plats et desserts du jour',
  },

  links: {
    reservations: 'https://bookings.zenchef.com/results?rid=348636&pid=1001',
    delivery: 'https://www.restaurant-lajavableue.fr/?livraison',
    takeaway: 'https://ccdl.zenchef.com/articles?rid=348636',
    giftCards: 'https://lajavableue.bonkdo.com/fr/',
  },
};

export const BOT_CONFIG = {
  language: 'en',
  maxEmojiPerMessage: 2,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  welcomeMessageDelay: 500, // milliseconds
};
