import { Platform, PermissionsAndroid } from 'react-native';
import { 
  getAuth, 
  signInWithPhoneNumber, 
  PhoneAuthProvider, 
  signInWithCredential,
  RecaptchaVerifier,
  ApplicationVerifier
} from 'firebase/auth';
import DeviceInfo from 'react-native-device-info';
import Contacts from 'react-native-contacts';

export interface PhoneAuthResult {
  success: boolean;
  verificationId?: string;
  error?: string;
  autoDetectedNumber?: string;
}

export interface OTPVerifyResult {
  success: boolean;
  error?: string;
  user?: any;
}

class SMSAuthService {
  private static instance: SMSAuthService;
  private auth = getAuth();
  private recaptchaVerifier: ApplicationVerifier | null = null;

  static getInstance(): SMSAuthService {
    if (!SMSAuthService.instance) {
      SMSAuthService.instance = new SMSAuthService();
    }
    return SMSAuthService.instance;
  }

  // Auto-detect user's phone number
  async detectPhoneNumber(): Promise<string | null> {
    try {
      console.log('📱 Attempting to detect phone number...');
      
      // Method 1: Try to get from contacts (user's own contact)
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_CONTACTS
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('❌ Contacts permission denied');
            return null;
          }
        }

        const contacts = await Contacts.getAll();
        const userContact = contacts.find(contact => 
          contact.displayName?.toLowerCase().includes('me') ||
          contact.displayName?.toLowerCase().includes('my') ||
          contact.givenName?.toLowerCase().includes('me')
        );

        if (userContact && userContact.phoneNumbers?.length > 0) {
          const phoneNumber = userContact.phoneNumbers[0].number;
          console.log('✅ Phone number detected from contacts:', phoneNumber);
          return this.formatPhoneNumber(phoneNumber);
        }
      } catch (error) {
        console.log('❌ Failed to get phone number from contacts:', error);
      }

      console.log('❌ Could not auto-detect phone number');
      return null;
    } catch (error) {
      console.error('❌ Error in detectPhoneNumber:', error);
      return null;
    }
  }

  // Format phone number to international format
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // If number doesn't start with country code, assume it's from user's country
    // For now, we'll assume US (+1) as default
    if (!cleaned.startsWith('1') && cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }
    
    // Add the + prefix for international format
    return '+' + cleaned;
  }

  // Initialize reCAPTCHA for web
  private async initializeRecaptcha(): Promise<void> {
    if (Platform.OS === 'web' && !this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier = new RecaptchaVerifier(this.auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response: any) => {
            console.log('reCAPTCHA solved:', response);
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired');
          }
        });
      } catch (error) {
        console.error('Failed to initialize reCAPTCHA:', error);
        throw error;
      }
    }
  }

  // Send OTP to phone number
  async sendOTP(phoneNumber: string): Promise<PhoneAuthResult> {
    try {
      console.log('📱 Sending OTP to:', phoneNumber);
      
      // Format the phone number
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      console.log('📱 Formatted number:', formattedNumber);

      // Initialize reCAPTCHA for web platform
      await this.initializeRecaptcha();

      // Send OTP
      const confirmationResult = await signInWithPhoneNumber(
        this.auth, 
        formattedNumber, 
        this.recaptchaVerifier!
      );

      console.log('✅ OTP sent successfully');
      return {
        success: true,
        verificationId: confirmationResult.verificationId
      };
    } catch (error: any) {
      console.error('❌ Failed to send OTP:', error);
      
      let errorMessage = 'Failed to send OTP. Please try again.';
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format. Please check and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later.';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Verify OTP and sign in
  async verifyOTP(verificationId: string, otp: string): Promise<OTPVerifyResult> {
    try {
      console.log('🔐 Verifying OTP:', otp);
      
      // Create credential with verification ID and OTP
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      
      // Sign in with the credential
      const result = await signInWithCredential(this.auth, credential);
      
      console.log('✅ OTP verification successful');
      return {
        success: true,
        user: result.user
      };
    } catch (error: any) {
      console.error('❌ OTP verification failed:', error);
      
      let errorMessage = 'Invalid OTP. Please check and try again.';
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code. Please check and try again.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Verification code has expired. Please request a new one.';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Auto-read OTP from SMS (Android only)
  async autoReadOTP(): Promise<string | null> {
    if (Platform.OS !== 'android') {
      console.log('❌ Auto-read OTP only supported on Android');
      return null;
    }

    try {
      // This would require additional setup with react-native-sms-retriever
      // For now, we'll return null and implement manual OTP entry
      console.log('📱 Auto-read OTP not yet implemented');
      return null;
    } catch (error) {
      console.error('❌ Failed to auto-read OTP:', error);
      return null;
    }
  }

  // Clean up reCAPTCHA
  cleanup(): void {
    if (this.recaptchaVerifier) {
      this.recaptchaVerifier = null;
    }
  }
}

export default SMSAuthService.getInstance(); 