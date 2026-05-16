import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Theme } from '../theme/theme';
import { LocalServerManager } from '../../core/api/LocalServerManager';
import { Cpu, PowerOff } from 'lucide-react-native';

export const StatusBanner: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRunning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRunning]);

  useEffect(() => {
    const check = async () => {
      const running = await LocalServerManager.isRunning();
      setIsRunning(running);
    };

    check();
    const interval = setInterval(check, 5000);
    
    const unsubscribe = LocalServerManager.addStatusListener((status) => {
       setIsRunning(status.running);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return (
    <View style={[
      styles.container, 
      !isRunning && styles.containerInactive
    ]}>
      <Animated.View style={[
        styles.dot, 
        !isRunning && styles.dotInactive,
        isRunning && { transform: [{ scale: pulseAnim }] }
      ]} />
      {isRunning ? (
        <Cpu size={12} color={Theme.colors.secondary} style={{ marginRight: 6 }} />
      ) : (
        <PowerOff size={12} color={Theme.colors.error} style={{ marginRight: 6 }} />
      )}
      <Text style={[styles.text, !isRunning && styles.textInactive]}>
        {isRunning ? 'NPU Core Active' : 'Engine Standby'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 212, 191, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.15)',
  },
  containerInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.secondary,
    marginRight: 8,
    shadowColor: Theme.colors.secondary,
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },
  dotInactive: {
    backgroundColor: Theme.colors.error,
    shadowColor: Theme.colors.error,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    color: Theme.colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Theme.fonts.bold,
  },
  textInactive: {
    color: Theme.colors.error,
  },
});
