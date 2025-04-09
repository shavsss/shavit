import { db, admin } from '../firebase/config/firebase';

export interface Deal {
  id: string;
  title: string;
  shortDescription: string;
  fullDetails?: string;
  location: {
    city: string;
    area?: string;
    address?: string; // Full address only visible after signing NDA
  };
  propertyType: string; // 'office', 'retail', 'residential', etc.
  size?: number; // Size in square meters
  price?: {
    amount?: number;
    range?: {
      min: number;
      max: number;
    };
    currency: string;
  };
  status: 'active' | 'sold' | 'unavailable';
  agentId: string; // Agent who created/manages this deal
  visibleTo?: string[]; // User IDs who have access to this deal
  isAnonymous?: boolean; // If submitted anonymously by a user
  submittedByUser?: string; // User ID if submitted by a user
  images?: string[]; // References to Storage files
  documents?: string[]; // References to Storage files
  createdAt: number;
  updatedAt: number;
}

export class DealModel {
  private collectionName = 'deals';
  private collection = db.collection(this.collectionName);

  async create(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> {
    const timestamp = Date.now();
    const dealToSave = {
      ...deal,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    const docRef = await this.collection.add(dealToSave);
    return {
      id: docRef.id,
      ...dealToSave
    };
  }

  async getById(id: string): Promise<Deal | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    
    return {
      id: doc.id,
      ...doc.data()
    } as Deal;
  }

  async update(id: string, data: Partial<Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: Date.now()
    });
  }

  async getAllActiveDeals(): Promise<Deal[]> {
    const snapshot = await this.collection
      .where('status', '==', 'active')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Deal));
  }

  async getDealsByAgentId(agentId: string): Promise<Deal[]> {
    const snapshot = await this.collection
      .where('agentId', '==', agentId)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Deal));
  }

  async getDealsByPropertyType(propertyType: string): Promise<Deal[]> {
    const snapshot = await this.collection
      .where('propertyType', '==', propertyType)
      .where('status', '==', 'active')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Deal));
  }

  async getDealsByLocation(city: string): Promise<Deal[]> {
    const snapshot = await this.collection
      .where('location.city', '==', city)
      .where('status', '==', 'active')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Deal));
  }

  async getAnonymousDeals(): Promise<Deal[]> {
    const snapshot = await this.collection
      .where('isAnonymous', '==', true)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Deal));
  }

  async addUserVisibility(dealId: string, userId: string): Promise<void> {
    await this.collection.doc(dealId).update({
      visibleTo: admin.firestore.FieldValue.arrayUnion(userId),
      updatedAt: Date.now()
    });
  }
} 