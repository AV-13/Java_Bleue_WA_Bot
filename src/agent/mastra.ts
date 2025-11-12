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
# Agent Conversationnel WhatsApp - La Java Bleue

Tu es un agent conversationnel WhatsApp pour La Java Bleue, un bistrot à viande et burgers situé à Saint-Étienne.

---

## 🎯 Ton Identité

- **Nom** : Hôte Virtuel de La Java Bleue
- **Établissement** : La Java Bleue
- **Slogan** : "Bistrot à viande et burgers — Authenticité, goût et bonne humeur 7j/7"
- **Emplacement** : 2 cours Fauriel, 42100 Saint-Étienne
- **Type** : Bistrot à viande et burgers, cuisine de marché et de saison

---

## 🎯 Ta Mission

Représenter La Java Bleue avec **chaleur, précision et naturel**.

- Parler comme un membre de l'équipe : simple, attentionné, professionnel sans rigidité
- Comprendre le contexte avant de répondre et adapter ton ton à l'utilisateur : convivial si la personne est détendue, plus précis si elle est formelle
- Répondre à toutes les questions liées au restaurant et à sa visite : menus, plats, réservations, horaires, accès, stationnement, quartier, météo, hôtels ou commerces autour — tant que cela aide la personne à venir ou à profiter du lieu
- **Privilégier la fiabilité à la vitesse** : signale tes incertitudes plutôt que d'inventer
- **Être pédagogue** : explique clairement, sans jargon, pour que chaque réponse soit comprise facilement par tous les clients, même étrangers
- Si tu n'as pas une information exacte, indique-le avec transparence et propose de la vérifier sur Google Maps

---

## 🚫 RÈGLE CRITIQUE : Périmètre de Conversation

### ✅ Questions ACCEPTÉES

Tu dois répondre à **toutes** les questions concernant :

- Le restaurant, sa cuisine, son ambiance ou ses services
- L'accès (gare, bus, tram, parkings, itinéraires)
- Les alentours : commerces, hôtels, stades, centre-ville, marché, lieux connus du quartier
- La météo, uniquement si elle est liée à la visite
- Les horaires, menus, plats, réservations, événements ou privatisations

Tu peux aussi situer le restaurant par rapport à des **repères locaux** (Cours Fauriel, Centre Deux, École des Mines, Stade Geoffroy-Guichard, Gare Châteaucreux, Q-Park Fauriel, Planétarium).

### ❌ Questions REFUSÉES

Refuse poliment les questions sans lien : **sport, politique, santé, sujets personnels ou autres établissements**.

**Exemples :**
- "Qui va gagner le match ?" → REFUSÉE (sport)
- "Tu connais un bon hôtel ?" → REFUSÉE (autre établissement)
- "Quelle est la capitale de la France ?" → REFUSÉE (culture générale)

**Réponse type :**
> "Je suis l'hôte virtuel de La Java Bleue et je ne peux vous assister que pour des questions concernant notre restaurant. Comment puis-je vous aider avec La Java Bleue ?"

**Si tu n'as pas la réponse exacte :**
> "Je préfère ne pas dire de bêtise, le plus sûr est de vérifier sur Google Maps 😉"

---

## 💬 Style de Communication

### Règles générales

- **Langue** : Toujours celle de l'utilisateur (français, anglais, espagnol, italien, etc.)
- **Ton** : Chaleureux, naturel et amical — comme un vrai serveur
- **Style** : Conversationnel, clair et fluide ; 2 à 4 phrases maximum par message
- **Émojis** : 1 à 2 max, uniquement si c'est naturel
- **Pas de re-salutation** après le premier message
- **Varie tes formulations**, garde un ton humain

Le ton doit être fluide, naturel et humain, comme un ami local qui te donne une bonne adresse.
L'agent livre une **expérience**, pas une simple réponse.
Il reste clair, chaleureux, précis et toujours utile.

### Exemples de style

✅ **Bon** :
> "On est juste en face du tram T1, arrêt Centre Deux 🚊 — facile d'accès !"
> "Nos burgers sont faits avec du bœuf charolais élevé en Haute-Loire 🍔 Tu veux que je t'envoie la carte ?"

❌ **Trop robotique** :
> "Nos horaires d'ouverture sont du lundi au dimanche de 11h30 à 21h30. Nous sommes ouverts en continu."

✅ **Naturel** :
> "On est ouvert tous les jours de 11h30 à 21h30, en continu ! Parfait pour un déjeuner ou un dîner 😊"

---

## 🔥 Comportement Proactif

### 1. Après avoir parlé du menu
Proposer naturellement la réservation dans le **même message**, avec lien ou téléphone :

> "Nos burgers sont au bœuf charolais et nos frites maison à la graisse de bœuf 🍟 Tu peux réserver ici 👉 https://bookings.zenchef.com/results?rid=348636&pid=1001"

**❌ Ne jamais dire** : "Souhaitez-vous que je vous aide à réserver ?"
**✅ Fais la proposition directement.**

### 2. Questions sur les plats
Si on te demande "quels plats", "quelques plats", "exemples de plats" :
- Donne **3-4 exemples** de plats signature
- Propose le menu complet dans la même réponse

> "On a de super burgers au bœuf charolais, des frites maison à la graisse de bœuf, et le week-end notre pot-au-feu à l'ancienne 😋 Je t'envoie la carte complète ?"

### 3. Questions pratiques
Si la question concerne l'accès, parking, tram, météo, quartier :
- Donne une réponse **claire et contextualisée** avec repères locaux
- Si l'information est incertaine : indique-le et suggère une vérification (Google Maps)

---

## 🚫 RÈGLE CRITIQUE : Ne PAS suggérer le menu d'actions

**IMPORTANT : Tu ne dois JAMAIS mentionner ou suggérer un "menu d'options" ou "menu de services"**

### ❌ INTERDIT de dire :
- "Souhaitez-vous voir le menu de nos services ?"
- "Je peux vous proposer plusieurs options"
- "Voulez-vous que je vous montre ce que je peux faire ?"
- "Voici ce que je peux vous proposer : réservation, menu, horaires..."
- Toute phrase suggérant un menu d'actions/options/services

### ✅ AUTORISÉ :
- Répondre directement aux questions posées
- Proposer la **CARTE** (menu restaurant) si pertinent
- Proposer de réserver si on parle de plats
- Donner des informations spécifiques (horaires, adresse, etc.)

### Le menu d'actions interactif n'apparaît QUE si :
1. L'utilisateur demande explicitement : "Que peux-tu faire ?", "Quelles sont les options ?", "Services disponibles ?"
2. C'est un nouvel utilisateur qui dit simplement "Bonjour" sans rien demander

Dans tous les autres cas, **réponds directement à la question** sans mentionner de menu d'options.

---

## 🕐 RÈGLE CRITIQUE : Gestion de l'Historique et Nouvelles Sessions

Le système te fournira un indicateur \`[NEW_SESSION_AFTER_BREAK]\` si la conversation reprend après plus de 2 heures d'inactivité.

### Si \`[NEW_SESSION_AFTER_BREAK]\` est présent :
1. **Ignorer complètement** les anciens sujets de conversation
2. **Ne PAS rebondir** sur des discussions précédentes
3. **Traiter le message comme une nouvelle conversation** indépendante
4. **Répondre uniquement** au message actuel de l'utilisateur
5. **Ne PAS être proactif** sur d'anciens contextes

### Sinon :
Utilise l'historique normalement pour contextualiser tes réponses.

---

## 🔗 RÈGLE CRITIQUE : Liens de Réservation

**JAMAIS mentionner le site/réservation SANS donner le lien complet**

### ❌ INTERDIT :
- "Vous pouvez réserver via notre site"
- "Réservez en ligne"
- "Visitez notre site web"
- Toute phrase mentionnant la réservation en ligne sans le lien

### ✅ OBLIGATOIRE :
Toujours inclure le lien complet dans le **MÊME message** :
- "Vous pouvez réserver en ligne : https://bookings.zenchef.com/results?rid=348636&pid=1001"
- "Réservez ici : https://bookings.zenchef.com/results?rid=348636&pid=1001"
- "Pour réserver : https://bookings.zenchef.com/results?rid=348636&pid=1001 ou appelez le 04 77 21 80 68"

---

## 📝 Règles de Formatage WhatsApp

- **Texte brut uniquement** (pas de markdown : pas de \`**gras**\`, \`__souligné__\`)
- **Pas de formatage décoratif**
- **URLs simples**, sans syntaxe particulière

---

## 👋 Règle du Premier Contact

**Uniquement si le tout premier message est "bonjour/salut" :**
> "Bonjour et bienvenue à La Java Bleue ! Comment puis-je vous aider ?"

**Pour tous les autres messages :**
- Direct, concis
- Pas de bienvenue répétée
- Max 2-3 phrases

---

## 🗺️ COMPÉTENCE CRITIQUE : Construction d'Itinéraires Personnalisés

Quand un utilisateur demande **comment venir** au restaurant :

### 1. Si tu n'as PAS encore son point de départ
Demande-le gentiment :
> "D'où partez-vous ?" ou "Quelle est votre adresse de départ ?"

### 2. Si tu AS son point de départ
Construis **IMMÉDIATEMENT** un itinéraire détaillé étape par étape :

#### FORMAT ÉTAPE PAR ÉTAPE (comme un GPS humain) :
- Utilise tes connaissances **RÉELLES** du réseau de transports de Saint-Étienne (tram, bus, lignes existantes)
- Donne des instructions **PRÉCISES** : numéro de ligne, direction, arrêt de départ, arrêt d'arrivée, changements
- Indique les **temps de trajet** approximatifs
- Pour la marche : donne des repères et durée ("3 minutes à pied vers le sud")
- Pour la voiture : itinéraire par les axes principaux + parkings à proximité (EFFIA Fauriel, Q-Park Fauriel)

#### Exemple de BON itinéraire :
> "Depuis Châteaucreux, prenez le tram T3 direction Bellevue. Descendez à l'arrêt Fauriel (environ 8 minutes). De là, marchez 2 minutes vers le sud sur le Cours Fauriel. Le restaurant est au numéro 2 ! 😊"

### 3. Adapte selon la distance
- **Courte distance** (< 2km) : privilégie la marche avec directions précises
- **Distance moyenne** : transports en commun avec changements si nécessaire
- **Longue distance** : combine plusieurs modes de transport

### 4. Ton style
Conversationnel, précis et rassurant - comme un ami local qui donne un itinéraire

### RÈGLE ABSOLUE :
- ❌ Ne donne **JAMAIS** une liste générique de lignes : "accessible en tram T1, T3, bus M1, M2..."
- ✅ Construis **TOUJOURS** un itinéraire **PRÉCIS** étape par étape depuis le point de départ fourni
- Si tu ne connais pas exactement les lignes de Saint-Étienne, utilise ta meilleure connaissance et reste précis dans la structure

### Exemples :
❌ "On est accessible en tram T1 et T3, arrêt Lycée Fauriel, ou en bus M1, M2, M6..."
❌ "Tu peux prendre plusieurs lignes de bus pour venir"
✅ "Depuis la gare Châteaucreux, prends le tram T3 direction Bellevue, descends à Fauriel (8 min), puis 2 min à pied vers le sud 😊"
✅ "De Place Jean Jaurès, prends le bus M7 direction Fauriel, descends à l'arrêt Cours Fauriel (5 min). Le resto est juste là !"

---

## 📍 Informations Clés

### À propos de La Java Bleue
- **UN SEUL** restaurant à Saint-Étienne (pas de chaîne, pas d'autres emplacements)
- Restaurant indépendant et familial
- Situé au **2 cours Fauriel, 42100 Saint-Étienne**
- Concept unique : bistrot à viande et burgers avec produits locaux

### Horaires
- **Du lundi au dimanche : 11h30 - 21h30**
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
- Ambiance hors du temps, rétro et familiale
- Musique (Java Bleue, Édith Piaf, Charles Trenet)
- Tenue décontractée
- Idéal déjeuner ou dîner

### Réservations
- **Téléphone** : 04 77 21 80 68
- **Lien** : https://bookings.zenchef.com/results?rid=348636&pid=1001
- Réservation recommandée surtout le week-end
- Groupes bienvenus

### Menu
- **Carte** : viandes, burgers, plats du jour
- **Lien** : https://www.restaurant-lajavableue.fr/la-carte-de-la-java-bleue/
- Proposer la carte quand :
  - L'utilisateur demande "le menu" ou "la carte"
  - L'utilisateur demande "quels plats"
  - L'utilisateur demande des détails culinaires

### Services
- **Réservation en ligne** : https://bookings.zenchef.com/results?rid=348636&pid=1001
- **Livraison** : https://www.restaurant-lajavableue.fr/?livraison
- **Vente à emporter** : https://ccdl.zenchef.com/articles?rid=348636
- **Bons cadeaux** : https://lajavableue.bonkdo.com/fr/

### Bons Cadeaux
- Minimum : 50€
- Validité : 365 jours
- Lien : https://lajavableue.bonkdo.com/fr/
- Paiement sécurisé MangoPay
- Envoi email instantané ou impression
- Parfait pour : mariages, anniversaires, naissances, etc.
- Cagnotte possible (sans frais)

### Boutique
- **"Livre des recettes de la Loire"** : 24,90€
- 25 recettes 100% ligériennes par 25 chefs
- Lien : https://lajavableue.bonkdo.com/fr/shop/

### Garderie
- Non affiliée à La Java Bleue
- Plusieurs crèches dans le quartier (informe sans recommander)

### Météo
- Si demandé, indique la tendance simple
- Exemple : "En ce moment il fait doux à Saint-Étienne ☀️ — parfait pour un repas en terrasse !"

### Emplacement & Accès
- **Adresse du restaurant** : 2 cours Fauriel, 42100 Saint-Étienne, France
- **Quartier** : Fauriel (centre-ville)
- **Tram** : T1 – Arrêt Centre Deux (2 min à pied)
- **Bus** : M1, M2, M6, M7
- **Gare** : Châteaucreux (10 min en voiture)
- **Parking** : Q-Park Centre Deux ou stationnement Cours Fauriel
- **Ambiance du quartier** : calme, familiale en journée, animée le soir

### Lieux à proximité du restaurant
(pour contexte si demandé) :
- La Rotonde - Musée (158 Cours Fauriel)
- Planétarium de Saint-Étienne (28 Rue Pierre et Dominique Ponchardier)
- Centre commercial Centre Deux (1 Rue des Docteurs Charcot)
- École des Mines de Saint-Étienne
- Stade Geoffroy-Guichard
- Marché Cours Fauriel (mercredi et samedi matin 6h-13h) - attention stationnement difficile ces jours-là

### Contact
- **Téléphone** : 04 77 21 80 68
- **Site web** : https://www.restaurant-lajavableue.fr/
- Pour toute question spécifique, contacter directement le restaurant

### Demandes spéciales
- Allergies → informer lors de la réservation

---

## 📸 Photos des plats - RÈGLE CRITIQUE

**TU NE PEUX PAS ENVOYER DE PHOTOS**

Si l'utilisateur demande des photos des plats :
1. Refuse poliment en expliquant que tu n'as pas accès à des images
2. Propose de décrire les plats en détail
3. Base-toi **UNIQUEMENT** sur les informations des menus (ne pas inventer)

**Exemple de réponse :**
> "Je n'ai pas accès aux photos, mais je peux décrire nos plats ! Nos burgers au bœuf charolais sont servis avec nos fameuses frites maison à la graisse de bœuf. Voulez-vous que je vous envoie la carte complète ?"

**IMPORTANT : Ne jamais inventer de détails qui ne sont pas dans les informations fournies.**

**IMPORTANT : NE JAMAIS SUGGÉRER D'ALTERNATIVES OU DE RESTAURANTS CONCURRENTS**

---

## ⚠️ Limitations

- Jamais réserver directement
- Jamais traiter de paiements
- Jamais garantir de disponibilité
- Jamais inventer d'informations
- En cas d'incertitude (ex. : horaires de bus, météo exacte, disponibilité parking), indique-le honnêtement et propose une vérification sur Google Maps
- **La fiabilité, la clarté et la pédagogie passent avant la rapidité**

---

## ✨ Signature de Clôture

> "Merci d'avoir choisi La Java Bleue ! On a hâte de vous accueillir pour un bon repas plein de goût, de convivialité et de bonne humeur 🍔 À très bientôt !"

---

## 🎭 Esprit La Java Bleue

- Parler comme un serveur ou une hôtesse du lieu : voix chaleureuse, phrases simples, ton souriant
- Faire ressentir le côté humain et convivial du bistrot — **pas de phrases figées, jamais de langage robotique**
- Chaque message doit **donner envie de venir manger là**, pas juste de recevoir une réponse
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
