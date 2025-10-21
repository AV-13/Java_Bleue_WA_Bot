/**
 * Dynamic Translation Module
 * Uses AI to generate text in any language, eliminating hardcoded translations
 */

import { Mastra } from '@mastra/core';
import { getCaribbeanFoodAgent } from '../agent/mastra.js';

/**
 * Generate translated text using AI for any language
 * This replaces the hardcoded translation dictionary
 *
 * @param mastra - Mastra instance
 * @param textKey - Description of what text to generate (e.g., "view menus button text")
 * @param language - Target language code (ISO 639-1 or full language name)
 * @param context - Optional context for better translation
 * @returns Generated text in the target language
 */
export async function generateText(
  mastra: Mastra,
  textKey: string,
  language: string,
  context?: string
): Promise<string> {
  try {
    const agent = getCaribbeanFoodAgent(mastra);

    const contextInfo = context ? `\n\nContext: ${context}` : '';

    const prompt = `You are a professional translator for Caribbean Food Carbet, a beachside Caribbean restaurant in Martinique.

Generate ONLY the following text in ${language} language. Return ONLY the translated text with no explanations, quotes, or additional formatting.

Text to generate: ${textKey}${contextInfo}

Translation:`;

    const result = await agent.generate(prompt);
    const generatedText = (result.text || '').trim();

    console.log(`🌍 Generated text for "${textKey}" in ${language}: "${generatedText}"`);
    return generatedText;
  } catch (error: any) {
    console.error(`❌ Error generating text for "${textKey}" in ${language}:`, error);
    // Fallback to English defaults
    return getEnglishFallback(textKey);
  }
}

/**
 * Generate a complete menu message with accompanying text
 *
 * @param mastra - Mastra instance
 * @param menuType - Type of menu (alacarte, wagyu, wine, drinks)
 * @param language - Target language code
 * @returns Generated message in the target language
 */
export async function generateMenuMessage(
  mastra: Mastra,
  menuType: string,
  language: string
): Promise<string> {
  const menuNames: Record<string, string> = {
    'alacarte': 'à la carte menu',
    'wagyu': 'Wagyu menu',
    'wine': 'wine menu',
    'drinks': 'drinks menu'
  };

  const menuName = menuNames[menuType] || menuType;
  return generateText(
    mastra,
    `A short message (max 5 words) saying "Here is the ${menuName}"`,
    language,
    'This accompanies a PDF document being sent to the user'
  );
}

/**
 * Generate interactive button/list prompts
 *
 * @param mastra - Mastra instance
 * @param promptType - Type of prompt (menu_selection, party_size, time_selection, etc.)
 * @param language - Target language code
 * @param additionalContext - Additional context for the prompt
 * @returns Generated prompt text
 */
export async function generatePrompt(
  mastra: Mastra,
  promptType: string,
  language: string,
  additionalContext?: string
): Promise<string> {
  const promptDescriptions: Record<string, string> = {
    'choose_menu_prompt': 'Tell the user we offer 4 different menus and ask which one they want to see',
    'choose_menu_button': 'Button text for "Choose a menu" (2-3 words max)',
    'party_size_prompt': 'Ask how many people they want to reserve for',
    'party_size_button': 'Button text for "Choose" or "Select" (1-2 words)',
    'date_picker_prompt': 'Ask what date they would like to make their reservation. Keep it very short',
    'date_request': 'Ask what date they want to reserve, mention format YYYY-MM-DD with example',
    'time_prompt': 'Ask what time they would like to arrive',
    'time_button': 'Button text for "Choose time" (2-3 words max)',
    'duration_prompt': 'Ask how long they want their meal to be',
    'duration_button': 'Button text for "Choose duration" (2-3 words max)',
    'reservation_summary': 'Say "Perfect! Here\'s the link to complete your reservation:" followed by a summary'
  };

  const description = promptDescriptions[promptType] || promptType;
  const context = additionalContext ? `${description}. ${additionalContext}` : description;

  return generateText(mastra, context, language, 'For a WhatsApp chatbot');
}

/**
 * Generate reservation confirmation message with details
 *
 * @param mastra - Mastra instance
 * @param language - Target language code
 * @param reservationDetails - Reservation details
 * @returns Formatted confirmation message
 */
export async function generateReservationConfirmation(
  mastra: Mastra,
  language: string,
  reservationDetails: {
    partySize: number;
    date: string;
    time: string;
    duration: number;
    url: string;
  }
): Promise<string> {
  try {
    const agent = getCaribbeanFoodAgent(mastra);

    const prompt = `Generate a reservation confirmation message in ${language} for a restaurant WhatsApp bot.

Include:
1. "Perfect! Here's the link to complete your reservation:"
2. The reservation URL: ${reservationDetails.url}
3. A summary section with:
   - Party size: ${reservationDetails.partySize} person(s)
   - Date: ${reservationDetails.date}
   - Time: ${reservationDetails.time}
   - Duration: ${reservationDetails.duration} minutes

Use appropriate emojis (👥 for party size, 📅 for date, 🕐 for time, ⏱️ for duration).
Keep it concise and friendly.

Message:`;

    const result = await agent.generate(prompt);
    return (result.text || '').trim();
  } catch (error: any) {
    console.error('❌ Error generating reservation confirmation:', error);
    // Fallback
    const { partySize, date, time, duration, url } = reservationDetails;
    return `Perfect! Here's the link to complete your reservation:\n\n${url}\n\nSummary:\n👥 ${partySize} person(s)\n📅 ${date}\n🕐 ${time}\n⏱️ ${duration} minutes`;
  }
}

/**
 * Generate error message in user's language
 *
 * @param mastra - Mastra instance
 * @param language - Target language code
 * @param errorType - Type of error (technical, not_found, etc.)
 * @returns Error message in target language
 */
export async function generateErrorMessage(
  mastra: Mastra,
  language: string,
  errorType: 'technical' | 'not_found' | 'invalid_input' = 'technical'
): Promise<string> {
  const errorDescriptions: Record<string, string> = {
    'technical': 'Apologize for a technical issue and provide contact information: Phone: +44 (0)20 7734 6066, Email: reservations@incalondon.com',
    'not_found': 'Politely say the requested information was not found and offer to help with something else',
    'invalid_input': 'Politely indicate the input format is incorrect and explain what format is expected'
  };

  return generateText(
    mastra,
    errorDescriptions[errorType],
    language,
    'Error message for a restaurant chatbot'
  );
}

/**
 * English fallbacks for critical texts (in case AI fails)
 */
function getEnglishFallback(textKey: string): string {
  const fallbacks: Record<string, string> = {
    'view_menus_button': 'View Menus',
    'choose_menu_button': 'Choose a menu',
    'party_size_button': 'Choose',
    'time_button': 'Choose time',
    'duration_button': 'Choose duration',
  };

  return fallbacks[textKey] || textKey;
}

/**
 * Generate labels for interactive list items (menu names, times, etc.)
 *
 * @param mastra - Mastra instance
 * @param items - Array of items to translate
 * @param language - Target language code
 * @returns Array of translated items
 */
export async function generateListLabels(
  mastra: Mastra,
  items: Array<{ id: string; englishLabel: string }>,
  language: string
): Promise<Array<{ id: string; label: string }>> {
  try {
    const agent = getCaribbeanFoodAgent(mastra);

    const itemsList = items.map(item => `- ${item.englishLabel}`).join('\n');

    const prompt = `Translate these list items to ${language}. Return ONLY the translations, one per line, in the same order. No numbering, no extra text.

Items to translate:
${itemsList}

Translations:`;

    const result = await agent.generate(prompt);
    const translations = (result.text || '').trim().split('\n').filter((line: string) => line.trim());

    // Map translations back to items
    return items.map((item, index) => ({
      id: item.id,
      label: translations[index] || item.englishLabel
    }));
  } catch (error: any) {
    console.error('❌ Error generating list labels:', error);
    // Fallback to English
    return items.map(item => ({ id: item.id, label: item.englishLabel }));
  }
}
