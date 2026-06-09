import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAhAg0EsprLMu_-T12yM5PbGZsMT9CHEFQ',
  authDomain: 'drive-nano-b0dfb.firebaseapp.com',
  projectId: 'drive-nano-b0dfb',
  storageBucket: 'drive-nano-b0dfb.firebasestorage.app',
  messagingSenderId: '529235790050',
  appId: '1:529235790050:web:ccc9d2ea342883be8176bb',
};

let app: FirebaseApp;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

export { auth };
export const db: Firestore = getFirestore(app!);
export const storage: FirebaseStorage = getStorage(app!);
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_API_KEY = firebaseConfig.apiKey;
