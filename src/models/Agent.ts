import { db, admin } from '../firebase/config/firebase';

export interface Agent {
  id: string;
  uid: string; // Firebase Auth UID
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'agent'; // admin = main broker, agent = regular agent
  clients?: string[]; // List of user IDs assigned to this agent
  createdAt: number;
  updatedAt: number;
}

export class AgentModel {
  private collectionName = 'agents';
  private collection = db.collection(this.collectionName);

  async create(agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
    const timestamp = Date.now();
    const agentToSave = {
      ...agent,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    const docRef = await this.collection.add(agentToSave);
    return {
      id: docRef.id,
      ...agentToSave
    };
  }

  async getById(id: string): Promise<Agent | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    
    return {
      id: doc.id,
      ...doc.data()
    } as Agent;
  }

  async getByUid(uid: string): Promise<Agent | null> {
    const snapshot = await this.collection
      .where('uid', '==', uid)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as Agent;
  }

  async update(id: string, data: Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: Date.now()
    });
  }

  async getAllAgents(): Promise<Agent[]> {
    const snapshot = await this.collection.get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Agent));
  }

  async getAdminAgents(): Promise<Agent[]> {
    const snapshot = await this.collection
      .where('role', '==', 'admin')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Agent));
  }

  async addClientToAgent(agentId: string, clientId: string): Promise<void> {
    await this.collection.doc(agentId).update({
      clients: admin.firestore.FieldValue.arrayUnion(clientId),
      updatedAt: Date.now()
    });
  }

  async removeClientFromAgent(agentId: string, clientId: string): Promise<void> {
    await this.collection.doc(agentId).update({
      clients: admin.firestore.FieldValue.arrayRemove(clientId),
      updatedAt: Date.now()
    });
  }
} 