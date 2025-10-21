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
// import { getDatabase } from '../database/supabase.js'; // COMMENTED OUT - Supabase disabled for now
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
2. "action_view_menu" - Wants to see the menu/food/carte (examples: "Show me the menu", "Je veux voir la carte", "Menu please")
3. "action_reserve" - Wants to book/reserve a table (examples: "I want to reserve", "Réserver une table", "Book a table")
4. "action_hours" - Wants to know opening hours (examples: "What time are you open?", "Horaires d'ouverture", "When are you open?")
5. "action_location" - Wants to know address/location (examples: "Where are you?", "Adresse du restaurant", "Location please")
6. "action_contact" - Wants contact information (examples: "How can I contact you?", "Coordonnées", "Phone number")
7. "action_delivery" - Wants to order delivery (examples: "Livraison", "I want delivery", "Order delivery")
8. "action_takeaway" - Wants to order takeaway (examples: "À emporter", "Takeaway", "Order to go")
9. "action_gift_cards" - Wants information about gift cards (examples: "Bon cadeau", "Gift card", "Chèque cadeau")
10. "action_shop" - Wants to see the shop (examples: "Boutique", "Shop", "Buy something")
11. "other" - Other messages that don't fit above categories

IMPORTANT:
- Only respond with ONE of these exact strings
- If the message is a GENERAL greeting without a specific request, respond "greeting"
- If the message asks for a SPECIFIC action, respond with the action ID (like "action_view_menu")
- If unclear or doesn't match, respond "other"

User message: "${userMessage}"

Intent:`;

    const result = await agent.generate(prompt);
    const intent = (result.text || 'other').trim().toLowerCase();

    console.log(`🎯 Intent detected for "${userMessage}": ${intent}`);

    // Validate the response
    const validIntents = [
      'greeting', 'action_view_menu', 'action_reserve', 'action_hours',
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
      { id: 'action_view_menu', englishLabel: 'View our menu', description: 'See our full menu card' },
      { id: 'action_reserve', englishLabel: 'Book a table', description: 'Make a reservation' },
      { id: 'action_hours', englishLabel: 'Opening hours', description: 'Check when we are open' },
      { id: 'action_location', englishLabel: 'Location & Address', description: 'Get directions to the restaurant' },
      { id: 'action_contact', englishLabel: 'Contact us', description: 'Get our contact information' },
      { id: 'action_delivery', englishLabel: 'Delivery', description: 'Order for delivery' },
      { id: 'action_takeaway', englishLabel: 'Takeaway', description: 'Order for takeaway' },
      { id: 'action_gift_cards', englishLabel: 'Gift cards', description: 'Buy a gift card' },
      { id: 'action_shop', englishLabel: 'Shop', description: 'Browse our shop' },
    ];

    // Translate menu item labels using AI
    const translatedLabels = await generateListLabels(
      mastra,
      menuItems.map(item => ({ id: item.id, englishLabel: item.englishLabel })),
      language
    );

    // Translate descriptions
    const translatedDescriptions = await generateListLabels(
      mastra,
      menuItems.map(item => ({ id: item.id, englishLabel: item.description })),
      language
    );

    // Build rows with translated labels and descriptions
    const rows = menuItems.map((item, index) => ({
      id: item.id,
      title: translatedLabels[index]?.label || item.englishLabel,
      description: translatedDescriptions[index]?.label || item.description,
    }));

    // Generate body text and button text
    // Warm and friendly welcome message (a bit longer for warmth)
    const bodyText = await generateText(
      mastra,
      'Warm welcome message for La Java Bleue restaurant. Say welcome and ask how can I help you today. Around 10-15 words. Be friendly, inviting and make them feel welcome.',
      language,
      'Welcoming greeting for a restaurant chatbot - should feel warm and personal like a friendly server'
    );

    const buttonText = await generateText(
      mastra,
      'Button text meaning "View options" or "See menu". MUST be translated to the target language. Max 2 words. Examples: French="Voir les options", Spanish="Ver opciones", Polish="Zobacz opcje"',
      language,
      'Button that opens a list of restaurant services - MUST be in the target language'
    );

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
        // Send menu link with button - friendly inviting message
        const menuMessage = await generateText(
          mastra,
          'Friendly message for viewing our menu. Say something inviting about our menu like "Discover our delicious menu!" Around 10-12 words. Be warm and appetizing.',
          language
        );
        const menuButtonLabel = await generateText(
          mastra,
          'Button text for "View menu" (2 words max)',
          language
        );
        await whatsappClient.sendCTAUrlButton(
          userId,
          menuMessage,
          menuButtonLabel,
          MENU_URL
        );
        break;

      case 'action_reserve':
        // Send reservation info with button - friendly inviting message
        const reserveMessage = await generateText(
          mastra,
          'Friendly message for booking a table. Say something inviting like "Reserve your table easily!" Around 10-12 words. Be warm and welcoming.',
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
        break;

      case 'action_hours':
        // Send opening hours info - well formatted, friendly with LINE BREAKS
        const hoursMessage = await generateText(
          mastra,
          'Tell our opening hours warmly with proper formatting. Structure:\n1. Start with welcoming phrase\n2. NEW LINE then hours: "🕐 11:30 - 21:30" \n3. Same line or new line: "Open 7 days a week, continuously"\n4. NEW LINE then add something nice like "Perfect for lunch or dinner!"\n\nIMPORTANT: Use line breaks (\\n) for readability. Be welcoming and warm.',
          language
        );
        await whatsappClient.sendTextMessage(userId, hoursMessage);
        break;

      case 'action_location':
        // Send location pin directly without unnecessary message
        await whatsappClient.sendLocationMessage(
          userId,
          JAVA_BLEUE_LOCATION.latitude,
          JAVA_BLEUE_LOCATION.longitude,
          JAVA_BLEUE_LOCATION.name,
          JAVA_BLEUE_LOCATION.address
        );
        break;

      case 'action_contact':
        // Send contact info - well formatted with emojis, warmth and LINE BREAKS
        const contactMessage = await generateText(
          mastra,
          'Provide contact information in a friendly warm message with proper formatting. Structure:\n1. Welcoming sentence like "Feel free to contact us!"\n2. NEW LINE then Phone with icon: 📞 04 77 21 80 68\n3. NEW LINE then Website with icon: 🌐 https://www.restaurant-lajavableue.fr/\n\nIMPORTANT: Use actual line breaks (\\n) between each line for readability. Be welcoming and helpful.',
          language
        );
        await whatsappClient.sendTextMessage(userId, contactMessage);
        break;

      case 'action_delivery':
        // Send delivery link with button - friendly message
        const deliveryMessage = await generateText(
          mastra,
          'Friendly message for delivery service. Say something inviting about ordering delivery. Around 10-12 words. Be warm and helpful.',
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
        // Send takeaway link with button - friendly message
        const takeawayMessage = await generateText(
          mastra,
          'Friendly message for takeaway service. Say something inviting about ordering takeaway. Around 10-12 words. Be warm and helpful.',
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
        // Send gift cards link with button - friendly message with details
        const giftCardMessage = await generateText(
          mastra,
          'Friendly message for gift cards with details. Structure:\n1. Inviting sentence about gift cards being a great gift idea\n2. NEW LINE then mention: From 50€, valid for 365 days\n3. NEW LINE then something warm like "Perfect for any occasion!"\n\nIMPORTANT: Use line breaks (\\n) for readability. Be warm and enthusiastic. Around 15-20 words total.',
          language
        );
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
        // Send shop link with button - friendly message mentioning Loire recipes book with details
        const shopMessage = await generateText(
          mastra,
          'Friendly message for our shop. Structure:\n1. Inviting sentence about discovering our shop\n2. NEW LINE then mention: "Loire Recipes Book" by 25 local chefs (24.90€)\n3. NEW LINE then something warm about local gastronomy\n\nIMPORTANT: Use line breaks (\\n) for readability. Be warm and inviting. Around 15-20 words total.',
          language
        );
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
  // const database = getDatabase(); // COMMENTED OUT - Supabase disabled

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

        // const tempConversation = await database.getOrCreateConversation(userId);
        // const tempMessages = await database.getConversationHistory(tempConversation.id, 5);
        // const tempHistory = database.formatHistoryForMastra(tempMessages);
        // const languageHint = await detectUserLanguage(userId, '', mastra, tempHistory);
        const languageHint = 'fr'; // Default to French

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
        // const tempConversation = await database.getOrCreateConversation(userId);
        // const tempMessages = await database.getConversationHistory(tempConversation.id, 5);
        // const tempHistory = database.formatHistoryForMastra(tempMessages);
        // const userLanguage = await detectUserLanguage(userId, '', mastra, tempHistory);
        const userLanguage = 'fr'; // Default to French

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

    await whatsappClient.markAsRead(messageId);
    await whatsappClient.sendTypingIndicator(userId);

    // Database integration - COMMENTED OUT (Supabase disabled)
    // const conversation = await database.getOrCreateConversation(userId);
    // const isNewUser = await database.isNewUser(userId);
    const isNewUser = false; // Default to false since database is disabled

    // await database.saveMessage({
    //   conversation_id: conversation.id,
    //   wa_message_id: messageId,
    //   direction: 'in',
    //   sender: 'user',
    //   message_type: message.type,
    //   text_content: userMessage
    // });

    // const messages = await database.getConversationHistory(conversation.id, 10);
    // const conversationHistory = database.formatHistoryForMastra(messages);
    const conversationHistory = undefined; // No conversation history without database

    const detectedLanguage = await detectUserLanguage(userId, userMessage, mastra, conversationHistory);

    // Handle main menu action clicks
    if (userMessage.startsWith('action_')) {
      await handleMainMenuAction(userId, userMessage, whatsappClient, detectedLanguage, mastra);
      console.log(`✅ Processing complete for ${userId}`);
      return;
    }

    // Check if user message is a greeting or menu request using AI (works in ALL languages)
    // const isGreetingOrMenuRequest = await checkIfGreetingOrMenuRequest(userMessage, mastra);

    // Send main menu directly for greetings or menu requests
    if (!userMessage.includes('carte') && !userMessage.includes('food')) {
      await sendMainMenu(userId, whatsappClient, detectedLanguage, mastra);
      console.log(`✅ Main menu sent for greeting/menu request - ${userId}`);
      return;
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

      // await database.saveMessage({
      //   conversation_id: conversation.id,
      //   direction: 'out',
      //   sender: 'bot',
      //   message_type: 'text',
      //   text_content: agentResponse.text
      // }); // COMMENTED OUT - Supabase disabled

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
