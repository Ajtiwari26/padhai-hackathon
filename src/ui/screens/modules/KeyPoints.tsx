import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme/theme';
import { ArrowLeft, BookOpen, Copy, RotateCcw, Frown, Meh, Smile, SmilePlus, Star } from 'lucide-react-native';

interface Props {
  navigation?: any;
  topic?: string;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;

export const KeyPoints: React.FC<Props> = ({ 
  navigation, 
  topic = "Physics" 
}) => {
  const [selectedEmoji, setSelectedEmoji] = useState<number | null>(null);

  const flashcards = [
    { title: "Newton's First Law", content: "An object remains at rest or in uniform motion unless acted upon by a net external force." },
    { title: "Inertia", content: "The resistance of any physical object to any change in its velocity." },
    { title: "Equilibrium", content: "A state in which opposing forces or influences are balanced." },
  ];

  const formulas = [
    { name: "Force", formula: "F = ma" },
    { name: "Momentum", formula: "p = mv" },
    { name: "Kinetic Energy", formula: "KE = 1/2 mv²" },
  ];

  const emojis = ['😕', '😐', '🙂', '😃', '🤩'];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={24} color={Theme.colors.primaryLight} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BookOpen size={20} color={Theme.colors.text} />
          <Text style={styles.headerTitle}>Key Takeaways</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>{topic} Summary</Text>
          <Text style={styles.subtitle}>Review the core concepts</Text>
        </View>

        {/* Flashcards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Flashcards</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 16}
            decelerationRate="fast"
            contentContainerStyle={styles.flashcardContainer}
          >
            {flashcards.map((card, i) => (
              <TouchableOpacity key={i} style={styles.flashcard} activeOpacity={0.9}>
                <View style={styles.flashcardInner}>
                  <Text style={styles.flashcardTitle}>{card.title}</Text>
                  <Text style={styles.flashcardContent}>{card.content}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Text style={styles.flipText}>Tap to flip</Text>
                  <RotateCcw size={12} color={Theme.colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Formulas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Critical Formulas</Text>
          <View style={styles.formulaList}>
            {formulas.map((item, i) => (
              <View key={i} style={styles.formulaCard}>
                <View>
                  <Text style={styles.formulaName}>{item.name}</Text>
                  <Text style={styles.formulaText}>{item.formula}</Text>
                </View>
                <TouchableOpacity style={styles.copyButton}>
                  <Copy size={18} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Confidence Rating */}
        <View style={styles.confidenceSection}>
          <Text style={styles.confidenceTitle}>How well did you understand this?</Text>
          <View style={styles.emojiRow}>
            {emojis.map((emoji, i) => {
              const icons = [
                <Frown size={24} color={selectedEmoji === i ? Theme.colors.primary : Theme.colors.text} />,
                <Meh size={24} color={selectedEmoji === i ? Theme.colors.primary : Theme.colors.text} />,
                <Smile size={24} color={selectedEmoji === i ? Theme.colors.primary : Theme.colors.text} />,
                <SmilePlus size={24} color={selectedEmoji === i ? Theme.colors.primary : Theme.colors.text} />,
                <Star size={24} color={selectedEmoji === i ? Theme.colors.primary : Theme.colors.text} />,
              ];
              
              return (
                <TouchableOpacity 
                  key={i} 
                  style={[
                    styles.emojiButton, 
                    selectedEmoji === i && styles.emojiSelected
                  ]}
                  onPress={() => setSelectedEmoji(i)}
                >
                  {icons[i]}
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedEmoji !== null && (
            <TouchableOpacity style={styles.submitRatingButton} onPress={() => navigation?.goBack()}>
              <Text style={styles.submitRatingText}>Continue Learning</Text>
            </TouchableOpacity>
          )}
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
  },
  iconButton: { padding: 8 },
  iconText: { color: Theme.colors.primaryLight, fontSize: 24 },
  headerTitle: { color: Theme.colors.text, fontSize: 18, fontWeight: '700' },
  scroll: {
    paddingTop: 16,
  },
  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  flashcardContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  flashcard: {
    width: CARD_WIDTH,
    height: 200,
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    padding: 24,
    justifyContent: 'space-between',
  },
  flashcardInner: {
    flex: 1,
  },
  flashcardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.primaryLight,
    marginBottom: 12,
  },
  flashcardContent: {
    fontSize: 16,
    color: Theme.colors.text,
    lineHeight: 24,
  },
  flipText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  formulaList: {
    paddingHorizontal: 24,
    gap: 12,
  },
  formulaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 52, 73, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorderLight,
  },
  formulaName: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  formulaText: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.secondaryLight,
    fontFamily: 'Courier',
  },
  copyButton: {
    padding: 12,
    backgroundColor: Theme.colors.glassBackground,
    borderRadius: 12,
  },
  copyIcon: {
    fontSize: 18,
  },
  confidenceSection: {
    paddingHorizontal: 24,
    marginTop: 16,
    backgroundColor: 'rgba(45, 52, 73, 0.25)',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    alignItems: 'center',
  },
  confidenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  emojiSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '30',
    transform: [{ scale: 1.1 }],
  },
  emojiText: {
    fontSize: 24,
  },
  submitRatingButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 100,
    width: '100%',
    alignItems: 'center',
  },
  submitRatingText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
