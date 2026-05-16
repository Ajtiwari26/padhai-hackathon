import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Theme } from '../theme/theme';

const { width } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
}

export const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const tagFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo fade in + scale
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      ]),
      // Glow pulse on [AI]
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        ]),
        { iterations: 2 }
      ),
      // Tagline fade in
      Animated.timing(tagFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Navigate after 3.5s
    const timer = setTimeout(onFinish, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Background glow orbs */}
      <View style={styles.orbPrimary} />
      <View style={styles.orbSecondary} />

      <Animated.View style={[styles.logoContainer, {
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }]}>
        {/* Logo text */}
        <View style={styles.logoRow}>
          <Text style={styles.logoPadh}>padh</Text>
          <Animated.Text style={[styles.logoAI, { opacity: glowAnim }]}>
            .ai
          </Animated.Text>
        </View>
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: tagFade }]}>
        Your Personal AI Mentor
      </Animated.Text>

      <View style={styles.bottomBar}>
        <Text style={styles.poweredBy}>Powered by Gemma 4 • On-Device AI</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbPrimary: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: '25%',
    left: -50,
  },
  orbSecondary: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(45, 212, 191, 0.06)',
    bottom: '20%',
    right: -40,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoPadh: {
    fontSize: 52,
    fontWeight: '300',
    color: Theme.colors.text,
    letterSpacing: 2,
  },
  logoAI: {
    fontSize: 52,
    fontWeight: '700',
    color: Theme.colors.primary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '400',
    color: Theme.colors.textSecondary,
    marginTop: 16,
    letterSpacing: 1.5,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
  },
  poweredBy: {
    fontSize: 11,
    fontWeight: '500',
    color: Theme.colors.textMuted,
    letterSpacing: 0.5,
  },
});
