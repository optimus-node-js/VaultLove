import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  userInfo?: {
    email: string;
    password: string;
  };
}

class BiometricAuthService {
  private static instance: BiometricAuthService;
  private readonly BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
  private readonly USER_CREDENTIALS_KEY = 'user_credentials_secure';

  static getInstance(): BiometricAuthService {
    if (!BiometricAuthService.instance) {
      BiometricAuthService.instance = new BiometricAuthService();
    }
    return BiometricAuthService.instance;
  }

  // Check if biometric authentication is available on device
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  // Check if user has enabled biometric auth in our app
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const isEnabled = await SecureStore.getItemAsync(this.BIOMETRIC_ENABLED_KEY);
      return isEnabled === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled status:', error);
      return false;
    }
  }

  // Enable biometric authentication and store user credentials securely
  async enableBiometricAuth(email: string, password: string): Promise<boolean> {
    try {
      console.log('🔐 Enabling biometric auth for user:', email);
      
      // First, verify biometric authentication works
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login for VaultLove',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (!authResult.success) {
        console.log('❌ Biometric verification failed during setup');
        return false;
      }

      // Store encrypted credentials
      const credentials = JSON.stringify({ email, password });
      await SecureStore.setItemAsync(this.USER_CREDENTIALS_KEY, credentials);
      
      // Mark biometric as enabled
      await SecureStore.setItemAsync(this.BIOMETRIC_ENABLED_KEY, 'true');
      
      console.log('✅ Biometric auth enabled successfully');
      return true;
    } catch (error) {
      console.error('❌ Error enabling biometric auth:', error);
      return false;
    }
  }

  // Disable biometric authentication
  async disableBiometricAuth(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.BIOMETRIC_ENABLED_KEY);
      await SecureStore.deleteItemAsync(this.USER_CREDENTIALS_KEY);
      console.log('🔐 Biometric auth disabled');
    } catch (error) {
      console.error('Error disabling biometric auth:', error);
    }
  }

  // Authenticate user with biometrics and return stored credentials
  async authenticateWithBiometrics(): Promise<BiometricAuthResult> {
    try {
      console.log('🔐 Attempting biometric authentication...');
      
      // Check if biometric is enabled
      const isEnabled = await this.isBiometricEnabled();
      if (!isEnabled) {
        return { success: false, error: 'Biometric authentication not enabled' };
      }

      // Check if biometric is available
      const isAvailable = await this.isBiometricAvailable();
      if (!isAvailable) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      // Prompt for biometric authentication
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to VaultLove',
        fallbackLabel: 'Use password instead',
        disableDeviceFallback: false,
      });

      if (!authResult.success) {
        console.log('❌ Biometric authentication failed');
        return { success: false, error: 'Biometric authentication failed' };
      }

      // Retrieve stored credentials
      const credentialsStr = await SecureStore.getItemAsync(this.USER_CREDENTIALS_KEY);
      if (!credentialsStr) {
        console.log('❌ No stored credentials found');
        return { success: false, error: 'No stored credentials found' };
      }

      const credentials = JSON.parse(credentialsStr);
      console.log('✅ Biometric authentication successful');
      
      return {
        success: true,
        userInfo: credentials
      };
    } catch (error) {
      console.error('❌ Biometric authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  // Get supported biometric types
  async getSupportedBiometrics(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error('Error getting supported biometrics:', error);
      return [];
    }
  }

  // Get friendly name for biometric type
  getBiometricTypeName(types: LocalAuthentication.AuthenticationType[]): string {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
    return 'Biometric Authentication';
  }
}

export default BiometricAuthService.getInstance(); 