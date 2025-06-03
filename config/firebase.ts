// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { Platform } from 'react-native';

// Import Firebase Auth with platform-specific logic
import { getAuth, Auth } from "firebase/auth";

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
  console.log('🔥 Firebase app initialized');
} else {
  app = getApp();
  console.log('🔥 Using existing Firebase app');
}

// Initialize Firebase Auth - Use getAuth for better compatibility
let auth: Auth;
try {
  auth = getAuth(app);
  
  // Configure auth for React Native
  if (Platform.OS !== 'web') {
    // For React Native, we need to ensure the auth domain is accessible
    console.log('🔧 Configuring auth for React Native platform');
    
    // Set auth language to device language
    auth.languageCode = 'en';
    
    // Add any React Native specific auth configuration here
    console.log('📱 Auth configured for React Native with domain:', firebaseConfig.authDomain);
  }
  
  console.log('✅ Firebase Auth initialized successfully for', Platform.OS);
} catch (error) {
  console.error('❌ Firebase Auth initialization failed:', error);
  throw error;
}

// Initialize other Firebase services
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Initialize Analytics (only on web and when available)
let analytics: Analytics | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
    console.log('✅ Firebase Analytics initialized');
  } catch (error) {
    console.log('⚠️ Analytics initialization failed:', error);
  }
}

console.log('🔥 Firebase services initialized:', {
  auth: !!auth,
  db: !!db,
  storage: !!storage,
  analytics: !!analytics,
  platform: Platform.OS,
  authDomain: firebaseConfig.authDomain
});

export { auth, analytics };
export default app; 