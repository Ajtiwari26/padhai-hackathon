/**
 * ThinkingIndicator Comparison
 * 
 * Side-by-side comparison of V1 and V2
 * Use this to test and decide which version to use
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ThinkingIndicatorV2 } from './ThinkingIndicatorV2';
import { Theme } from '../theme/theme';

export const ThinkingIndicatorComparison: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🎨 ThinkingIndicator Comparison</Text>

      {/* Version 1 - Current */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Version 1 (Current)</Text>
        <View style={styles.demoBox}>
          <ThinkingIndicator text="Thinking..." />
        </View>
        <Text style={styles.description}>
          • Deep Indigo chip (#4F46E5){'\n'}
          • Basic internal circuitry{'\n'}
          • Simple pulse animation{'\n'}
          • Teal triodes
        </Text>
      </View>

      {/* Version 2 - New Purple Design */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Version 2 (New - Purple)</Text>
        
        {/* Medium Size */}
        <View style={styles.demoBox}>
          <ThinkingIndicatorV2 text="Thinking..." size="medium" />
        </View>
        <Text style={styles.description}>
          • Deep Purple chip (#5B21B6){'\n'}
          • Enhanced circuitry details{'\n'}
          • Multi-layer glow effects{'\n'}
          • Smooth triode flow animation{'\n'}
          • Corner accents{'\n'}
          • Matches app icon design
        </Text>

        {/* Small Size */}
        <Text style={styles.subTitle}>Small Size</Text>
        <View style={styles.demoBox}>
          <ThinkingIndicatorV2 text="Processing..." size="small" />
        </View>

        {/* Large Size */}
        <Text style={styles.subTitle}>Large Size</Text>
        <View style={styles.demoBox}>
          <ThinkingIndicatorV2 text="Analyzing..." size="large" />
        </View>

        {/* Without Text */}
        <Text style={styles.subTitle}>Without Text</Text>
        <View style={styles.demoBox}>
          <ThinkingIndicatorV2 text="" size="medium" />
        </View>
      </View>

      {/* Feature Comparison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feature Comparison</Text>
        <View style={styles.comparisonTable}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeader}>Feature</Text>
            <Text style={styles.tableHeader}>V1</Text>
            <Text style={styles.tableHeader}>V2</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Color Match</Text>
            <Text style={styles.tableCell}>Indigo</Text>
            <Text style={[styles.tableCell, styles.highlight]}>Purple ✓</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Circuitry Detail</Text>
            <Text style={styles.tableCell}>Basic</Text>
            <Text style={[styles.tableCell, styles.highlight]}>Enhanced ✓</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Glow Effects</Text>
            <Text style={styles.tableCell}>Single</Text>
            <Text style={[styles.tableCell, styles.highlight]}>Multi-layer ✓</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Animations</Text>
            <Text style={styles.tableCell}>1 (pulse)</Text>
            <Text style={[styles.tableCell, styles.highlight]}>3 (pulse+glow+flow) ✓</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Size Options</Text>
            <Text style={styles.tableCell}>Fixed</Text>
            <Text style={[styles.tableCell, styles.highlight]}>3 sizes ✓</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Corner Accents</Text>
            <Text style={styles.tableCell}>No</Text>
            <Text style={[styles.tableCell, styles.highlight]}>Yes ✓</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Icon Match</Text>
            <Text style={styles.tableCell}>Partial</Text>
            <Text style={[styles.tableCell, styles.highlight]}>Exact ✓</Text>
          </View>
        </View>
      </View>

      {/* Recommendation */}
      <View style={styles.recommendation}>
        <Text style={styles.recommendTitle}>💡 Recommendation</Text>
        <Text style={styles.recommendText}>
          Version 2 is recommended because:{'\n\n'}
          ✓ Matches the app icon design exactly{'\n'}
          ✓ Purple color scheme is more distinctive{'\n'}
          ✓ Enhanced visual details and animations{'\n'}
          ✓ Multiple size options for flexibility{'\n'}
          ✓ Better glow and flow effects{'\n'}
          ✓ More polished and professional look
        </Text>
      </View>

      {/* Usage Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Usage</Text>
        <View style={styles.codeBlock}>
          <Text style={styles.code}>
            {`// Import V2
import { ThinkingIndicatorV2 } from './ThinkingIndicatorV2';

// Use in your component
<ThinkingIndicatorV2 
  text="Thinking..." 
  size="medium" 
/>

// Size options: 'small' | 'medium' | 'large'
// Text is optional (can be empty string)`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.primary,
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    marginBottom: 40,
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.secondary,
    marginBottom: 20,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  demoBox: {
    backgroundColor: Theme.colors.background,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    alignItems: 'center',
  },
  description: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    lineHeight: 20,
  },
  comparisonTable: {
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
  },
  tableHeader: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.primary,
    backgroundColor: Theme.colors.surfaceMuted,
  },
  tableCell: {
    flex: 1,
    padding: 12,
    fontSize: 13,
    color: Theme.colors.text,
  },
  highlight: {
    color: Theme.colors.secondary,
    fontWeight: '600',
  },
  recommendation: {
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderWidth: 2,
    borderColor: Theme.colors.secondary,
  },
  recommendTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.secondary,
    marginBottom: 12,
  },
  recommendText: {
    fontSize: 14,
    color: Theme.colors.text,
    lineHeight: 22,
  },
  codeBlock: {
    backgroundColor: Theme.colors.background,
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  code: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: Theme.colors.secondary,
    lineHeight: 18,
  },
});
