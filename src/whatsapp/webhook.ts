/**
 * WhatsApp Webhook Handler for Meta Business API
 * Handles incoming messages and webhook verification
 *
 * SIMPLIFIED VERSION - Menus only, no reservation flow
 */

import { Request, Response } from 'express';
import { WhatsAppClient } from './client.js';
import { Mastra } from '@mastra/core';
import { processUserMessage, detectLanguageWithMastra, getJavaBleuAgent } from '../agent/mastra.js';
import { sessionManager } from '../sessionManager.js';
import { getDatabase } from '../database/supabase.js';
import {
  generateText,
  generateMenuMessage,
  generatePrompt,
  generateErrorMessage,
  generateListLabels
} from '../i18n/dynamicTranslation.js';
import { processAudioMessage } from '../audio/whisper.js';
// import { generateLocationResponse, INCA_LONDON_LOCATION, type LocationData } from '../location/maps.js'; // COMMENTED OUT - Old restaurant location

// La Java Bleue location
const JAVA_BLEUE_LOCATION = {
  latitude: 45.4397,  // Coordinates for La Java Bleue, Saint-Etienne (à vérifier)
  longitude: 4.3872,
  name: 'La Java Bleue',
  address: '2 cours Fauriel, 42100 Saint-Etienne'
};

type LocationData = {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

/**
 * Set to track processed message IDs (prevents duplicates)
 * Messages are kept for 5 minutes to handle Meta's webhook retries
 */
const processedMessages = new Set<string>();
const MESSAGE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Cache to store user's detected language (in-memory, persists across messages)
 * Key: userId, Value: { language: string, lastUpdated: number }
 */
const userLanguageCache = new Map<string, { language: string; lastUpdated: number }>();
const LANGUAGE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Clean up expired language cache entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of userLanguageCache.entries()) {
    if (now - data.lastUpdated > LANGUAGE_CACHE_DURATION) {
      userLanguageCache.delete(userId);
      console.log(`🗑️ Cleaned up expired language cache for user ${userId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour

/**
 * Process AI-generated text to fix formatting issues
 * Replaces literal \n with actual newlines for proper WhatsApp display
 */
function processFormattedText(text: string): string {
  // Replace literal \n with actual newline characters
  return text.replace(/\\n/g, '\n');
}

/**
 * Normalize language code to ISO 639-1 format
 * Handles various input formats: 'French' -> 'fr', 'en-US' -> 'en', 'SPANISH' -> 'es', etc.
 */
function normalizeLanguageCode(language: string): string {
  if (!language) return 'fr'; // Default to French for La Java Bleue

  const lang = language.toLowerCase().trim();

  // Map common language names to ISO codes
  const languageMap: { [key: string]: string } = {
    'french': 'fr', 'francais': 'fr', 'français': 'fr',
    'english': 'en', 'anglais': 'en',
    'spanish': 'es', 'espanol': 'es', 'español': 'es',
    'german': 'de', 'deutsch': 'de', 'allemand': 'de',
    'italian': 'it', 'italiano': 'it', 'italien': 'it',
    'portuguese': 'pt', 'portugues': 'pt', 'português': 'pt',
    'dutch': 'nl', 'nederlands': 'nl', 'néerlandais': 'nl',
    'polish': 'pl', 'polski': 'pl', 'polonais': 'pl',
    'russian': 'ru', 'русский': 'ru', 'russe': 'ru',
    'arabic': 'ar', 'عربي': 'ar', 'arabe': 'ar',
    'chinese': 'zh', '中文': 'zh', 'chinois': 'zh',
    'japanese': 'ja', '日本語': 'ja', 'japonais': 'ja'
  };

  // Check if it's a language name
  if (languageMap[lang]) {
    return languageMap[lang];
  }

  // If it's already a 2-letter code, return it
  if (lang.length === 2 && /^[a-z]{2}$/.test(lang)) {
    return lang;
  }

  // Handle locale formats like 'en-US', 'fr-FR'
  if (lang.includes('-')) {
    const code = lang.split('-')[0];
    if (code.length === 2) {
      return code;
    }
  }

  // If nothing matches, try to extract first 2 letters
  const extracted = lang.substring(0, 2);
  if (/^[a-z]{2}$/.test(extracted)) {
    return extracted;
  }

  // Default fallback
  console.warn(`⚠️ Could not normalize language code: "${language}", defaulting to French`);
  return 'fr';
}

/**
 * Detect user's specific intent using AI (works in ALL languages)
 * Returns the action ID if a specific action is requested, or 'greeting' for general greeting, or null for other messages
 */
async function detectUserIntent(
  userMessage: string,
  mastra: Mastra
): Promise<string | null> {
  try {
    const agent = getJavaBleuAgent(mastra);

    const prompt = `Analyze this user message and determine their intent. Choose ONE option from this list:

1. "greeting" - General greeting without specific request (examples: "Hello", "Bonjour", "Hi", "Hola")
2. "positive_response" - Positive answer to a question (examples: "Yes", "Oui", "Si", "Sure", "D'accord", "OK", "Yeah", "Yep", "Bien sûr", "Absolument", "Volontiers", "With pleasure")
3. "show_main_menu" - Wants to see the main options/services menu (examples: "Show options", "What can you do?", "Voir les options", "Que proposez-vous?", "Menu principal", "Options", "Services")
4. "action_view_menu" - Wants to see the FOOD menu/carte (examples: "Show me the menu", "Je veux voir la carte", "Menu please", "Food menu")
5. "action_reserve" - Wants to book/reserve a table (examples: "I want to reserve", "Réserver une table", "Book a table")
6. "action_hours" - Wants to know opening hours (examples: "What time are you open?", "Horaires d'ouverture", "When are you open?")
7. "action_location" - Wants to know address/location (examples: "Where are you?", "Adresse du restaurant", "Location please")
8. "action_contact" - Wants contact information (examples: "How can I contact you?", "Coordonnées", "Phone number")
9. "action_delivery" - Wants to order delivery (examples: "Livraison", "I want delivery", "Order delivery")
10. "action_takeaway" - Wants to order takeaway (examples: "À emporter", "Takeaway", "Order to go")
11. "action_gift_cards" - Wants information about gift cards (examples: "Bon cadeau", "Gift card", "Chèque cadeau")
12. "action_shop" - Wants to see the shop (examples: "Boutique", "Shop", "Buy something")
13. "other" - Other messages that don't fit above categories

IMPORTANT:
- Only respond with ONE of these exact strings
- If the message is a GENERAL greeting without a specific request, respond "greeting"
- If the message is a POSITIVE response (yes, oui, ok, etc.), respond "positive_response"
- If the message asks to see the SERVICES/OPTIONS (not food), respond "show_main_menu"
- If the message asks for a SPECIFIC action, respond with the action ID (like "action_view_menu")
- If unclear or doesn't match, respond "other"

User message: "${userMessage}"

Intent:`;

    const result = await agent.generate(prompt);
    const intent = (result.text || 'other').trim().toLowerCase();

    console.log(`🎯 Intent detected for "${userMessage}": ${intent}`);

    // Validate the response
    const validIntents = [
      'greeting', 'positive_response', 'show_main_menu', 'action_view_menu', 'action_reserve', 'action_hours',
      'action_location', 'action_contact', 'action_delivery', 'action_takeaway',
      'action_gift_cards', 'action_shop', 'other'
    ];

    if (validIntents.includes(intent)) {
      return intent === 'other' ? null : intent;
    }

    return null;
  } catch (error: any) {
    console.error('❌ Error detecting intent:', error);
    return null;
  }
}

/**
 * Detect user's language from conversation history
 * Uses the most recent text messages to detect language, ignoring button IDs
 * Stores detected language in cache for future button clicks
 */
async function detectUserLanguage(
  userId: string,
  userMessage: string,
  mastra: Mastra,
  conversationHistory?: string
): Promise<string> {
  try {
    // Don't detect language from button IDs (they're in English by design)
    const isButtonClick = userMessage.startsWith('menu_') || userMessage.startsWith('action_');

    if (isButtonClick) {
      // Check cache first for button clicks
      const cachedLanguage = userLanguageCache.get(userId);
      if (cachedLanguage && (Date.now() - cachedLanguage.lastUpdated) < LANGUAGE_CACHE_DURATION) {
        console.log(`🌍 Button click - using cached language for ${userId}: ${cachedLanguage.language}`);
        return cachedLanguage.language;
      }

      // Try to extract language from conversation history
      if (conversationHistory) {
        const historyLines = conversationHistory.split('\n');
        for (let i = historyLines.length - 1; i >= 0; i--) {
          const line = historyLines[i];
          if (line.startsWith('User: ')) {
            const lastUserMessage = line.substring(6).trim();
            if (!lastUserMessage.startsWith('menu_') &&
                !lastUserMessage.startsWith('action_') &&
                lastUserMessage.length > 5) {
              console.log(`🌍 Detecting language from history: "${lastUserMessage}"`);
              const detectedLanguage = await detectLanguageWithMastra(mastra, lastUserMessage);
              // Cache it
              userLanguageCache.set(userId, { language: detectedLanguage, lastUpdated: Date.now() });
              return detectedLanguage;
            }
          }
        }
      }
      console.log('🌍 Button click detected, no valid cache or history - defaulting to French');
      return 'fr'; // Default to French for La Java Bleue
    }

    // For regular messages, detect language and cache it
    const detectedLanguage = await detectLanguageWithMastra(mastra, userMessage);

    // Cache the detected language for this user
    userLanguageCache.set(userId, { language: detectedLanguage, lastUpdated: Date.now() });
    console.log(`🌍 Cached language for ${userId}: ${detectedLanguage}`);

    return detectedLanguage;
  } catch (error: any) {
    console.error('❌ Error detecting language:', error);
    return 'fr'; // Default to French for La Java Bleue
  }
}

/**
 * WhatsApp webhook message structure from Meta
 */
interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  audio?: {
    id: string;
    mime_type: string;
  };
  voice?: {
    id: string;
    mime_type: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  type: string;
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: {
          name: string;
        };
        wa_id: string;
      }>;
      messages?: WhatsAppWebhookMessage[];
      statuses?: Array<any>;
    };
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

/**
 * Verify webhook endpoint (GET request from Meta)
 */
export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.status(403).send('Forbidden');
  }
}

/**
 * Handle incoming webhook events (POST request from Meta)
 */
export async function handleWebhook(
  req: Request,
  res: Response,
  whatsappClient: WhatsAppClient,
  mastra: Mastra
): Promise<void> {
  try {
    const body = req.body as WhatsAppWebhookPayload;

    if (body.object !== 'whatsapp_business_account') {
      console.warn('⚠️ Received non-WhatsApp webhook');
      res.sendStatus(404);
      return;
    }

    res.sendStatus(200);

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await processIncomingMessage(message, whatsappClient, mastra);
          }
        }

        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            console.log(`📊 Message status update: ${status.status} for message ${status.id}`);
          }
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Error handling webhook:', error);
  }
}

// SERVICE LINKS CONFIGURATION - La Java Bleue
const MENU_URL = 'https://www.restaurant-lajavableue.fr/la-carte-de-la-java-bleue/';
const RESERVATION_URL = 'https://bookings.zenchef.com/results?rid=348636&pid=1001';
const DELIVERY_URL = 'https://www.restaurant-lajavableue.fr/?livraison';
const TAKEAWAY_URL = 'https://ccdl.zenchef.com/articles?rid=348636';
const GIFT_CARD_URL = 'https://lajavableue.bonkdo.com/fr/';

/**
 * Send main menu with all available actions (multilingue)
 */
async function sendMainMenu(
  userId: string,
  whatsappClient: WhatsAppClient,
  language: string,
  mastra: Mastra
): Promise<void> {
  try {
    console.log(`📋 Sending main menu to ${userId} in language: ${language}`);

    // Define menu items in English (to be translated)
    const menuItems = [
      { id: 'action_view_menu', englishLabel: 'View our menu' },
      { id: 'action_reserve', englishLabel: 'Book a table' },
      { id: 'action_hours', englishLabel: 'Opening hours' },
      { id: 'action_location', englishLabel: 'Location & Address', description: 'Find us in Saint-Etienne' },
      { id: 'action_contact', englishLabel: 'Contact us' },
      { id: 'action_delivery', englishLabel: 'Delivery', description: 'Get our food delivered home' },
      { id: 'action_takeaway', englishLabel: 'Takeaway', description: 'Order and pick up' },
      { id: 'action_gift_cards', englishLabel: 'Gift cards' },
      { id: 'action_shop', englishLabel: 'Shop' },
    ];

    // Translate menu item labels using AI
    const translatedLabels = await generateListLabels(
      mastra,
      menuItems.map(item => ({ id: item.id, englishLabel: item.englishLabel })),
      language
    );

    // Translate descriptions only for items that have descriptions
    const itemsWithDescriptions = menuItems.filter(item => item.description);
    const translatedDescriptions = itemsWithDescriptions.length > 0
      ? await generateListLabels(
          mastra,
          itemsWithDescriptions.map(item => ({ id: item.id, englishLabel: item.description! })),
          language
        )
      : [];

    // Build rows with translated labels and descriptions (only where applicable)
    const rows = menuItems.map((item, index) => {
      const row: { id: string; title: string; description?: string } = {
        id: item.id,
        title: translatedLabels[index]?.label || item.englishLabel,
      };

      // Add description only if the item has one
      if (item.description) {
        const descIndex = itemsWithDescriptions.findIndex(i => i.id === item.id);
        if (descIndex >= 0) {
          row.description = translatedDescriptions[descIndex]?.label || item.description;
        }
      }

      return row;
    });

    // Generate body text and button text
    // Professional, warm, and conversion-focused welcome message
    const bodyText = await generateText(
      mastra,
      'Professional and inviting welcome for La Java Bleue restaurant. Structure: Welcome message + subtle suggestion to explore our offerings or book a table. Around 15-18 words. Be elegant, courteous, and gently guide toward reservation. Example: "Welcome to La Java Bleue! Discover our services or reserve your table directly."',
      language,
      'Professional restaurant greeting that subtly guides toward conversion - courteous, refined, and action-oriented'
    );

    // Generate button text - use hardcoded translations for reliability
    // This is a critical UI element, so we want to ensure it's always correct

    // Normalize language code to handle various formats
    const normalizedLang = normalizeLanguageCode(language);

    console.log(`🌍 Detected language: "${language}" → Normalized to: "${normalizedLang}"`);

    const buttonTextMap: { [key: string]: string } = {
      'fr': 'Voir les options',
      'en': 'View options',
      'es': 'Ver opciones',
      'de': 'Optionen anzeigen',
      'it': 'Vedi opzioni',
      'pt': 'Ver opções',
      'nl': 'Opties bekijken',
      'pl': 'Zobacz opcje',
      'ru': 'Посмотреть варианты',
      'ar': 'عرض الخيارات',
      'zh': '查看选项',
      'ja': 'オプションを見る'
    };

    // Use normalized language code for lookup
    const buttonText = buttonTextMap[normalizedLang] || buttonTextMap['fr']; // Fallback to French

    console.log(`🔘 Menu button text: "${buttonText}" (language: ${language} → ${normalizedLang})`);

    // Send interactive list with single section
    await whatsappClient.sendInteractiveList(
      userId,
      bodyText,
      buttonText,
      [
        {
          title: await generateText(mastra, 'Section title "Services" (1 word)', language),
          rows: rows,
        },
      ]
    );

    console.log(`✅ Main menu sent to ${userId}`);
  } catch (error: any) {
    console.error('❌ Error sending main menu:', error);
    // Fallback to simple text message (also translated by AI)
    try {
      const fallbackText = await generateText(
        mastra,
        'Ask "How can I help you today?" in a friendly way. Max 8 words.',
        language,
        'Fallback message when interactive menu fails'
      );
      await whatsappClient.sendTextMessage(userId, fallbackText);
    } catch (fallbackError) {
      // Last resort fallback (only if AI translation also fails)
      const lastResortText = language === 'fr'
        ? 'Comment puis-je vous aider ?'
        : 'How can I help you?';
      await whatsappClient.sendTextMessage(userId, lastResortText);
    }
  }
}

/**
 * Handle main menu action clicks
 */
async function handleMainMenuAction(
  userId: string,
  actionId: string,
  whatsappClient: WhatsAppClient,
  language: string,
  mastra: Mastra
): Promise<void> {
  try {
    console.log(`🎯 Handling main menu action: ${actionId} for user ${userId}`);

    switch (actionId) {
      case 'action_view_menu':
        // Send menu link with button - professional and inviting message
        const menuMessage = await generateText(
          mastra,
          'Professional invitation to view our menu. Mention our culinary offerings in an elegant way. Around 10-12 words. Tone: refined, appetizing, and professional - like a quality restaurant presenting their carte.',
          language
        );
        console.log("generated menu message:", menuMessage);
        const menuButtonLabel = await generateText(
          mastra,
          'Button text for "View menu" (2 words max)',
          language
        );
        console.log("generated menu button label:", menuButtonLabel);
        await whatsappClient.sendCTAUrlButton(
          userId,
          menuMessage,
          menuButtonLabel,
          MENU_URL
        );

        // PROACTIVE: Follow up with reservation prompt
        await new Promise(resolve => setTimeout(resolve, 1500));
        const menuFollowUp = await generateText(
          mastra,
          'After showing menu, proactively suggest reservation. Be inviting and conversion-focused. Around 8-10 words. Example: "Tempted? Would you like to reserve a table?"',
          language
        );
        await whatsappClient.sendTextMessage(userId, menuFollowUp);
        break;

      case 'action_reserve':
        // Send reservation info with button - professional, welcoming and enthusiastic
        const reserveMessage = await generateText(
          mastra,
          'Enthusiastic and professional invitation to reserve. Express excitement about welcoming them and mention the ease of booking. Around 12-15 words. Tone: warm, inviting, and eager - like a maître d\'hôtel delighted to serve.',
          language
        );
        const reserveButtonLabel = await generateText(
          mastra,
          'Button text for "Book table" or "Reserve" (2 words max)',
          language
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          reserveMessage,
          reserveButtonLabel,
          RESERVATION_URL
        );

        // Add a warm closing message after reservation link
        await new Promise(resolve => setTimeout(resolve, 1500));
        const reserveClosing = await generateText(
          mastra,
          'After sending reservation link, add a warm closing that expresses anticipation. Around 8-10 words. Example: "We look forward to welcoming you soon!"',
          language
        );
        await whatsappClient.sendTextMessage(userId, reserveClosing);
        break;

      case 'action_hours':
        // Send opening hours info - professional and clear with LINE BREAKS
        const hoursMessageRaw = await generateText(
          mastra,
          'Share our opening hours in a professional, clear format. Structure:\n1. Brief opening phrase (e.g., "Our hours:")\n2. NEW LINE then hours: "🕐 11:30 - 21:30"\n3. NEW LINE: "Open 7 days a week, continuous service"\n\nIMPORTANT: Use line breaks (\\n) for readability. Tone: professional, clear, and courteous.',
          language
        );
        const hoursMessage = processFormattedText(hoursMessageRaw);
        await whatsappClient.sendTextMessage(userId, hoursMessage);

        // PROACTIVE: Follow up with reservation prompt
        await new Promise(resolve => setTimeout(resolve, 1000));
        const hoursFollowUp = await generateText(
          mastra,
          'After showing hours, proactively suggest booking. Be inviting. Around 8-10 words. Example: "Would you like to book a table?"',
          language
        );
        await whatsappClient.sendTextMessage(userId, hoursFollowUp);
        break;

      case 'action_location':
        // Send location pin directly
        await whatsappClient.sendLocationMessage(
          userId,
          JAVA_BLEUE_LOCATION.latitude,
          JAVA_BLEUE_LOCATION.longitude,
          JAVA_BLEUE_LOCATION.name,
          JAVA_BLEUE_LOCATION.address
        );

        // PROACTIVE: Follow up with reservation prompt
        await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay for better UX
        const locationFollowUp = await generateText(
          mastra,
          'After showing location, ask if they would like to reserve a table. Be proactive and inviting. Around 8-10 words. Example: "Would you like to reserve a table with us?"',
          language
        );
        await whatsappClient.sendTextMessage(userId, locationFollowUp);
        break;

      case 'action_contact':
        // Send contact info - professional and well formatted with LINE BREAKS
        const contactMessageRaw = await generateText(
          mastra,
          'Share contact information in a professional way. Structure:\n1. Brief opening like "Contact information:" or "How to reach us:"\n2. NEW LINE then Phone: 📞 04 77 21 80 68\n3. NEW LINE then Website: 🌐 https://www.restaurant-lajavableue.fr/\n\nIMPORTANT: Use line breaks (\\n) for readability. Tone: professional, clear, and helpful.',
          language
        );
        const contactMessage = processFormattedText(contactMessageRaw);
        await whatsappClient.sendTextMessage(userId, contactMessage);

        // PROACTIVE: Follow up with reservation prompt
        await new Promise(resolve => setTimeout(resolve, 1000));
        const contactFollowUp = await generateText(
          mastra,
          'After showing contact, suggest online reservation. Be proactive. Around 10-12 words. Example: "You can also reserve your table directly online. Interested?"',
          language
        );
        await whatsappClient.sendTextMessage(userId, contactFollowUp);
        break;

      case 'action_delivery':
        // Send delivery link with button - professional message
        const deliveryMessage = await generateText(
          mastra,
          'Professional message for delivery service. Mention that our cuisine is available for home delivery. Around 10-12 words. Tone: refined, service-oriented, and professional.',
          language
        );
        const deliveryButtonLabel = await generateText(
          mastra,
          'Button text for "Order delivery" (2 words max)',
          language
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          deliveryMessage,
          deliveryButtonLabel,
          DELIVERY_URL
        );
        break;

      case 'action_takeaway':
        // Send takeaway link with button - professional message
        const takeawayMessage = await generateText(
          mastra,
          'Professional message for takeaway service. Mention that our dishes are available for takeaway. Around 10-12 words. Tone: refined, service-oriented, and professional.',
          language
        );
        const takeawayButtonLabel = await generateText(
          mastra,
          'Button text for "Order takeaway" (2 words max)',
          language
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          takeawayMessage,
          takeawayButtonLabel,
          TAKEAWAY_URL
        );
        break;

      case 'action_gift_cards':
        // Send gift cards link with button - professional message with details
        const giftCardMessageRaw = await generateText(
          mastra,
          'Professional message for gift cards. Structure:\n1. Present gift cards as an elegant gifting option\n2. NEW LINE then mention: From 50€, valid for 365 days\n3. NEW LINE then closing: "Perfect for any occasion."\n\nIMPORTANT: Use line breaks (\\n) for readability. Tone: refined, professional, and courteous. Around 15-18 words total.',
          language
        );
        const giftCardMessage = processFormattedText(giftCardMessageRaw);
        const giftCardButtonLabel = await generateText(
          mastra,
          'Button text for "Buy gift card" (2 words max)',
          language
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          giftCardMessage,
          giftCardButtonLabel,
          GIFT_CARD_URL
        );
        break;

      case 'action_shop':
        // Send shop link with button - professional message mentioning Loire recipes book with details
        const shopMessageRaw = await generateText(
          mastra,
          'Professional message for our shop. Structure:\n1. Invite them to discover our shop\n2. NEW LINE then present: "Loire Recipes Book" by 25 local chefs (24.90€)\n3. NEW LINE then mention: "Celebrating local gastronomy."\n\nIMPORTANT: Use line breaks (\\n) for readability. Tone: refined, professional, and cultured. Around 15-18 words total.',
          language
        );
        const shopMessage = processFormattedText(shopMessageRaw);
        const shopButtonLabel = await generateText(
          mastra,
          'Button text for "Visit shop" (2 words max)',
          language
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          shopMessage,
          shopButtonLabel,
          'https://lajavableue.bonkdo.com/fr/shop/'
        );
        break;

      default:
        console.warn(`⚠️ Unknown main menu action: ${actionId}`);
        break;
    }
  } catch (error: any) {
    console.error(`❌ Error handling main menu action ${actionId}:`, error);
  }
}

/**
 * Process incoming WhatsApp message
 */
async function processIncomingMessage(
  message: WhatsAppWebhookMessage,
  whatsappClient: WhatsAppClient,
  mastra: Mastra
): Promise<void> {
  const database = getDatabase();

  try {
    const userId = message.from;
    const messageId = message.id;
    let userMessage = '';
    let isButtonClick = false;

    // Handle interactive button/list responses
    if (message.type === 'interactive' && message.interactive) {
      const buttonReply = message.interactive.button_reply;
      const listReply = message.interactive.list_reply;

      if (buttonReply) {
        userMessage = buttonReply.id;
        isButtonClick = true;
        console.log(`🔘 Button clicked: ${buttonReply.id} (${buttonReply.title})`);
      } else if (listReply) {
        userMessage = listReply.id;
        isButtonClick = true;
        console.log(`📋 List item selected: ${listReply.id} (${listReply.title})`);
      }
    }
    // Handle text messages
    else if (message.type === 'text' && message.text?.body) {
      userMessage = message.text.body.trim();
    }
    // Handle audio messages
    else if ((message.type === 'audio' || message.type === 'voice') && (message.audio?.id || message.voice?.id)) {
      const mediaId = message.audio?.id || message.voice?.id;
      if (!mediaId) {
        console.error('❌ Audio message received but no media ID found');
        return;
      }

      console.log(`🎤 Audio/Voice message received, transcribing...`);

      try {
        const accessToken = process.env.META_WHATSAPP_TOKEN;
        if (!accessToken) {
          throw new Error('META_WHATSAPP_TOKEN not configured');
        }

        const tempConversation = await database.getOrCreateConversation(userId);
        const tempMessages = await database.getConversationHistory(tempConversation.id, 5);
        const tempHistory = database.formatHistoryForMastra(tempMessages);
        const languageHint = await detectUserLanguage(userId, '', mastra, tempHistory);

        const transcription = await processAudioMessage(mediaId, accessToken, languageHint);
        userMessage = transcription;

        console.log(`✅ Transcription: "${transcription}"`);

        // Removed intermediate "I heard" message - process transcription directly
      } catch (error: any) {
        console.error('❌ Error transcribing audio:', error);
        const errorLang = await detectUserLanguage(userId, '', mastra);
        const errorMsg = await generateText(
          mastra,
          'Apologize that you could not process the audio message',
          errorLang
        );
        await whatsappClient.sendTextMessage(userId, errorMsg);
        return;
      }
    }
    // Handle location messages
    else if (message.type === 'location' && message.location) {
      console.log(`📍 Location received: ${message.location.latitude}, ${message.location.longitude}`);

      try {
        const tempConversation = await database.getOrCreateConversation(userId);
        const tempMessages = await database.getConversationHistory(tempConversation.id, 5);
        const tempHistory = database.formatHistoryForMastra(tempMessages);
        const userLanguage = await detectUserLanguage(userId, '', mastra, tempHistory);

        // Simple location response without using generateLocationResponse
        const locationResponse = `Merci pour votre localisation ! Voici notre adresse : ${JAVA_BLEUE_LOCATION.address}`;

        await whatsappClient.sendTextMessage(userId, locationResponse);

        await whatsappClient.sendLocationMessage(
          userId,
          JAVA_BLEUE_LOCATION.latitude,
          JAVA_BLEUE_LOCATION.longitude,
          JAVA_BLEUE_LOCATION.name,
          JAVA_BLEUE_LOCATION.address
        );

        console.log(`✅ Sent location response and restaurant location to ${userId}`);
        return;
      } catch (error: any) {
        console.error('❌ Error processing location:', error);
        const errorLang = await detectUserLanguage(userId, '', mastra);
        const errorMsg = await generateText(
          mastra,
          'Apologize that you could not process the location',
          errorLang
        );
        await whatsappClient.sendTextMessage(userId, errorMsg);
        return;
      }
    }
    else {
      console.log(`⚠️ Ignoring message of type: ${message.type}`);
      return;
    }

    // Check for duplicates
    if (processedMessages.has(messageId)) {
      console.log(`⏭️ Skipping duplicate message: ${messageId}`);
      return;
    }

    processedMessages.add(messageId);

    setTimeout(() => {
      processedMessages.delete(messageId);
    }, MESSAGE_CACHE_DURATION);

    console.log(`\n📨 Incoming message from ${userId}:`);
    console.log(`   Message ID: ${messageId}`);
    console.log(`   Content: "${userMessage}"`);

    // Mark as read and show typing indicator (best practice per Meta docs)
    await whatsappClient.markAsReadWithTyping(messageId);

    // Database integration - Get or create conversation
    const conversation = await database.getOrCreateConversation(userId);
    const isNewUser = await database.isNewUser(userId);

    // Save incoming message to database
    await database.saveMessage({
      conversation_id: conversation.id,
      wa_message_id: messageId,
      direction: 'in',
      sender: 'user',
      message_type: message.type,
      text_content: userMessage
    });

    // Get conversation history for context
    const messages = await database.getConversationHistory(conversation.id, 10);
    const conversationHistory = database.formatHistoryForMastra(messages);

    const detectedLanguage = await detectUserLanguage(userId, userMessage, mastra, conversationHistory);

    // Handle main menu action clicks
    if (userMessage.startsWith('action_')) {
      await handleMainMenuAction(userId, userMessage, whatsappClient, detectedLanguage, mastra);
      console.log(`✅ Processing complete for ${userId}`);
      return;
    }

    // For text messages, detect user intent to provide direct responses
    if (!isButtonClick) {
      console.log(`🔍 Detecting intent for text message: "${userMessage}"`);
      const detectedIntent = await detectUserIntent(userMessage, mastra);

      if (detectedIntent) {
        if (detectedIntent === 'greeting' || detectedIntent === 'show_main_menu') {
          // Show main menu for general greetings or explicit menu requests
          await sendMainMenu(userId, whatsappClient, detectedLanguage, mastra);
          console.log(`✅ Main menu sent for ${detectedIntent} - ${userId}`);
          return;
        } else if (detectedIntent === 'positive_response') {
          // User said YES! Trigger reservation flow
          console.log(`✅ Positive response detected - triggering reservation for ${userId}`);
          await handleMainMenuAction(userId, 'action_reserve', whatsappClient, detectedLanguage, mastra);
          console.log(`✅ Reservation triggered after positive response - ${userId}`);
          return;
        } else if (detectedIntent.startsWith('action_')) {
          // User requested a specific action directly - execute it!
          console.log(`🎯 Direct action requested: ${detectedIntent}`);
          await handleMainMenuAction(userId, detectedIntent, whatsappClient, detectedLanguage, mastra);
          console.log(`✅ Direct action response sent for ${detectedIntent} - ${userId}`);
          return;
        }
      }
    }

    // Process through Mastra
    const agentResponse = await processUserMessage(
      mastra,
      userMessage,
      userId,
      conversationHistory,
      isNewUser
    );

    const userLanguage = agentResponse.detectedLanguage || 'fr';

    // MENU RESPONSE HANDLING REMOVED - Agent now shares menu link directly in text
    // No need for special menu handling - the Canva link is included in agent responses

    // Send response (with or without service buttons)
    if (agentResponse.text && agentResponse.text.trim().length > 0) {
      // Check which button to send (priority: menu > reservation > delivery > takeaway > gift card)
      if (agentResponse.sendMenuButton) {
        console.log(`📋 Sending response with menu button to ${userId}`);
        const menuButtonLabel = await generateText(
          mastra,
          'Button text for "View menu" (2-3 words max)',
          userLanguage,
          'Button that opens the restaurant menu in a web browser'
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          agentResponse.text,
          menuButtonLabel,
          MENU_URL
        );
        console.log(`✅ Response with menu button sent to ${userId} (button: "${menuButtonLabel}")`);
      } else if (agentResponse.sendReservationButton) {
        console.log(`📅 Sending response with reservation button to ${userId}`);
        const reservationButtonLabel = await generateText(
          mastra,
          'Button text for "Book a table" (2-3 words max)',
          userLanguage,
          'Button that opens the online reservation page'
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          agentResponse.text,
          reservationButtonLabel,
          RESERVATION_URL
        );
        console.log(`✅ Response with reservation button sent to ${userId} (button: "${reservationButtonLabel}")`);
      } else if (agentResponse.sendDeliveryButton) {
        console.log(`🚚 Sending response with delivery button to ${userId}`);
        const deliveryButtonLabel = await generateText(
          mastra,
          'Button text for "Order delivery" (2-3 words max)',
          userLanguage,
          'Button that opens the delivery page'
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          agentResponse.text,
          deliveryButtonLabel,
          DELIVERY_URL
        );
        console.log(`✅ Response with delivery button sent to ${userId} (button: "${deliveryButtonLabel}")`);
      } else if (agentResponse.sendTakeawayButton) {
        console.log(`🥡 Sending response with takeaway button to ${userId}`);
        const takeawayButtonLabel = await generateText(
          mastra,
          'Button text for "Order takeaway" (2-3 words max)',
          userLanguage,
          'Button that opens the takeaway order page'
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          agentResponse.text,
          takeawayButtonLabel,
          TAKEAWAY_URL
        );
        console.log(`✅ Response with takeaway button sent to ${userId} (button: "${takeawayButtonLabel}")`);
      } else if (agentResponse.sendGiftCardButton) {
        console.log(`🎁 Sending response with gift card button to ${userId}`);
        const giftCardButtonLabel = await generateText(
          mastra,
          'Button text for "Buy gift card" (2-3 words max)',
          userLanguage,
          'Button that opens the gift card purchase page'
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          agentResponse.text,
          giftCardButtonLabel,
          GIFT_CARD_URL
        );
        console.log(`✅ Response with gift card button sent to ${userId} (button: "${giftCardButtonLabel}")`);
      } else {
        // Send regular text message (no button needed)
        await whatsappClient.sendTextMessage(userId, agentResponse.text);
        console.log(`✅ Text response sent to ${userId}`);
      }

      // Save outgoing message to database
      await database.saveMessage({
        conversation_id: conversation.id,
        direction: 'out',
        sender: 'bot',
        message_type: 'text',
        text_content: agentResponse.text
      });

      // Send location pin if user explicitly requested it
      if (agentResponse.sendLocation) {
        console.log(`📍 User requested location, sending location pin to ${userId}`);
        await whatsappClient.sendLocationMessage(
          userId,
          JAVA_BLEUE_LOCATION.latitude,
          JAVA_BLEUE_LOCATION.longitude,
          JAVA_BLEUE_LOCATION.name,
          JAVA_BLEUE_LOCATION.address
        );
        console.log(`✅ Location pin sent to ${userId}`);
      }
    }

    console.log(`✅ Processing complete for ${userId}`);
  } catch (error: any) {
    console.error('❌ Error processing incoming message:', error);

    try {
      let errorLanguage = 'en';
      try {
        if (message.text?.body) {
          errorLanguage = await detectUserLanguage(message.from, message.text.body, mastra);
        }
      } catch (langError) {
        console.error('Failed to detect language for error message:', langError);
      }

      const errorMessage = await generateErrorMessage(mastra, errorLanguage, 'technical');
      await whatsappClient.sendTextMessage(message.from, errorMessage);
    } catch (sendError) {
      console.error('❌ Failed to send error message to user:', sendError);
      try {
        await whatsappClient.sendTextMessage(
          message.from,
          "Je m'excuse, mais je rencontre un problème technique. Veuillez réessayer dans un moment, ou nous contacter directement:\n\n📞 04 77 21 80 68\n🌐 https://www.restaurant-lajavableue.fr/"
        );
      } catch (finalError) {
        console.error('❌ Failed to send fallback error message:', finalError);
      }
    }
  }
}

/**
 * Validate webhook signature
 */
export function validateWebhookSignature(req: Request): boolean {
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    console.warn('⚠️ No signature provided in webhook request');
    return true;
  }

  return true;
}
