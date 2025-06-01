import * as SecureStore from 'expo-secure-store';
import { VaultConfig } from './types';
import { useAuthStore } from '@/stores/authStore';

export const initializeVault = async (config: VaultConfig): Promise<void> => {
  try {
    // Save encryption key securely
    await SecureStore.setItemAsync('encryption_key', config.encryptionKey);
    
    // Save user details
    await SecureStore.setItemAsync('username', config.username);
    await SecureStore.setItemAsync('partner_username', config.partnerUsername);
    
    // Mark app as initialized
    await SecureStore.setItemAsync('vault_initialized', 'true');
    
    // Update auth store with user info
    const { setUserInfo } = useAuthStore.getState();
    setUserInfo(config.username, config.partnerUsername);
    
  } catch (error) {
    console.error('Failed to initialize vault:', error);
    throw new Error('Vault initialization failed');
  }
};

export const isVaultInitialized = async (): Promise<boolean> => {
  try {
    const initialized = await SecureStore.getItemAsync('vault_initialized');
    return initialized === 'true';
  } catch (error) {
    console.error('Failed to check if vault is initialized:', error);
    return false;
  }
};