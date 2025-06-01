import { create } from 'zustand';
import { MediaItem, MediaUpload } from '@/utils/types';
import { encryptMedia, decryptMedia } from '@/utils/encryption';
import { mockUploadToStorage, mockDeleteFromStorage } from '@/utils/storageUtils';

interface VaultState {
  mediaItems: MediaItem[];
  isLoading: boolean;
  error: string | null;
  mediaCount: number;
  
  // Actions
  uploadMedia: (media: MediaUpload) => Promise<void>;
  loadVaultContents: () => Promise<void>;
  toggleFavorite: (mediaId: string) => void;
  deleteMedia: (mediaId: string) => Promise<void>;
  clearVault: () => Promise<void>;
}

// In a real app, this would be persisted to Firebase
const MOCK_MEDIA_ITEMS: MediaItem[] = [];

export const useVaultStore = create<VaultState>((set, get) => ({
  mediaItems: [],
  isLoading: false,
  error: null,
  mediaCount: 0,
  
  uploadMedia: async (media) => {
    set({ isLoading: true, error: null });
    
    try {
      // In a real app, this would encrypt the file and upload to Firebase
      const encryptedMedia = await encryptMedia(media);
      
      // Mock upload to storage and get download URL
      const url = await mockUploadToStorage(encryptedMedia);
      
      // Create thumbnail from the media
      const thumbnailUrl = url; // In a real app, this would be a separate smaller file
      
      // Add the media item to the store
      const newItem: MediaItem = {
        id: `media-${Date.now()}`,
        url,
        thumbnailUrl,
        caption: media.caption || '',
        timestamp: media.timestamp,
        isFavorite: false,
      };
      
      set(state => ({
        mediaItems: [newItem, ...state.mediaItems],
        mediaCount: state.mediaCount + 1,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Upload failed:', error);
      set({ isLoading: false, error: 'Upload failed' });
      throw error;
    }
  },
  
  loadVaultContents: async () => {
    set({ isLoading: true, error: null });
    
    try {
      // In a real app, this would fetch from Firebase and decrypt
      // Using mock data for demonstration
      
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, we would decrypt each media file here
      const decryptedMedia = MOCK_MEDIA_ITEMS.map(item => ({
        ...item,
        url: decryptMedia(item.url),
        thumbnailUrl: decryptMedia(item.thumbnailUrl),
      }));
      
      set({ 
        mediaItems: decryptedMedia, 
        mediaCount: decryptedMedia.length,
        isLoading: false 
      });
    } catch (error) {
      console.error('Failed to load vault contents:', error);
      set({ isLoading: false, error: 'Failed to load media' });
    }
  },
  
  toggleFavorite: (mediaId) => {
    set(state => ({
      mediaItems: state.mediaItems.map(item =>
        item.id === mediaId
          ? { ...item, isFavorite: !item.isFavorite }
          : item
      ),
    }));
  },
  
  deleteMedia: async (mediaId) => {
    set({ isLoading: true, error: null });
    
    try {
      const mediaToDelete = get().mediaItems.find(item => item.id === mediaId);
      
      if (mediaToDelete) {
        // In a real app, delete from Firebase storage
        await mockDeleteFromStorage(mediaToDelete.url);
        
        // Remove from local state
        set(state => ({
          mediaItems: state.mediaItems.filter(item => item.id !== mediaId),
          mediaCount: state.mediaCount - 1,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('Delete failed:', error);
      set({ isLoading: false, error: 'Delete failed' });
      throw error;
    }
  },
  
  clearVault: async () => {
    set({ isLoading: true, error: null });
    
    try {
      // In a real app, this would delete all files from Firebase
      const deletePromises = get().mediaItems.map(item => 
        mockDeleteFromStorage(item.url)
      );
      
      await Promise.all(deletePromises);
      
      set({ 
        mediaItems: [], 
        mediaCount: 0,
        isLoading: false 
      });
    } catch (error) {
      console.error('Failed to clear vault:', error);
      set({ isLoading: false, error: 'Failed to clear vault' });
      throw error;
    }
  },
}));