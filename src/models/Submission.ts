import { db } from '../firebase/config/firebase';

export interface Submission {
  id: string;
  submittedBy: string; // User ID who submitted
  title?: string;
  description?: string;
  location?: {
    city?: string;
    area?: string;
  };
  propertyType?: string;
  size?: number;
  price?: {
    amount?: number;
    range?: {
      min?: number;
      max?: number;
    };
    currency?: string;
  };
  status: 'new' | 'processing' | 'approved' | 'rejected';
  files?: string[]; // References to files in Storage
  notes?: string; // Agent's internal notes
  convertedToDealId?: string; // If this was converted to a full deal
  createdAt: number;
  updatedAt: number;
}

export class SubmissionModel {
  private collectionName = 'submissions';
  private collection = db.collection(this.collectionName);

  async create(submission: Omit<Submission, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Submission> {
    const timestamp = Date.now();
    const submissionToSave = {
      ...submission,
      status: 'new' as const,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    const docRef = await this.collection.add(submissionToSave);
    return {
      id: docRef.id,
      ...submissionToSave
    };
  }

  async getById(id: string): Promise<Submission | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    
    return {
      id: doc.id,
      ...doc.data()
    } as Submission;
  }

  async update(id: string, data: Partial<Omit<Submission, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: Date.now()
    });
  }

  async getAllSubmissions(): Promise<Submission[]> {
    const snapshot = await this.collection
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Submission));
  }

  async getNewSubmissions(): Promise<Submission[]> {
    const snapshot = await this.collection
      .where('status', '==', 'new')
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Submission));
  }

  async markAsProcessing(id: string, notes?: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'processing',
      notes,
      updatedAt: Date.now()
    });
  }

  async markAsApproved(id: string, dealId: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'approved',
      convertedToDealId: dealId,
      updatedAt: Date.now()
    });
  }

  async markAsRejected(id: string, notes?: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'rejected',
      notes,
      updatedAt: Date.now()
    });
  }

  async getUserSubmissions(userId: string): Promise<Submission[]> {
    const snapshot = await this.collection
      .where('submittedBy', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Submission));
  }
} 