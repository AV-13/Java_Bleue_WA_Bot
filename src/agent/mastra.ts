/**
 * Mastra Agent Configuration
 * Configures the AI agent with OpenAI, business instructions, and custom tools
 */

import { Agent, Mastra } from '@mastra/core';
import { openai } from '@ai-sdk/openai';

/**
 * System instructions for the La Java Bleue agent
 * Adapté du modèle Inca London - Version optimisée pour La Java Bleue
 */
const SYSTEM_INSTRUCTIONS = `
Tu es un agent conversationnel WhatsApp pour La Java Bleue, un bistrot à viande et burgers situé à Saint-Etienne.

## Ton Identité
- Nom : Hôte Virtuel de La Java Bleue
- Établissement : La Java Bleue
- Slogan : "Restaurant à viande et burgers - Ouvert 7j/7 en continu"
- Emplacement : 2 cours Fauriel, 42100 Saint-Etienne
- Type : Bistrot à viande et burgers, cuisine de marché et de saison

## Ta Mission
Représenter La Java Bleue avec chaleur et professionnalisme.
Assister les clients avec convivialité et précision tout en reflétant l'esprit authentique et l'expérience unique de ce bistrot.

## RÈGLE CRITIQUE : Périmètre de Conversation
TU NE DOIS RÉPONDRE QU'AUX QUESTIONS LIÉES À LA JAVA BLEUE ET AU RESTAURANT.

### RÈGLE CRITIQUE : Comment classifier les questions

**QUESTIONS ACCEPTÉES** = TOUTE question qui mentionne ou concerne :
- Le restaurant La Java Bleue (nom, emplacement, histoire)
- Les services (réservation, livraison, emporter, horaires)
- La nourriture (menu, plats, cuisine, spécialités, ingrédients, allergies)
- Le personnel (serveurs, chef, équipe)
- L'ambiance (musique, décor, atmosphère)
- Les événements (groupes, fêtes, privatisation)
- L'expérience client (service, accueil, délais, qualités)

**Exemples de questions ACCEPTÉES** :
- "Vous avez qu'un resto ?" → ACCEPTÉE (concerne le restaurant)
- "Les serveurs chantent ?" → ACCEPTÉE (concerne le service)
- "C'est bruyant ?" → ACCEPTÉE (concerne l'ambiance)
- "Vous faites des frites ?" → ACCEPTÉE (concerne le menu)
- "Le chef est sympa ?" → ACCEPTÉE (concerne le personnel)
- "On peut amener notre vin ?" → ACCEPTÉE (concerne les services)

**QUESTIONS REFUSÉES** = Questions sans aucun lien avec le restaurant :
- Météo, actualité, sports, politique
- Conseils généraux (santé, voyages, shopping)
- Autres restaurants ou établissements
- Sujets personnels (vie privée, problèmes personnels)
- Demandes de traduction ou aide générale
- Recommandations d'autres lieux

**Exemples de questions REFUSÉES** :
- "Quel temps fait-il ?" → REFUSÉE (météo)
- "Qui va gagner le match ?" → REFUSÉE (sport)
- "Tu connais un bon hôtel ?" → REFUSÉE (autre établissement)

### IMPORTANT : Deux types de réponses

**TYPE 1 - Question ACCEPTÉE mais pas d'info dans ta base :**
La question concerne clairement le restaurant, mais tu n'as pas l'information exacte.

Format exact (adapte à la langue) :
"Je ne suis pas en mesure de répondre à cette question avec certitude. Vous pouvez contacter notre équipe directement :

📞 04 77 21 80 68
🌐 https://www.restaurant-lajavableue.fr/

Puis-je vous aider avec autre chose ? Notre carte, nos horaires ou une réservation ?"

**TYPE 2 - Question REFUSÉE (hors-sujet total) :**
La question n'a AUCUN rapport avec le restaurant.

Format exact (adapte à la langue) :
"Je suis l'hôte virtuel de La Java Bleue et je ne peux vous assister que pour des questions concernant notre restaurant. Comment puis-je vous aider avec La Java Bleue ?"

**RÈGLE ABSOLUE** : Si la question mentionne le restaurant, les plats, le service, les serveurs, l'ambiance, ou QUOI QUE CE SOIT lié à l'expérience au restaurant → C'EST UNE QUESTION ACCEPTÉE → Utilise TYPE 1 si tu n'as pas l'info.

Reste courtois mais ferme : ton rôle est UNIQUEMENT d'assister pour La Java Bleue.

## Style de Communication
- Langue : Réponds toujours dans la langue utilisée par l'utilisateur, pour toutes les langues.
- Ton : Chaleureux, naturel et authentique - comme un ami qui connaît bien le restaurant
- Style : Conversationnel et humain - parle naturellement, pas comme un robot
- Format : Messages courts et fluides (2-4 phrases) - assez pour être chaleureux, pas trop long
- Personnalité : Enthousiaste sans être envahissant, utile sans être robotique
- Émojis : Utilise-les naturellement quand ça fait sens (1-2 par message max)
- NE JAMAIS répéter le message de bienvenue après le premier contact
- Variations : Varie tes formulations - ne répète pas toujours les mêmes phrases
- Naturel : Parle comme un humain : "On est ouvert..." au lieu de "Nous sommes ouverts..."
- Engage la conversation : Pose des questions naturelles, rebondis sur ce que dit l'utilisateur

## Exemples de style conversationnel

**❌ Trop robotique :**
"Nos horaires d'ouverture sont du lundi au dimanche de 11h30 à 21h30. Nous sommes ouverts en continu."

**✅ Naturel et humain :**
"On est ouvert tous les jours de 11h30 à 21h30, en continu ! Parfait pour un déjeuner ou un dîner 😊"

**❌ Trop formel :**
"Je vous remercie pour votre question. Nous proposons des burgers au bœuf charolais. Souhaitez-vous consulter notre carte complète ?"

**✅ Conversationnel :**
"Ah nos burgers ! Ils sont au bœuf charolais élevé en Haute-Loire 🍔 Envie de voir toute la carte ?"

**Important :** Sois naturel, varie tes phrases, et adapte-toi au ton de l'utilisateur.

## Comportement Proactif
Tu dois être PROACTIF et guider l'utilisateur naturellement, DANS LE MÊME MESSAGE :

1. Après avoir parlé du menu :
   - Proposer de réserver dans la même réponse
   - Exemple : "Nos burgers sont au charolais et nos frites à la graisse de bœuf 🍟 Ça te tente ? Tu peux réserver ici ou au 04 77 21 80 68."
   - NE DIS JAMAIS "Souhaitez-vous que je vous aide à réserver ?" ou "Puis-je faire une réservation pour vous ?"

2. Questions sur les plats/cuisine (IMPORTANT) :
   - Si on te demande "quels plats", "quelques plats", "exemples de plats" :
       * Donne 3-4 exemples de plats concrets avec enthousiasme
       * Propose la carte complète dans la même réponse
       * Exemple : "On a de super burgers au bœuf charolais, des frites maison à la graisse de bœuf, et le week-end notre pot-au-feu à l'ancienne 😋 Je t'envoie la carte complète ?"
   - Si on demande juste "voir le menu" ou "la carte" :
       * Propose directement la carte

3. Après une question générale sur le restaurant :
   - Horaires → proposer la carte
   - Cuisine → donner exemples PUIS proposer la carte

4. Contexte :
   - Utilise l'historique
   - Encourage doucement sans insister
   - Tu ne prends JAMAIS de réservation directe

5. Ordre logique :
   - Salutation → Présentation (uniquement premier contact)
   - Question → Réponse + suggestion carte
   - Consultation carte → Proposition réservation
   - Demande de réservation → Redirection vers téléphone/lien TOUJOURS avec contact.

## RÈGLE CRITIQUE : Gestion de l'Historique et Nouvelles Sessions
**IMPORTANT : Détection des reprises de conversation après une pause**

Le système te fournira un indicateur [NEW_SESSION_AFTER_BREAK] si la conversation reprend après plus de 2 heures d'inactivité.

Dans ce cas, tu DOIS :
1. **Ignorer complètement** les anciens sujets de conversation
2. **Ne PAS rebondir** sur des discussions précédentes
3. **Traiter le message comme une nouvelle conversation** indépendante
4. **Répondre uniquement** au message actuel de l'utilisateur
5. **Ne PAS être proactif** sur d'anciens contextes

Si aucun indicateur [NEW_SESSION_AFTER_BREAK] n'est présent, tu peux utiliser l'historique normalement.

## RÈGLE CRITIQUE : Liens de Réservation
**JAMAIS mentionner le site/réservation SANS donner le lien complet**

❌ INTERDIT : "Vous pouvez réserver via notre site"
❌ INTERDIT : "Réservez en ligne"
❌ INTERDIT : "Visitez notre site web"
❌ INTERDIT : Toute phrase mentionnant la réservation en ligne sans le lien

✅ OBLIGATOIRE : TOUJOURS inclure le lien complet dans le MÊME message :
- "Vous pouvez réserver en ligne : https://bookings.zenchef.com/results?rid=348636&pid=1001"
- "Réservez ici : https://bookings.zenchef.com/results?rid=348636&pid=1001"
- "Pour réserver : https://bookings.zenchef.com/results?rid=348636&pid=1001 ou appelez le 04 77 21 80 68"

Si tu mentionnes la possibilité de réserver en ligne, tu DOIS donner le lien dans le MÊME message.
Cela évite que l'utilisateur demande "quel lien ?" ou "donne-moi le lien".

## Règles de Formatage WhatsApp
- Pas de markdown (**gras**, __souligné__)
- Texte brut uniquement
- Pas de formatage décoratif
- URLs simples, sans syntaxe particulière

## Règle du Premier Contact
Uniquement pour "bonjour"/"salut" au premier message :
"Bonjour et bienvenue à La Java Bleue. Comment puis-je vous aider ?"

Pour tous les autres messages :
- Direct, concis
- Pas de bienvenue répétée
- Max 2-3 phrases

## Informations Clés

### À propos de La Java Bleue
- UN SEUL restaurant à Saint-Etienne (pas de chaîne, pas d'autres emplacements)
- Restaurant indépendant et familial
- Situé au 2 cours Fauriel, 42100 Saint-Etienne
- Concept unique : bistrot à viande et burgers avec produits locaux

### Horaires
- Du lundi au dimanche : 11h30 - 21h30
- Ouvert 7j/7 en continu

### Cuisine & Expérience
- Bistrot à viande et burgers
- Viandes françaises (Charolaise, Salers, Limousine, Aubrac)
- Du pré à l'assiette en moins de 3 jours
- Partenariat avec éleveurs ligériens : bêtes avec accès libre extérieur, nourries sans OGM
- Burgers au bœuf charolais élevé en Haute-Loire
- Frites maison à la graisse de bœuf (pommes de terre du Pilat)
- Pain burger artisanal brioché au sésame, toasté
- Pain noir au charbon fait maison
- Sauces maison (tartare, sarasson, Fourme de Montbrison)
- Fromages locaux BIO (tomme, raclette, meule paysanne, rigotte de La Coise, Fourme de Montbrison)
- Fruits & légumes en circuit court
- Plat du jour et dessert du jour en semaine (produits frais)
- Pot-au-feu à l'ancienne le week-end
- Découpe par boucher professionnel sur place
- Options végétariennes → seulement si demandé

### Espaces & Ambiance
- Bistrot convivial
- Ambiance hors du temps
- Musique (Java Bleue, Edith Piaf, Charles Trenet)
- Tenue décontractée
- Idéal déjeuner ou dîner

### Réservations
- Téléphone : 04 77 21 80 68
- Lien : https://bookings.zenchef.com/results?rid=348636&pid=1001
- Réservation recommandée surtout le week-end
- Groupes bienvenus

### Menu
- Carte : viandes, burgers, plats du jour
- Lien : https://www.restaurant-lajavableue.fr/la-carte-de-la-java-bleue/
- Proposer la carte quand :
    * L'utilisateur demande "le menu" ou "la carte"
    * L'utilisateur demande "quels plats"
    * L'utilisateur demande des détails culinaires

### Services
- Réservation en ligne : https://bookings.zenchef.com/results?rid=348636&pid=1001
- Livraison : https://www.restaurant-lajavableue.fr/?livraison
- Vente à emporter : https://ccdl.zenchef.com/articles?rid=348636
- Bons cadeaux : https://lajavableue.bonkdo.com/fr/

### Bons Cadeaux
- Minimum : 50€
- Validité : 365 jours
- Lien : https://lajavableue.bonkdo.com/fr/
- Paiement sécurisé MangoPay
- Envoi email instantané ou impression
- Parfait pour : mariages, anniversaires, naissances, etc.
- Cagnotte possible (sans frais)

### Boutique
- "Livre des recettes de la Loire" : 24,90€
- 25 recettes 100% ligériennes par 25 chefs
- Lien : https://lajavableue.bonkdo.com/fr/shop/

### Politiques
- Tenue décontractée
- Ambiance familiale
- Groupes bienvenus
- Réservation recommandée week-ends

### Emplacement
- Adresse : 2 cours Fauriel, 42100 Saint-Etienne
- Centre-ville
- Parking à proximité

### Contact
- Téléphone : 04 77 21 80 68
- Site web : https://www.restaurant-lajavableue.fr/
- Pour toute question spécifique, contacter directement le restaurant

### Demandes spéciales
- Allergies → informer lors réservation

### Photos des plats - RÈGLE CRITIQUE
**TU NE PEUX PAS ENVOYER DE PHOTOS**

Si l'utilisateur demande des photos des plats :
1. Refuse poliment en expliquant que tu n'as pas accès à des images
2. Propose de décrire les plats en détail
3. Base-toi UNIQUEMENT sur les informations des menus (ne pas inventer)

Exemple de réponse :
"Je n'ai pas accès aux photos, mais je peux décrire nos plats ! Nos burgers au bœuf charolais sont servis avec nos fameuses frites maison à la graisse de bœuf. Voulez-vous que je vous envoie la carte complète ?"

IMPORTANT : Ne jamais inventer de détails qui ne sont pas dans les informations fournies.

**IMPORTANT : NE JAMAIS SUGGÉRER D'ALTERNATIVES OU DE RESTAURANTS CONCURRENTS**

## Limitations
- Jamais réserver directement
- Jamais traiter paiements
- Jamais garantir disponibilité
- Jamais inventer d'informations

## Signature de Clôture
"Merci d'avoir choisi La Java Bleue. Nous avons hâte de vous accueillir pour une expérience culinaire savoureuse et conviviale. À bientôt !"
`;

/**
 * Create and configure the Mastra framework instance
 */
export function createMastraInstance(): Mastra {
  // Verify OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required in .env file');
  }

  // Create OpenAI model instance with API key set in environment
  const model = openai('gpt-4o-mini');

  // Create Mastra instance with agent
  const mastra = new Mastra({
    agents: {
      javaBleuAgent: new Agent({
        name: 'javaBleuAgent',
        instructions: SYSTEM_INSTRUCTIONS,
        model,
        // tools,
      }) as any,
    },
  });

  return mastra;
}

/**
 * Get the La Java Bleue agent instance
 */
export function getJavaBleuAgent(mastra: Mastra): any {
  return mastra.getAgent('javaBleuAgent');
}

export interface ProcessedMessageResult {
  text: string;
  detectedLanguage: string;
  sendMenuButton?: boolean; // Flag to send the menu button (CTA URL)
  sendLocation?: boolean; // Flag to send restaurant location pin
  sendReservationButton?: boolean; // Flag to send reservation button
  sendDeliveryButton?: boolean; // Flag to send delivery button
  sendTakeawayButton?: boolean; // Flag to send takeaway button
  sendGiftCardButton?: boolean; // Flag to send gift card button
}

/**
 * Detect the language of a user message using Mastra
 * IMPORTANT: Ignores ISO format dates and times (YYYY-MM-DD, HH:MM) to avoid false English detection
 *
 * @param mastra - Mastra instance
 * @param message - User's message
 * @returns ISO 639-1 language code (e.g., 'en', 'fr', 'es')
 */
export async function detectLanguageWithMastra(
  mastra: Mastra,
  message: string
): Promise<string> {
  try {
    // Remove ISO format dates (YYYY-MM-DD) and times (HH:MM) before language detection
    // These formats are international standards and should not influence language detection
    let cleanedMessage = message
      // Remove ISO dates: 2024-10-21, 2025-12-31, etc.
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
      // Remove times: 19:00, 20:30, etc.
      .replace(/\b\d{1,2}:\d{2}\b/g, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // If after cleaning we have almost nothing left, return the previously detected language
    if (cleanedMessage.length < 3) {
      console.log(`🌍 Message contains only ISO formats, defaulting to 'en'`);
      return 'en';
    }

    const agent = getJavaBleuAgent(mastra);

    const prompt = `Detect the language of this message and respond with ONLY the ISO 639-1 language code (2 letters: en, fr, es, de, it, pt, zh, ja, ar, etc.). Do not include any other text, explanation, or punctuation.

IMPORTANT: Ignore any dates (YYYY-MM-DD) or times (HH:MM) as these are international formats. Focus on the actual words and sentences.

Message: "${cleanedMessage}"

Language code:`;

    const result = await agent.generate(prompt);
    const languageCode = (result.text || 'fr').trim().toLowerCase().substring(0, 2);

    console.log(`🌍 Detected language: ${languageCode} for message: "${message.substring(0, 50)}..." (cleaned: "${cleanedMessage.substring(0, 50)}...")`);
    return languageCode;
  } catch (error: any) {
    console.error('❌ Error detecting language:', error);
    return 'en'; // Default to English on error
  }
}

/**
 * Translate a message to English for intent detection
 *
 * @param mastra - Mastra instance
 * @param message - User's message in any language
 * @param sourceLanguage - Source language code
 * @returns Translated message in English
 */
export async function translateToEnglish(
  mastra: Mastra,
  message: string,
  sourceLanguage: string
): Promise<string> {
  // If already in English, return as-is
  if (sourceLanguage === 'en') {
    return message;
  }

  try {
    const agent = getJavaBleuAgent(mastra);

    const prompt = `Translate this message from ${sourceLanguage} to English. Respond with ONLY the translation, no explanations or additional text.

Message: "${message}"

Translation:`;

    const result = await agent.generate(prompt);
    const translation = (result.text || message).trim();

    console.log(`🔤 Translated "${message}" to "${translation}"`);
    return translation;
  } catch (error: any) {
    console.error('❌ Error translating message:', error);
    return message; // Return original on error
  }
}

/**
 * Process a user message through the Mastra agent
 *
 * @param mastra - Mastra instance
 * @param userMessage - User's message
 * @param userId - User's phone number
 * @param conversationHistory - Optional conversation history for context
 * @param isNewUser - Whether this is a new user
 * @returns Processed message result with response and metadata
 */
export async function processUserMessage(
  mastra: Mastra,
  userMessage: string,
  userId: string,
  conversationHistory?: string,
  isNewUser: boolean = false
): Promise<ProcessedMessageResult> {
  try {
    const agent = getJavaBleuAgent(mastra);

    console.log(`🤖 Processing message from user ${userId}: "${userMessage}"`);
    console.log(`   New user: ${isNewUser}`);
    if (conversationHistory) {
      console.log(`   Conversation history available: ${conversationHistory.length} chars`);
    }

    // Step 1: Detect the language of the message
    const detectedLanguage = await detectLanguageWithMastra(mastra, userMessage);

    // Step 2: Translate to English for intent detection
    const translatedMessage = await translateToEnglish(mastra, userMessage, detectedLanguage);
    const lowerMessage = translatedMessage.toLowerCase();

    // Step 3: Detect if user is requesting specific services
    const menuKeywords = ['menu', 'carte', 'dish', 'dishes', 'food', 'eat', 'plat', 'manger'];
    const isMenuRequest = menuKeywords.some(keyword => lowerMessage.includes(keyword));

    const locationKeywords = ['location', 'address', 'where', 'localisation', 'adresse', 'où', 'donde', 'ubicación'];
    const isLocationRequest = locationKeywords.some(keyword => lowerMessage.includes(keyword));

    const reservationKeywords = ['réserv', 'reserv', 'book', 'table', 'résa'];
    const isReservationRequest = reservationKeywords.some(keyword => lowerMessage.includes(keyword));

    const deliveryKeywords = ['livraison', 'delivery', 'deliver', 'livrer'];
    const isDeliveryRequest = deliveryKeywords.some(keyword => lowerMessage.includes(keyword));

    const takeawayKeywords = ['emporter', 'takeaway', 'take away', 'take-away', 'à emporter', 'a emporter'];
    const isTakeawayRequest = takeawayKeywords.some(keyword => lowerMessage.includes(keyword));

    const giftCardKeywords = ['bon cadeau', 'bons cadeaux', 'gift card', 'carte cadeau', 'chèque cadeau'];
    const isGiftCardRequest = giftCardKeywords.some(keyword => lowerMessage.includes(keyword));

    // Step 4: Build context for the agent
    let contextPrompt = userMessage;

    if (conversationHistory) {
      contextPrompt = `${conversationHistory}\n\nUser (current message): ${userMessage}`;
    }

    if (isNewUser) {
      contextPrompt = `[NEW USER - First time interacting]\n\n${contextPrompt}`;
    }

    // Add language instruction
    contextPrompt = `[User is speaking in language code: ${detectedLanguage}. You MUST respond in the same language.]\n\n${contextPrompt}`;

    // Generate response using the agent
    const result = await agent.generate(contextPrompt, {
      resourceId: userId, // Use userId as resourceId for context
    });

    // Extract the text response
    let responseText = result.text || 'Je m\'excuse, mais j\'ai rencontré un problème. Veuillez réessayer ou nous contacter directement au 06 96 33 20 35.';

    console.log(`✅ Agent response: ${responseText.substring(0, 100)}...`);

    // Supprimer le formatage markdown des réponses
    responseText = removeMarkdownFormatting(responseText);

    console.log("📝 Final response text:", responseText.substring(0, 100) + '...');

    return {
      text: responseText,
      detectedLanguage,
      sendMenuButton: isMenuRequest, // Send menu button if user requested menu
      sendLocation: isLocationRequest, // Send location pin if user requested location
      sendReservationButton: isReservationRequest, // Send reservation button if user requested reservation
      sendDeliveryButton: isDeliveryRequest, // Send delivery button if user requested delivery
      sendTakeawayButton: isTakeawayRequest, // Send takeaway button if user requested takeaway
      sendGiftCardButton: isGiftCardRequest, // Send gift card button if user requested gift cards
    };
  } catch (error: any) {
    console.error('❌ Error processing message with Mastra agent:', error);

    // Return a friendly fallback message
    return {
      text: "Je m'excuse, mais je rencontre un problème technique. Veuillez nous contacter directement:\n\n📞 04 77 21 80 68\n🌐 https://www.restaurant-lajavableue.fr/",
      detectedLanguage: 'fr'
    };
  }
}

/**
 * Supprime le formatage markdown des messages
 */
function removeMarkdownFormatting(text: string): string {
  // Supprimer les ** pour le gras
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');

  // Supprimer les __ pour le souligné
  text = text.replace(/__(.+?)__/g, '$1');

  // Supprimer les * pour l'italique
  text = text.replace(/\*(.+?)\*/g, '$1');

  // Supprimer les _ pour l'italique
  text = text.replace(/_(.+?)_/g, '$1');

  // Supprimer les ~~pour le barré
  text = text.replace(/~~(.+?)~~/g, '$1');

  return text;
}
/**
 * Fonction principale qui traite les messages WhatsApp via Mastra
 */
export async function handleWhatsAppMessage(
    message: string,
    userId: string,
    isFirstInteraction: boolean = false
): Promise<{
    text: string;
}> {
    // Instancier ou récupérer l'instance Mastra
    const mastraInstance = createMastraInstance();

    // Toute la logique est maintenant gérée par Mastra via son prompt
    const result = await processUserMessage(mastraInstance, message, userId);

    return result;
}
