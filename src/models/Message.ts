import { db } from '../firebase/config/firebase';

export interface Message {
  id: string;
  userId: string; // User (client) ID
  direction: 'inbound' | 'outbound'; // Inbound = from user, Outbound = from system
  content: string;
  type: 'text' | 'media' | 'template' | 'interactive'; // Message type
  mediaUrl?: string; // If message contains media
  whatsappMessageId?: string; // Original WhatsApp message ID for reference
  dealId?: string; // If related to a specific deal
  timestamp: number;
  createdAt: number;
}

export class MessageModel {
  private collectionName = 'messages';
  private collection = db.collection(this.collectionName);

  async create(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const timestamp = Date.now();
    const messageToSave = {
      ...message,
      createdAt: timestamp
    };
    
    const docRef = await this.collection.add(messageToSave);
    return {
      id: docRef.id,
      ...messageToSave
    };
  }

  async getById(id: string): Promise<Message | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    
    return {
      id: doc.id,
      ...doc.data()
    } as Message;
  }

  async getUserMessages(userId: string, limit: number = 50): Promise<Message[]> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
  }

  async getRecentMessages(hours: number = 24): Promise<Message[]> {
    const hoursAgo = Date.now() - (hours * 60 * 60 * 1000);
    
    const snapshot = await this.collection
      .where('timestamp', '>=', hoursAgo)
      .orderBy('timestamp', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
  }

  async hasRecentInteraction(userId: string, hours: number = 24): Promise<boolean> {
    const hoursAgo = Date.now() - (hours * 60 * 60 * 1000);
    
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('timestamp', '>=', hoursAgo)
      .limit(1)
      .get();
    
    return !snapshot.empty;
  }
} 