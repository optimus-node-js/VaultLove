import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Heart, Trash2, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { MediaItem } from '@/utils/types';
import { useVaultStore } from '@/stores/vaultStore';

interface MediaViewerProps {
  media: MediaItem;
  onClose: () => void;
  onFavorite: () => void;
}

const { width, height } = Dimensions.get('window');

export default function MediaViewer({ media, onClose, onFavorite }: MediaViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { deleteMedia } = useVaultStore();
  
  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteMedia(media.id);
    onClose();
  };
  
  const handleFavorite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFavorite();
  };
  
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X color="#fff" size={24} />
        </TouchableOpacity>
        
        <View style={styles.headerControls}>
          <TouchableOpacity style={styles.headerButton} onPress={handleFavorite}>
            <Heart 
              color="#fff" 
              fill={media.isFavorite ? "#ff2d55" : "transparent"} 
              size={24} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
            <Trash2 color="#fff" size={24} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.mediaContainer}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#ff2d55" size="large" />
          </View>
        )}
        
        <Image
          source={{ uri: media.url }}
          style={styles.image}
          resizeMode="contain"
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
        />
      </View>
      
      {media.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>{media.caption}</Text>
          <Text style={styles.date}>
            {new Date(media.timestamp).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerControls: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  image: {
    width,
    height: height * 0.7,
  },
  captionContainer: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  caption: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  date: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#999',
  },
});