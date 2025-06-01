import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject, 
  listAll,
  getMetadata,
  UploadTask
} from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { storage, db, analytics } from '../config/firebase';
import { logEvent } from 'firebase/analytics';
import authService from './auth';

export interface MediaFile {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  category: 'photo' | 'video' | 'document' | 'audio' | 'other';
  size: number;
  downloadURL: string;
  thumbnailURL?: string;
  storagePath: string;
  userId: string;
  partnerId?: string;
  caption?: string;
  tags?: string[];
  isFavorite: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  isCompleted: boolean;
  error?: string;
  downloadURL?: string;
}

export interface BulkUploadProgress {
  totalFiles: number;
  completedFiles: number;
  currentFile?: string;
  overallProgress: number;
  files: UploadProgress[];
}

class StorageService {
  private uploadTasks: Map<string, UploadTask> = new Map();
  private mediaListeners: ((media: MediaFile[]) => void)[] = [];

  // Helper function to categorize files based on MIME type
  private categorizeFile(mimeType: string): 'photo' | 'video' | 'document' | 'audio' | 'other' {
    if (mimeType.startsWith('image/')) {
      return 'photo';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text') ||
      mimeType.includes('application/msword') ||
      mimeType.includes('application/vnd.openxmlformats-officedocument') ||
      mimeType.includes('application/vnd.ms-excel') ||
      mimeType.includes('application/vnd.ms-powerpoint')
    ) {
      return 'document';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else {
      return 'other';
    }
  }

  // Upload single file with progress
  async uploadFile(
    fileUri: string, 
    fileName: string, 
    mimeType: string, 
    caption?: string,
    onProgress?: (progress: number) => void
  ): Promise<MediaFile> {
    const user = authService.getCurrentUser();
    const userProfile = authService.getUserProfile();
    
    if (!user || !userProfile) {
      throw new Error('No authenticated user');
    }

    try {
      // Create file reference
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const category = this.categorizeFile(mimeType);
      const storagePath = `users/${user.uid}/media/${category}/${timestamp}_${sanitizedFileName}`;
      const storageRef = ref(storage, storagePath);

      // Convert URI to blob for upload
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // Create upload task
      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: mimeType,
      });

      this.uploadTasks.set(fileName, uploadTask);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress?.(progress);
          },
          (error) => {
            this.uploadTasks.delete(fileName);
            console.error('Upload error:', error);
            reject(error);
          },
          async () => {
            try {
              this.uploadTasks.delete(fileName);
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              // Save metadata to Firestore with category
              const mediaData: Omit<MediaFile, 'id'> = {
                fileName: sanitizedFileName,
                originalName: fileName,
                mimeType,
                category,
                size: blob.size,
                downloadURL,
                storagePath,
                userId: user.uid,
                partnerId: userProfile.partnerId,
                caption,
                tags: [],
                isFavorite: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              const docRef = await addDoc(collection(db, 'media'), mediaData);
              const mediaFile: MediaFile = { id: docRef.id, ...mediaData };

              // Log analytics event with category
              if (analytics) {
                logEvent(analytics, 'media_uploaded', { 
                  file_type: mimeType.split('/')[0],
                  category: category
                });
              }

              resolve(mediaFile);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  }

  // Bulk upload with progress tracking
  async uploadMultipleFiles(
    files: { uri: string; name: string; type: string; caption?: string }[],
    onProgress?: (progress: BulkUploadProgress) => void
  ): Promise<MediaFile[]> {
    const results: MediaFile[] = [];
    const progressData: BulkUploadProgress = {
      totalFiles: files.length,
      completedFiles: 0,
      overallProgress: 0,
      files: files.map(file => ({
        fileName: file.name,
        progress: 0,
        isCompleted: false,
      })),
    };

    onProgress?.(progressData);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        progressData.currentFile = file.name;
        onProgress?.(progressData);

        try {
          const result = await this.uploadFile(
            file.uri,
            file.name,
            file.type,
            file.caption,
            (fileProgress) => {
              progressData.files[i].progress = fileProgress;
              progressData.overallProgress = 
                (progressData.completedFiles / progressData.totalFiles) * 100 +
                (fileProgress / progressData.totalFiles);
              onProgress?.(progressData);
            }
          );

          results.push(result);
          progressData.files[i].isCompleted = true;
          progressData.files[i].downloadURL = result.downloadURL;
          progressData.completedFiles++;
          progressData.overallProgress = (progressData.completedFiles / progressData.totalFiles) * 100;
          onProgress?.(progressData);

        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          progressData.files[i].error = error instanceof Error ? error.message : 'Upload failed';
          onProgress?.(progressData);
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk upload error:', error);
      throw error;
    }
  }

  // Cancel upload
  cancelUpload(fileName: string): boolean {
    const uploadTask = this.uploadTasks.get(fileName);
    if (uploadTask) {
      uploadTask.cancel();
      this.uploadTasks.delete(fileName);
      return true;
    }
    return false;
  }

  // Get user media with real-time updates
  subscribeToUserMedia(callback: (media: MediaFile[]) => void) {
    const user = authService.getCurrentUser();
    
    if (!user) {
      console.log('No authenticated user for media subscription');
      callback([]);
      return () => {};
    }

    const userProfile = authService.getUserProfile();
    
    // Immediately call callback with empty array to stop loading state
    callback([]);
    
    // Query for user's media and partner's media (if connected)
    const userIds = [user.uid];
    if (userProfile?.partnerId) {
      userIds.push(userProfile.partnerId);
    }

    try {
      const q = query(
        collection(db, 'media'),
        where('userId', 'in', userIds),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
          const media: MediaFile[] = [];
          snapshot.forEach((doc) => {
            media.push({ id: doc.id, ...doc.data() } as MediaFile);
          });
          callback(media);
        },
        (error) => {
          console.error('Media subscription error:', error);
          // Still call callback with empty array on error to prevent infinite loading
          callback([]);
        }
      );

      this.mediaListeners.push(callback);
      return unsubscribe;
    } catch (error) {
      console.error('Media subscription setup error:', error);
      callback([]);
      return () => {};
    }
  }

  // Delete media file
  async deleteMedia(mediaId: string): Promise<void> {
    const user = authService.getCurrentUser();
    if (!user) throw new Error('No authenticated user');

    try {
      // Get media document
      const mediaDoc = await getDocs(
        query(collection(db, 'media'), where('id', '==', mediaId))
      );

      if (mediaDoc.empty) {
        throw new Error('Media not found');
      }

      const mediaData = mediaDoc.docs[0].data() as MediaFile;
      
      // Check if user owns this media
      if (mediaData.userId !== user.uid) {
        throw new Error('Unauthorized to delete this media');
      }

      // Delete from storage
      const storageRef = ref(storage, mediaData.storagePath);
      await deleteObject(storageRef);

      // Delete from Firestore
      await deleteDoc(doc(db, 'media', mediaId));

      // Log analytics event
      if (analytics) {
        logEvent(analytics, 'media_deleted', { 
          file_type: mediaData.mimeType.split('/')[0] 
        });
      }
    } catch (error) {
      console.error('Delete media error:', error);
      throw error;
    }
  }

  // Update media metadata
  async updateMedia(mediaId: string, updates: Partial<Pick<MediaFile, 'caption' | 'tags' | 'isFavorite'>>): Promise<void> {
    const user = authService.getCurrentUser();
    if (!user) throw new Error('No authenticated user');

    try {
      await updateDoc(doc(db, 'media', mediaId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Update media error:', error);
      throw error;
    }
  }

  // Toggle favorite status
  async toggleFavorite(mediaId: string): Promise<void> {
    try {
      const mediaDoc = await getDocs(
        query(collection(db, 'media'), where('id', '==', mediaId))
      );

      if (mediaDoc.empty) {
        throw new Error('Media not found');
      }

      const mediaData = mediaDoc.docs[0].data() as MediaFile;
      await this.updateMedia(mediaId, { isFavorite: !mediaData.isFavorite });
    } catch (error) {
      console.error('Toggle favorite error:', error);
      throw error;
    }
  }

  // Get storage usage statistics
  async getStorageStats(): Promise<{ totalSize: number; fileCount: number; mediaByType: Record<string, number> }> {
    const user = authService.getCurrentUser();
    if (!user) throw new Error('No authenticated user');

    try {
      const q = query(
        collection(db, 'media'),
        where('userId', '==', user.uid)
      );

      const snapshot = await getDocs(q);
      let totalSize = 0;
      const mediaByType: Record<string, number> = {};

      snapshot.forEach((doc) => {
        const media = doc.data() as MediaFile;
        totalSize += media.size;
        
        const type = media.mimeType.split('/')[0];
        mediaByType[type] = (mediaByType[type] || 0) + 1;
      });

      return {
        totalSize,
        fileCount: snapshot.size,
        mediaByType,
      };
    } catch (error) {
      console.error('Get storage stats error:', error);
      throw error;
    }
  }

  // Clean up listeners
  cleanup() {
    this.mediaListeners.length = 0;
    this.uploadTasks.clear();
  }
}

export const storageService = new StorageService();
export default storageService; 