import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Camera, Image as ImageIcon, X, Upload as UploadIcon, Heart, Grid2x2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import storageService, { BulkUploadProgress } from '../../services/storage';
import authService, { UserProfile } from '../../services/auth';

export default function UploadScreen() {
  const [selectedImages, setSelectedImages] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<BulkUploadProgress | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Subscribe to user profile changes
    const unsubscribe = authService.onProfileChange((profile) => {
      setUserProfile(profile);
    });

    return unsubscribe;
  }, []);
  
  const pickImages = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
      allowsEditing: false, // Allow raw files for better type detection
    });
    
    if (!result.canceled && result.assets) {
      const files = result.assets.map(asset => {
        // Better file type detection
        let detectedType = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
        
        // Try to detect from file extension if available
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
  
  const takePhoto = async () => {
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
  };
  
  const handleUpload = async () => {
    if (selectedImages.length === 0) return;

    try {
      setIsUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Add caption to all files
      const filesWithCaptions = selectedImages.map(file => ({
        ...file,
        caption: caption.trim() || undefined,
      }));

      if (selectedImages.length === 1) {
        // Single upload with real-time progress
        const fileName = filesWithCaptions[0].name;
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

        await storageService.uploadFile(
          filesWithCaptions[0].uri,
          filesWithCaptions[0].name,
          filesWithCaptions[0].type,
          filesWithCaptions[0].caption,
          (progress) => {
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

        // Final update
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
        // Bulk upload with detailed progress tracking
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

        await storageService.uploadMultipleFiles(
          filesWithCaptions,
          (progress) => {
            setUploadProgress(progress);
          }
        );
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success with file count and categories
      const photoCount = selectedImages.filter(img => img.type.startsWith('image/')).length;
      const videoCount = selectedImages.filter(img => img.type.startsWith('video/')).length;
      
      let message = '';
      if (selectedImages.length === 1) {
        message = 'Your memory has been securely saved to the vault.';
      } else {
        const parts = [];
        if (photoCount > 0) parts.push(`${photoCount} photo${photoCount > 1 ? 's' : ''}`);
        if (videoCount > 0) parts.push(`${videoCount} video${videoCount > 1 ? 's' : ''}`);
        message = `All ${parts.join(' and ')} have been securely saved to the vault.`;
      }

      Alert.alert(
        "Success! 💖", 
        message,
        [
          {
            text: 'View Vault',
            onPress: () => {
              clearSelection();
              router.push('/(tabs)');
            }
          },
          {
            text: 'Upload More',
            onPress: clearSelection
          }
        ]
      );
    } catch (error) {
      console.error('Upload failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Upload Failed", "Please try again later.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const goToVault = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Loading overlay only during uploads */}
        {isUploading && (
          <View style={styles.uploadLoadingOverlay}>
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
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Heart color="#ec4899" size={24} />
              <Text style={styles.title}>Upload Memories</Text>
              <Text style={styles.subtitle}>
                {userProfile?.partnerStatus === 'connected' 
                  ? 'Share precious moments with your partner'
                  : 'Preserve your precious moments securely'
                }
              </Text>
            </View>
            
            {selectedImages.length > 0 ? (
              <ScrollView 
                style={styles.selectedContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.selectedScrollContent}
              >
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
                      <Image 
                        source={{ uri: image.uri }} 
                        style={styles.selectedImage}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeImage(index)}
                      >
                        <X color="#fff" size={16} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                
                <View style={styles.captionContainer}>
                  <Text style={styles.captionLabel}>Add a memory note (optional)</Text>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="What makes these moments special?"
                    placeholderTextColor="#9ca3af"
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    maxLength={200}
                  />
                  <Text style={styles.characterCount}>{caption.length}/200</Text>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.selectContainer}>
                <Text style={styles.selectText}>Choose how to capture your memories</Text>
                
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={takePhoto}
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

                <TouchableOpacity style={styles.vaultButton} onPress={goToVault}>
                  <Grid2x2 color="#6b7280" size={20} />
                  <Text style={styles.vaultButtonText}>View Your Vault</Text>
                </TouchableOpacity>
                
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
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  selectContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  selectText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 40,
  },
  optionsContainer: {
    gap: 20,
    marginBottom: 32,
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
  vaultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  vaultButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  securityContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fdf2f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fce7f3',
  },
  securityNote: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ec4899',
    textAlign: 'center',
    marginBottom: 4,
  },
  securitySubNote: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  selectedContainer: {
    flex: 1,
    marginBottom: 24,
  },
  selectedScrollContent: {
    paddingBottom: 20,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedImagesScroll: {
    marginBottom: 24,
    height: 120,
  },
  selectedImagesContent: {
    paddingHorizontal: 12,
  },
  selectedImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 4,
  },
  captionContainer: {
    marginBottom: 24,
  },
  captionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
  },
  captionInput: {
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  uploadButtonContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  uploadButton: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    width: '100%',
  },
  uploadButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  uploadLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  uploadLoadingContainer: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 25,
    width: '80%',
    maxWidth: 300,
  },
  uploadLoadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ec4899',
    borderRadius: 4,
  },
  uploadProgressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  currentFileText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});