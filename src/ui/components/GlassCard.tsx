import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { Theme } from '../theme/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.inner}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: Theme.roundness.md,
    backgroundColor: Theme.colors.glassBackground,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      }
    })
  },
  inner: {
    padding: Theme.spacing.md,
  }
});
