import * as functions from 'firebase-functions';
import { whatsappWebhook } from './webhooks/whatsappWebhook';
import { scheduleWeeklyDeals } from './services/scheduledServices';
import { docusignWebhook } from './webhooks/docusignWebhook';

// WhatsApp Webhook
export const whatsapp = functions.https.onRequest(whatsappWebhook);

// DocuSign Webhook
export const docusign = functions.https.onRequest(docusignWebhook);

// Scheduled weekly deals message
export const weeklyDeals = functions.pubsub
  .schedule('every monday 09:00')
  .timeZone('Asia/Jerusalem')
  .onRun(scheduleWeeklyDeals);

// Export other functions as needed 