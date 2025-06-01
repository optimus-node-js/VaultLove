import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential
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

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  phoneNumber?: string;
  gender: 'male' | 'female';
  dateOfBirth?: string;
  partnerCode?: string;
  partnerId?: string;
  partnerStatus?: 'none' | 'pending' | 'connected';
  createdAt: any;
  updatedAt: any;
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

  constructor() {
    this.initializeAuthListener();
  }

  private initializeAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      
      if (user) {
        await this.loadUserProfile(user.uid);
        // Log analytics event
        if (analytics) {
          logEvent(analytics, 'login', { method: 'firebase' });
        }
      } else {
        this.userProfile = null;
      }
      
      // Notify all listeners
      this.authStateListeners.forEach(listener => listener(user));
      this.profileListeners.forEach(listener => listener(this.userProfile));
    });
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

  // Email/Password Authentication
  async signUp(
    email: string, 
    password: string, 
    userData: { 
      name: string; 
      gender: 'male' | 'female'; 
      dateOfBirth?: string; 
      phoneNumber?: string;
    }
  ) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user profile
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        name: userData.name,
        phoneNumber: userData.phoneNumber,
        gender: userData.gender,
        dateOfBirth: userData.dateOfBirth,
        partnerStatus: 'none',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'users', user.uid), userProfile);
      this.userProfile = userProfile;
      
      // Log analytics event
      if (analytics) {
        logEvent(analytics, 'sign_up', { 
          method: 'email',
          user_gender: userData.gender,
        });
      }
      
      return { user, profile: userProfile };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Load user profile after successful sign in
      await this.loadUserProfile(userCredential.user.uid);
      
      if (analytics) {
        logEvent(analytics, 'login', { method: 'email' });
      }
      
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      await signOut(auth);
      this.userProfile = null;
      if (analytics) {
        logEvent(analytics, 'logout');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Phone Authentication
  async signInWithPhone(phoneNumber: string, recaptchaVerifier: any) {
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      if (analytics) {
        logEvent(analytics, 'phone_sign_in_initiated', { phone_number: phoneNumber });
      }
      return confirmationResult;
    } catch (error) {
      console.error('Phone sign in error:', error);
      throw error;
    }
  }

  async verifyPhoneCode(verificationId: string, code: string) {
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Check if this is a new user and create profile if needed
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        // This is a new user, create basic profile
        const userProfile: UserProfile = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || '',
          name: userCredential.user.displayName || 'User',
          gender: 'male', // Default, user should update this
          partnerStatus: 'none',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
        this.userProfile = userProfile;
      } else {
        // Load existing profile
        await this.loadUserProfile(userCredential.user.uid);
      }
      
      if (analytics) {
        logEvent(analytics, 'login', { method: 'phone' });
      }
      
      return userCredential.user;
    } catch (error) {
      console.error('Phone verification error:', error);
      throw error;
    }
  }

  // User Profile Management
  private async loadUserProfile(uid: string) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        this.userProfile = userDoc.data() as UserProfile;
      } else {
        console.warn('User profile not found for UID:', uid);
        this.userProfile = null;
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.userProfile = null;
    }
  }

  async updateProfile(updates: Partial<UserProfile>) {
    if (!this.currentUser) {
      throw new Error('No authenticated user');
    }

    try {
      const userRef = doc(db, 'users', this.currentUser.uid);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(userRef, updateData);
      
      // Update local profile
      if (this.userProfile) {
        this.userProfile = { ...this.userProfile, ...updates };
        this.profileListeners.forEach(listener => listener(this.userProfile));
      }
      
      if (analytics) {
        logEvent(analytics, 'profile_updated');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // Partner Connection System
  private generatePartnerCode(name: string): string {
    const prefix = name.substring(0, 4).toUpperCase().padEnd(4, 'X');
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    return `${prefix}-${suffix}`;
  }

  async generatePartnerConnection(): Promise<string> {
    if (!this.currentUser || !this.userProfile) throw new Error('No authenticated user');
    
    try {
      const code = this.generatePartnerCode(this.userProfile.name);
      const connectionData: PartnerConnection = {
        id: code,
        code,
        creatorId: this.currentUser.uid,
        creatorName: this.userProfile.name,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };
      
      await setDoc(doc(db, 'partnerConnections', code), connectionData);
      
      // Update user's partner code
      await this.updateProfile({ 
        partnerCode: code,
        partnerStatus: 'pending' 
      });
      
      if (analytics) {
        logEvent(analytics, 'partner_code_generated');
      }
      
      return code;
    } catch (error) {
      console.error('Generate partner connection error:', error);
      throw error;
    }
  }

  async connectWithPartner(code: string): Promise<boolean> {
    if (!this.currentUser || !this.userProfile) throw new Error('No authenticated user');
    
    try {
      const connectionDoc = await getDoc(doc(db, 'partnerConnections', code));
      
      if (!connectionDoc.exists()) {
        throw new Error('Invalid partner code');
      }
      
      const connection = connectionDoc.data() as PartnerConnection;
      
      if (connection.status !== 'pending') {
        throw new Error('Partner code is no longer valid');
      }
      
      if (connection.creatorId === this.currentUser.uid) {
        throw new Error('Cannot connect to your own code');
      }
      
      // Check if code has expired
      if (connection.expiresAt.toDate() < new Date()) {
        throw new Error('Partner code has expired');
      }
      
      // Update connection status
      await updateDoc(doc(db, 'partnerConnections', code), {
        partnerId: this.currentUser.uid,
        partnerName: this.userProfile.name,
        status: 'connected',
        updatedAt: serverTimestamp(),
      });
      
      // Update both users' profiles
      await Promise.all([
        this.updateProfile({
          partnerId: connection.creatorId,
          partnerStatus: 'connected',
        }),
        updateDoc(doc(db, 'users', connection.creatorId), {
          partnerId: this.currentUser.uid,
          partnerStatus: 'connected',
          updatedAt: serverTimestamp(),
        })
      ]);
      
      if (analytics) {
        logEvent(analytics, 'partner_connected');
      }
      
      return true;
    } catch (error) {
      console.error('Connect with partner error:', error);
      throw error;
    }
  }

  async disconnectPartner(): Promise<void> {
    if (!this.currentUser || !this.userProfile) throw new Error('No authenticated user');
    
    try {
      const partnerId = this.userProfile.partnerId;
      
      if (partnerId) {
        // Update partner's profile
        await updateDoc(doc(db, 'users', partnerId), {
          partnerId: null,
          partnerStatus: 'none',
          partnerCode: null,
          updatedAt: serverTimestamp(),
        });
      }
      
      // Update current user's profile
      await this.updateProfile({
        partnerId: undefined,
        partnerStatus: 'none',
        partnerCode: undefined,
      });
      
      if (analytics) {
        logEvent(analytics, 'partner_disconnected');
      }
    } catch (error) {
      console.error('Disconnect partner error:', error);
      throw error;
    }
  }

  // Getters
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getUserProfile(): UserProfile | null {
    return this.userProfile;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  isPartnerConnected(): boolean {
    return this.userProfile?.partnerStatus === 'connected';
  }
}

export const authService = new AuthService();
export default authService; 