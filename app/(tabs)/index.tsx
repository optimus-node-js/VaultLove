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
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

// Platform-specific ActionSheet import
let ActionSheetIOS: any = null;
if (Platform.OS === 'ios') {
  ActionSheetIOS = require('react-native').ActionSheetIOS;
}

import storageService, { MediaFile } from '../../services/storage';
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
        Alert.alert('Success!', `All ${successCount} files uploaded successfully`);
      } else {
        Alert.alert(
          'Partial Success',
          `${successCount} files uploaded, ${failedCount} failed`
        );
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Upload Failed', 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const showUploadOptions = () => {
    console.log('🔵 showUploadOptions called');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const options = ['Take Photo', 'Choose from Gallery', 'Go to Upload Page', 'Cancel'];
    const cancelButtonIndex = 3;

    console.log('🔵 Platform:', Platform.OS, 'ActionSheetIOS available:', !!ActionSheetIOS);

    if (Platform.OS === 'ios' && ActionSheetIOS) {
      console.log('🔵 Using iOS ActionSheet');
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Add a Memory',
        },
        (buttonIndex: number) => {
          console.log('🔵 ActionSheet button pressed:', buttonIndex);
          if (buttonIndex === 0) {
              takePhoto();
          } else if (buttonIndex === 1) {
              pickMultipleImages();
          } else if (buttonIndex === 2) {
            router.push('/(tabs)/upload');
          }
        }
      );
    } else {
      console.log('🔵 Using Alert dialog');
      Alert.alert(
        'Add a Memory',
        'Choose how you want to add your memory',
        [
          { text: 'Take Photo', onPress: () => { console.log('🔵 Take Photo pressed'); takePhoto(); } },
          { text: 'Choose from Gallery', onPress: () => { console.log('🔵 Choose from Gallery pressed'); pickMultipleImages(); } },
          { text: 'Go to Upload Page', onPress: () => { console.log('🔵 Go to Upload Page pressed'); router.push('/(tabs)/upload'); } },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const quickUploadToVault = () => {
    console.log('🔴 Plus button clicked - quickUploadToVault called');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showUploadOptions();
  };

  const toggleFavorite = async (mediaId: string) => {
    try {
      await storageService.toggleFavorite(mediaId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Toggle favorite error:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const openFullScreen = (media: MediaFile) => {
    setSelectedMedia(media);
    setCaptionText(media.caption || '');
    setShowFullScreen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const closeFullScreen = () => {
    setShowFullScreen(false);
    setSelectedMedia(null);
    setEditingCaption(false);
    setCaptionText('');
  };

  const saveCaption = async () => {
    if (!selectedMedia) return;
    
    try {
      // Update caption in storage service (we'll need to add this method)
      await storageService.updateMediaCaption(selectedMedia.id, captionText.trim());
      setEditingCaption(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Caption updated successfully!');
    } catch (error) {
      console.error('Update caption error:', error);
      Alert.alert('Error', 'Failed to update caption');
    }
  };

  const deleteMedia = async (mediaId: string) => {
    const mediaItem = media.find(item => item.id === mediaId);
    const mediaType = mediaItem?.category || 'item';
    
    Alert.alert(
      'Delete Memory',
      `Are you sure you want to permanently delete this ${mediaType}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.deleteMedia(mediaId);
              
              // Close modal if deleting the currently viewed media
              if (selectedMedia?.id === mediaId) {
                closeFullScreen();
              }
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Deleted', `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} deleted successfully`);
            } catch (error) {
              console.error('Delete error:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete media');
            }
          },
        },
      ]
    );
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
            e.stopPropagation();
            toggleFavorite(item.id);
          }}
              style={styles.actionButton}
            >
          <Heart
            color={item.isFavorite ? "#ec4899" : "#ffffff"}
                size={16} 
            fill={item.isFavorite ? "#ec4899" : "transparent"}
              />
            </TouchableOpacity>
            <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            deleteMedia(item.id);
          }}
              style={styles.actionButton}
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
            <TouchableOpacity 
          style={styles.addButton}
          onPress={quickUploadToVault}
        >
          <Plus color="#ec4899" size={24} />
            </TouchableOpacity>
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
                    onPress={() => selectedMedia && toggleFavorite(selectedMedia.id)}
                  >
                    <Heart
                      color={selectedMedia?.isFavorite ? "#ec4899" : "#ffffff"}
                      size={20}
                      fill={selectedMedia?.isFavorite ? "#ec4899" : "transparent"}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fullScreenActionButton}
                    onPress={() => selectedMedia && deleteMedia(selectedMedia.id)}
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

        {isLoading && (
          <View style={styles.uploadLoadingOverlay}>
            <View style={styles.uploadLoadingContainer}>
              <ActivityIndicator size="large" color="#ec4899" />
              <Text style={styles.loadingText}>Uploading...</Text>
            </View>
          </View>
        )}
        
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
  uploadLoadingOverlay: {
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
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#1f2937',
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    minHeight: 60,
    textAlignVertical: 'top',
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
});