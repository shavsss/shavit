import * as functions from 'firebase-functions';
import { Request, Response } from 'express';
import { db, storage, admin } from '../firebase/config/firebase';
import { AgreementModel } from '../models/Agreement';
import { UserModel } from '../models/User';
import { MessageModel } from '../models/Message';
import { sendTextMessage } from '../services/whatsappApi';
import dotenv from 'dotenv';

dotenv.config();

const agreementModel = new AgreementModel();
const userModel = new UserModel();
const messageModel = new MessageModel();

interface DocuSignWebhookEvent {
  event: string;
  data: {
    envelopeId: string;
    envelopeSummary?: {
      status: string;
      envelopeId: string;
      statusDateTime: string;
      recipientStatuses?: {
        status: string;
        email: string;
        userName: string;
      }[];
    };
  };
}

/**
 * Webhook handler for DocuSign Connect notifications
 */
export const docusignWebhook = functions.https.onRequest(async (req: Request, res: Response) => {
  try {
    // Basic security check - in production, implement proper auth
    const token = req.query.token;
    if (token !== process.env.DOCUSIGN_WEBHOOK_TOKEN) {
      console.error('Invalid webhook token');
      res.status(403).send('Forbidden');
      return;
    }

    // Parse the webhook data
    const data: DocuSignWebhookEvent = req.body;
    console.log('Received DocuSign webhook:', data.event);

    // We're interested in envelope completed events
    if (data.event !== 'envelope-completed' && data.event !== 'envelope-status-change') {
      console.log('Event not handled, ignoring');
      res.status(200).send('Event ignored');
      return;
    }

    const envelopeId = data.data.envelopeId;
    if (!envelopeId) {
      console.error('Missing envelope ID');
      res.status(400).send('Bad request: Missing envelope ID');
      return;
    }

    // Find the agreement in our database
    const agreement = await agreementModel.getByEnvelopeId(envelopeId);
    if (!agreement) {
      console.error(`Agreement not found for envelope ID: ${envelopeId}`);
      res.status(404).send('Agreement not found');
      return;
    }

    // Get the envelope status
    const envelopeStatus = data.data.envelopeSummary?.status;
    if (!envelopeStatus) {
      console.error('Missing envelope status');
      res.status(400).send('Bad request: Missing envelope status');
      return;
    }

    // Process based on status
    switch (envelopeStatus.toLowerCase()) {
      case 'completed':
        await handleCompletedEnvelope(agreement.id, envelopeId);
        break;
      case 'declined':
        await handleDeclinedEnvelope(agreement.id);
        break;
      case 'voided':
        await handleVoidedEnvelope(agreement.id);
        break;
      default:
        console.log(`Envelope status '${envelopeStatus}' not specifically handled`);
        break;
    }

    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error processing DocuSign webhook:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * Handle a completed envelope (signed by all parties)
 */
async function handleCompletedEnvelope(agreementId: string, envelopeId: string): Promise<void> {
  try {
    // Get the agreement details
    const agreement = await agreementModel.getById(agreementId);
    if (!agreement) {
      throw new Error(`Agreement ${agreementId} not found`);
    }

    // Get user details
    const user = await userModel.getById(agreement.userId);
    if (!user) {
      throw new Error(`User ${agreement.userId} not found`);
    }

    // In a real implementation, download the signed PDF from DocuSign
    // This would use the DocuSign SDK to get the document
    // For demo purposes, we'll just create a placeholder URL
    
    // Example of storing a signed document in Firebase Storage:
    const signedDocPath = `agreements/${agreement.userId}/${envelopeId}.pdf`;
    const signedDocUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${signedDocPath}`;

    // Update the agreement to "signed" status with the document URL
    await agreementModel.markAsSigned(agreementId, signedDocUrl);

    // Update user's agreement status
    await userModel.update(user.id, {
      agreementSigned: true
    });

    // Get the phone number ID for sending WhatsApp messages
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    // Send a WhatsApp confirmation to the user
    if (phoneNumberId) {
      const message = 'תודה על חתימת הסכם התיווך הדיגיטלי. כעת תוכל/י לקבל פרטים מלאים על הנכסים שיעניינו אותך. לצפייה בעסקאות זמינות, הקלד/י "עסקאות".';
      
      const messageId = await sendTextMessage(phoneNumberId, user.phoneNumber, message);
      
      // Record this message
      await messageModel.create({
        userId: user.id,
        direction: 'outbound',
        content: message,
        type: 'text',
        whatsappMessageId: messageId,
        timestamp: Date.now()
      });
    }

    // Notify the agent (in a real implementation, this might be through a dashboard notification)
    console.log(`Agreement ${agreementId} has been signed by user ${user.fullName}`);

  } catch (error) {
    console.error('Error handling completed envelope:', error);
    throw error;
  }
}

/**
 * Handle a declined envelope
 */
async function handleDeclinedEnvelope(agreementId: string): Promise<void> {
  try {
    // Update the agreement status to declined
    await agreementModel.markAsDeclined(agreementId);

    // Get the agreement details
    const agreement = await agreementModel.getById(agreementId);
    if (!agreement) {
      throw new Error(`Agreement ${agreementId} not found`);
    }

    // Get user details
    const user = await userModel.getById(agreement.userId);
    if (!user) {
      throw new Error(`User ${agreement.userId} not found`);
    }

    // Get the phone number ID for sending WhatsApp messages
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    // Send a WhatsApp follow-up to the user
    if (phoneNumberId) {
      const message = 'ראינו שבחרת שלא לחתום על הסכם התיווך כרגע. אם יש לך שאלות או חששות, אנא צור/י קשר עם המתווך שלך. נשמח לסייע לך בכל דרך אפשרית.';
      
      const messageId = await sendTextMessage(phoneNumberId, user.phoneNumber, message);
      
      // Record this message
      await messageModel.create({
        userId: user.id,
        direction: 'outbound',
        content: message,
        type: 'text',
        whatsappMessageId: messageId,
        timestamp: Date.now()
      });
    }

    // Notify the agent
    console.log(`Agreement ${agreementId} has been declined by user ${user.fullName}`);

  } catch (error) {
    console.error('Error handling declined envelope:', error);
    throw error;
  }
}

/**
 * Handle a voided envelope
 */
async function handleVoidedEnvelope(agreementId: string): Promise<void> {
  try {
    // Update the agreement status to expired
    await agreementModel.update(agreementId, {
      status: 'expired',
      timestampExpired: Date.now()
    });

    console.log(`Agreement ${agreementId} has been marked as expired`);
  } catch (error) {
    console.error('Error handling voided envelope:', error);
    throw error;
  }
} 