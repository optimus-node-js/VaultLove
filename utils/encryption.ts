import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import { MediaUpload } from './types';

// In a real app, we would use a more secure key derivation method
const getEncryptionKey = async (): Promise<string> => {
  const storedKey = await SecureStore.getItemAsync('encryption_key');
  if (!storedKey) {
    throw new Error('Encryption key not found');
  }
  return storedKey;
};

// In a real app, we would encrypt the actual file binary data
// This is a simplified version for demonstration
export const encryptMedia = async (media: MediaUpload): Promise<MediaUpload> => {
  const key = await getEncryptionKey();
  
  // In a real app, we would read the file, encrypt it, and create a new encrypted file
  // For demonstration, we're just returning the original media with a mock "encrypted" flag
  return {
    ...media,
    encrypted: true,
  };
};

// Decrypt media URL (in a real app, this would decrypt the actual file)
export const decryptMedia = (url: string): string => {
  // In a real app, this would decrypt the file and return a local URL to the decrypted file
  // For demonstration, we're just returning the original URL
  return url;
};

// Encrypt text (used for captions, metadata, etc.)
export const encryptText = async (text: string): Promise<string> => {
  const key = await getEncryptionKey();
  return CryptoJS.AES.encrypt(text, key).toString();
};

// Decrypt text
export const decryptText = async (encryptedText: string): Promise<string> => {
  try {
    const key = await getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Failed to decrypt text:', error);
    return '';
  }
};