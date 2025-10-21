/**
 * La Java Bleue WhatsApp Bot
 * Main entry point - Express server with Meta WhatsApp Business API webhooks
 */

import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { createWhatsAppClient } from './whatsapp/client.js';
import { createMastraInstance } from './agent/mastra.js';
import { verifyWebhook, handleWebhook } from './whatsapp/webhook.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'META_WHATSAPP_TOKEN',
  'META_WHATSAPP_PHONE_NUMBER_ID',
  'META_WEBHOOK_VERIFY_TOKEN',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.error('Please check your .env file and ensure all variables are set.');
    process.exit(1);
  }
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from assets folder (for PDF menus)
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetsPath = join(__dirname, '..', 'assets');
app.use('/menus', express.static(assetsPath));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Initialize WhatsApp client and Mastra
let whatsappClient: ReturnType<typeof createWhatsAppClient>;
let mastraInstance: ReturnType<typeof createMastraInstance>;

try {
  whatsappClient = createWhatsAppClient();
  mastraInstance = createMastraInstance();
  console.log('✅ WhatsApp client and Mastra agent initialized');
} catch (error: any) {
  console.error('❌ Failed to initialize services:', error.message);
  process.exit(1);
}

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    service: 'La Java Bleue WhatsApp Bot',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Webhook verification endpoint (GET)
// Meta will call this to verify your webhook
app.get('/webhook', (req: Request, res: Response) => {
  verifyWebhook(req, res);
});

// Webhook event handler (POST)
// Meta sends incoming messages and events here
app.post('/webhook', async (req: Request, res: Response) => {
  await handleWebhook(req, res, whatsappClient, mastraInstance);
});

// Test endpoint to verify server is accessible
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('\n🚀 La Java Bleue WhatsApp Bot is running!');
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`🌐 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`💡 Make sure to expose this with ngrok and configure it in Meta Developer Console\n`);
  console.log('🍖 Ready to assist guests with reservations and menu inquiries!\n');
  console.log('⏳ Server is running... Press Ctrl+C to stop\n');
});

// Prevent the server from closing
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Keep the process alive
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\n⏳ Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏳ Shutting down gracefully...');
  process.exit(0);
});
