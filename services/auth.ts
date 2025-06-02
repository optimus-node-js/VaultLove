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
  ConfirmationResult,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset
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
      }
      console.log('Phone auth initialized successfully');
    } catch (error) {
      console.error('Failed to initialize phone auth:', error);
      throw error;
    }
  }

  async sendPhoneVerification(phoneNumber: string): Promise<boolean> {
    try {
      console.log('Sending phone verification to:', phoneNumber);
      
      // Format phone number (ensure it starts with +)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      
      if (Platform.OS === 'web') {
        // Web implementation using reCAPTCHA
        if (!this.recaptchaVerifier) {
          await this.initializeRecaptcha();
        }
        
        this.confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, this.recaptchaVerifier!);
        console.log('SMS sent successfully (web)');
        return true;
      } else {
        // For React Native, phone auth is complex with web SDK
        // We'll disable it and recommend email auth instead
        console.warn('Phone authentication on React Native with Firebase web SDK requires complex setup.');
        throw new Error('Phone authentication is not available on mobile. Please use email/password authentication instead.');
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

      // Use the confirmation result directly (works for both web and React Native)
      const result = await this.confirmationResult.confirm(verificationCode);
      const user = result.user;

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
      console.log('🚪 Starting complete logout process...');
      
      // Sign out from Firebase first
      await signOut(auth);
      console.log('✅ Firebase signout successful');
      
      // Clear all internal state immediately
      this.currentUser = null;
      this.userProfile = null;
      this.currentUserProfile = null;
      this.confirmationResult = null;
      this.verificationId = '';
      
      // Notify all listeners that user and profile are null
      this.authStateListeners.forEach(callback => callback(null));
      this.notifyProfileListeners(null);
      console.log('📢 Notified all auth state listeners');
      
      // Clear all persisted data from AsyncStorage
      await AsyncStorage.multiRemove([
        'firebaseUser',           // Auth service storage
        '@vaultlove_user_data',   // Layout storage for user data  
        '@vaultlove_auth_token',  // Layout storage for auth token
        '@vaultlove_last_login',  // Layout storage for last login
        'vault_pin',              // Vault PIN
        'biometrics_enabled',     // Biometrics setting
        'username',               // Username
        'partner_username',       // Partner username
        'vault_initialized',      // Vault initialization
        'encryption_key',         // Encryption key
        '@auth_token',            // Any additional auth tokens
        '@user_session',          // User session data
        '@app_state'              // App state
      ]);
      console.log('🗑️ Cleared all stored authentication data');
      
      // Additional cleanup - try to clear any remaining storage
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = allKeys.filter(key => 
          key.includes('auth') || 
          key.includes('user') || 
          key.includes('vault') || 
          key.includes('firebase') ||
          key.includes('login') ||
          key.includes('session')
        );
        
        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
          console.log('🧹 Cleared additional storage keys:', keysToRemove);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Could not perform additional storage cleanup:', cleanupError);
      }
      
      // Log analytics if available
      if (analytics) {
        logEvent(analytics, 'logout');
        console.log('📊 Logged logout analytics event');
      }
      
      console.log('✅ Complete logout process finished successfully');
      
    } catch (error) {
      console.error('❌ Sign out error:', error);
      
      // Even if there's an error, try to clear local state
      this.currentUser = null;
      this.userProfile = null;
      this.currentUserProfile = null;
      this.confirmationResult = null;
      this.verificationId = '';
      this.authStateListeners.forEach(callback => callback(null));
      this.notifyProfileListeners(null);
      
      // Emergency cleanup - clear everything
      try {
        await AsyncStorage.clear();
        console.log('🚨 Emergency: Cleared all AsyncStorage due to logout error');
      } catch (clearError) {
        console.error('❌ Failed to clear storage during error recovery:', clearError);
      }
      
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

  // Email validation helper
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      console.log('🔍 Checking if email exists:', email);
      
      // Use Firebase Auth's fetchSignInMethodsForEmail to check if email exists
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      
      // If there are sign-in methods, the email exists
      const exists = signInMethods.length > 0;
      console.log('📧 Email check result:', { email, exists, methods: signInMethods });
      
      return exists;
    } catch (error: any) {
      console.error('❌ Email check error:', error);
      
      // If we get a user-not-found error, the email doesn't exist
      if (error.code === 'auth/user-not-found') {
        return false;
      }
      
      // For other errors, assume email might exist to be safe
      return false;
    }
  }

  // Password Reset Methods
  /**
   * Send password reset email - Updated for Firebase Email Enumeration Protection
   * 
   * IMPORTANT: Firebase changed behavior for projects created after September 15, 2023
   * 
   * OLD BEHAVIOR (before Email Enumeration Protection):
   * - Would throw 'auth/user-not-found' error if email doesn't exist
   * - Developers could show specific "email not found" messages
   * 
   * NEW BEHAVIOR (with Email Enumeration Protection enabled):
   * - Always succeeds, regardless of whether email exists
   * - No error thrown for non-existent emails
   * - This prevents attackers from discovering which emails are registered
   * 
   * SECURITY REASONING:
   * - Prevents email enumeration attacks
   * - Attackers can't determine if an email is registered by trying password reset
   * - Consistent with industry best practices
   * 
   * HOW TO HANDLE:
   * - Always show success message mentioning "if account exists"
   * - Don't rely on errors to determine if email exists
   * - Email will only be sent if account actually exists
   * 
   * To disable this feature (NOT recommended for security):
   * Go to Firebase Console > Authentication > Settings > Email Enumeration Protection > Disable
   * 
   * @param email Email address to send reset link to
   * @returns Promise with sent status and user-friendly message
   */
  async sendPasswordResetEmail(email: string): Promise<{ sent: boolean; message: string }> {
    try {
      console.log('📧 Sending password reset email to:', email);
      
      // Note: Firebase Email Enumeration Protection (enabled by default for new projects since Sept 15, 2023)
      // means sendPasswordResetEmail will NOT throw an error if the email doesn't exist.
      // This is a security feature to prevent attackers from discovering registered emails.
      // The method will always succeed, regardless of whether the email exists.
      
      console.log('📤 Calling Firebase sendPasswordResetEmail...');
      
      // Determine the correct URL based on environment
      let resetUrl = 'https://vaultlove.com/action'; // Production URL
      
      // For development, use current window location
      if (typeof window !== 'undefined') {
        const currentHost = window.location.host;
        if (currentHost.includes('localhost') || currentHost.includes('127.0.0.1')) {
          resetUrl = `${window.location.protocol}//${window.location.host}/action`;
        }
      }
      
      console.log('🔗 Using reset URL:', resetUrl);
      
      await sendPasswordResetEmail(auth, email, {
        url: resetUrl,
        handleCodeInApp: false
      });
      console.log('✅ Firebase sendPasswordResetEmail completed successfully');
      
      // Log analytics
      if (analytics) {
        logEvent(analytics, 'password_reset_requested', { email });
        console.log('📊 Analytics event logged');
      }

      // Return success with appropriate messaging
      return {
        sent: true,
        message: `If an account with ${email} exists, you will receive a password reset email shortly. Please check your inbox and spam folder.`
      };

    } catch (error: any) {
      console.error('❌ Send password reset email error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Handle specific Firebase errors (these can still occur for other reasons)
      if (error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many password reset requests. Please wait a few minutes before trying again.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else if (error.code === 'auth/missing-email') {
        throw new Error('Email address is required.');
      } else {
        // For debugging - include the original error message
        console.error('Unhandled error code:', error.code);
        throw new Error(`Failed to send reset email: ${error.message || 'Unknown error'}`);
      }
    }
  }

  async verifyPasswordResetCode(oobCode: string): Promise<string> {
    try {
      console.log('🔐 Verifying password reset code...');
      
      // Verify the reset code and get the email
      const email = await verifyPasswordResetCode(auth, oobCode);
      console.log('✅ Password reset code verified for email:', email);
      
      return email;
    } catch (error: any) {
      console.error('❌ Verify password reset code error:', error);
      
      if (error.code === 'auth/invalid-action-code') {
        throw new Error('Invalid or expired password reset link. Please request a new one.');
      } else if (error.code === 'auth/expired-action-code') {
        throw new Error('Password reset link has expired. Please request a new one.');
      } else {
        throw new Error('Invalid password reset link. Please request a new one.');
      }
    }
  }

  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
    try {
      console.log('🔐 Confirming password reset...');
      
      await confirmPasswordReset(auth, oobCode, newPassword);
      console.log('✅ Password reset successful');
      
      // Log analytics
      if (analytics) {
        logEvent(analytics, 'password_reset_completed');
      }
    } catch (error: any) {
      console.error('❌ Confirm password reset error:', error);
      
      if (error.code === 'auth/invalid-action-code') {
        throw new Error('Invalid or expired password reset link. Please request a new one.');
      } else if (error.code === 'auth/expired-action-code') {
        throw new Error('Password reset link has expired. Please request a new one.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Please choose a stronger password with at least 6 characters.');
      } else {
        throw new Error('Failed to reset password. Please try again.');
      }
    }
  }
}

export const authService = new AuthService();
export default authService; 