import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  ConfirmationResult
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, analytics } from '../config/firebase';
import { logEvent } from 'firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  photoURL?: string;
  gender?: 'male' | 'female';
  dateOfBirth?: string;
  partnerId?: string;
  partnerStatus: 'none' | 'pending' | 'connected' | 'no_partner';
  partnerCode?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SignupData {
  displayName: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  gender?: 'male' | 'female';
  dateOfBirth?: string;
  partnerCode?: string;
}

export interface PhoneSignInData {
  phoneNumber: string;
  verificationCode?: string;
}

export interface PartnerConnection {
  id: string;
  code: string;
  creatorId: string;
  creatorName: string;
  partnerId?: string;
  partnerName?: string;
  status: 'pending' | 'connected' | 'expired';
  createdAt: any;
  expiresAt: any;
}

class AuthService {
  private currentUser: User | null = null;
  private userProfile: UserProfile | null = null;
  private authStateListeners: ((user: User | null) => void)[] = [];
  private profileListeners: ((profile: UserProfile | null) => void)[] = [];
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private confirmationResult: ConfirmationResult | null = null;
  private currentUserProfile: UserProfile | null = null;
  private rnAuth: any = null;
  private verificationId: string = '';

  constructor() {
    this.initializeAuth();
  }

  // Utility function to clean data for Firestore (remove undefined values)
  private cleanDataForFirestore(data: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
  }

  private async initializeAuth() {
    try {
      // Check for persisted auth state
      const persistedUser = await AsyncStorage.getItem('firebaseUser');
      
      onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user?.uid || 'logged out');
        this.currentUser = user;
        
        if (user) {
          // Store user info for persistence
          await AsyncStorage.setItem('firebaseUser', JSON.stringify({
            uid: user.uid,
            email: user.email,
            phoneNumber: user.phoneNumber,
            displayName: user.displayName
          }));
          
          // Load or create user profile with complete data
          let userProfile = await this.loadUserProfile(user.uid);
          
          if (!userProfile) {
            console.log('Creating user profile for existing auth user...');
            // Create profile if it doesn't exist
            userProfile = await this.createOrUpdateProfile({
              uid: user.uid,
              email: user.email || undefined,
              phoneNumber: user.phoneNumber || undefined,
              displayName: user.displayName || undefined,
              photoURL: user.photoURL || undefined,
              partnerStatus: 'no_partner'
            });
          }
          
          // Notify all listeners about auth state change
          this.authStateListeners.forEach(callback => callback(user));
        } else {
          // Clear persisted data on sign out
          await AsyncStorage.removeItem('firebaseUser');
          this.userProfile = null;
          this.notifyProfileListeners(null);
          this.authStateListeners.forEach(callback => callback(null));
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
    }
  }

  // Dynamic import for React Native Firebase (only on mobile)
  private async getRNAuth() {
    if (Platform.OS === 'web') {
      throw new Error('React Native Firebase is not available on web');
    }
    
    if (!this.rnAuth) {
      try {
        // Use require with try-catch for better compatibility
        const rnFirebase = require('@react-native-firebase/auth');
        this.rnAuth = rnFirebase.default;
        console.log('React Native Firebase auth loaded successfully');
      } catch (error) {
        console.error('Failed to load React Native Firebase:', error);
        throw new Error('React Native Firebase auth is not available');
      }
    }
    
    return this.rnAuth;
  }

  // Auth state management
  onAuthStateChange(callback: (user: User | null) => void) {
    this.authStateListeners.push(callback);
    // Immediately call with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
    };
  }

  onProfileChange(callback: (profile: UserProfile | null) => void) {
    this.profileListeners.push(callback);
    // Immediately call with current state
    callback(this.userProfile);
    
    // Return unsubscribe function
    return () => {
      this.profileListeners = this.profileListeners.filter(cb => cb !== callback);
    };
  }

  // Phone Authentication Methods
  async initializeRecaptcha(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Initialize reCAPTCHA for web
        if (!this.recaptchaVerifier) {
          this.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {
              console.log('reCAPTCHA solved');
            },
            'expired-callback': () => {
              console.log('reCAPTCHA expired');
            }
          });
        }
      } else {
        // React Native handles verification automatically
        console.log('Firebase handles verification automatically in React Native');
      }
    } catch (error) {
      console.error('Recaptcha initialization error:', error);
      throw error;
    }
  }

  async sendPhoneVerification(phoneNumber: string): Promise<boolean> {
    try {
      console.log('Sending phone verification to:', phoneNumber);
      
      // Ensure phone number has country code
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      
      if (Platform.OS === 'web') {
        // Web implementation
        if (!this.recaptchaVerifier) {
          await this.initializeRecaptcha();
        }
        
        this.confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, this.recaptchaVerifier!);
        console.log('SMS sent successfully (web)');
        return true;
      } else {
        // React Native implementation
        const rnAuth = await this.getRNAuth();
        
        // Send verification code
        const confirmation = await rnAuth().signInWithPhoneNumber(formattedPhone);
        this.confirmationResult = confirmation;
        
        // Store verification ID for later use
        if (confirmation.verificationId) {
          this.verificationId = confirmation.verificationId;
        }
        
        console.log('SMS sent successfully (React Native)');
        return true;
      }
    } catch (error) {
      console.error('Send phone verification error:', error);
      throw new Error(this.getPhoneAuthErrorMessage(error));
    }
  }

  async verifyPhoneNumber(verificationCode: string): Promise<UserProfile> {
    try {
      if (!this.confirmationResult) {
        throw new Error('No verification in progress');
      }

      console.log('Verifying phone number with code:', verificationCode);

      let user: User;
      
      if (Platform.OS === 'web') {
        // Web platform using Firebase auth directly
        const result = await this.confirmationResult.confirm(verificationCode);
        user = result.user;
      } else {
        // React Native platform using React Native Firebase
        const rnAuth = await this.getRNAuth();
        const credential = PhoneAuthProvider.credential(this.verificationId, verificationCode);
        const result = await signInWithCredential(auth, credential);
        user = result.user;
      }

      // Load or create user profile
      let userProfile = await this.loadUserProfile(user.uid);
      
      if (!userProfile) {
        console.log('User profile not found, creating new profile...');
        // Create new profile if it doesn't exist
        userProfile = await this.createOrUpdateProfile({
          uid: user.uid,
          email: user.email || undefined,
          phoneNumber: user.phoneNumber || undefined,
          displayName: user.displayName || undefined,
          photoURL: user.photoURL || undefined,
          partnerStatus: 'no_partner'
        });
        console.log('Created new user profile for phone user:', userProfile);
      }

      // Log analytics
      if (analytics) {
        logEvent(analytics, 'login', { method: 'phone' });
      }

      // Clear verification state
      this.confirmationResult = null;
      this.verificationId = '';

      return userProfile;
    } catch (error) {
      console.error('Phone verification error:', error);
      throw error;
    }
  }

  // Email Authentication Methods
  async signUp(signupData: SignupData): Promise<UserProfile> {
    try {
      console.log('Signing up user:', signupData);
      
      let user: User;
      
      if (signupData.email && signupData.password) {
        // Email/password signup
        const result = await createUserWithEmailAndPassword(
          auth, 
          signupData.email, 
          signupData.password
        );
        user = result.user;
        
        // Update display name
        if (signupData.displayName) {
          await updateProfile(user, { displayName: signupData.displayName });
        }
      } else {
        throw new Error('Email and password are required for signup');
      }

      // Create user profile
      const userProfile = await this.createOrUpdateProfile({
        uid: user.uid,
        email: user.email || undefined,
        phoneNumber: signupData.phoneNumber,
        displayName: signupData.displayName || user.displayName || `User${user.uid.slice(-4)}`,
        gender: signupData.gender,
        dateOfBirth: signupData.dateOfBirth,
        partnerStatus: 'no_partner',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Handle partner code if provided
      if (signupData.partnerCode) {
        await this.connectWithPartner(signupData.partnerCode);
      }

      // Log analytics
      if (analytics) {
        logEvent(analytics, 'sign_up', { method: 'email' });
      }

      return userProfile;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<UserProfile> {
    try {
      console.log('Signing in user:', email);
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Load user profile
      let userProfile = await this.loadUserProfile(user.uid);
      
      if (!userProfile) {
        console.log('User profile not found, creating new profile...');
        // Create new profile if it doesn't exist
        userProfile = await this.createOrUpdateProfile({
          uid: user.uid,
          email: user.email || undefined,
          phoneNumber: user.phoneNumber || undefined,
          displayName: user.displayName || undefined,
          photoURL: user.photoURL || undefined,
          partnerStatus: 'no_partner'
        });
        console.log('Created new user profile:', userProfile);
      }

      // Log analytics
      if (analytics) {
        logEvent(analytics, 'login', { method: 'email' });
      }

      return userProfile;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async signOutUser(): Promise<void> {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.userProfile = null;
      this.confirmationResult = null;
      
      // Clear persisted data
      await AsyncStorage.removeItem('firebaseUser');
      
      // Log analytics
      if (analytics) {
        logEvent(analytics, 'logout');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // User Profile Management
  private async createOrUpdateProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      if (!profileData.uid) {
        throw new Error('User ID is required');
      }

      const userRef = doc(db, 'users', profileData.uid);
      const existingDoc = await getDoc(userRef);
      
      let userProfile: UserProfile;
      
      if (existingDoc.exists()) {
        // Update existing profile - filter out undefined values
        const updateData = this.cleanDataForFirestore({
          ...profileData,
          updatedAt: serverTimestamp()
        });
        await updateDoc(userRef, updateData);
        userProfile = { ...existingDoc.data(), ...updateData } as UserProfile;
      } else {
        // Create new profile - filter out undefined values
        const baseProfileData = {
          uid: profileData.uid,
          partnerStatus: 'no_partner' as const,
          ...profileData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const cleanProfileData = this.cleanDataForFirestore(baseProfileData);
        
        await setDoc(userRef, cleanProfileData);
        userProfile = baseProfileData as UserProfile;
      }

      this.userProfile = userProfile;
      this.notifyProfileListeners(userProfile);
      
      return userProfile;
    } catch (error) {
      console.error('Profile creation/update error:', error);
      throw error;
    }
  }

  private async loadUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      console.log('Loading user profile for uid:', uid);
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userProfile: UserProfile = {
          uid: userData.uid || uid,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          gender: userData.gender,
          dateOfBirth: userData.dateOfBirth,
          partnerId: userData.partnerId,
          partnerStatus: userData.partnerStatus || 'no_partner',
          partnerCode: userData.partnerCode,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt
        };
        
        console.log('User profile loaded successfully:', {
          uid: userProfile.uid,
          email: userProfile.email,
          displayName: userProfile.displayName,
          partnerStatus: userProfile.partnerStatus
        });
        
        this.userProfile = userProfile;
        this.notifyProfileListeners(userProfile);
        return userProfile;
      }
      
      console.log('No user profile found in Firestore for uid:', uid);
      return null;
    } catch (error) {
      console.error('Load profile error:', error);
      return null;
    }
  }

  async connectWithPartner(partnerCode: string): Promise<void> {
    try {
      if (!this.currentUser || !this.userProfile) {
        throw new Error('User must be authenticated');
      }

      // Implementation for partner connection logic
      // This would search for users with the given partner code
      console.log('Connecting with partner code:', partnerCode);
      
      // For now, just update the partner code
      await this.updateProfile({ partnerCode });
    } catch (error) {
      console.error('Partner connection error:', error);
      throw error;
    }
  }

  async generatePartnerConnection(): Promise<string> {
    try {
      if (!this.currentUser || !this.userProfile) {
        throw new Error('User must be authenticated');
      }

      // Generate a unique partner code
      const partnerCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      console.log('Generated partner code:', partnerCode);
      
      // Update user profile with the partner code and pending status
      await this.updateProfile({ 
        partnerCode,
        partnerStatus: 'pending'
      });

      return partnerCode;
    } catch (error) {
      console.error('Generate partner connection error:', error);
      throw error;
    }
  }

  async disconnectPartner(): Promise<void> {
    try {
      if (!this.currentUser || !this.userProfile) {
        throw new Error('User must be authenticated');
      }

      console.log('Disconnecting from partner...');
      
      // Update user profile to remove partner connection
      await this.updateProfile({ 
        partnerCode: undefined,
        partnerId: undefined,
        partnerStatus: 'no_partner'
      });

      console.log('Successfully disconnected from partner');
    } catch (error) {
      console.error('Disconnect partner error:', error);
      throw error;
    }
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      if (!this.currentUser) {
        throw new Error('No authenticated user');
      }

      const userRef = doc(db, 'users', this.currentUser.uid);
      const updateData = this.cleanDataForFirestore({
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      await updateDoc(userRef, updateData);
      
      const updatedProfile = { ...this.userProfile, ...updates, updatedAt: serverTimestamp() } as UserProfile;
      this.userProfile = updatedProfile;
      this.notifyProfileListeners(updatedProfile);
      
      return updatedProfile;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }

  // Public getters
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getUserProfile(): UserProfile | null {
    return this.userProfile;
  }

  isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  isPartnerConnected(): boolean {
    return this.userProfile?.partnerStatus === 'connected';
  }

  // Profile change listeners
  private notifyProfileListeners(profile: UserProfile | null) {
    this.profileListeners.forEach(callback => callback(profile));
  }

  // Error handling
  private getPhoneAuthErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/invalid-phone-number':
        return 'Invalid phone number format';
      case 'auth/missing-phone-number':
        return 'Phone number is required';
      case 'auth/quota-exceeded':
        return 'SMS quota exceeded. Try again later';
      case 'auth/user-disabled':
        return 'This account has been disabled';
      case 'auth/invalid-verification-code':
        return 'Invalid verification code';
      case 'auth/code-expired':
        return 'Verification code has expired';
      case 'auth/missing-verification-code':
        return 'Verification code is required';
      case 'auth/too-many-requests':
        return 'Too many requests. Please try again later';
      default:
        return error.message || 'Authentication failed';
    }
  }

  // Cleanup
  cleanup() {
    this.profileListeners = [];
    this.confirmationResult = null;
    this.recaptchaVerifier = null;
  }

  async createUserProfile(userData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated to create profile');
      }

      const profileData: UserProfile = {
        uid: userData.uid || currentUser.uid,
        email: userData.email || currentUser.email || undefined,
        phoneNumber: userData.phoneNumber || currentUser.phoneNumber || undefined,
        displayName: userData.displayName || currentUser.displayName || undefined,
        photoURL: userData.photoURL || currentUser.photoURL || undefined,
        gender: userData.gender,
        dateOfBirth: userData.dateOfBirth,
        partnerId: userData.partnerId,
        partnerStatus: userData.partnerStatus || 'no_partner',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Filter out undefined values before saving to Firestore
      const cleanProfileData = this.cleanDataForFirestore(profileData);

      // Save to Firestore
      await setDoc(doc(db, 'users', currentUser.uid), cleanProfileData);
      
      // Cache the profile
      this.currentUserProfile = profileData;
      
      console.log('User profile created successfully:', profileData);
      
      // Log analytics
      if (analytics) {
        logEvent(analytics, 'user_profile_created', {
          user_id: currentUser.uid,
          has_partner: !!profileData.partnerId
        });
      }

      return profileData;
    } catch (error) {
      console.error('Create user profile error:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
export default authService; 