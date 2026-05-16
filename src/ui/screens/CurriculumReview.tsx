import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { AISyllabusGenerator, Curriculum, Chapter } from '../../core/curriculum/AISyllabusGenerator';
import { ArrowLeft, Clock, Zap, CheckCircle, Trash2, Plus } from 'lucide-react-native';

export const CurriculumReview: React.FC<{ route: any, navigation: any }> = ({ route, navigation }) => {
  const { draft } = route.params as { draft: Curriculum };
  const [curriculum, setCurriculum] = useState<Curriculum>(draft);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');

  const handleAddChapter = () => {
    if (!newChapterName.trim()) {
      Alert.alert('Error', 'Please enter a chapter name.');
      return;
    }

    const newChapter: Chapter = {
      id: `custom_${Date.now()}`,
      name: newChapterName,
      description: 'Custom user-added chapter.',
      order: curriculum.chapters.length + 1,
      difficulty: 50,
      estimatedHours: 2,
      subtopics: [],
      isEnriched: false,
      status: 'locked'
    };

    setCurriculum({
      ...curriculum,
      chapters: [...curriculum.chapters, newChapter]
    });
    setNewChapterName('');
    setIsModalVisible(false);
  };

  const handleDeleteChapter = (id: string) => {
    const updatedChapters = curriculum.chapters.filter(c => c.id !== id)
      .map((c, i) => ({ ...c, order: i + 1 }));
    setCurriculum({ ...curriculum, chapters: updatedChapters });
  };

  const handleFinalize = async () => {
    try {
      const final: Curriculum = {
        ...curriculum,
        status: 'active',
        isOutlineOnly: true, // It's still just an outline until chapters are enriched
        createdAt: Date.now()
      };
      await AISyllabusGenerator.saveCurriculum(final);
      
      // Navigate to Home and reset stack to prevent going back to review
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (e) {
      console.error('[CurriculumReview] Finalize failed:', e);
      Alert.alert('Error', 'Failed to save curriculum.');
    }
  };

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty < 40) return 'Basic';
    if (difficulty < 60) return 'Intermediate';
    if (difficulty < 80) return 'Advanced';
    return 'Expert';
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty < 40) return '#10b981';
    if (difficulty < 60) return '#f59e0b';
    if (difficulty < 80) return '#ef4444';
    return '#9333ea';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Your Path</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{curriculum.subject}</Text>
          <Text style={styles.summarySubtitle}>{curriculum.level} • {curriculum.chapters.length} Chapters</Text>
        </View>

        <Text style={styles.sectionTitle}>Proposed Outline</Text>
        <Text style={styles.sectionSubtitle}>You can remove chapters you already know or keep the full journey.</Text>

        {curriculum.chapters.map((chapter) => (
          <View key={chapter.id} style={styles.chapterCard}>
            <View style={styles.chapterHeader}>
              <View style={styles.chapterOrderBox}>
                <Text style={styles.chapterOrderText}>{chapter.order}</Text>
              </View>
              <View style={styles.chapterInfo}>
                <Text style={styles.chapterName}>{chapter.name}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Clock size={12} color={Theme.colors.textMuted} />
                    <Text style={styles.metaText}>{chapter.estimatedHours}h</Text>
                  </View>
                  <View style={[styles.diffBadge, { backgroundColor: getDifficultyColor(chapter.difficulty) + '15' }]}>
                    <Text style={[styles.diffText, { color: getDifficultyColor(chapter.difficulty) }]}>
                      {getDifficultyLabel(chapter.difficulty)}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => handleDeleteChapter(chapter.id)}
                style={styles.deleteBtn}
              >
                <Trash2 size={20} color={Theme.colors.error} />
              </TouchableOpacity>
            </View>
            <Text style={styles.chapterDesc}>{chapter.description}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalVisible(true)}>
          <Plus size={20} color={Theme.colors.primary} />
          <Text style={styles.addBtnText}>Add Custom Chapter</Text>
        </TouchableOpacity>

        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Custom Chapter</Text>
              <TextInput
                style={styles.input}
                placeholder="Chapter Name (e.g., Advanced Calculus)"
                placeholderTextColor={Theme.colors.textMuted}
                value={newChapterName}
                onChangeText={setNewChapterName}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.cancelBtn]} 
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.confirmBtn]} 
                  onPress={handleAddChapter}
                >
                  <Text style={styles.confirmBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.finalizeBtn} onPress={handleFinalize}>
          <CheckCircle size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.finalizeBtnText}>Looks Perfect, Let's Start!</Text>
        </TouchableOpacity>
      </View>
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
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Theme.colors.text },
  scroll: { padding: 20 },
  summaryCard: {
    backgroundColor: Theme.colors.primary + '10',
    padding: 24,
    borderRadius: 24,
    marginBottom: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.primary + '30',
  },
  summaryTitle: { fontSize: 22, fontWeight: '800', color: Theme.colors.text, textAlign: 'center', marginBottom: 8 },
  summarySubtitle: { fontSize: 14, color: Theme.colors.primary, fontWeight: '600' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: Theme.colors.text, marginBottom: 8 },
  sectionSubtitle: { fontSize: 14, color: Theme.colors.textSecondary, marginBottom: 24 },
  chapterCard: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  chapterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  chapterOrderBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chapterOrderText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  chapterInfo: { flex: 1 },
  chapterName: { fontSize: 16, fontWeight: '700', color: Theme.colors.text, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Theme.colors.textMuted, fontWeight: '600' },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  diffText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  deleteBtn: { padding: 8 },
  chapterDesc: { fontSize: 13, color: Theme.colors.textSecondary, lineHeight: 18 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderStyle: 'dashed',
    marginTop: 8,
    gap: 8,
  },
  addBtnText: { color: Theme.colors.primary, fontWeight: '700', fontSize: 15 },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
    backgroundColor: Theme.colors.background,
  },
  finalizeBtn: {
    height: 56,
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  finalizeBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 20,
  },
  input: {
    backgroundColor: Theme.colors.background,
    borderRadius: 12,
    padding: 16,
    color: Theme.colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: Theme.colors.surfaceMuted,
  },
  cancelBtnText: {
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: Theme.colors.primary,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
