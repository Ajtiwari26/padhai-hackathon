import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme/theme';
import { ArrowLeft, MoreVertical, Microscope, PlayCircle, BarChart2 } from 'lucide-react-native';

interface Props {
  navigation?: any;
  topic?: string;
  subtopic?: string;
}

export const PracticalLab: React.FC<Props> = ({ 
  navigation, 
  topic = "Physics", 
  subtopic = "Kinematics" 
}) => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => navigation?.goBack()}
        >
          <ArrowLeft size={24} color={Theme.colors.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{topic}</Text>
        <TouchableOpacity style={styles.iconButton}>
          <MoreVertical size={24} color={Theme.colors.primaryLight} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Microscope size={28} color={Theme.colors.text} />
            <Text style={[styles.pageTitle, { marginBottom: 0 }]}>Practical Lab</Text>
          </View>
          <Text style={styles.subtitle}>{subtopic}</Text>
        </View>

        {/* Large Diagram Card */}
        <View style={styles.diagramCard}>
          <View style={styles.imagePlaceholder}>
            {/* Placeholder for future generated diagrams */}
            <Text style={styles.placeholderText}>Visual Diagram Simulation</Text>
            <Text style={styles.placeholderSub}>[Interactive Graph Area]</Text>
          </View>
        </View>

        {/* Interactive Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.animButton}>
            <PlayCircle size={18} color="#003731" style={{ marginRight: 6 }} />
            <Text style={styles.animButtonText}>Show Animation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.graphButton}>
            <BarChart2 size={18} color={Theme.colors.primaryLight} style={{ marginRight: 6 }} />
            <Text style={styles.graphButtonText}>View Graph</Text>
          </TouchableOpacity>
        </View>

        {/* Visual Explanation Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Explanation</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepDot} />
            <Text style={styles.stepText}>Observe the trajectory of the particle under constant acceleration.</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepDot} />
            <Text style={styles.stepText}>Notice how the velocity vector changes direction and magnitude.</Text>
          </View>
        </View>

        {/* Historical Context Card */}
        <View style={[styles.card, { borderLeftColor: Theme.colors.accent, borderLeftWidth: 4 }]}>
          <Text style={[styles.cardTitle, { color: Theme.colors.accent }]}>Historical Context</Text>
          <Text style={styles.cardText}>
            First calculated by Isaac Newton in 1687, forming the foundation of classical mechanics.
          </Text>
        </View>

        {/* Related Concepts */}
        <View style={styles.relatedSection}>
          <Text style={styles.relatedTitle}>Related Concepts</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {['Projectile Motion', 'Newton\'s Laws', 'Energy Conservation'].map((concept, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{concept}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
    backgroundColor: 'rgba(11, 19, 38, 0.8)',
  },
  iconButton: { padding: 8 },
  iconText: { color: Theme.colors.primaryLight, fontSize: 24 },
  headerTitle: { color: Theme.colors.primaryLight, fontSize: 18, fontWeight: '700' },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
  diagramCard: {
    backgroundColor: 'rgba(45, 52, 73, 0.15)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    marginBottom: 24,
  },
  imagePlaceholder: {
    height: 240,
    backgroundColor: 'rgba(11, 19, 38, 0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorderLight,
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: Theme.colors.primaryLight,
    fontWeight: '600',
    fontSize: 18,
    marginBottom: 8,
  },
  placeholderSub: {
    color: Theme.colors.textMuted,
    fontSize: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  animButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Theme.colors.secondary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animButtonText: {
    color: '#003731', // Dark text on teal
    fontWeight: '700',
    fontSize: 15,
  },
  graphButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  graphButtonText: {
    color: Theme.colors.primaryLight,
    fontWeight: '700',
    fontSize: 15,
  },
  card: {
    backgroundColor: 'rgba(45, 52, 73, 0.25)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    marginBottom: 16,
  },
  cardTitle: {
    color: Theme.colors.text,
    fontWeight: '600',
    fontSize: 18,
    marginBottom: 12,
  },
  cardText: {
    color: Theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.primaryLight,
    marginTop: 8,
  },
  stepText: {
    flex: 1,
    color: Theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  relatedSection: {
    marginTop: 16,
  },
  relatedTitle: {
    color: Theme.colors.text,
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 12,
  },
  chipsRow: {
    gap: 12,
    paddingRight: 24,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
