import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}

export function getFirebaseDatabase(): Database {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getDatabase(app);
}
