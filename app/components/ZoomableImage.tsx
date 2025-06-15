import React, { useEffect, useState } from 'react';
import { 
  Image, 
  Dimensions, 
  View, 
  StyleSheet,
  ImageStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import * as ScreenOrientation from 'expo-screen-orientation';

interface ZoomableImageProps {
  source: { uri: string };
  style?: ImageStyle;
  onSingleTap?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
}

const ZoomableImage: React.FC<ZoomableImageProps> = ({ 
  source, 
  style, 
  onSingleTap,
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown
}) => {
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  
  // Zoom and pan values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // For tracking pan start positions
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  useEffect(() => {
    // Unlock screen orientation when component mounts
    const unlockOrientation = async () => {
      try {
        await ScreenOrientation.unlockAsync();
      } catch (error) {
        console.log('Failed to unlock orientation:', error);
      }
    };

    unlockOrientation();

    // Listen for orientation changes
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
      // Reset zoom when orientation changes
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

    return () => {
      // Lock back to portrait when component unmounts
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(
        error => console.log('Failed to lock orientation:', error)
      );
      subscription?.remove();
    };
  }, []);

  // Single tap gesture
  const singleTap = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      if (scale.value <= 1.1 && onSingleTap) {
        runOnJS(onSingleTap)();
      }
    });

  // Double tap gesture for zoom toggle
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else {
        // Zoom in to 2x
        scale.value = withSpring(2);
      }
    });

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = startScale.value * event.scale;
      // Constrain scale between 1 and 4
      scale.value = Math.max(1, Math.min(4, newScale));
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  // Pan gesture for moving around when zoomed and for swipe gestures
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1.1) {
        // Pan when zoomed in
        const maxTranslateX = (screenData.width * (scale.value - 1)) / 2;
        const maxTranslateY = (screenData.height * (scale.value - 1)) / 2;
        
        const newTranslateX = startX.value + event.translationX;
        const newTranslateY = startY.value + event.translationY;
        
        translateX.value = Math.max(-maxTranslateX, Math.min(maxTranslateX, newTranslateX));
        translateY.value = Math.max(-maxTranslateY, Math.min(maxTranslateY, newTranslateY));
      } else {
        // Handle swipe gestures when not zoomed
        const absX = Math.abs(event.translationX);
        const absY = Math.abs(event.translationY);
        
        if (absY > absX) {
          // Vertical swipe - only allow downward swipe to close
          if (event.translationY > 0) {
            translateY.value = event.translationY * 0.5; // Damping effect
          }
        } else {
          // Horizontal swipe for navigation
          translateX.value = event.translationX * 0.3; // Damping effect
        }
      }
    })
    .onEnd((event) => {
      if (scale.value > 1.1) {
        // Just end pan when zoomed
        return;
      }
      
      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      const velocityX = event.velocityX;
      const velocityY = event.velocityY;
      
      // Check for swipe gestures
      if (absY > absX) {
        // Vertical swipe
        if (event.translationY > 100 || velocityY > 500) {
          // Swipe down to close
          if (onSwipeDown) {
            runOnJS(onSwipeDown)();
          }
        }
      } else {
        // Horizontal swipe
        if (absX > 80 || Math.abs(velocityX) > 500) {
          if (event.translationX > 0) {
            // Swipe right
            if (onSwipeRight) {
              runOnJS(onSwipeRight)();
            }
          } else {
            // Swipe left
            if (onSwipeLeft) {
              runOnJS(onSwipeLeft)();
            }
          }
        }
      }
      
      // Reset position with animation
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  // Compose all gestures
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    Gesture.Exclusive(doubleTap, singleTap)
  );

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, 100],
      [1, 0.7],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity,
    };
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.gestureContainer}>
          <Animated.View style={[animatedStyle]}>
            <Image
              source={source}
              style={[
                {
                  width: screenData.width,
                  height: screenData.height,
                },
                style
              ]}
              resizeMode="contain"
            />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gestureContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ZoomableImage; 