import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Platform,
  Vibration
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import {
  Mic,
  MicOff,
  Send,
  X,
  Play,
  Pause,
  Trash2
} from 'lucide-react-native';

interface VoiceRecorderProps {
  onSendVoice: (uri: string, duration: number) => Promise<void>;
  onCancel: () => void;
  isVisible: boolean;
  disabled?: boolean;
}

interface CustomRecordingStatus {
  canRecord: boolean;
  isRecording: boolean;
  isDoneRecording: boolean;
  durationMillis: number;
  uri?: string;
}

export default function VoiceRecorder({
  onSendVoice,
  onCancel,
  isVisible,
  disabled = false
}: VoiceRecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<CustomRecordingStatus>({
    canRecord: false,
    isRecording: false,
    isDoneRecording: false,
    durationMillis: 0
  });
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveformAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Slide up animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8
      }).start();
      
      // Setup audio
      setupAudio();
    } else {
      // Slide down animation
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true
      }).start();
      
      // Cleanup
      cleanupAudio();
    }

    return () => {
      cleanupAudio();
    };
  }, [isVisible]);

  useEffect(() => {
    if (recordingStatus.isRecording) {
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true
          })
        ])
      ).start();

      // Start waveform animation
      Animated.loop(
        Animated.timing(waveformAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false
        })
      ).start();
    } else {
      // Stop animations
      pulseAnim.stopAnimation();
      waveformAnim.stopAnimation();
      pulseAnim.setValue(1);
      waveformAnim.setValue(0);
    }
  }, [recordingStatus.isRecording]);

  const setupAudio = async () => {
    try {
      console.log('🎤 Setting up audio for recording...');
      
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          'Microphone Permission Required',
          'Please enable microphone access to send voice messages.',
          [{ text: 'OK', onPress: onCancel }]
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      setRecordingStatus(prev => ({ ...prev, canRecord: true }));
      console.log('✅ Audio setup complete');
    } catch (error) {
      console.error('❌ Failed to setup audio:', error);
      Alert.alert('Error', 'Failed to setup audio recording');
      onCancel();
    }
  };

  const cleanupAudio = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      setRecordingStatus({
        canRecord: false,
        isRecording: false,
        isDoneRecording: false,
        durationMillis: 0
      });
      setIsPlaying(false);
    } catch (error) {
      console.error('❌ Error cleaning up audio:', error);
    }
  };

  const startRecording = async () => {
    try {
      if (!recordingStatus.canRecord) {
        await setupAudio();
        return;
      }

      console.log('🎤 Starting recording...');
      
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Vibration.vibrate(50);
      }

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        }
      });

      newRecording.setOnRecordingStatusUpdate((status) => {
        // Map expo-av RecordingStatus to our custom status
        setRecordingStatus(prevStatus => ({
          ...prevStatus,
          isRecording: status.isRecording || false,
          durationMillis: status.durationMillis || 0,
          uri: status.uri || undefined
        }));
      });

      await newRecording.startAsync();
      setRecording(newRecording);
      
      console.log('✅ Recording started');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
      onCancel();
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      console.log('⏹️ Stopping recording...');
      
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        setRecordingStatus(prev => ({
          ...prev,
          uri,
          isDoneRecording: true,
          isRecording: false
        }));
        console.log('✅ Recording stopped, URI:', uri);
      } else {
        throw new Error('No recording URI available');
      }
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
      onCancel();
    }
  };

  const playRecording = async () => {
    try {
      if (!recordingStatus.uri) return;

      if (sound && isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
        return;
      }

      if (sound && !isPlaying) {
        await sound.playAsync();
        setIsPlaying(true);
        return;
      }

      console.log('🎵 Loading recording for playback...');
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordingStatus.uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      );

      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('❌ Failed to play recording:', error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const sendRecording = async () => {
    try {
      if (!recordingStatus.uri || !recordingStatus.isDoneRecording) return;

      setIsSending(true);
      
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const duration = Math.floor(recordingStatus.durationMillis / 1000);
      await onSendVoice(recordingStatus.uri, duration);
      
      console.log('✅ Voice message sent');
    } catch (error) {
      console.error('❌ Failed to send voice message:', error);
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setIsSending(false);
    }
  };

  const deleteRecording = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      setRecordingStatus(prev => ({
        ...prev,
        uri: undefined,
        isDoneRecording: false,
        durationMillis: 0
      }));
      setIsPlaying(false);
      
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      console.log('🗑️ Recording deleted');
    } catch (error) {
      console.error('❌ Failed to delete recording:', error);
    }
  };

  const formatDuration = (millis: number): string => {
    const seconds = Math.floor(millis / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderWaveform = () => {
    const bars = Array.from({ length: 30 }).map((_, index) => {
      const height = waveformAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [8, Math.random() * 24 + 8],
        extrapolate: 'clamp'
      });

      return (
        <Animated.View
          key={index}
          style={[
            styles.waveformBar,
            { 
              height,
              opacity: recordingStatus.isRecording ? 0.8 : 0.3
            }
          ]}
        />
      );
    });

    return <View style={styles.waveform}>{bars}</View>;
  };

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.content}>
        {/* Cancel button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={disabled || isSending}
        >
          <X size={24} color="#6b7280" />
        </TouchableOpacity>

        {/* Main content */}
        <View style={styles.mainContent}>
          {recordingStatus.isDoneRecording ? (
            // Playback controls
            <View style={styles.playbackContainer}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={playRecording}
                disabled={disabled}
              >
                {isPlaying ? (
                  <Pause size={24} color="#ec4899" />
                ) : (
                  <Play size={24} color="#ec4899" />
                )}
              </TouchableOpacity>

              <View style={styles.playbackInfo}>
                <Text style={styles.durationText}>
                  {formatDuration(recordingStatus.durationMillis)}
                </Text>
                <View style={styles.staticWaveform}>
                  {Array.from({ length: 20 }).map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.staticWaveformBar,
                        { height: Math.random() * 16 + 8 }
                      ]}
                    />
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={deleteRecording}
                disabled={disabled}
              >
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            // Recording controls
            <View style={styles.recordingContainer}>
              <Animated.View style={[
                styles.recordButton,
                { transform: [{ scale: pulseAnim }] }
              ]}>
                <TouchableOpacity
                  style={[
                    styles.recordButtonInner,
                    recordingStatus.isRecording && styles.recordingActive
                  ]}
                  onPress={recordingStatus.isRecording ? stopRecording : startRecording}
                  disabled={disabled || (!recordingStatus.canRecord && !recordingStatus.isRecording)}
                >
                  {recordingStatus.isRecording ? (
                    <MicOff size={28} color="#ffffff" />
                  ) : (
                    <Mic size={28} color="#ec4899" />
                  )}
                </TouchableOpacity>
              </Animated.View>

              {recordingStatus.isRecording && (
                <View style={styles.recordingInfo}>
                  <Text style={styles.recordingText}>Recording...</Text>
                  <Text style={styles.durationText}>
                    {formatDuration(recordingStatus.durationMillis)}
                  </Text>
                  {renderWaveform()}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Send button */}
        {recordingStatus.isDoneRecording && (
          <TouchableOpacity
            style={[
              styles.sendButton,
              (disabled || isSending) && styles.sendButtonDisabled
            ]}
            onPress={sendRecording}
            disabled={disabled || isSending}
          >
            <Send size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingBottom: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cancelButton: {
    padding: 8,
  },
  mainContent: {
    flex: 1,
  },
  recordingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#ec4899',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingActive: {
    backgroundColor: '#ec4899',
  },
  recordingInfo: {
    alignItems: 'center',
    gap: 8,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ec4899',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 40,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#ec4899',
    borderRadius: 1.5,
  },
  playbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#ec4899',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackInfo: {
    flex: 1,
    gap: 8,
  },
  staticWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  staticWaveformBar: {
    width: 2,
    backgroundColor: '#d1d5db',
    borderRadius: 1,
  },
  deleteButton: {
    padding: 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ec4899',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
});