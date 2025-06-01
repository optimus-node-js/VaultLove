import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject, 
  listAll, 
  getMetadata,
  updateMetadata
} from 'firebase/storage';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { storage, db, analytics } from '../config/firebase';
import { logEvent } from 'firebase/analytics';
import authService from './auth';

export interface MediaFile {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  category: 'photo' | 'video' | 'document' | 'audio';
  fileSize: number;
  downloadURL: string;
  thumbnailURL?: string;
  storagePath: string;
  uploadedBy: string;
  uploadedAt: Timestamp;
  caption?: string;
  tags?: string[];
  isFavorite: boolean;
  isShared: boolean;
  metadata?: Record<string, any>;
}

export interface BulkUploadProgress {
  totalFiles: number;
  completedFiles: number;
  currentFile?: string;
  overallProgress: number;
  files: Array<{
    fileName: string;
    progress: number;
    isCompleted: boolean;
    error?: string;
  }>;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  isCompleted: boolean;
  downloadURL?: string;
  error?: string;
}

class StorageService {
  private mediaListeners: ((media: MediaFile[]) => void)[] = [];

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    try {
      console.log('Storage service initialized');
    } catch (error) {
      console.error('Storage service initialization error:', error);
    }
  }

  // File Upload Methods
  async uploadFile(
    fileUri: string,
    fileName: string,
    mimeType: string,
    caption?: string,
    onProgress?: (progress: number) => void
  ): Promise<MediaFile> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated to upload files');
      }

      console.log('Starting upload:', { fileName, mimeType, fileUri });

      // Validate file URI
      if (!fileUri || !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
        throw new Error('Invalid file URI provided');
      }

      // Create unique file name to avoid conflicts
      const timestamp = Date.now();
      const fileExtension = fileName.split('.').pop() || 'unknown';
      const uniqueFileName = `${timestamp}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
      
      // Determine storage path based on file type
      const category = this.determineFileCategory(mimeType);
      const storagePath = `uploads/${currentUser.uid}/${category}/${uniqueFileName}`;
      
      console.log('Upload path:', storagePath);

      // Create storage reference
      const storageRef = ref(storage, storagePath);

      // Convert file URI to blob for upload
      const blob = await this.uriToBlob(fileUri);
      console.log('Blob created, size:', blob.size);

      // Create upload task with progress monitoring
      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: mimeType,
        customMetadata: {
          originalName: fileName,
          uploadedBy: currentUser.uid,
          uploadedAt: new Date().toISOString(),
          category: category,
          caption: caption || ''
        }
      });

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload progress: ${progress}%`);
            onProgress?.(progress);
          },
          (error) => {
            console.error('Upload error:', error);
            reject(new Error(`Upload failed: ${error.message}`));
          },
          async () => {
            try {
              // Upload completed successfully
              console.log('Upload completed, getting download URL...');
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Download URL obtained:', downloadURL);

              // Create media record in Firestore
              const mediaData: Omit<MediaFile, 'id'> = {
                fileName: uniqueFileName,
                originalName: fileName,
                mimeType,
                category,
                fileSize: blob.size,
                downloadURL,
                storagePath,
                uploadedBy: currentUser.uid,
                uploadedAt: serverTimestamp() as Timestamp,
                caption,
                isFavorite: false,
                isShared: false,
                metadata: {
                  userAgent: 'VaultLove Mobile App',
                  platform: 'React Native'
                }
              };

              console.log('Creating Firestore record...');
              const docRef = await addDoc(collection(db, 'media'), mediaData);
              console.log('Firestore record created:', docRef.id);

              const createdMedia: MediaFile = {
                id: docRef.id,
                ...mediaData,
                uploadedAt: Timestamp.now() // Use current timestamp for consistency
              };

              // Log analytics
              if (analytics) {
                logEvent(analytics, 'file_uploaded', {
                  file_type: category,
                  file_size: blob.size,
                  user_id: currentUser.uid
                });
              }

              resolve(createdMedia);
            } catch (firestoreError) {
              console.error('Firestore creation error:', firestoreError);
              reject(new Error(`Failed to save file record: ${firestoreError}`));
            }
          }
        );
      });
    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  }

  async uploadMultipleFiles(
    files: Array<{ uri: string; name: string; type: string; caption?: string }>,
    onProgress?: (progress: BulkUploadProgress) => void
  ): Promise<MediaFile[]> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated to upload files');
      }

      console.log('Starting bulk upload for', files.length, 'files');

      const totalFiles = files.length;
      let completedFiles = 0;
      const results: MediaFile[] = [];
      const fileProgresses: BulkUploadProgress['files'] = files.map(file => ({
        fileName: file.name,
        progress: 0,
        isCompleted: false
      }));

      // Initialize progress
      const updateProgress = () => {
        const overallProgress = fileProgresses.reduce((sum, file) => sum + file.progress, 0) / totalFiles;
        onProgress?.({
          totalFiles,
          completedFiles,
          overallProgress,
          files: [...fileProgresses]
        });
      };

      // Upload files concurrently with limited concurrency
      const uploadPromises = files.map(async (file, index) => {
        try {
          const result = await this.uploadFile(
            file.uri,
            file.name,
            file.type,
            file.caption,
            (progress) => {
              fileProgresses[index].progress = progress;
              updateProgress();
            }
          );

          fileProgresses[index].isCompleted = true;
          completedFiles++;
          results.push(result);
          updateProgress();

          return result;
        } catch (error) {
          console.error(`Upload failed for ${file.name}:`, error);
          fileProgresses[index].error = error instanceof Error ? error.message : 'Upload failed';
          fileProgresses[index].isCompleted = true;
          completedFiles++;
          updateProgress();
          
          return null;
        }
      });

      // Wait for all uploads to complete
      await Promise.allSettled(uploadPromises);

      console.log('Bulk upload completed. Successful uploads:', results.length);

      // Log analytics
      if (analytics) {
        logEvent(analytics, 'bulk_upload_completed', {
          total_files: totalFiles,
          successful_uploads: results.length,
          failed_uploads: totalFiles - results.length,
          user_id: currentUser.uid
        });
      }

      return results;
    } catch (error) {
      console.error('Bulk upload error:', error);
      throw error;
    }
  }

  // File Management Methods
  async deleteMedia(mediaId: string): Promise<void> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      console.log('Deleting media:', mediaId);

      // Get media document
      const mediaDoc = await getDocs(query(
        collection(db, 'media'),
        where('__name__', '==', mediaId),
        where('uploadedBy', '==', currentUser.uid)
      ));

      if (mediaDoc.empty) {
        throw new Error('Media not found or you do not have permission to delete it');
      }

      const mediaData = mediaDoc.docs[0].data() as MediaFile;

      // Delete from storage
      const storageRef = ref(storage, mediaData.storagePath);
      await deleteObject(storageRef);

      // Delete from Firestore
      await deleteDoc(doc(db, 'media', mediaId));

      console.log('Media deleted successfully');

      // Log analytics
      if (analytics) {
        logEvent(analytics, 'file_deleted', {
          file_type: mediaData.category,
          user_id: currentUser.uid
        });
      }
    } catch (error) {
      console.error('Delete media error:', error);
      throw error;
    }
  }

  async toggleFavorite(mediaId: string): Promise<void> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      const mediaRef = doc(db, 'media', mediaId);
      const mediaDoc = await getDocs(query(
        collection(db, 'media'),
        where('__name__', '==', mediaId),
        where('uploadedBy', '==', currentUser.uid)
      ));

      if (mediaDoc.empty) {
        throw new Error('Media not found');
      }

      const currentData = mediaDoc.docs[0].data() as MediaFile;
      await updateDoc(mediaRef, {
        isFavorite: !currentData.isFavorite,
        updatedAt: serverTimestamp()
      });

      console.log('Favorite status toggled for media:', mediaId);
    } catch (error) {
      console.error('Toggle favorite error:', error);
      throw error;
    }
  }

  // Media Subscription
  subscribeToUserMedia(callback: (media: MediaFile[]) => void): () => void {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      console.warn('No authenticated user for media subscription');
      callback([]);
      return () => {};
    }

    console.log('Setting up media subscription for user:', currentUser.uid);

    const q = query(
      collection(db, 'media'),
      where('uploadedBy', '==', currentUser.uid),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const media: MediaFile[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as MediaFile));

          console.log('Media subscription update:', media.length, 'files');
          callback(media);
        } catch (error) {
          console.error('Media subscription error:', error);
          callback([]);
        }
      },
      (error) => {
        console.error('Media subscription listener error:', error);
        callback([]);
      }
    );

    return unsubscribe;
  }

  // Utility Methods
  private async uriToBlob(uri: string): Promise<Blob> {
    try {
      console.log('Converting URI to blob:', uri);
      
      // For React Native, we need to handle file URIs differently
      const response = await fetch(uri);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('Blob conversion successful, size:', blob.size);
      
      return blob;
    } catch (error) {
      console.error('URI to blob conversion error:', error);
      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private determineFileCategory(mimeType: string): 'photo' | 'video' | 'document' | 'audio' {
    if (mimeType.startsWith('image/')) return 'photo';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  // Public getters
  getCurrentUserMediaCount(): Promise<number> {
    return new Promise((resolve) => {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        resolve(0);
        return;
      }

      const q = query(
        collection(db, 'media'),
        where('uploadedBy', '==', currentUser.uid)
      );

      getDocs(q)
        .then(snapshot => resolve(snapshot.size))
        .catch(() => resolve(0));
    });
  }

  async getStorageStats(): Promise<{
    totalSize: number;
    fileCount: number;
    mediaByType: Record<string, number>;
  }> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return {
          totalSize: 0,
          fileCount: 0,
          mediaByType: {}
        };
      }

      console.log('Loading storage stats for user:', currentUser.uid);

      const q = query(
        collection(db, 'media'),
        where('uploadedBy', '==', currentUser.uid)
      );

      const snapshot = await getDocs(q);
      let totalSize = 0;
      const mediaByType: Record<string, number> = {
        photo: 0,
        video: 0,
        document: 0,
        audio: 0
      };

      snapshot.docs.forEach(doc => {
        const data = doc.data() as MediaFile;
        totalSize += data.fileSize || 0;
        mediaByType[data.category] = (mediaByType[data.category] || 0) + 1;
      });

      const stats = {
        totalSize,
        fileCount: snapshot.size,
        mediaByType
      };

      console.log('Storage stats loaded:', stats);
      return stats;
    } catch (error) {
      console.error('Get storage stats error:', error);
      return {
        totalSize: 0,
        fileCount: 0,
        mediaByType: {}
      };
    }
  }

  // Cleanup
  cleanup() {
    this.mediaListeners = [];
  }
}

export default new StorageService(); 