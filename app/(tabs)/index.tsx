import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Dimensions, 
  ActivityIndicator, 
  Image 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Heart, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useVaultStore } from '@/stores/vaultStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import MediaViewer from '@/components/vault/MediaViewer';
import { MediaItem } from '@/utils/types';

const { width } = Dimensions.get('window');
const numColumns = 3;
const itemSize = width / numColumns;

export default function VaultScreen() {
  const { mediaItems, isLoading, toggleFavorite } = useVaultStore();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  
  useFocusEffect(
    useCallback(() => {
      // Refresh content when tab gets focus
      return () => {
        // Clean up when tab loses focus
        setSelectedMedia(null);
      };
    }, [])
  );
  
  const handleMediaPress = (item: MediaItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMedia(item);
  };
  
  const handleFavoritePress = (item: MediaItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(item.id);
  };
  
  const renderMediaItem = ({ item }: { item: MediaItem }) => {
    return (
      <TouchableOpacity
        style={styles.mediaItem}
        onPress={() => handleMediaPress(item)}
        activeOpacity={0.8}
      >
        {item.thumbnailUrl ? (
          <Image 
            source={{ uri: item.thumbnailUrl }} 
            style={styles.mediaThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Lock color="#666" size={24} />
          </View>
        )}
        
        {item.isFavorite && (
          <View style={styles.favoriteIcon}>
            <Heart color="#ff2d55" fill="#ff2d55" size={16} />
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  return (
    <LinearGradient
      colors={['#0c0c0c', '#090909']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Vault</Text>
        </View>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#ff2d55" size="large" />
          </View>
        ) : mediaItems.length > 0 ? (
          <FlatList
            data={mediaItems}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            contentContainerStyle={styles.mediaGrid}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Lock color="#666" size={48} />
            <Text style={styles.emptyText}>Your vault is empty</Text>
            <Text style={styles.emptySubtext}>
              Upload your first memory to get started
            </Text>
          </View>
        )}
      </SafeAreaView>
      
      {selectedMedia && (
        <MediaViewer 
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onFavorite={() => handleFavoritePress(selectedMedia)}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaGrid: {
    padding: 1,
  },
  mediaItem: {
    width: itemSize - 2,
    height: itemSize - 2,
    margin: 1,
    position: 'relative',
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  mediaPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  favoriteIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontFamily: 'Inter-Medium',
    fontSize: 20,
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});