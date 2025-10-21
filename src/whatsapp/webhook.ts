/**
 * WhatsApp Webhook Handler for Meta Business API
 * Handles incoming messages and webhook verification
 *
 * SIMPLIFIED VERSION - Menus only, no reservation flow
 */

import { Request, Response } from 'express';
import { WhatsAppClient } from './client.js';
import { Mastra } from '@mastra/core';
import { processUserMessage, detectLanguageWithMastra } from '../agent/mastra.js';
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

// Caribbean Food Carbet location
const CARIBBEAN_FOOD_LOCATION = {
  latitude: 14.697429195748091,  // Exact coordinates for Caribbean Food Carbet
  longitude: -61.18028413084514,
  name: 'Caribbean Food Carbet',
  address: 'Le Coin, Le Carbet 97221, Martinique'
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
 * Detect user's language from conversation history
 * Uses the most recent text messages to detect language, ignoring button IDs
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
              return detectedLanguage;
            }
          }
        }
      }
      console.log('🌍 Button click detected, no valid history - defaulting to English');
      return 'en';
    }

    const detectedLanguage = await detectLanguageWithMastra(mastra, userMessage);
    return detectedLanguage;
  } catch (error: any) {
    console.error('❌ Error detecting language:', error);
    return 'en';
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

// MENU CONFIGURATIONS REMOVED - Caribbean Food uses single Canva menu link
// The agent will share the menu link directly in text responses
const MENU_URL = 'https://www.canva.com/design/DAGJ58x1g9o/WOx7t3_GavjWjygcZ3TBIw/view?utm_content=DAGJ58x1g9o&utm_campaign=designshare&utm_medium=link&utm_source=viewer#2';

// MENU BUTTON FUNCTIONS COMMENTED OUT - No longer using interactive menu buttons
// Caribbean Food uses a single Canva link shared via text message

/*
async function sendMenuButtons(
  userId: string,
  whatsappClient: WhatsAppClient,
  language: string,
  mastra: Mastra
): Promise<void> {
  // Function removed - no longer using interactive menu buttons
}

async function handleMenuButtonClick(
  userId: string,
  buttonId: string,
  whatsappClient: WhatsAppClient,
  language: string,
  mastra: Mastra
): Promise<void> {
  // Function removed - no longer using menu button clicks
}
*/

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
        const languageHint = 'fr'; // Default to French for Martinique

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
        const locationResponse = `Merci pour votre localisation ! Voici notre adresse : ${CARIBBEAN_FOOD_LOCATION.address}`;

        await whatsappClient.sendTextMessage(userId, locationResponse);

        await whatsappClient.sendLocationMessage(
          userId,
          CARIBBEAN_FOOD_LOCATION.latitude,
          CARIBBEAN_FOOD_LOCATION.longitude,
          CARIBBEAN_FOOD_LOCATION.name,
          CARIBBEAN_FOOD_LOCATION.address
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

    // MENU BUTTON HANDLING REMOVED - No longer using interactive buttons
    // if (userMessage === 'action_view_menus') {
    //   await sendMenuButtons(userId, whatsappClient, detectedLanguage, mastra);
    //   console.log(`✅ Processing complete for ${userId}`);
    //   return;
    // }

    // if (userMessage.startsWith('menu_')) {
    //   await handleMenuButtonClick(userId, userMessage, whatsappClient, detectedLanguage, mastra);
    //   console.log(`✅ Processing complete for ${userId}`);
    //   return;
    // }

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

    // Send response (with or without menu button)
    if (agentResponse.text && agentResponse.text.trim().length > 0) {
      // If menu button should be sent, include it in the same message
      if (agentResponse.sendMenuButton) {
        console.log(`📋 Sending response with menu button to ${userId}`);

        // Translate "View menu" button label to user's language
        const menuButtonLabel = await generateText(
          mastra,
          'Button text for "View menu" (2-3 words max)',
          userLanguage,
          'Button that opens the restaurant menu in a web browser'
        );

        await whatsappClient.sendCTAUrlButton(
          userId,
          agentResponse.text, // Use bot's response as the message body
          menuButtonLabel,
          MENU_URL
        );
        console.log(`✅ Response with menu button sent to ${userId} (button: "${menuButtonLabel}")`);
      } else {
        // Send regular text message
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
          CARIBBEAN_FOOD_LOCATION.latitude,
          CARIBBEAN_FOOD_LOCATION.longitude,
          CARIBBEAN_FOOD_LOCATION.name,
          CARIBBEAN_FOOD_LOCATION.address
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
          "Je m'excuse, mais je rencontre un problème technique. Veuillez réessayer dans un moment, ou nous contacter directement:\n\n📞 06 96 33 20 35\n📧 caribbeanfoodnord@gmail.com"
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
