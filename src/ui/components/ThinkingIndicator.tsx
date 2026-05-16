/**
 * ThinkingIndicator V2
 * 
 * Improved version matching the Padh.ai app icon design:
 * - Purple/Indigo AI chip with internal circuitry
 * - Glowing teal triodes radiating from edges
 * - Smooth pulsing animation
 * - Professional minimalist aesthetic
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Theme } from '../theme/theme';

interface Props {
  text?: string;
  size?: 'small' | 'medium' | 'large';
  isAnimating?: boolean; // Controls whether animations are active
}

export const ThinkingIndicator: React.FC<Props> = ({ 
  text = '', 
  size = 'small',
  isAnimating = true // Default to animating for backward compatibility
}) => {
  // Animation values
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const triodeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isAnimating) {
      // Stop animations and reset to default state
      pulseAnim.setValue(0);
      glowAnim.setValue(0);
      triodeAnim.setValue(0);
      return;
    }

    // Main pulse animation (chip breathing)
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    // Glow animation (faster pulse)
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    // Triode flow animation (data flowing)
    const triodeAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(triodeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(triodeAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    glowAnimation.start();
    triodeAnimation.start();

    return () => {
      pulseAnimation.stop();
      glowAnimation.stop();
      triodeAnimation.stop();
    };
  }, [pulseAnim, glowAnim, triodeAnim, isAnimating]);

  const sizeStyles = getSizeStyles(size);

  return (
    <View style={styles.container}>
      <View style={[styles.chipWrapper, sizeStyles.wrapper]}>
        {/* Outer Glow Ring */}
        <Animated.View
          style={[
            styles.outerGlow,
            sizeStyles.outerGlow,
            {
              opacity: glowAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 0.6, 0.3],
              }),
              transform: [
                {
                  scale: glowAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.15, 1],
                  }),
                },
              ],
            },
          ]}
        />

        {/* Main Chip Container */}
        <Animated.View
          style={[
            styles.chipContainer,
            sizeStyles.chip,
            {
              transform: [
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.98, 1.02, 0.98],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Chip Core (Purple) */}
          <View style={[styles.chipCore, sizeStyles.chipCore]}>
            {/* Inner Glow Layer */}
            <Animated.View
              style={[
                styles.innerGlow,
                {
                  opacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 0.7],
                  }),
                },
              ]}
            />

            {/* Internal Circuitry - Horizontal Lines */}
            <View style={[styles.circuitH, { top: '20%', width: '70%' }]} />
            <View style={[styles.circuitH, { top: '35%', width: '85%' }]} />
            <View style={[styles.circuitH, { top: '50%', width: '60%' }]} />
            <View style={[styles.circuitH, { top: '65%', width: '75%' }]} />
            <View style={[styles.circuitH, { top: '80%', width: '65%' }]} />

            {/* Internal Circuitry - Vertical Lines */}
            <View style={[styles.circuitV, { left: '20%', height: '70%' }]} />
            <View style={[styles.circuitV, { left: '40%', height: '55%' }]} />
            <View style={[styles.circuitV, { left: '60%', height: '65%' }]} />
            <View style={[styles.circuitV, { left: '80%', height: '60%' }]} />

            {/* Central Processor Core */}
            <View style={[styles.processorCore, sizeStyles.processorCore]}>
              <Animated.View
                style={[
                  styles.processorDot,
                  sizeStyles.processorDot,
                  {
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ]}
              />
            </View>

            {/* Corner Accents */}
            <View style={[styles.cornerAccent, styles.cornerTL]} />
            <View style={[styles.cornerAccent, styles.cornerTR]} />
            <View style={[styles.cornerAccent, styles.cornerBL]} />
            <View style={[styles.cornerAccent, styles.cornerBR]} />
          </View>

          {/* Radiating Triodes (Teal Data Flow) */}
          {/* Top Triode */}
          <Animated.View
            style={[
              styles.triode,
              styles.triodeTop,
              sizeStyles.triodeTop,
              {
                opacity: triodeAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.6, 1, 0.6],
                }),
                transform: [
                  {
                    scaleY: triodeAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.8, 1.1, 0.8],
                    }),
                  },
                ],
              },
            ]}
          />

          {/* Bottom Triode */}
          <Animated.View
            style={[
              styles.triode,
              styles.triodeBottom,
              sizeStyles.triodeBottom,
              {
                opacity: triodeAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.6, 1, 0.6],
                }),
                transform: [
                  {
                    scaleY: triodeAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.8, 1.1, 0.8],
                    }),
                  },
                ],
              },
            ]}
          />

          {/* Right Triode */}
          <Animated.View
            style={[
              styles.triode,
              styles.triodeRight,
              sizeStyles.triodeRight,
              {
                opacity: triodeAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.6, 1, 0.6],
                }),
                transform: [
                  {
                    scaleX: triodeAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.8, 1.1, 0.8],
                    }),
                  },
                ],
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* Thinking Text */}
      {text && (
        <Animated.Text
          style={[
            styles.text,
            sizeStyles.text,
            {
              opacity: pulseAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.8, 1, 0.8],
              }),
            },
          ]}
        >
          {text}
        </Animated.Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  chipWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerGlow: {
    position: 'absolute',
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  chipContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipCore: {
    borderRadius: 10,
    backgroundColor: '#5B21B6', // Deep Purple
    borderWidth: 2,
    borderColor: '#7C3AED', // Lighter Purple
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
  },
  innerGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(124, 58, 237, 0.4)',
    borderRadius: 10,
  },
  circuitH: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(167, 139, 250, 0.5)',
    left: '5%',
  },
  circuitV: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(167, 139, 250, 0.5)',
    top: '10%',
  },
  processorCore: {
    borderRadius: 4,
    backgroundColor: '#1E1B4B', // Dark Navy
    borderWidth: 2,
    borderColor: '#2DD4BF', // Teal
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  processorDot: {
    borderRadius: 999,
    backgroundColor: '#2DD4BF',
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  cornerAccent: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: 'rgba(45, 212, 191, 0.6)',
    borderRadius: 1,
  },
  cornerTL: { top: 4, left: 4 },
  cornerTR: { top: 4, right: 4 },
  cornerBL: { bottom: 4, left: 4 },
  cornerBR: { bottom: 4, right: 4 },
  triode: {
    position: 'absolute',
    backgroundColor: '#2DD4BF',
    borderRadius: 4,
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  triodeTop: {},
  triodeBottom: {},
  triodeRight: {},
  text: {
    color: '#E8EDFB',
    fontWeight: '600',
    letterSpacing: 0.3,
    opacity: 0.6,
    textShadowColor: 'rgba(99, 102, 241, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});

// Size variants
function getSizeStyles(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'small':
      return StyleSheet.create({
        wrapper: { width: 40, height: 40 },
        outerGlow: { width: 40, height: 40 },
        chip: { width: 40, height: 40 },
        chipCore: { width: 28, height: 28 },
        processorCore: { width: 10, height: 10 },
        processorDot: { width: 3, height: 3 },
        triodeTop: { top: -8, left: 17, width: 3, height: 8 },
        triodeBottom: { bottom: -8, left: 17, width: 3, height: 8 },
        triodeRight: { right: -8, top: 17, width: 8, height: 3 },
        text: { fontSize: 11 },
      });

    case 'large':
      return StyleSheet.create({
        wrapper: { width: 64, height: 64 },
        outerGlow: { width: 64, height: 64 },
        chip: { width: 64, height: 64 },
        chipCore: { width: 48, height: 48 },
        processorCore: { width: 18, height: 18 },
        processorDot: { width: 6, height: 6 },
        triodeTop: { top: -14, left: 29, width: 4, height: 14 },
        triodeBottom: { bottom: -14, left: 29, width: 4, height: 14 },
        triodeRight: { right: -14, top: 29, width: 14, height: 4 },
        text: { fontSize: 18 },
      });

    case 'medium':
    default:
      return StyleSheet.create({
        wrapper: { width: 52, height: 52 },
        outerGlow: { width: 52, height: 52 },
        chip: { width: 52, height: 52 },
        chipCore: { width: 38, height: 38 },
        processorCore: { width: 14, height: 14 },
        processorDot: { width: 5, height: 5 },
        triodeTop: { top: -12, left: 23, width: 3.5, height: 12 },
        triodeBottom: { bottom: -12, left: 23, width: 3.5, height: 12 },
        triodeRight: { right: -12, top: 23, width: 12, height: 3.5 },
        text: { fontSize: 15 },
      });
  }
}

export default ThinkingIndicator;
