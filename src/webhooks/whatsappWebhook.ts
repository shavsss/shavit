import * as functions from 'firebase-functions';
import { db } from '../firebase/config/firebase';
import { User, UserModel } from '../models/User';
import { MessageModel } from '../models/Message';
import { WebhookRequestBody, WebhookMessageReceived, MessageType } from '../types/whatsapp';
import { handleTextMessage } from '../services/whatsappMessageHandler';
import * as crypto from 'crypto';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
import axios from 'axios';

dotenv.config();

const userModel = new UserModel();
const messageModel = new MessageModel();

/**
 * Validates the WhatsApp webhook request using the app secret
 */
const validateWhatsAppWebhook = (
  signature: string | undefined,
  body: string
): boolean => {
  if (!signature) return false;

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error('WHATSAPP_APP_SECRET is not defined');
    return false;
  }

  const hmac = crypto.createHmac('sha256', appSecret);
  const expectedSignature = `sha256=${hmac.update(body).digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Gets or creates a user in Firestore based on the WhatsApp sender
 */
const getOrCreateUser = async (phoneNumber: string): Promise<User> => {
  // Format the phone number to ensure consistent formatting
  const formattedPhoneNumber = phoneNumber
    .replace(/\s+/g, '')
    .replace(/^\+/, '');

  // Try to fetch the user
  let user = await userModel.getByPhoneNumber(formattedPhoneNumber);

  // If the user doesn't exist, create a new one with default values
  if (!user) {
    // Get the first admin agent to assign as default
    const adminAgentSnapshot = await db
      .collection('agents')
      .where('role', '==', 'admin')
      .limit(1)
      .get();

    let agentId = '';
    if (!adminAgentSnapshot.empty) {
      agentId = adminAgentSnapshot.docs[0].id;
    }

    user = await userModel.create({
      fullName: 'WhatsApp User', // Default name until we get more info
      phoneNumber: formattedPhoneNumber,
      agreementSigned: false,
      agentId
    });

    console.log(`Created new user with ID: ${user.id}`);
  }

  return user;
};

/**
 * Webhook handler for WhatsApp Cloud API
 */
export const whatsappWebhook = functions.https.onRequest(async (req: Request, res: Response) => {
  // Verification request from WhatsApp (setup phase)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (
      mode === 'subscribe' &&
      token === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      console.log('Webhook verified successfully');
      return res.status(200).send(challenge);
    }

    console.error('Failed webhook verification');
    return res.sendStatus(403);
  }

  // Regular POST request from WhatsApp (message received)
  if (req.method === 'POST') {
    const signature = req.headers['x-hub-signature-256'] as string;
    const requestBody = JSON.stringify(req.body);

    // Verify signature if app secret is set
    if (process.env.WHATSAPP_APP_SECRET) {
      const isValid = validateWhatsAppWebhook(signature, requestBody);
      if (!isValid) {
        console.error('Invalid signature');
        return res.sendStatus(403);
      }
    }

    const data = req.body as WebhookRequestBody;

    // Handle all incoming webhook messages
    try {
      if (data && data.entry && data.entry.length > 0) {
        for (const entry of data.entry) {
          for (const change of entry.changes) {
            if (
              change.field === 'messages' &&
              change.value &&
              change.value.messages &&
              change.value.messages.length > 0
            ) {
              for (const message of change.value.messages) {
                await processIncomingMessage(message, change.value.metadata.phone_number_id);
              }
            }
          }
        }
      }

      console.log('Webhook processed successfully');
      return res.sendStatus(200);
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.sendStatus(500);
    }
  }

  return res.sendStatus(404);
});

/**
 * Process an incoming WhatsApp message
 */
async function processIncomingMessage(
  message: WebhookMessageReceived,
  phoneNumberId: string
): Promise<void> {
  try {
    // Get the sender's WhatsApp ID
    const from = message.from;
    
    // Get or create the user
    const user = await getOrCreateUser(from);
    
    // Record the message in our database
    const messageType = message.type as MessageType;
    
    let content = '';
    let mediaUrl = undefined;
    
    // Handle different message types
    switch (messageType) {
      case 'text':
        content = message.text?.body || '';
        break;
      case 'image':
      case 'document':
      case 'audio':
      case 'video':
        content = message[messageType]?.caption || `Received ${messageType}`;
        mediaUrl = message[messageType]?.id; // ID to retrieve media later
        break;
      case 'interactive':
        // Handle button responses
        if (message.interactive?.button_reply) {
          content = `Button: ${message.interactive.button_reply.id}`;
        } else if (message.interactive?.list_reply) {
          content = `List: ${message.interactive.list_reply.id}`;
        }
        break;
      default:
        content = `Received message of type: ${messageType}`;
    }
    
    // Save the message to our database
    await messageModel.create({
      userId: user.id,
      direction: 'inbound',
      content,
      type: messageType,
      mediaUrl,
      whatsappMessageId: message.id,
      timestamp: Date.now()
    });
    
    // Process the message based on type
    if (messageType === 'text') {
      await handleTextMessage(user, content, phoneNumberId);
    } else if (messageType === 'interactive') {
      // Handle interactive messages in a separate function
      // TODO: Implement handleInteractiveMessage
    }
    
    console.log(`Processed message from ${from}`);
  } catch (error) {
    console.error('Error processing message:', error);
    throw error;
  }
} 