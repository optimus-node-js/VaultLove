import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Audio } from 'expo-av';
import { 
  Check, 
  CheckCheck, 
  Clock, 
  Play, 
  Pause, 
  Download,
  FileText,
  Video
} from 'lucide-react-native';
import { ChatMessage } from '../../utils/chatTypes';
import { formatDistanceToNow } from 'date-fns';

const { width: screenWidth } = Dimensions.get('window');
const maxBubbleWidth = screenWidth * 0.75;

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showStatus?: boolean;
  onImagePress?: (imageUrl: string) => void;
  onVideoPress?: (videoUrl: string) => void;
  onDocumentPress?: (documentUrl: string, fileName: string) => void;
}

export default function MessageBubble({
  message,
  isOwn,
  showStatus = true,
  onImagePress,
  onVideoPress,
  onDocumentPress
}: MessageBubbleProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<any>(null);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    return () => {
      // Cleanup sound when component unmounts
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const playVoiceMessage = async () => {
    try {
      if (!message.mediaUrl) return;

      if (sound && isPlaying) {
        // Pause current playback
        await sound.pauseAsync();
        setIsPlaying(false);
        return;
      }

      if (sound && !isPlaying) {
        // Resume playback
        await sound.playAsync();
        setIsPlaying(true);
        return;
      }

      // Load and play new sound
      console.log('🎵 Loading voice message:', message.mediaUrl);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: message.mediaUrl },
        { shouldPlay: true },
        (status) => {
          setPlaybackStatus(status);
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      );

      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('❌ Error playing voice message:', error);
      Alert.alert('Error', 'Could not play voice message');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    if (!isOwn || !showStatus) return null;

    switch (message.status) {
      case 'sending':
        return <Clock size={16} color="#9ca3af" />;
      case 'sent':
        return <Check size={16} color="#9ca3af" />;
      case 'delivered':
        return <CheckCheck size={16} color="#9ca3af" />;
      case 'seen':
        return <CheckCheck size={16} color="#3b82f6" />;
      default:
        return null;
    }
  };

  const renderTextMessage = () => (
    <View>
      <Text style={[
        styles.messageText,
        { color: isOwn ? '#ffffff' : '#1f2937' }
      ]}>
        {message.content}
      </Text>
    </View>
  );

  const renderImageMessage = () => (
    <TouchableOpacity 
      onPress={() => onImagePress?.(message.mediaUrl!)}
      style={styles.mediaContainer}
    >
      <Image
        source={{ uri: message.mediaUrl }}
        style={styles.imageMessage}
        onLoadStart={() => setImageLoading(true)}
        onLoadEnd={() => setImageLoading(false)}
        resizeMode="cover"
      />
      {imageLoading && (
        <View style={styles.imageLoader}>
          <ActivityIndicator color="#ec4899" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderVideoMessage = () => (
    <TouchableOpacity 
      onPress={() => onVideoPress?.(message.mediaUrl!)}
      style={styles.mediaContainer}
    >
      <Image
        source={{ uri: message.thumbnailUrl || message.mediaUrl }}
        style={styles.videoMessage}
        resizeMode="cover"
      />
      <View style={styles.playButtonOverlay}>
        <View style={styles.playButton}>
          <Play size={24} color="#ffffff" fill="#ffffff" />
        </View>
      </View>
      <View style={styles.videoLabel}>
        <Video size={16} color="#ffffff" />
        <Text style={styles.videoLabelText}>Video</Text>
      </View>
    </TouchableOpacity>
  );

  const renderVoiceMessage = () => (
    <TouchableOpacity 
      onPress={playVoiceMessage}
      style={styles.voiceContainer}
    >
      <View style={styles.voiceButton}>
        {isPlaying ? (
          <Pause size={20} color={isOwn ? '#ffffff' : '#ec4899'} />
        ) : (
          <Play size={20} color={isOwn ? '#ffffff' : '#ec4899'} />
        )}
      </View>
      
      <View style={styles.voiceWaveform}>
        {/* Simplified waveform visualization */}
        {Array.from({ length: 20 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.waveformBar,
              {
                height: Math.random() * 20 + 10,
                backgroundColor: isOwn ? 'rgba(255,255,255,0.7)' : 'rgba(236,72,153,0.7)'
              }
            ]}
          />
        ))}
      </View>
      
      <Text style={[
        styles.voiceDuration,
        { color: isOwn ? '#ffffff' : '#6b7280' }
      ]}>
        {formatDuration(message.voiceDuration || 0)}
      </Text>
    </TouchableOpacity>
  );

  const renderDocumentMessage = () => (
    <TouchableOpacity 
      onPress={() => onDocumentPress?.(message.mediaUrl!, message.fileName!)}
      style={styles.documentContainer}
    >
      <View style={styles.documentIcon}>
        <FileText size={24} color={isOwn ? '#ffffff' : '#ec4899'} />
      </View>
      <View style={styles.documentInfo}>
        <Text style={[
          styles.documentName,
          { color: isOwn ? '#ffffff' : '#1f2937' }
        ]} numberOfLines={1}>
          {message.fileName}
        </Text>
        <Text style={[
          styles.documentSize,
          { color: isOwn ? 'rgba(255,255,255,0.8)' : '#6b7280' }
        ]}>
          {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)} KB` : 'Document'}
        </Text>
      </View>
      <Download size={20} color={isOwn ? '#ffffff' : '#ec4899'} />
    </TouchableOpacity>
  );

  const renderMessageContent = () => {
    switch (message.messageType) {
      case 'text':
        return renderTextMessage();
      case 'image':
        return renderImageMessage();
      case 'video':
        return renderVideoMessage();
      case 'voice':
        return renderVoiceMessage();
      case 'document':
        return renderDocumentMessage();
      default:
        return renderTextMessage();
    }
  };

  return (
    <View style={[
      styles.container,
      isOwn ? styles.ownMessage : styles.partnerMessage
    ]}>
      <View style={[
        styles.bubble,
        isOwn ? styles.ownBubble : styles.partnerBubble,
        message.messageType !== 'text' && styles.mediaBubble
      ]}>
        {renderMessageContent()}
        
        <View style={styles.messageFooter}>
          <Text style={[
            styles.timestamp,
            { color: isOwn ? 'rgba(255,255,255,0.8)' : '#9ca3af' }
          ]}>
            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: false })}
          </Text>
          {getStatusIcon()}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  partnerMessage: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: maxBubbleWidth,
    borderRadius: 18,
    padding: 12,
  },
  ownBubble: {
    backgroundColor: '#ec4899',
    borderBottomRightRadius: 4,
  },
  partnerBubble: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  mediaBubble: {
    padding: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
  },
  
  // Media styles
  mediaContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 14,
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  videoMessage: {
    width: 200,
    height: 200,
    borderRadius: 14,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  videoLabelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Voice message styles
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    gap: 12,
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  voiceWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 30,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceDuration: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
  },
  
  // Document styles
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    gap: 12,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  documentSize: {
    fontSize: 14,
  },
});