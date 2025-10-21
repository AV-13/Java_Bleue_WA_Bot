/**
 * Caribbean Food Carbet Bot Configuration
 * Contains all restaurant information and bot settings
 */

export const RESTAURANT_INFO = {
  name: 'Caribbean Food Carbet',
  slogan: 'Un voyage de saveurs entre terre et mer, au coeur de la Caraïbes',

  contact: {
    address: 'Le Coin, Le Carbet 97221, Martinique',
    phone: '06 96 33 20 35',
    emails: {
      reservations: 'caribbeanfoodnord@gmail.com',
      general: 'caribbeanfoodnord@gmail.com',
    },
    instagram: '@caribbean_food_972',
    instagramUrl: 'https://www.instagram.com/caribbean_food_972/?hl=fr',
  },

  hours: {
    monday: '12h - 15h',
    tuesday: 'Fermé',
    wednesday: '12h - 15h',
    thursday: '12h - 15h',
    friday: '12h - 22h30',
    saturday: '12h - 22h30',
    sunday: '12h - 15h',
    closed: ['Tuesday'],
  },

  policies: {
    dressCode: 'Décontractée - tenue de plage acceptée',
    reservationPhone: '06 96 33 20 35',
    reservationEmail: 'caribbeanfoodnord@gmail.com',
  },

  dining: {
    cuisineType: 'Cuisine caribéenne et créole, fruits de mer, poissons frais',
    specialties: [
      'Fruits de mer frais',
      'Poissons grillés',
      'Spécialités créoles',
      'Cocktails exotiques',
    ],
    atmosphere: 'Restaurant en bord de mer avec vue sur l\'océan',
  },

  location: {
    description: 'En bord de mer au Coin, Le Carbet, Martinique',
    beachFront: true,
  },

  menu: {
    url: 'https://www.canva.com/design/DAGJ58x1g9o/WOx7t3_GavjWjygcZ3TBIw/view?utm_content=DAGJ58x1g9o&utm_campaign=designshare&utm_medium=link&utm_source=viewer#2',
    type: 'Menu unique avec spécialités caribéennes et créoles',
  },
};

export const BOT_CONFIG = {
  language: 'en',
  maxEmojiPerMessage: 2,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  welcomeMessageDelay: 500, // milliseconds
};
