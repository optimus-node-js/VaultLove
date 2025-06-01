import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  username: string;
  partnerUsername: string;
  pin: string;
  biometricsEnabled: boolean;
  
  // Actions
  login: () => void;
  logout: () => void;
  setInitialized: (initialized: boolean) => void;
  setupPin: (pin: string) => void;
  enableBiometrics: (enabled: boolean) => void;
  setUserInfo: (username: string, partnerUsername: string) => void;
  
  // Init
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isInitialized: false,
  username: '',
  partnerUsername: '',
  pin: '',
  biometricsEnabled: false,
  
  login: () => set({ isAuthenticated: true }),
  
  logout: () => set({ isAuthenticated: false }),
  
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  
  setupPin: async (pin) => {
    await SecureStore.setItemAsync('vault_pin', pin);
    set({ pin });
  },
  
  enableBiometrics: async (enabled) => {
    await SecureStore.setItemAsync('biometrics_enabled', enabled ? 'true' : 'false');
    set({ biometricsEnabled: enabled });
  },
  
  setUserInfo: async (username, partnerUsername) => {
    await SecureStore.setItemAsync('username', username);
    await SecureStore.setItemAsync('partner_username', partnerUsername);
    set({ username, partnerUsername });
  },
  
  initialize: async () => {
    try {
      // Check if app is initialized
      const initData = await SecureStore.getItemAsync('vault_initialized');
      const isInitialized = initData === 'true';
      
      if (isInitialized) {
        // Load user data
        const pin = await SecureStore.getItemAsync('vault_pin') || '';
        const biometricsEnabled = (await SecureStore.getItemAsync('biometrics_enabled')) === 'true';
        const username = await SecureStore.getItemAsync('username') || '';
        const partnerUsername = await SecureStore.getItemAsync('partner_username') || '';
        
        set({ 
          isInitialized,
          pin,
          biometricsEnabled,
          username,
          partnerUsername
        });
      } else {
        set({ isInitialized: false });
      }
    } catch (error) {
      console.error('Failed to initialize auth store:', error);
      set({ isInitialized: false });
    }
  },
}));

// Initialize auth store when imported
useAuthStore.getState().initialize();