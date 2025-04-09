import { db } from '../firebase/config/firebase';

export interface User {
  id: string;
  fullName: string;
  phoneNumber: string; // Unique identifier matching WhatsApp
  email?: string; // For DocuSign
  role?: string; // Job title or company
  preferences?: {
    propertyTypes?: string[];
    locations?: string[];
  };
  agreementSigned: boolean;
  agentId: string; // ID of the agent managing this user
  lastDealSent?: {
    dealId: string;
    timestamp: number;
  };
  createdAt: number;
  updatedAt: number;
}

export class UserModel {
  private collectionName = 'users';
  private collection = db.collection(this.collectionName);

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const timestamp = Date.now();
    const userToSave = {
      ...user,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    const docRef = await this.collection.add(userToSave);
    return {
      id: docRef.id,
      ...userToSave
    };
  }

  async getById(id: string): Promise<User | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    
    return {
      id: doc.id,
      ...doc.data()
    } as User;
  }

  async getByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const snapshot = await this.collection
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as User;
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: Date.now()
    });
  }

  async getUsersByAgentId(agentId: string): Promise<User[]> {
    const snapshot = await this.collection
      .where('agentId', '==', agentId)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));
  }

  async getUsersWithAgreementSigned(): Promise<User[]> {
    const snapshot = await this.collection
      .where('agreementSigned', '==', true)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));
  }
} 