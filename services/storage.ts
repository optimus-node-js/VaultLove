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
  getDoc,
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
  uploadedByName?: string; // Partner's name for easy display
  uploadedAt: Timestamp;
  caption?: string;
  tags?: string[];
  isFavorite: boolean;
  favoriteBy?: string[]; // Array of user IDs who favorited this
  isShared: boolean;
  sharedCollectionId?: string; // Link to shared collection if shared
  metadata?: Record<string, any>;
  albumId?: string; // Link to album if part of one
  lastModifiedBy?: string; // Track who last modified (for captions, favorites, etc.)
  lastModifiedAt?: Timestamp;
}

export interface Album {
  id: string;
  name: string;
  description?: string;
  coverImageUrl: string;
  createdBy: string;
  createdByName?: string; // Partner's name for easy display
  createdAt: Timestamp;
  updatedAt: Timestamp;
  mediaCount: number;
  isShared: boolean;
  sharedCollectionId?: string; // Link to shared collection if shared
  mediaIds: string[]; // Array of media file IDs in this album
  lastModifiedBy?: string; // Track who last modified
  lastModifiedAt?: Timestamp;
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

      console.log('📤 Starting upload:', { fileName, mimeType, fileUri, userUid: currentUser.uid });

      // Validate file URI
      if (!fileUri) {
        throw new Error('File URI is required');
      }

      // For web, allow blob: URIs as well
      const isValidUri = fileUri.startsWith('file://') || 
                        fileUri.startsWith('content://') || 
                        fileUri.startsWith('blob:') ||
                        fileUri.startsWith('data:');
      
      if (!isValidUri) {
        console.error('Invalid file URI:', fileUri);
        throw new Error(`Invalid file URI format: ${fileUri.substring(0, 50)}...`);
      }

      // Create unique file name to avoid conflicts
      const timestamp = Date.now();
      const fileExtension = fileName.split('.').pop() || 'unknown';
      const uniqueFileName = `${timestamp}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
      
      // Determine storage path based on file type
      const category = this.determineFileCategory(mimeType);
      const storagePath = `uploads/${currentUser.uid}/${category}/${uniqueFileName}`;
      
      console.log('📁 Upload path:', storagePath);
      console.log('📋 File category:', category);

      // Create storage reference
      const storageRef = ref(storage, storagePath);
      console.log('📦 Storage reference created');

      // Convert file URI to blob for upload
      console.log('🔄 Converting URI to blob...');
      const blob = await this.uriToBlob(fileUri);
      console.log('✅ Blob created, size:', blob.size, 'bytes');

      if (blob.size === 0) {
        throw new Error('File appears to be empty');
      }

      // Create upload task with progress monitoring
      console.log('🚀 Starting upload task...');
      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: mimeType,
        customMetadata: {
          originalName: fileName,
          uploadedBy: currentUser.uid,
          uploadedAt: new Date().toISOString(),
          category: category,
          ...(caption && { caption }) // Only include caption if it has a value
        }
      });

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`📊 Upload progress: ${Math.round(progress)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes)`);
            onProgress?.(progress);
          },
          (error) => {
            console.error('❌ Upload error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            reject(new Error(`Upload failed: ${error.message}`));
          },
          async () => {
            try {
              // Upload completed successfully
              console.log('✅ Upload completed, getting download URL...');
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('🔗 Download URL obtained:', downloadURL);

              // Get user profile for partner information
              const userProfile = authService.getUserProfile();
              
              // Create media record in Firestore - exclude undefined fields
              const mediaData: Omit<MediaFile, 'id'> = {
                fileName: uniqueFileName,
                originalName: fileName,
                mimeType,
                category,
                fileSize: blob.size,
                downloadURL,
                storagePath,
                uploadedBy: currentUser.uid,
                uploadedByName: userProfile?.displayName || 'User',
                uploadedAt: serverTimestamp() as Timestamp,
                ...(caption && { caption }), // Only include caption if it has a value
                favoriteBy: [], // Initialize empty favorites array
                isFavorite: false,
                isShared: userProfile?.partnerStatus === 'connected',
                ...(userProfile?.sharedCollectionId && { sharedCollectionId: userProfile.sharedCollectionId }),
                metadata: {
                  userAgent: 'VaultLove Mobile App',
                  platform: 'React Native'
                }
              };

              console.log('📝 Creating Firestore record...');
              const docRef = await addDoc(collection(db, 'media'), mediaData);
              console.log('✅ Firestore record created:', docRef.id);

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

              console.log('🎉 Upload completed successfully!');
              resolve(createdMedia);
            } catch (firestoreError) {
              console.error('❌ Firestore creation error:', firestoreError);
              reject(new Error(`Failed to save file record: ${firestoreError}`));
            }
          }
        );
      });
    } catch (error) {
      console.error('❌ Upload file error:', error);
      throw error;
    }
  }

  async uploadMultipleFiles(
    files: Array<{ 
      uri: string; 
      name: string; 
      type: string; 
      caption?: string;
      albumInfo?: {
        albumName: string;
        albumDescription?: string;
        isAlbum: boolean;
        existingAlbumId?: string;
      };
    }>,
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

      // Check if this is an album upload
      const albumInfo = files[0]?.albumInfo;
      const isAlbumUpload = albumInfo?.isAlbum && albumInfo.albumName.trim();

      console.log('Is album upload:', isAlbumUpload, albumInfo);

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

      // Create album if this was an album upload
      if (isAlbumUpload && results.length > 0 && albumInfo) {
        try {
          if (albumInfo.existingAlbumId) {
            // Add to existing album
            console.log('Adding media to existing album:', albumInfo.existingAlbumId);
            await this.addMediaToAlbum(albumInfo.existingAlbumId, results);
            console.log('Media added to existing album successfully');
          } else {
            // Create new album
            console.log('Creating new album after successful uploads...');
            const album = await this.createAlbum(
              albumInfo.albumName,
              albumInfo.albumDescription,
              results
            );
            console.log('New album created successfully:', album.id);
          }
        } catch (albumError) {
          console.error('Album operation failed:', albumError);
          // Don't throw here - uploads were successful, just album operation failed
        }
      }

      // Log analytics
      if (analytics) {
        logEvent(analytics, 'bulk_upload_completed', {
          total_files: totalFiles,
          successful_uploads: results.length,
          failed_uploads: totalFiles - results.length,
          is_album: isAlbumUpload,
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

      console.log('🔄 Toggling favorite for media:', mediaId, 'by user:', currentUser.uid);

      const mediaRef = doc(db, 'media', mediaId);
      const mediaDoc = await getDoc(mediaRef);
      
      if (!mediaDoc.exists()) {
        throw new Error('Media file not found');
      }

      const mediaData = mediaDoc.data() as MediaFile;
      const currentFavoriteBy = mediaData.favoriteBy || [];
      const isCurrentlyFavorited = currentFavoriteBy.includes(currentUser.uid);
      
      // Update favoriteBy array - add or remove current user
      let newFavoriteBy: string[];
      if (isCurrentlyFavorited) {
        // Remove current user from favorites
        newFavoriteBy = currentFavoriteBy.filter(uid => uid !== currentUser.uid);
        console.log('❌ Removing user from favorites');
      } else {
        // Add current user to favorites
        newFavoriteBy = [...currentFavoriteBy, currentUser.uid];
        console.log('❤️ Adding user to favorites');
      }
      
      await updateDoc(mediaRef, {
        favoriteBy: newFavoriteBy,
        lastModifiedBy: currentUser.uid,
        lastModifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log('✅ Favorite status updated. New favoriteBy:', newFavoriteBy);
    } catch (error) {
      console.error('❌ Toggle favorite error:', error);
      throw error;
    }
  }

  async updateMediaCaption(mediaId: string, caption: string): Promise<void> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      console.log('Updating caption for media:', mediaId);

      const mediaRef = doc(db, 'media', mediaId);
      const mediaDoc = await getDocs(query(
        collection(db, 'media'),
        where('__name__', '==', mediaId),
        where('uploadedBy', '==', currentUser.uid)
      ));

      if (mediaDoc.empty) {
        throw new Error('Media not found or you do not have permission to edit it');
      }

      await updateDoc(mediaRef, {
        caption: caption || null,
        updatedAt: serverTimestamp()
      });

      console.log('Caption updated successfully for media:', mediaId);
    } catch (error) {
      console.error('Update caption error:', error);
      throw error;
    }
  }

  // Media Subscription
  subscribeToUserMedia(callback: (media: MediaFile[]) => void): () => void {
    const currentUser = authService.getCurrentUser();
    const userProfile = authService.getUserProfile();
    
    if (!currentUser) {
      console.warn('No authenticated user for media subscription');
      callback([]);
      return () => {};
    }

    console.log('Setting up media subscription for user:', currentUser.uid);
    console.log('Partner status:', userProfile?.partnerStatus);
    console.log('Shared collection ID:', userProfile?.sharedCollectionId);

    // If user has a partner and shared collection, subscribe to shared media
    if (userProfile?.partnerStatus === 'connected' && userProfile?.sharedCollectionId) {
      console.log('📡 Setting up SHARED media subscription');
      
      const sharedQuery = query(
        collection(db, 'media'),
        where('sharedCollectionId', '==', userProfile.sharedCollectionId),
        orderBy('uploadedAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        sharedQuery,
        (snapshot) => {
          try {
            const media: MediaFile[] = snapshot.docs.map(doc => {
              const data = doc.data() as MediaFile;
              
              // Enhance with partner info for display
              return {
                ...data,
                id: doc.id,
                // Set favorite status based on current user
                isFavorite: data.favoriteBy?.includes(currentUser.uid) || false
              } as MediaFile;
            });

            console.log('📡 Shared media subscription update:', media.length, 'files');
            console.log('📊 Media breakdown:', {
              total: media.length,
              byCurrentUser: media.filter(m => m.uploadedBy === currentUser.uid).length,
              byPartner: media.filter(m => m.uploadedBy !== currentUser.uid).length,
              favorites: media.filter(m => m.isFavorite).length
            });
            
            callback(media);
          } catch (error) {
            console.error('❌ Shared media subscription error:', error);
            callback([]);
          }
        },
        (error) => {
          console.error('❌ Shared media subscription listener error:', error);
          callback([]);
        }
      );

      return unsubscribe;
    } else {
      // User is not partnered, use individual media subscription
      console.log('📡 Setting up INDIVIDUAL media subscription');
      
      const individualQuery = query(
        collection(db, 'media'),
        where('uploadedBy', '==', currentUser.uid),
        where('sharedCollectionId', '==', null), // Only individual media
        orderBy('uploadedAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        individualQuery,
        (snapshot) => {
          try {
            const media: MediaFile[] = snapshot.docs.map(doc => ({
              ...doc.data(),
              id: doc.id,
              isFavorite: doc.data().isFavorite || false
            } as MediaFile));

            console.log('📡 Individual media subscription update:', media.length, 'files');
            callback(media);
          } catch (error) {
            console.error('❌ Individual media subscription error:', error);
            callback([]);
          }
        },
        (error) => {
          console.error('❌ Individual media subscription listener error:', error);
          callback([]);
        }
      );

      return unsubscribe;
    }
  }

  // Utility Methods
  private async uriToBlob(uri: string): Promise<Blob> {
    try {
      console.log('🔄 Converting URI to blob:', uri.substring(0, 100) + '...');
      
      // Handle different URI formats
      if (uri.startsWith('data:')) {
        console.log('📄 Processing data URI...');
        // Handle data URIs
        const response = await fetch(uri);
        const blob = await response.blob();
        console.log('✅ Data URI converted to blob, size:', blob.size);
        return blob;
      }
      
      // For React Native and web, we need to handle file URIs differently
      console.log('🌐 Processing file/content URI...');
      const response = await fetch(uri);
      
      if (!response.ok) {
        console.error('❌ Fetch failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      console.log('✅ Fetch successful, response status:', response.status);
      console.log('📦 Response headers:', Object.fromEntries(response.headers.entries()));
      
      const blob = await response.blob();
      console.log('✅ Blob conversion successful, size:', blob.size, 'type:', blob.type);
      
      if (blob.size === 0) {
        throw new Error('Received empty blob from URI');
      }
      
      return blob;
    } catch (error) {
      console.error('❌ URI to blob conversion error:', error);
      console.error('❌ Failed URI:', uri.substring(0, 100) + '...');
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
        throw new Error('User must be authenticated');
      }

      const mediaQuery = query(
        collection(db, 'media'),
        where('uploadedBy', '==', currentUser.uid)
      );

      const snapshot = await getDocs(mediaQuery);
      
      let totalSize = 0;
      const mediaByType: Record<string, number> = {
        photo: 0,
        video: 0,
        document: 0,
        audio: 0
      };

      snapshot.docs.forEach(doc => {
        const media = doc.data() as MediaFile;
        totalSize += media.fileSize;
        mediaByType[media.category] = (mediaByType[media.category] || 0) + 1;
      });

      return {
        totalSize,
        fileCount: snapshot.docs.length,
        mediaByType
      };
    } catch (error) {
      console.error('Get storage stats error:', error);
      throw error;
    }
  }

  // Album Management Methods
  async createAlbum(
    name: string,
    description?: string,
    mediaFiles: MediaFile[] = []
  ): Promise<Album> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated to create albums');
      }

      console.log('Creating album:', name, 'with', mediaFiles.length, 'files');

      // Use the first image as cover image, or a default
      const coverImageUrl = mediaFiles.length > 0 
        ? mediaFiles.find(f => f.category === 'photo')?.downloadURL || mediaFiles[0].downloadURL
        : '';

      const albumData: Omit<Album, 'id'> = {
        name: name.trim(),
        description: description?.trim(),
        coverImageUrl,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        mediaCount: mediaFiles.length,
        isShared: false,
        mediaIds: mediaFiles.map(f => f.id)
      };

      console.log('Creating album document in Firestore...');
      const albumRef = await addDoc(collection(db, 'albums'), albumData);
      console.log('Album created with ID:', albumRef.id);

      // Update media files to reference this album
      if (mediaFiles.length > 0) {
        console.log('Updating media files to reference album...');
        const updatePromises = mediaFiles.map(mediaFile => 
          updateDoc(doc(db, 'media', mediaFile.id), {
            albumId: albumRef.id,
            updatedAt: serverTimestamp()
          })
        );
        await Promise.all(updatePromises);
        console.log('Media files updated with album reference');
      }

      const createdAlbum: Album = {
        id: albumRef.id,
        ...albumData,
        createdAt: albumData.createdAt,
        updatedAt: albumData.updatedAt
      };

      return createdAlbum;
    } catch (error) {
      console.error('Create album error:', error);
      throw error;
    }
  }

  async getUserAlbums(): Promise<Album[]> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      const albumQuery = query(
        collection(db, 'albums'),
        where('createdBy', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(albumQuery);
      const albums: Album[] = [];

      snapshot.docs.forEach(doc => {
        const albumData = doc.data();
        albums.push({
          id: doc.id,
          ...albumData
        } as Album);
      });

      console.log('Retrieved', albums.length, 'albums for user');
      return albums;
    } catch (error) {
      console.error('Get user albums error:', error);
      throw error;
    }
  }

  async getAlbumMedia(albumId: string): Promise<MediaFile[]> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      console.log('Fetching media for album:', albumId);

      const mediaQuery = query(
        collection(db, 'media'),
        where('albumId', '==', albumId),
        where('uploadedBy', '==', currentUser.uid)
        // Removed orderBy to avoid composite index requirement
        // orderBy('uploadedAt', 'desc')
      );

      const snapshot = await getDocs(mediaQuery);
      const mediaFiles: MediaFile[] = [];

      snapshot.docs.forEach(doc => {
        const mediaData = doc.data();
        mediaFiles.push({
          id: doc.id,
          ...mediaData
        } as MediaFile);
      });

      // Sort manually by upload date (newest first)
      mediaFiles.sort((a, b) => {
        const aTime = a.uploadedAt?.toMillis?.() || 0;
        const bTime = b.uploadedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      console.log('Retrieved', mediaFiles.length, 'media files for album', albumId);
      return mediaFiles;
    } catch (error) {
      console.error('Get album media error:', error);
      throw error;
    }
  }

  async deleteAlbum(albumId: string): Promise<void> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      console.log('Deleting album:', albumId);

      // First, remove album reference from all media files
      const mediaQuery = query(
        collection(db, 'media'),
        where('albumId', '==', albumId),
        where('uploadedBy', '==', currentUser.uid)
      );

      const mediaSnapshot = await getDocs(mediaQuery);
      const updatePromises = mediaSnapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          albumId: null,
          updatedAt: serverTimestamp()
        })
      );

      await Promise.all(updatePromises);
      console.log('Removed album reference from', mediaSnapshot.docs.length, 'media files');

      // Delete the album document
      await deleteDoc(doc(db, 'albums', albumId));
      console.log('Album deleted successfully');

    } catch (error) {
      console.error('Delete album error:', error);
      throw error;
    }
  }

  async addMediaToAlbum(albumId: string, mediaFiles: MediaFile[]): Promise<void> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      console.log('Adding', mediaFiles.length, 'media files to album:', albumId);

      // Get the album document to verify ownership
      const albumQuery = query(
        collection(db, 'albums'),
        where('__name__', '==', albumId),
        where('createdBy', '==', currentUser.uid)
      );

      const albumSnapshot = await getDocs(albumQuery);
      if (albumSnapshot.empty) {
        throw new Error('Album not found or you do not have permission to modify it');
      }

      const albumData = albumSnapshot.docs[0].data() as Album;
      const mediaIds = mediaFiles.map(f => f.id);

      // Update media files to reference this album
      const updateMediaPromises = mediaFiles.map(mediaFile => 
        updateDoc(doc(db, 'media', mediaFile.id), {
          albumId: albumId,
          updatedAt: serverTimestamp()
        })
      );

      // Update album with new media IDs and updated count and cover
      const updatedMediaIds = [...new Set([...albumData.mediaIds, ...mediaIds])]; // Remove duplicates
      const newCoverImage = mediaFiles.find(f => f.category === 'photo')?.downloadURL || albumData.coverImageUrl;

      const updateAlbumPromise = updateDoc(doc(db, 'albums', albumId), {
        mediaIds: updatedMediaIds,
        mediaCount: updatedMediaIds.length,
        coverImageUrl: newCoverImage,
        updatedAt: serverTimestamp()
      });

      // Execute all updates
      await Promise.all([...updateMediaPromises, updateAlbumPromise]);

      console.log('Successfully added media to album');
    } catch (error) {
      console.error('Add media to album error:', error);
      throw error;
    }
  }

  cleanup() {
    this.mediaListeners = [];
  }
}

export default new StorageService(); 