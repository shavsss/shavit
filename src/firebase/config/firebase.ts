import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // If you're using a service account directly, you can use this instead:
    // credential: admin.credential.cert(require('../../../serviceAccountKey.json')),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

// Initialize Firestore
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Initialize Firebase Storage
const storage = admin.storage();

// Export the Firebase services
export { admin, functions, db, storage }; 