import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions,
  ScrollView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Heart, Lock, Upload } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function VaultScreen() {
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // Sample data for demonstration
  const mediaItems = [
    { id: '1', title: 'Photo 1', type: 'image' },
    { id: '2', title: 'Photo 2', type: 'image' },
    { id: '3', title: 'Video 1', type: 'video' },
  ];
  
  const handleMediaPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Handle media item press
  };
  
  const toggleFavorite = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavorites(prev => 
      prev.includes(id) 
        ? prev.filter(fav => fav !== id)
        : [...prev, id]
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
          <Text style={styles.subtitle}>Your secure memories</Text>
        </View>
        
        <ScrollView style={styles.content}>
          {mediaItems.length > 0 ? (
            <View style={styles.mediaGrid}>
              {mediaItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.mediaItem}
                  onPress={() => handleMediaPress(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.mediaPlaceholder}>
                    <Lock color="#666" size={24} />
                    <Text style={styles.mediaTitle}>{item.title}</Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={() => toggleFavorite(item.id)}
                  >
                    <Heart 
                      color={favorites.includes(item.id) ? "#ff2d55" : "#666"} 
                      fill={favorites.includes(item.id) ? "#ff2d55" : "transparent"}
                      size={16} 
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Upload color="#666" size={48} />
              <Text style={styles.emptyText}>Your vault is empty</Text>
              <Text style={styles.emptySubtext}>
                Upload your first memory to get started
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
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
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#999',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mediaItem: {
    width: (width - 48) / 2,
    height: 120,
    marginBottom: 16,
    position: 'relative',
  },
  mediaPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
  },
  mediaTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 100,
  },
  emptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});