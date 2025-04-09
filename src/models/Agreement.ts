import { db } from '../firebase/config/firebase';

export interface Agreement {
  id: string;
  userId: string; // User who needs to sign
  dealId?: string; // If related to a specific deal, otherwise null for general brokerage agreement
  type: 'brokerage' | 'nda'; // Type of agreement
  status: 'pending' | 'signed' | 'declined' | 'expired';
  docusignEnvelopeId: string;
  signedDocUrl?: string; // URL to the signed document in Storage
  timestampRequested: number;
  timestampSigned?: number;
  timestampExpired?: number;
  createdAt: number;
  updatedAt: number;
}

export class AgreementModel {
  private collectionName = 'agreements';
  private collection = db.collection(this.collectionName);

  async create(agreement: Omit<Agreement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agreement> {
    const timestamp = Date.now();
    const agreementToSave = {
      ...agreement,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    const docRef = await this.collection.add(agreementToSave);
    return {
      id: docRef.id,
      ...agreementToSave
    };
  }

  async getById(id: string): Promise<Agreement | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    
    return {
      id: doc.id,
      ...doc.data()
    } as Agreement;
  }

  async getByEnvelopeId(envelopeId: string): Promise<Agreement | null> {
    const snapshot = await this.collection
      .where('docusignEnvelopeId', '==', envelopeId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as Agreement;
  }

  async update(id: string, data: Partial<Omit<Agreement, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: Date.now()
    });
  }

  async markAsSigned(id: string, signedDocUrl: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'signed',
      signedDocUrl,
      timestampSigned: Date.now(),
      updatedAt: Date.now()
    });
  }

  async markAsDeclined(id: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'declined',
      updatedAt: Date.now()
    });
  }

  async getUserAgreements(userId: string): Promise<Agreement[]> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Agreement));
  }

  async getPendingAgreements(): Promise<Agreement[]> {
    const snapshot = await this.collection
      .where('status', '==', 'pending')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Agreement));
  }

  async hasUserSignedAgreement(userId: string, type: 'brokerage' | 'nda', dealId?: string): Promise<boolean> {
    let query = this.collection
      .where('userId', '==', userId)
      .where('type', '==', type)
      .where('status', '==', 'signed');
    
    if (dealId) {
      query = query.where('dealId', '==', dealId);
    } else {
      // For general agreements (not deal specific)
      query = query.where('dealId', '==', null);
    }
    
    const snapshot = await query.limit(1).get();
    return !snapshot.empty;
  }
} 