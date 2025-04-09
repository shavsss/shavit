import axios from 'axios';
import dotenv from 'dotenv';
import { TextMessage, TemplateMessage, InteractiveMessage, SendMessageResponse } from '../types/whatsapp';
import { MessageModel } from '../models/Message';

dotenv.config();

const messageModel = new MessageModel();
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v18.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Send a simple text message to a WhatsApp user
 */
export async function sendTextMessage(
  phoneNumberId: string,
  recipientNumber: string,
  messageText: string,
  previewUrl = false
): Promise<string> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
    
    const requestBody: TextMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientNumber,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: messageText
      }
    };
    
    const response = await axios.post<SendMessageResponse>(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Message sent successfully:', response.data);
    return response.data.messages[0].id;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

/**
 * Send a template message to a WhatsApp user
 */
export async function sendTemplateMessage(
  phoneNumberId: string,
  recipientNumber: string,
  templateName: string,
  languageCode: string = 'he',
  components: any[] = []
): Promise<string> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
    
    const requestBody: TemplateMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientNumber,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        }
      }
    };
    
    if (components.length > 0) {
      requestBody.template.components = components;
    }
    
    const response = await axios.post<SendMessageResponse>(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Template message sent successfully:', response.data);
    return response.data.messages[0].id;
  } catch (error) {
    console.error('Error sending WhatsApp template message:', error);
    throw error;
  }
}

/**
 * Send an interactive list message to a WhatsApp user
 */
export async function sendInteractiveListMessage(
  phoneNumberId: string,
  recipientNumber: string,
  headerText: string,
  bodyText: string,
  sections: {
    title?: string;
    rows: {
      id: string;
      title: string;
      description?: string;
    }[];
  }[],
  buttonText: string = 'View Options'
): Promise<string> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
    
    const requestBody: InteractiveMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientNumber,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: headerText
        },
        body: {
          text: bodyText
        },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    };
    
    const response = await axios.post<SendMessageResponse>(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Interactive list message sent successfully:', response.data);
    return response.data.messages[0].id;
  } catch (error) {
    console.error('Error sending WhatsApp interactive list message:', error);
    throw error;
  }
}

/**
 * Send interactive buttons message to a WhatsApp user
 */
export async function sendButtonsMessage(
  phoneNumberId: string,
  recipientNumber: string,
  headerText: string,
  bodyText: string,
  buttons: {
    id: string;
    title: string;
  }[],
  footerText?: string
): Promise<string> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
    
    const requestBody: InteractiveMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientNumber,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: headerText
        },
        body: {
          text: bodyText
        },
        action: {
          buttons: buttons.map(button => ({
            type: 'reply',
            reply: {
              id: button.id,
              title: button.title
            }
          }))
        }
      }
    };
    
    if (footerText) {
      requestBody.interactive.footer = {
        text: footerText
      };
    }
    
    const response = await axios.post<SendMessageResponse>(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Interactive buttons message sent successfully:', response.data);
    return response.data.messages[0].id;
  } catch (error) {
    console.error('Error sending WhatsApp interactive buttons message:', error);
    throw error;
  }
}

/**
 * Send a media message to a WhatsApp user
 */
export async function sendMediaMessage(
  phoneNumberId: string,
  recipientNumber: string,
  mediaType: 'image' | 'document' | 'audio' | 'video',
  mediaUrl: string,
  caption?: string
): Promise<string> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
    
    const requestBody: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientNumber,
      type: mediaType,
      [mediaType]: {
        link: mediaUrl
      }
    };
    
    if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
      requestBody[mediaType].caption = caption;
    }
    
    const response = await axios.post<SendMessageResponse>(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`${mediaType} message sent successfully:`, response.data);
    return response.data.messages[0].id;
  } catch (error) {
    console.error(`Error sending WhatsApp ${mediaType} message:`, error);
    throw error;
  }
} 