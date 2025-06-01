import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  FlatList, 
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions, 
  Platform,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { 
  Heart, 
  Upload, 
  Play, 
  Trash2, 
  MoreVertical,
  Camera,
  Image as ImageIcon,
  Star,
  Download,
  Users,
  Plus,
  Grid3X3,
  Filter,
  X,
  ZoomIn,
  Upload as UploadIcon,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

// Platform-specific ActionSheet import
let ActionSheetIOS: any = null;
if (Platform.OS === 'ios') {
  ActionSheetIOS = require('react-native').ActionSheetIOS;
}

import storageService, { MediaFile, BulkUploadProgress, Album } from '../../services/storage';
import authService, { UserProfile } from '../../services/auth';

const { width } = Dimensions.get('window');
const itemSize = (width - 48 - 16) / 2; // 2 columns with padding and gap

export default function VaultScreen() {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'photo' | 'video' | 'document' | 'audio' | 'favorites'>('all');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionText, setCaptionText] = useState('');
  
  // Upload modal states - bringing from upload.tsx
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<BulkUploadProgress | null>(null);
  const [previewModal, setPreviewModal] = useState({ visible: false, uri: '', type: '' });
  
  // Album functionality states
  const [isAlbumMode, setIsAlbumMode] = useState(false);
  const [albumName, setAlbumName] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [showAlbumList, setShowAlbumList] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  
  // Album selection for upload
  const [showAlbumDropdown, setShowAlbumDropdown] = useState(false);
  const [selectedExistingAlbum, setSelectedExistingAlbum] = useState<Album | null>(null);
  const [albumSelectionMode, setAlbumSelectionMode] = useState<'new' | 'existing'>('new');
  
  // Album detail view states
  const [showAlbumDetail, setShowAlbumDetail] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumMedia, setAlbumMedia] = useState<MediaFile[]>([]);
  
  // Delete confirmation modal state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<MediaFile | null>(null);
  
  // Album context tracking for full screen navigation
  const [openedFromAlbum, setOpenedFromAlbum] = useState(false);
  const [albumContextBeforeFullScreen, setAlbumContextBeforeFullScreen] = useState<Album | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    
    // Subscribe to user profile changes
    const unsubscribeProfile = authService.onProfileChange((profile) => {
      if (mounted) {
      setUserProfile(profile);
      }
    });

    // Subscribe to media changes with error handling
    const unsubscribeMedia = storageService.subscribeToUserMedia((mediaFiles) => {
      if (mounted) {
      setMedia(mediaFiles);
        setIsInitialLoading(false);
      setIsRefreshing(false);
      }
    });

    // Load albums
    const loadAlbums = async () => {
      try {
        const userAlbums = await storageService.getUserAlbums();
        if (mounted) {
          setAlbums(userAlbums);
        }
      } catch (error) {
        console.error('Failed to load albums:', error);
      }
    };
    
    loadAlbums();

    // Set a short timeout to stop initial loading if nothing happens
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        setIsInitialLoading(false);
      }
    }, 2000); // Reduced to 2 seconds

      return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      unsubscribeProfile();
      unsubscribeMedia();
    };
  }, []);

  useEffect(() => {
    // Filter media based on selected filter
    const filtered = media.filter(item => {
      if (selectedFilter === 'photo') return item.category === 'photo';
      if (selectedFilter === 'video') return item.category === 'video';
      if (selectedFilter === 'document') return item.category === 'document';
      if (selectedFilter === 'audio') return item.category === 'audio';
      if (selectedFilter === 'favorites') return item.isFavorite;
      return true;
    });
    setFilteredMedia(filtered);

    // Update selectedMedia if it exists to reflect real-time changes
    if (selectedMedia) {
      const updatedSelectedMedia = media.find(item => item.id === selectedMedia.id);
      if (updatedSelectedMedia) {
        setSelectedMedia(updatedSelectedMedia);
        setCaptionText(updatedSelectedMedia.caption || '');
      }
    }
  }, [media, selectedFilter, selectedMedia?.id]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pickMultipleImages = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10, // Allow up to 10 files
      });

      if (!result.canceled && result.assets) {
        const files = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        }));

        if (files.length === 1) {
          // Single file upload
          uploadSingleFile(files[0]);
        } else {
          // Bulk upload
          uploadMultipleFiles(files);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const takePhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const file = {
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        };
        
        uploadSingleFile(file);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadSingleFile = async (file: { uri: string; name: string; type: string }) => {
    try {
      setIsLoading(true);
      await storageService.uploadFile(
        file.uri,
        file.name,
        file.type,
        undefined,
        (progress) => {
          console.log(`Upload progress: ${progress}%`);
        }
      );
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success!', 'Your memory has been saved to the vault');
    } catch (error) {
      console.error('Upload error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Upload Failed', 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadMultipleFiles = async (files: { uri: string; name: string; type: string }[]) => {
    try {
      setIsLoading(true);
      
      const results = await storageService.uploadMultipleFiles(
        files,
        (progress) => {
          console.log(`Bulk upload progress: ${progress.overallProgress}%`);
        }
      );

      const successCount = results.length;
      const failedCount = files.length - successCount;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (failedCount === 0) {
        Alert.alert('Success!', `All ${successCount} memories have been saved to the vault`);
      } else {
        Alert.alert('Partial Success', `${successCount} memories saved, ${failedCount} failed. Please try again for the failed uploads.`);
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Upload Failed', 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  // Upload modal functions - from upload.tsx
  const pickImages = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
      allowsEditing: false,
    });
    
    if (!result.canceled && result.assets) {
      const files = result.assets.map(asset => {
        let detectedType = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
        
        if (asset.fileName) {
          const extension = asset.fileName.toLowerCase().split('.').pop();
          if (extension) {
            const typeMap: Record<string, string> = {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'gif': 'image/gif',
              'webp': 'image/webp',
              'mp4': 'video/mp4',
              'mov': 'video/quicktime',
              'avi': 'video/avi',
              'pdf': 'application/pdf',
              'doc': 'application/msword',
              'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'txt': 'text/plain',
              'mp3': 'audio/mpeg',
              'wav': 'audio/wav',
              'm4a': 'audio/mp4',
            };
            detectedType = typeMap[extension] || detectedType;
          }
        }

        return {
          uri: asset.uri,
          name: asset.fileName || `media_${Date.now()}.${detectedType.split('/')[1]}`,
          type: detectedType,
        };
      });
      setSelectedImages(files);
    }
  };
  
  const takePhotoForModal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    
    if (cameraPermission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const file = {
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        };
        setSelectedImages([file]);
      }
    } else {
      Alert.alert("Camera Permission", "We need camera access to take photos for your vault.");
    }
  };
  
  const removeImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const clearSelection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedImages([]);
    setCaption('');
    setUploadProgress(null);
    // Reset album states
    setIsAlbumMode(false);
    setAlbumName('');
    setAlbumDescription('');
    // Reset album selection states
    setAlbumSelectionMode('new');
    setSelectedExistingAlbum(null);
    setShowAlbumDropdown(false);
  };

  const openPreview = (uri: string, type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreviewModal({ visible: true, uri, type });
  };

  const closePreview = () => {
    setPreviewModal({ visible: false, uri: '', type: '' });
  };
  
  const handleUpload = async () => {
    if (selectedImages.length === 0) {
      console.log('❌ No images selected for upload');
      return;
    }

    // Validation for album mode
    if (selectedImages.length > 1 && isAlbumMode) {
      if (albumSelectionMode === 'new' && !albumName.trim()) {
        Alert.alert('Album Name Required', 'Please enter a name for your new album.');
        return;
      }
      if (albumSelectionMode === 'existing' && !selectedExistingAlbum) {
        Alert.alert('Album Selection Required', 'Please select an existing album or create a new one.');
        return;
      }
    }

    console.log('🚀 Starting upload process...');
    console.log('📋 User profile:', userProfile);
    console.log('📷 Selected images:', selectedImages.length, 'files');
    console.log('📝 Caption:', caption);

    try {
      setIsUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const currentUser = authService.getCurrentUser();
      const currentProfile = authService.getUserProfile();
      
      console.log('👤 Current user:', currentUser?.uid);
      console.log('📱 Current profile:', currentProfile ? 'loaded' : 'not loaded');
      
      if (!currentUser) {
        console.error('❌ No authenticated user found');
        Alert.alert("Authentication Error", "Please log in again to upload files.");
        return;
      }

      console.log('✅ User authenticated, proceeding with upload...');
      
      const filesWithCaptions = selectedImages.map((file, index) => {
        console.log(`📁 File ${index + 1}:`, {
          name: file.name,
          type: file.type,
          uri: file.uri.substring(0, 50) + '...'
        });
        return {
          ...file,
          caption: selectedImages.length === 1 
            ? caption.trim() || undefined 
            : !isAlbumMode 
              ? caption.trim() || undefined 
              : undefined,
          albumInfo: selectedImages.length > 1 && isAlbumMode ? {
            albumName: albumSelectionMode === 'new' 
              ? albumName.trim() 
              : selectedExistingAlbum?.name || '',
            albumDescription: albumDescription.trim() || undefined,
            isAlbum: true,
            existingAlbumId: albumSelectionMode === 'existing' 
              ? selectedExistingAlbum?.id 
              : undefined,
          } : undefined,
        };
      });

      console.log('📦 Files prepared for upload:', filesWithCaptions.length);

      if (selectedImages.length === 1) {
        const fileName = filesWithCaptions[0].name;
        console.log('📤 Starting single file upload:', fileName);
        
        setUploadProgress({
          totalFiles: 1,
          completedFiles: 0,
          currentFile: fileName,
          overallProgress: 0,
          files: [{
            fileName,
            progress: 0,
            isCompleted: false,
          }],
        });

        console.log('📡 Calling storageService.uploadFile...');
        const result = await storageService.uploadFile(
          filesWithCaptions[0].uri,
          filesWithCaptions[0].name,
          filesWithCaptions[0].type,
          filesWithCaptions[0].caption,
          (progress) => {
            console.log('📊 Upload progress callback:', progress);
            setUploadProgress(prev => prev ? {
              ...prev,
              overallProgress: progress,
              files: [{
                fileName,
                progress,
                isCompleted: progress === 100,
              }],
            } : null);
          }
        );

        console.log('✅ Single upload result:', result ? 'success' : 'failed');

        setUploadProgress(prev => prev ? {
          ...prev,
          completedFiles: 1,
          overallProgress: 100,
          files: [{
            fileName,
            progress: 100,
            isCompleted: true,
          }],
        } : null);
      } else {
        console.log('📤 Starting bulk upload for', selectedImages.length, 'files');
        
        const initialProgress: BulkUploadProgress = {
          totalFiles: selectedImages.length,
          completedFiles: 0,
          overallProgress: 0,
          files: filesWithCaptions.map(file => ({
            fileName: file.name,
            progress: 0,
            isCompleted: false,
          })),
        };
        setUploadProgress(initialProgress);

        console.log('📡 Calling storageService.uploadMultipleFiles...');
        const results = await storageService.uploadMultipleFiles(
          filesWithCaptions,
          (progress) => {
            console.log('📊 Bulk upload progress callback:', progress);
            setUploadProgress(progress);
          }
        );

        console.log('✅ Bulk upload results:', results.length, 'successful uploads');
      }
      
      console.log('🎉 Upload process completed successfully!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const photoCount = selectedImages.filter(img => img.type.startsWith('image/')).length;
      const videoCount = selectedImages.filter(img => img.type.startsWith('video/')).length;
      
      let message = '';
      if (selectedImages.length === 1) {
        message = 'Your memory has been securely saved to the vault! 💖';
      } else {
        const parts = [];
        if (photoCount > 0) parts.push(`${photoCount} photo${photoCount > 1 ? 's' : ''}`);
        if (videoCount > 0) parts.push(`${videoCount} video${videoCount > 1 ? 's' : ''}`);
        message = `Amazing! All ${parts.join(' and ')} have been securely saved to the vault! 💖`;
      }

      // Check if this was an album upload before clearing selection
      const wasAlbumUpload = selectedImages.length > 1 && isAlbumMode;

      clearSelection();
      setShowUploadModal(false);
      
      // Refresh albums list if this was an album upload
      if (wasAlbumUpload) {
        try {
          const updatedAlbums = await storageService.getUserAlbums();
          setAlbums(updatedAlbums);
          console.log('Albums refreshed after upload');
        } catch (error) {
          console.error('Failed to refresh albums:', error);
        }
      }
      
      Alert.alert(
        "Upload Successful! 🎉", 
        message,
        [{ text: 'OK', onPress: () => {} }],
        { cancelable: false }
      );

    } catch (error) {
      console.error('❌ Upload failed with error:', error);
      
      if (error instanceof Error) {
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let errorMessage = "Please try again later.";
      if (error instanceof Error) {
        console.log('🔍 Analyzing error message:', error.message);
        if (error.message.includes('No authenticated user') || error.message.includes('User must be authenticated')) {
          errorMessage = "Please log in again to upload files.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('quota') || error.message.includes('storage')) {
          errorMessage = "Storage quota exceeded. Please free up space.";
        } else if (error.message.includes('Invalid file URI') || error.message.includes('Failed to process file')) {
          errorMessage = "There was an issue with the selected file. Please try selecting a different file.";
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          errorMessage = "Permission denied. Please check your account settings.";
        }
      }
      
      Alert.alert("Upload Failed", `${errorMessage}\n\nError details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('🏁 Upload process finished, cleaning up...');
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const showUploadOptions = () => {
    console.log('🔵 showUploadOptions called');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    console.log('🔵 Platform:', Platform.OS, 'ActionSheetIOS available:', !!ActionSheetIOS);

    // Force using Alert.alert regardless of platform for consistency
    console.log('🔵 Showing Alert dialog');
    
    // Use setTimeout to ensure alert shows up
    setTimeout(() => {
      Alert.alert(
        'Add a Memory',
        'Choose how you want to add your memory',
        [
          { 
            text: 'Take Photo', 
            onPress: () => { 
              console.log('🔵 Take Photo pressed'); 
              takePhoto(); 
            } 
          },
          { 
            text: 'Choose from Gallery', 
            onPress: () => { 
              console.log('🔵 Choose from Gallery pressed'); 
              pickMultipleImages(); 
            } 
          },
          { 
            text: 'Go to Upload Page', 
            onPress: () => { 
              console.log('🔵 Go to Upload Page pressed'); 
              router.push('/(tabs)/upload'); 
            } 
          },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }, 100);
  };

  const quickUpload = async () => {
    console.log('🚀 Quick upload started');
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
        allowsEditing: false,
      });
      
      if (!result.canceled && result.assets) {
        console.log('🚀 Files selected:', result.assets.length);
        
        const files = result.assets.map(asset => {
          let detectedType = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
          
          if (asset.fileName) {
            const extension = asset.fileName.toLowerCase().split('.').pop();
            if (extension) {
              const typeMap: Record<string, string> = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'mp4': 'video/mp4',
                'mov': 'video/quicktime',
                'avi': 'video/avi',
              };
              detectedType = typeMap[extension] || detectedType;
            }
          }

          return {
            uri: asset.uri,
            name: asset.fileName || `media_${Date.now()}.${detectedType.split('/')[1]}`,
            type: detectedType,
          };
        });

        console.log('🚀 Starting upload for', files.length, 'files');
        setIsLoading(true);

        if (files.length === 1) {
          // Single file upload
          await uploadSingleFile(files[0]);
        } else {
          // Multiple files upload
          await uploadMultipleFiles(files);
        }
      }
    } catch (error) {
      console.error('Quick upload error:', error);
      setIsLoading(false);
      setTimeout(() => {
        Alert.alert('Upload Error', 'Failed to upload files. Please try again.');
      }, 100);
    }
  };

  const quickUploadToVault = () => {
    console.log('🔴 Plus button clicked - quickUploadToVault called');
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Show the upload modal directly
      setShowUploadModal(true);
    } catch (error) {
      console.error('Error in quickUploadToVault:', error);
      setTimeout(() => {
        Alert.alert('Error', 'Failed to show upload options');
      }, 100);
    }
  };

  const openAlbumDetail = async (album: Album) => {
    try {
      console.log('🔍 Opening album:', album.name);
      setSelectedAlbum(album);
      // Transition from album list to album detail within the same modal
      setShowAlbumDetail(true);
      
      // Fetch media files for this album
      const mediaFiles = await storageService.getAlbumMedia(album.id);
      setAlbumMedia(mediaFiles);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Failed to load album media:', error);
      Alert.alert('Error', 'Failed to load album content');
    }
  };

  const closeAlbumDetail = () => {
    console.log('🔙 Closing album detail, returning to album list');
    setShowAlbumDetail(false);
    setSelectedAlbum(null);
    setAlbumMedia([]);
    // showAlbumList should remain true to show the album list
  };

  const refreshAlbumMedia = async () => {
    if (selectedAlbum) {
      try {
        const mediaFiles = await storageService.getAlbumMedia(selectedAlbum.id);
        setAlbumMedia(mediaFiles);
      } catch (error) {
        console.error('Failed to refresh album media:', error);
      }
    }
  };

  const toggleFavoriteInAlbum = async (mediaId: string) => {
    try {
      await storageService.toggleFavorite(mediaId);
      
      // Update the albumMedia state immediately for real-time UI update
      setAlbumMedia(prev => prev.map(media => 
        media.id === mediaId 
          ? { ...media, isFavorite: !media.isFavorite }
          : media
      ));
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Toggle favorite error:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const deleteMediaFromAlbum = async (mediaId: string) => {
    console.log('🗑️ deleteMediaFromAlbum called for:', mediaId);
    
    const mediaItem = albumMedia.find(item => item.id === mediaId);
    if (mediaItem) {
      console.log('🗑️ Found media item, opening delete confirmation modal');
      setMediaToDelete(mediaItem);
      setShowDeleteConfirmation(true);
    }
  };

  const confirmDelete = async () => {
    if (!mediaToDelete) return;
    
    console.log('🗑️ Confirming delete for:', mediaToDelete.id);
    console.log('🗑️ openedFromAlbum:', openedFromAlbum);
    
    try {
      await storageService.deleteMedia(mediaToDelete.id);
      
      // Update albumMedia if we're in album detail view or if we'll return to album
      if (showAlbumDetail && albumMedia.length > 0) {
        setAlbumMedia(prev => prev.filter(media => media.id !== mediaToDelete.id));
      } else if (openedFromAlbum && albumContextBeforeFullScreen) {
        // We'll be returning to album, so we need to update the album media
        // This will be refreshed anyway in closeFullScreen, but update it here too
        setAlbumMedia(prev => prev.filter(media => media.id !== mediaToDelete.id));
      }
      
      // Close full screen if deleting the currently viewed media
      if (selectedMedia?.id === mediaToDelete.id) {
        closeFullScreen();
      }
      
      // Close confirmation modal
      setShowDeleteConfirmation(false);
      setMediaToDelete(null);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('✅ Delete completed successfully');
      
    } catch (error) {
      console.error('❌ Delete error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to delete media. Please try again.');
    }
  };

  const cancelDelete = () => {
    console.log('🗑️ Delete cancelled');
    setShowDeleteConfirmation(false);
    setMediaToDelete(null);
  };

  const toggleFavorite = async (mediaId: string) => {
    try {
      await storageService.toggleFavorite(mediaId);
      
      // Update albumMedia if we're in album detail view
      if (showAlbumDetail && albumMedia.length > 0) {
        setAlbumMedia(prev => prev.map(media => 
          media.id === mediaId 
            ? { ...media, isFavorite: !media.isFavorite }
            : media
        ));
      }
      
      // Update selectedMedia if it's the current media
      if (selectedMedia?.id === mediaId) {
        setSelectedMedia(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : prev);
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Toggle favorite error:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const openFullScreen = (media: MediaFile) => {
    console.log('🎯 openFullScreen called for:', media.id);
    console.log('🎯 Current showFullScreen state:', showFullScreen);
    console.log('🎯 Current showAlbumDetail state:', showAlbumDetail);
    
    // Set the selected media and caption
    setSelectedMedia(media);
    setCaptionText(media.caption || '');
    
    if (showAlbumDetail && selectedAlbum) {
      // If we're in album detail view, just switch to full screen mode within the same modal
      console.log('🎯 Switching to full screen mode within album modal');
      setOpenedFromAlbum(true);
      setAlbumContextBeforeFullScreen(selectedAlbum);
      setShowFullScreen(true);
      // Don't close album modal - we'll render full screen content inside it
    } else {
      // We're in memories view, open the separate full screen modal
      console.log('🎯 Opening full screen modal from memories');
      setOpenedFromAlbum(false);
      setAlbumContextBeforeFullScreen(null);
      setShowFullScreen(true);
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const closeFullScreen = () => {
    console.log('🎯 closeFullScreen called');
    console.log('🎯 openedFromAlbum:', openedFromAlbum);
    console.log('🎯 albumContextBeforeFullScreen:', albumContextBeforeFullScreen?.name);
    
    setShowFullScreen(false);
    setSelectedMedia(null);
    setEditingCaption(false);
    setCaptionText('');
    
    if (openedFromAlbum && albumContextBeforeFullScreen) {
      // We're returning to album view within the same modal - no modal transitions needed!
      console.log('🎯 Returning to album view within same modal');
      // The album modal is already open, just refresh the data
      setTimeout(async () => {
        try {
          const refreshedMedia = await storageService.getAlbumMedia(albumContextBeforeFullScreen.id);
          setAlbumMedia(refreshedMedia);
          console.log('🎯 Album media refreshed - staying in album');
        } catch (error) {
          console.error('Failed to refresh album media:', error);
        }
        
        // Clear the context flags after refresh since we're back to album view
        setOpenedFromAlbum(false);
        setAlbumContextBeforeFullScreen(null);
      }, 50);
    } else {
      // Clear album context flags immediately if not returning to album
      setOpenedFromAlbum(false);
      setAlbumContextBeforeFullScreen(null);
    }
  };

  const saveCaption = async () => {
    if (!selectedMedia) return;
    
    try {
      // Update caption in storage service
      await storageService.updateMediaCaption(selectedMedia.id, captionText.trim());
      
      // Update albumMedia if we're in album detail view
      if (showAlbumDetail && albumMedia.length > 0) {
        setAlbumMedia(prev => prev.map(media => 
          media.id === selectedMedia.id 
            ? { ...media, caption: captionText.trim() }
            : media
        ));
      }
      
      // Update selectedMedia
      setSelectedMedia(prev => prev ? { ...prev, caption: captionText.trim() } : prev);
      
      setEditingCaption(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Caption updated successfully!');
    } catch (error) {
      console.error('Update caption error:', error);
      Alert.alert('Error', 'Failed to update caption');
    }
  };

  const deleteMedia = async (mediaId: string) => {
    console.log('🗑️ Delete function called for mediaId:', mediaId);
    
    try {
      const mediaItem = media.find(item => item.id === mediaId) || 
                        albumMedia.find(item => item.id === mediaId);
      const mediaType = mediaItem?.category || 'item';
      
      console.log('🗑️ Found media item:', mediaItem ? 'yes' : 'no', 'type:', mediaType);
      
      // Use setTimeout to ensure alert shows up
      setTimeout(() => {
        Alert.alert(
          'Delete Memory',
          `Are you sure you want to permanently delete this ${mediaType}? This action cannot be undone.`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => console.log('🗑️ Delete cancelled')
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  console.log('🗑️ Executing delete for:', mediaId);
                  await storageService.deleteMedia(mediaId);
                  
                  // Update albumMedia if we're in album detail view
                  if (showAlbumDetail && albumMedia.length > 0) {
                    setAlbumMedia(prev => prev.filter(media => media.id !== mediaId));
                  }
                  
                  // Close modal if deleting the currently viewed media
                  if (selectedMedia?.id === mediaId) {
                    closeFullScreen();
                  }
                  
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  
                  // Show success message
                  setTimeout(() => {
                    Alert.alert(
                      'Deleted', 
                      `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} deleted successfully`,
                      [{ text: 'OK' }]
                    );
                  }, 100);
                } catch (error) {
                  console.error('Delete error:', error);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  
                  setTimeout(() => {
                    Alert.alert(
                      'Error', 
                      'Failed to delete media. Please try again.',
                      [{ text: 'OK' }]
                    );
                  }, 100);
                }
              },
            },
          ],
          { cancelable: false }
        );
      }, 100);
    } catch (error) {
      console.error('Error in deleteMedia function:', error);
      setTimeout(() => {
        Alert.alert(
          'Error', 
          'Failed to delete media. Please try again.',
          [{ text: 'OK' }]
        );
      }, 100);
    }
  };

  const renderFilterBar = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
      {[
        { key: 'all', label: 'All' },
        { key: 'photo', label: 'Photos' },
        { key: 'video', label: 'Videos' },
        { key: 'document', label: 'Docs' },
        { key: 'audio', label: 'Audio' },
        { key: 'favorites', label: 'Favorites' },
      ].map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[
            styles.filterButton,
            selectedFilter === item.key && styles.filterButtonActive,
          ]}
          onPress={() => setSelectedFilter(item.key as any)}
        >
          <Text
            style={[
              styles.filterText,
              selectedFilter === item.key && styles.filterTextActive,
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderMediaItem = ({ item }: { item: MediaFile }) => (
    <TouchableOpacity 
      style={styles.mediaItem}
      onPress={() => openFullScreen(item)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.thumbnailURL || item.downloadURL }} style={styles.mediaImage} />
        
      {/* Media type indicators */}
      {item.category === 'video' && (
          <View style={styles.videoOverlay}>
          <Play color="#ffffff" size={24} fill="#ffffff" />
        </View>
      )}

      {item.category === 'document' && (
        <View style={styles.documentOverlay}>
          <Text style={styles.documentIcon}>📄</Text>
          </View>
        )}
        
      {item.category === 'audio' && (
        <View style={styles.audioOverlay}>
          <Text style={styles.audioIcon}>🎵</Text>
          </View>
        )}
        
      {/* Actions */}
      <View style={styles.mediaActions}>
        <TouchableOpacity
          onPress={(e) => {
            console.log('❤️ Heart button pressed for:', item.id);
            e.stopPropagation();
            toggleFavorite(item.id);
          }}
          style={styles.actionButton}
          activeOpacity={0.7}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Heart
            color={item.isFavorite ? "#ec4899" : "#ffffff"}
            size={16} 
            fill={item.isFavorite ? "#ec4899" : "transparent"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(e) => {
            console.log('🗑️ Memories delete button pressed for:', item.id);
            e.stopPropagation();
            // Use the same delete modal approach as albums
            const mediaItem = media.find(m => m.id === item.id);
            if (mediaItem) {
              setMediaToDelete(mediaItem);
              setShowDeleteConfirmation(true);
            }
          }}
          style={styles.actionButton}
          activeOpacity={0.7}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Trash2 color="#ffffff" size={16} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Memories</Text>
          <Text style={styles.headerSubtitle}>
            {filteredMedia.length} {filteredMedia.length === 1 ? 'memory' : 'memories'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.albumButton}
            onPress={() => {
              console.log('📚 Album button pressed');
              setShowAlbumList(true);
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Grid3X3 color="#6b7280" size={20} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => {
              console.log('🔴 Header plus button pressed');
              quickUploadToVault();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus color="#ec4899" size={24} />
          </TouchableOpacity>
        </View>
      </View>
      {renderFilterBar()}
    </View>
  );

  const renderEmptyState = () => {
    // Only show empty state if user has no media at all, or filter-specific messages
    const totalMediaCount = media.length;
    
    let title = "No memories yet";
    let subtitle = "Start building your vault of precious memories with your partner";
    let showEmptyState = true;

    if (totalMediaCount === 0) {
      // User has no media at all
      title = "No memories yet";
      subtitle = "Start building your vault of precious memories with your partner";
    } else {
      // User has media, but none match the current filter
      showEmptyState = true;
      switch (selectedFilter) {
        case 'photo':
          title = "No photos yet";
          subtitle = "Upload your first photo to start your memory collection";
          break;
        case 'video':
          title = "No videos yet";
          subtitle = "Upload your first video to capture moving memories";
          break;
        case 'document':
          title = "No documents yet";
          subtitle = "Upload documents to keep important files safe";
          break;
        case 'audio':
          title = "No audio files yet";
          subtitle = "Upload audio files to preserve special sounds and messages";
          break;
        case 'favorites':
          title = "No favorites yet";
          subtitle = "Tap the heart icon on any memory to add it to your favorites";
          break;
        default:
          title = "No memories yet";
          subtitle = "Start building your vault of precious memories with your partner";
      }
    }

    if (!showEmptyState) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <ImageIcon color="#d1d5db" size={64} />
        </View>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={showUploadOptions}
        >
          <Plus color="#ffffff" size={20} />
          <Text style={styles.emptyButtonText}>
            {totalMediaCount === 0 ? "Add your first memory" : "Add memory"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  if (isInitialLoading && media.length === 0) {
  return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ec4899" />
            <Text style={styles.loadingText}>Loading your memories...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={styles.safeArea}>
        {/* Full-Screen Media Viewer Modal */}
        <Modal
          visible={showFullScreen}
          transparent={true}
          animationType="fade"
          onRequestClose={closeFullScreen}
        >
          <View style={styles.fullScreenContainer}>
            <TouchableOpacity 
              style={styles.fullScreenOverlay} 
              onPress={closeFullScreen}
              activeOpacity={1}
            />
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.fullScreenContent}
            >
              {/* Header with close button */}
              <View style={styles.fullScreenHeader}>
                <TouchableOpacity 
                  style={styles.fullScreenCloseButton}
                  onPress={closeFullScreen}
                >
                  <X color="#fff" size={24} />
                </TouchableOpacity>
                
                {/* Actions */}
                <View style={styles.fullScreenActions}>
                  <TouchableOpacity
                    style={styles.fullScreenActionButton}
                    onPress={() => {
                      console.log('❤️ Modal heart button pressed for:', selectedMedia?.id);
                      if (selectedMedia) {
                        toggleFavorite(selectedMedia.id);
                      }
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Heart
                      color={selectedMedia?.isFavorite ? "#ec4899" : "#ffffff"}
                      size={20}
                      fill={selectedMedia?.isFavorite ? "#ec4899" : "transparent"}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fullScreenActionButton}
                    onPress={() => {
                      console.log('🗑️ Full screen modal delete button pressed for:', selectedMedia?.id);
                      if (selectedMedia) {
                        // Use the same custom modal approach
                        setMediaToDelete(selectedMedia);
                        setShowDeleteConfirmation(true);
                      }
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 color="#ffffff" size={20} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Media Content */}
              <View style={styles.fullScreenMediaContainer}>
                {selectedMedia && (
                  <Image
                    source={{ uri: selectedMedia.downloadURL }}
                    style={styles.fullScreenImage}
                    resizeMode="contain"
                  />
                )}
              </View>

              {/* Caption Section */}
              <View style={styles.captionSection}>
                <View style={styles.captionHeader}>
                  <Text style={styles.captionLabel}>Memory Note</Text>
                  <TouchableOpacity
                    style={styles.editCaptionButton}
                    onPress={() => setEditingCaption(!editingCaption)}
                  >
                    <Text style={styles.editCaptionText}>
                      {editingCaption ? 'Cancel' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {editingCaption ? (
                  <View style={styles.captionEditContainer}>
                    <TextInput
                      style={styles.captionInput}
                      value={captionText}
                      onChangeText={setCaptionText}
                      placeholder="Add a memory note..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      maxLength={200}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.saveCaptionButton}
                      onPress={saveCaption}
                    >
                      <Text style={styles.saveCaptionText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.captionText}>
                    {selectedMedia?.caption || 'No memory note added yet. Tap Edit to add one.'}
                  </Text>
                )}
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Delete Confirmation Modal - Moved to top level to avoid modal conflicts */}
        <Modal
          visible={showDeleteConfirmation}
          transparent={true}
          animationType="fade"
          onRequestClose={cancelDelete}
        >
          <View style={styles.deleteModalContainer}>
            <View style={styles.deleteModalContent}>
              <Text style={styles.deleteModalTitle}>Delete Memory</Text>
              <Text style={styles.deleteModalMessage}>
                Are you sure you want to permanently delete this {mediaToDelete?.category || 'item'}? This action cannot be undone.
              </Text>
              
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={styles.deleteModalCancelButton}
                  onPress={cancelDelete}
                >
                  <Text style={styles.deleteModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.deleteModalDeleteButton}
                  onPress={confirmDelete}
                >
                  <Text style={styles.deleteModalDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Upload Modal - from upload.tsx */}
        <Modal
          visible={showUploadModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowUploadModal(false)}
        >
          <View style={styles.uploadModalContainer}>
            <SafeAreaView style={styles.uploadModalSafeArea}>
              {/* Upload Modal Header */}
              <View style={styles.uploadModalHeader}>
                <TouchableOpacity
                  style={styles.uploadModalCloseButton}
                  onPress={() => {
                    setShowUploadModal(false);
                    clearSelection();
                  }}
                >
                  <X color="#6b7280" size={24} />
                </TouchableOpacity>
                <Text style={styles.uploadModalTitle}>Upload Memories</Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Preview Modal for selected images */}
              <Modal
                visible={previewModal.visible}
                transparent={true}
                animationType="fade"
                onRequestClose={closePreview}
              >
                <View style={styles.previewModalContainer}>
                  <TouchableOpacity style={styles.previewModalOverlay} onPress={closePreview} />
                  <View style={styles.previewModalContent}>
                    <TouchableOpacity style={styles.previewCloseButton} onPress={closePreview}>
                      <X color="#fff" size={24} />
                    </TouchableOpacity>
                    {previewModal.type.startsWith('image/') ? (
                      <Image 
                        source={{ uri: previewModal.uri }} 
                        style={styles.previewImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.videoPreviewContainer}>
                        <Text style={styles.videoPreviewText}>Video Preview</Text>
                        <Text style={styles.videoPreviewSubtext}>Video playback not yet implemented</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Modal>

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.uploadModalKeyboardAvoid}
              >
                <ScrollView 
                  style={styles.uploadModalScrollContainer}
                  contentContainerStyle={styles.uploadModalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.uploadModalContent}>
                    <View style={styles.uploadModalHeaderSection}>
                      <Heart color="#ec4899" size={24} />
                      <Text style={styles.uploadModalHeaderTitle}>Upload Memories</Text>
                      <Text style={styles.uploadModalHeaderSubtitle}>
                        {userProfile?.partnerStatus === 'connected' 
                          ? 'Share precious moments with your partner'
                          : 'Preserve your precious moments securely'
                        }
                      </Text>
                    </View>
                    
                    {selectedImages.length > 0 ? (
                      <View style={styles.selectedContainer}>
                        <View style={styles.selectedHeader}>
                          <Text style={styles.selectedTitle}>
                            {selectedImages.length} {selectedImages.length === 1 ? 'Memory' : 'Memories'} Selected
                          </Text>
                          <TouchableOpacity
                            style={styles.clearAllButton}
                            onPress={clearSelection}
                          >
                            <X color="#6b7280" size={20} />
                          </TouchableOpacity>
                        </View>

                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          style={styles.selectedImagesScroll}
                          contentContainerStyle={styles.selectedImagesContent}
                        >
                          {selectedImages.map((image, index) => (
                            <View key={index} style={styles.selectedImageContainer}>
                              <TouchableOpacity 
                                onPress={() => openPreview(image.uri, image.type)}
                                activeOpacity={0.8}
                              >
                                <Image 
                                  source={{ uri: image.uri }} 
                                  style={styles.selectedImage}
                                  resizeMode="cover"
                                />
                                <View style={styles.previewIconContainer}>
                                  <ZoomIn color="#fff" size={16} />
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => removeImage(index)}
                              >
                                <X color="#fff" size={16} />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </ScrollView>
                        
                        <View style={styles.uploadOptionsContainer}>
                          {selectedImages.length > 1 && (
                            <View style={styles.albumToggleContainer}>
                              <Text style={styles.albumToggleLabel}>Mark as Album</Text>
                              <TouchableOpacity
                                style={[styles.toggleSwitch, isAlbumMode && styles.toggleSwitchActive]}
                                onPress={() => {
                                  setIsAlbumMode(!isAlbumMode);
                                  if (!isAlbumMode) {
                                    setAlbumName('');
                                    setAlbumDescription('');
                                  }
                                }}
                                activeOpacity={0.8}
                              >
                                <View style={[styles.toggleThumb, isAlbumMode && styles.toggleThumbActive]} />
                              </TouchableOpacity>
                            </View>
                          )}
                          
                          {selectedImages.length > 1 && isAlbumMode && (
                            <>
                              <View style={styles.albumSelectionContainer}>
                                <Text style={styles.inputLabel}>Album Options</Text>
                                <View style={styles.albumSelectionButtons}>
                                  <TouchableOpacity
                                    style={[
                                      styles.albumSelectionButton,
                                      albumSelectionMode === 'new' && styles.albumSelectionButtonActive
                                    ]}
                                    onPress={() => {
                                      setAlbumSelectionMode('new');
                                      setSelectedExistingAlbum(null);
                                    }}
                                  >
                                    <Text style={[
                                      styles.albumSelectionButtonText,
                                      albumSelectionMode === 'new' && styles.albumSelectionButtonTextActive
                                    ]}>Create New</Text>
                                  </TouchableOpacity>
                                  
                                  {albums.length > 0 && (
                                    <TouchableOpacity
                                      style={[
                                        styles.albumSelectionButton,
                                        albumSelectionMode === 'existing' && styles.albumSelectionButtonActive
                                      ]}
                                      onPress={() => {
                                        setAlbumSelectionMode('existing');
                                        setShowAlbumDropdown(true);
                                      }}
                                    >
                                      <Text style={[
                                        styles.albumSelectionButtonText,
                                        albumSelectionMode === 'existing' && styles.albumSelectionButtonTextActive
                                      ]}>Add to Existing</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                              
                              {albumSelectionMode === 'new' && (
                                <View style={styles.albumNameContainer}>
                                  <Text style={styles.inputLabel}>Album Name</Text>
                                  <TextInput
                                    style={styles.albumNameInput}
                                    placeholder="Enter album name..."
                                    placeholderTextColor="#9ca3af"
                                    value={albumName}
                                    onChangeText={setAlbumName}
                                    maxLength={50}
                                  />
                                  <Text style={styles.characterCount}>{albumName.length}/50</Text>
                                </View>
                              )}
                              
                              {albumSelectionMode === 'existing' && selectedExistingAlbum && (
                                <View style={styles.albumNameContainer}>
                                  <Text style={styles.inputLabel}>Selected Album</Text>
                                  <View style={styles.selectedAlbumDisplay}>
                                    <Image source={{ uri: selectedExistingAlbum.coverImageUrl }} style={styles.selectedAlbumCover} />
                                    <View style={styles.selectedAlbumInfo}>
                                      <Text style={styles.selectedAlbumName}>{selectedExistingAlbum.name}</Text>
                                      <Text style={styles.selectedAlbumCount}>{selectedExistingAlbum.mediaCount} memories</Text>
                                    </View>
                                    <TouchableOpacity
                                      style={styles.changeAlbumButton}
                                      onPress={() => setShowAlbumDropdown(true)}
                                    >
                                      <Text style={styles.changeAlbumButtonText}>Change</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              )}
                            </>
                          )}
                          
                          <View style={styles.captionContainer}>
                            <Text style={styles.captionLabel}>
                              {selectedImages.length === 1 
                                ? "Add a memory note (optional)" 
                                : isAlbumMode 
                                  ? "Album Description (optional)"
                                  : "Add a memory note (optional)"
                              }
                            </Text>
                            <TextInput
                              style={styles.captionInput}
                              placeholder={
                                selectedImages.length === 1 
                                  ? "What makes these moments special?"
                                  : isAlbumMode
                                    ? "What makes this album special?"
                                    : "What makes these moments special?"
                              }
                              placeholderTextColor="#9ca3af"
                              value={selectedImages.length === 1 ? caption : albumDescription}
                              onChangeText={selectedImages.length === 1 ? setCaption : setAlbumDescription}
                              multiline
                              maxLength={200}
                            />
                            <Text style={styles.characterCount}>
                              {selectedImages.length === 1 ? caption.length : albumDescription.length}/200
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.selectContainer}>
                        <Text style={styles.selectText}>Choose how to capture your memories</Text>
                        
                        <View style={styles.optionsContainer}>
                          <TouchableOpacity
                            style={styles.optionButton}
                            onPress={takePhotoForModal}
                            activeOpacity={0.8}
                          >
                            <View style={styles.optionContent}>
                              <View style={styles.optionIconContainer}>
                                <Camera color="#ec4899" size={28} />
                              </View>
                              <Text style={styles.optionText}>Take Photo</Text>
                              <Text style={styles.optionSubtext}>Capture new moments</Text>
                            </View>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={styles.optionButton}
                            onPress={pickImages}
                            activeOpacity={0.8}
                          >
                            <View style={styles.optionContent}>
                              <View style={styles.optionIconContainer}>
                                <ImageIcon color="#ec4899" size={28} />
                              </View>
                              <Text style={styles.optionText}>From Gallery</Text>
                              <Text style={styles.optionSubtext}>Choose existing photos & videos</Text>
                            </View>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.securityContainer}>
                          <Text style={styles.securityNote}>
                            🔒 All files are encrypted and secured
                          </Text>
                          <Text style={styles.securitySubNote}>
                            {userProfile?.partnerStatus === 'connected' 
                              ? 'Shared securely with your partner'
                              : 'Only you can access your precious memories'
                            }
                          </Text>
                        </View>
                      </View>
                    )}
                      
                    {/* Fixed upload button */}
                    {selectedImages.length > 0 && (
                      <View style={styles.uploadButtonContainer}>
                        <TouchableOpacity
                          style={[
                            styles.uploadButton,
                            isUploading && styles.uploadButtonDisabled
                          ]}
                          onPress={handleUpload}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <>
                              <UploadIcon color="#fff" size={20} />
                              <Text style={styles.uploadButtonText}>
                                Upload to Vault
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            </SafeAreaView>
            
            {/* Loading overlay during uploads - moved to end to prevent overlapping */}
            {isUploading && (
              <View style={styles.uploadLoadingOverlayFixed}>
                <View style={styles.uploadLoadingContainer}>
                  <ActivityIndicator size="large" color="#ec4899" />
                  <Text style={styles.uploadLoadingText}>
                    {uploadProgress?.totalFiles === 1 ? 'Uploading memory...' : 'Uploading memories...'}
                  </Text>
                  {uploadProgress && (
                    <>
                      <View style={styles.progressBarContainer}>
                        <View style={styles.progressBar}>
                          <View 
                            style={[
                              styles.progressFill, 
                              { width: `${uploadProgress.overallProgress}%` }
                            ]} 
                          />
                        </View>
                      </View>
                      <Text style={styles.uploadProgressText}>
                        {Math.round(uploadProgress.overallProgress)}% complete
                      </Text>
                      {uploadProgress.currentFile && (
                        <Text style={styles.currentFileText}>
                          Uploading: {uploadProgress.currentFile}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              </View>
            )}
          </View>
        </Modal>
        
        {/* Unified Albums Modal */}
        <Modal
          visible={showAlbumList || showAlbumDetail}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            if (showAlbumDetail) {
              closeAlbumDetail();
            } else {
              setShowAlbumList(false);
            }
          }}
        >
          <View style={styles.uploadModalContainer}>
            <SafeAreaView style={styles.uploadModalSafeArea}>
              {showAlbumDetail ? (
                // Album Detail View or Full Screen within Album
                showFullScreen && openedFromAlbum ? (
                  // Full Screen View within Album Modal
                  <View style={styles.fullScreenContainer}>
                    <KeyboardAvoidingView 
                      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                      style={styles.fullScreenContent}
                    >
                      {/* Header with close button */}
                      <View style={styles.fullScreenHeader}>
                        <TouchableOpacity 
                          style={styles.fullScreenCloseButton}
                          onPress={closeFullScreen}
                        >
                          <X color="#fff" size={24} />
                        </TouchableOpacity>
                        
                        {/* Actions */}
                        <View style={styles.fullScreenActions}>
                          <TouchableOpacity
                            style={styles.fullScreenActionButton}
                            onPress={() => {
                              console.log('❤️ Modal heart button pressed for:', selectedMedia?.id);
                              if (selectedMedia) {
                                toggleFavorite(selectedMedia.id);
                              }
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Heart
                              color={selectedMedia?.isFavorite ? "#ec4899" : "#ffffff"}
                              size={20}
                              fill={selectedMedia?.isFavorite ? "#ec4899" : "transparent"}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.fullScreenActionButton}
                            onPress={() => {
                              console.log('🗑️ Full screen modal delete button pressed for:', selectedMedia?.id);
                              if (selectedMedia) {
                                setMediaToDelete(selectedMedia);
                                setShowDeleteConfirmation(true);
                              }
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Trash2 color="#ffffff" size={20} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Media Content */}
                      <View style={styles.fullScreenMediaContainer}>
                        {selectedMedia && (
                          <Image
                            source={{ uri: selectedMedia.downloadURL }}
                            style={styles.fullScreenImage}
                            resizeMode="contain"
                          />
                        )}
                      </View>

                      {/* Caption Section */}
                      <View style={styles.captionSection}>
                        <View style={styles.captionHeader}>
                          <Text style={styles.captionLabel}>Memory Note</Text>
                          <TouchableOpacity
                            style={styles.editCaptionButton}
                            onPress={() => setEditingCaption(!editingCaption)}
                          >
                            <Text style={styles.editCaptionText}>
                              {editingCaption ? 'Cancel' : 'Edit'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {editingCaption ? (
                          <View style={styles.captionEditContainer}>
                            <TextInput
                              style={styles.captionInput}
                              value={captionText}
                              onChangeText={setCaptionText}
                              placeholder="Add a memory note..."
                              placeholderTextColor="#9ca3af"
                              multiline
                              maxLength={200}
                              autoFocus
                            />
                            <TouchableOpacity
                              style={styles.saveCaptionButton}
                              onPress={saveCaption}
                            >
                              <Text style={styles.saveCaptionText}>Save</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={styles.captionText}>
                            {selectedMedia?.caption || 'No memory note added yet. Tap Edit to add one.'}
                          </Text>
                        )}
                      </View>
                    </KeyboardAvoidingView>
                  </View>
                ) : (
                  // Album Detail Grid View
                  <>
                    {/* Album Detail Header */}
                    <View style={styles.uploadModalHeader}>
                      <TouchableOpacity
                        style={styles.uploadModalCloseButton}
                        onPress={closeAlbumDetail}
                      >
                        <X color="#6b7280" size={24} />
                      </TouchableOpacity>
                      <Text style={styles.uploadModalTitle}>
                        {selectedAlbum?.createdAt 
                          ? new Date(selectedAlbum.createdAt.toDate()).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          : 'Album'
                        }
                      </Text>
                      <View style={{ width: 24 }} />
                    </View>

                    <ScrollView style={styles.albumDetailContainer}>
                      {/* Album Info Section */}
                      {selectedAlbum && (
                        <View style={styles.albumInfoSection}>
                          <Text style={styles.albumDetailTitle}>{selectedAlbum.name}</Text>
                          {selectedAlbum.description && (
                            <Text style={styles.albumDetailDescription}>
                              {selectedAlbum.description}
                            </Text>
                          )}
                          <Text style={styles.albumDetailCount}>
                            {albumMedia.length} {albumMedia.length === 1 ? 'memory' : 'memories'}
                          </Text>
                        </View>
                      )}

                      {/* Album Media Grid */}
                      {albumMedia.length > 0 ? (
                        <View style={styles.albumMediaGrid}>
                          {albumMedia.map((media, index) => (
                            <View
                              key={media.id}
                              style={styles.albumMediaItem}
                            >
                              <TouchableOpacity
                                style={styles.albumMediaImageContainer}
                                onPress={() => {
                                  console.log('🖼️ Album image clicked:', media.id);
                                  openFullScreen(media);
                                }}
                                activeOpacity={0.8}
                              >
                                <Image
                                  source={{ uri: media.thumbnailURL || media.downloadURL }}
                                  style={styles.albumMediaImage}
                                />
                                
                                {/* Media type indicators */}
                                {media.category === 'video' && (
                                  <View style={styles.videoOverlay}>
                                    <Play color="#ffffff" size={20} fill="#ffffff" />
                                  </View>
                                )}
                              </TouchableOpacity>
                              
                              {/* Media actions */}
                              <View style={styles.mediaActions}>
                                <TouchableOpacity
                                  onPress={() => {
                                    console.log('❤️ Heart clicked for:', media.id);
                                    toggleFavoriteInAlbum(media.id);
                                  }}
                                  style={styles.actionButton}
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                  <Heart
                                    color={media.isFavorite ? "#ec4899" : "#ffffff"}
                                    size={14}
                                    fill={media.isFavorite ? "#ec4899" : "transparent"}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => {
                                    console.log('🗑️ Delete clicked for:', media.id);
                                    deleteMediaFromAlbum(media.id);
                                  }}
                                  style={styles.actionButton}
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                  <Trash2 color="#ffffff" size={14} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.emptyAlbumMedia}>
                          <Text style={styles.emptyAlbumMediaText}>
                            No media found in this album
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  </>
                )
              ) : (
                // Album List View
                <>
                  {/* Album List Header */}
                  <View style={styles.uploadModalHeader}>
                    <TouchableOpacity
                      style={styles.uploadModalCloseButton}
                      onPress={() => setShowAlbumList(false)}
                    >
                      <X color="#6b7280" size={24} />
                    </TouchableOpacity>
                    <Text style={styles.uploadModalTitle}>Your Albums</Text>
                    <View style={{ width: 24 }} />
                  </View>

                  <ScrollView style={styles.albumListContainer}>
                    {albums.length === 0 ? (
                      <View style={styles.emptyAlbumContainer}>
                        <View style={styles.emptyAlbumIconContainer}>
                          <Grid3X3 color="#d1d5db" size={64} />
                        </View>
                        <Text style={styles.emptyAlbumTitle}>No albums yet</Text>
                        <Text style={styles.emptyAlbumSubtitle}>
                          Upload multiple images and mark them as an album to create your first album
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.albumGridContainer}>
                        {albums.map((album, index) => (
                          <TouchableOpacity 
                            key={index} 
                            style={styles.albumItem}
                            onPress={() => {
                              openAlbumDetail(album);
                            }}
                          >
                            <Image 
                              source={{ uri: album.coverImageUrl }} 
                              style={styles.albumCover}
                            />
                            <View style={styles.albumInfo}>
                              <Text style={styles.albumTitle}>{album.name}</Text>
                              <Text style={styles.albumCount}>{album.mediaCount} memories</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                </>
              )}
            </SafeAreaView>
          </View>
        </Modal>
        
        {/* Album Dropdown Modal */}
        <Modal
          visible={showAlbumDropdown}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAlbumDropdown(false)}
        >
          <View style={styles.uploadModalContainer}>
            <SafeAreaView style={styles.uploadModalSafeArea}>
              <View style={styles.uploadModalHeader}>
                <TouchableOpacity
                  style={styles.uploadModalCloseButton}
                  onPress={() => setShowAlbumDropdown(false)}
                >
                  <X color="#6b7280" size={24} />
                </TouchableOpacity>
                <Text style={styles.uploadModalTitle}>Select Album</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView style={styles.albumListContainer}>
                {albums.length === 0 ? (
                  <View style={styles.emptyAlbumContainer}>
                    <Text style={styles.emptyAlbumTitle}>No albums available</Text>
                    <Text style={styles.emptyAlbumSubtitle}>
                      You need to create an album first before you can add to existing ones.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.albumGridContainer}>
                    {albums.map((album, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={[
                          styles.albumItem,
                          selectedExistingAlbum?.id === album.id && styles.albumItemSelected
                        ]}
                        onPress={() => {
                          setSelectedExistingAlbum(album);
                          // Preload the existing album's description for editing
                          setAlbumDescription(album.description || '');
                          setShowAlbumDropdown(false);
                        }}
                      >
                        <Image 
                          source={{ uri: album.coverImageUrl }} 
                          style={styles.albumCover}
                        />
                        <View style={styles.albumInfo}>
                          <Text style={styles.albumTitle}>{album.name}</Text>
                          <Text style={styles.albumCount}>{album.mediaCount} memories</Text>
                        </View>
                        {selectedExistingAlbum?.id === album.id && (
                          <View style={styles.selectedIndicator}>
                            <Text style={styles.selectedIndicatorText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
        
        {filteredMedia.length === 0 ? (
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#ec4899']} />
            }
          >
            {renderHeader()}
            {renderEmptyState()}
          </ScrollView>
        ) : (
          <FlatList
            data={filteredMedia}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContainer}
            columnWrapperStyle={styles.row}
            ListHeaderComponent={renderHeader}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#ec4899']} />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  albumButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
  },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
  },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginHorizontal: 6,
  },
  filterButtonActive: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mediaItem: {
    width: itemSize,
    height: itemSize,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  favoriteOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  mediaActions: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 120,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: '#ec4899',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#ec4899',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadLoadingOverlayFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadLoadingContainer: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 4,
  },
  documentIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  audioOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 4,
  },
  audioIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  fullScreenContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  fullScreenCloseButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  fullScreenActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fullScreenActionButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  fullScreenMediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: width,
    height: '100%',
    resizeMode: 'contain',
  },
  captionSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    minHeight: 120,
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  captionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  editCaptionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  editCaptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  captionEditContainer: {
    gap: 12,
  },
  captionInput: {
    backgroundColor: '#ffffff',
    color: '#1f2937',
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
  },
  saveCaptionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ec4899',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  saveCaptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  captionText: {
    fontSize: 16,
    color: '#e5e7eb',
    lineHeight: 22,
  },
  uploadModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  uploadModalSafeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  uploadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  uploadModalCloseButton: {
    padding: 8,
  },
  uploadModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  previewModalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  videoPreviewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  videoPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  videoPreviewSubtext: {
    fontSize: 16,
    color: '#ccc',
  },
  uploadLoadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ec4899',
    borderRadius: 2,
  },
  uploadProgressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  currentFileText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  uploadModalKeyboardAvoid: {
    flex: 1,
  },
  uploadModalScrollContainer: {
    flex: 1,
  },
  uploadModalScrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  uploadModalContent: {
    flex: 1,
  },
  uploadModalHeaderSection: {
    alignItems: 'center',
    marginBottom: 40,
    paddingTop: 20,
  },
  uploadModalHeaderTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 12,
  },
  uploadModalHeaderSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  selectedContainer: {
    marginBottom: 32,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  clearAllButton: {
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
  },
  selectedImagesScroll: {
    marginBottom: 24,
  },
  selectedImagesContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  selectedImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  previewIconContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  captionContainer: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 16,
  },
  selectContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: 40,
  },
  selectText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: 20,
    marginBottom: 40,
  },
  optionButton: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  optionContent: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 16,
  },
  optionIconContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#fdf2f8',
    borderRadius: 50,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  optionSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  securityContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
  },
  securityNote: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  securitySubNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  uploadButtonContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  uploadButton: {
    backgroundColor: '#ec4899',
    padding: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#ec4899',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  uploadOptionsContainer: {
    marginBottom: 32,
  },
  albumToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  albumToggleLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    padding: 2,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#ec4899',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  albumNameContainer: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  albumNameInput: {
    backgroundColor: '#ffffff',
    color: '#1f2937',
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    minHeight: 50,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  albumListContainer: {
    padding: 24,
  },
  emptyAlbumContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyAlbumIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyAlbumTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyAlbumSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  albumGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  albumItem: {
    width: itemSize,
    height: itemSize,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    position: 'relative',
  },
  albumCover: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  albumInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
  },
  albumTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  albumCount: {
    fontSize: 14,
    color: '#ffffff',
  },
  albumDetailContainer: {
    flex: 1,
    padding: 24,
  },
  albumInfoSection: {
    marginBottom: 24,
  },
  albumDetailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  albumDetailDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  albumDetailCount: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
  },
  albumMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  albumMediaItem: {
    width: itemSize,
    height: itemSize,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    position: 'relative',
  },
  albumMediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  albumMediaImageContainer: {
    width: '100%',
    height: '100%',
  },
  emptyAlbumMedia: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyAlbumMediaText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  deleteModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalContent: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  deleteModalCancelButton: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginRight: 16,
  },
  deleteModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  deleteModalDeleteButton: {
    backgroundColor: '#ec4899',
    padding: 12,
    borderRadius: 8,
  },
  deleteModalDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  albumSelectionContainer: {
    marginBottom: 32,
  },
  albumSelectionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  albumSelectionButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    marginRight: 16,
  },
  albumSelectionButtonActive: {
    backgroundColor: '#ec4899',
  },
  albumSelectionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  albumSelectionButtonTextActive: {
    color: '#ffffff',
  },
  selectedAlbumDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedAlbumCover: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  selectedAlbumInfo: {
    flex: 1,
  },
  selectedAlbumName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  selectedAlbumCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  changeAlbumButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#ec4899',
    marginTop: 16,
  },
  changeAlbumButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  albumItemSelected: {
    backgroundColor: '#f3f4f6',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
    backgroundColor: '#ec4899',
    borderRadius: 12,
  },
  selectedIndicatorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});