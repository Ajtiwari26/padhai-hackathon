import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { AISyllabusGenerator } from '../../core/curriculum/AISyllabusGenerator';
import { ArrowLeft, Target, Rocket } from 'lucide-react-native';

export const CurriculumCreator: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('Intermediate');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!goal.trim()) return;

    setIsGenerating(true);
    try {
      const draft = await AISyllabusGenerator.generateFromGoal(goal, level);
      navigation.navigate('CurriculumReview', { draft });
    } catch (e) {
      console.error('[CurriculumCreator] Generation failed:', e);
      Alert.alert('Error', 'Failed to generate outline. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={24} color={Theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Learning Path</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Target size={40} color={Theme.colors.primary} />
          </View>
          
          <Text style={styles.title}>What do you want to master?</Text>
          <Text style={styles.subtitle}>
            Tell us your goal, and our AI Mentor will map out the perfect hierarchical learning path for you.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Goal</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Quantum Physics for Beginners, React Native Mastery..."
              placeholderTextColor={Theme.colors.textMuted}
              value={goal}
              onChangeText={setGoal}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.levelGroup}>
            <Text style={styles.label}>Target Level</Text>
            <View style={styles.levelRow}>
              {['Basic', 'Intermediate', 'Advanced'].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.levelBtn, level === l && styles.levelBtnActive]}
                  onPress={() => setLevel(l)}
                >
                  <Text style={[styles.levelBtnText, level === l && styles.levelBtnTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.generateBtn, !goal.trim() && styles.generateBtnDisabled]} 
            onPress={handleGenerate}
            disabled={isGenerating || !goal.trim()}
          >
            {isGenerating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Rocket size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.generateBtnText}>Map My Journey</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Theme.colors.text },
  content: { flex: 1, padding: 30, alignItems: 'center' },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: Theme.colors.text, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: Theme.colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  inputGroup: { width: '100%', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: Theme.colors.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    color: Theme.colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  levelGroup: { width: '100%', marginBottom: 40 },
  levelRow: { flexDirection: 'row', gap: 10 },
  levelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Theme.colors.surfaceCard,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  levelBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  levelBtnText: { fontSize: 14, fontWeight: '600', color: Theme.colors.textSecondary },
  levelBtnTextActive: { color: '#fff' },
  generateBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: Theme.colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
