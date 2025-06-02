// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Import Firebase Auth with platform-specific logic
import { initializeAuth, getAuth, Auth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDPQCFs50VBywJT97ZtyFWNq66YMAUv0PI",
  authDomain: "vault-love-7c7ff.firebaseapp.com",
  projectId: "vault-love-7c7ff",
  storageBucket: "vault-love-7c7ff.firebasestorage.app",
  messagingSenderId: "129125501166",
  appId: "1:129125501166:web:cbf5fc062feab55031cbff",
  measurementId: "G-YKL1WG4J5V"
};

// Initialize Firebase
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firebase Auth with proper persistence
let auth: Auth;
try {
  if (Platform.OS === 'web') {
    // Use regular getAuth for web
    auth = getAuth(app);
  } else {
    // For React Native, try to use initializeAuth with AsyncStorage persistence
    try {
      // Import getReactNativePersistence dynamically for React Native
      const { getReactNativePersistence } = require('firebase/auth');
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
      });
    } catch (persistenceError) {
      console.warn('React Native persistence not available, using default auth:', persistenceError);
      // Fallback to regular getAuth if persistence setup fails
      auth = getAuth(app);
    }
  }
} catch (error) {
  // If already initialized, get the existing instance
  console.warn('Auth already initialized, using existing instance:', error);
  auth = getAuth(app);
}

// Initialize other Firebase services
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Initialize Analytics (only on web and when available)
let analytics: Analytics | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.log('Analytics initialization failed:', error);
  }
}

export { auth, analytics };
export default app; 