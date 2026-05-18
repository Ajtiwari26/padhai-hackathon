import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { AISyllabusGenerator, Curriculum, Chapter } from '../../core/curriculum/AISyllabusGenerator';
import { ChatStore } from '../../core/storage/ChatStore';
import { ResourceStore, ResourceTask } from '../../core/storage/ResourceStore';
import { ResourcePlanner } from '../../core/planner/ResourcePlanner';
import { EventBus } from '../../core/bus/EventBus';
import { RichText } from '../components/RichText';
import { ArrowLeft, Clock, Zap } from 'lucide-react-native';

export const ChapterDetail: React.FC<{ route: any, navigation: any }> = ({ route, navigation }) => {
  const { chapter, curriculum } = route.params as { chapter: Chapter, curriculum: Curriculum };
  const [enrichedChapter, setEnrichedChapter] = useState<Chapter>(chapter);
  const [isEnriching, setIsEnriching] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [resourceTasks, setResourceTasks] = useState<ResourceTask[]>([]);

  const loadChapterData = useCallback(async (chapterToLoad: Chapter = enrichedChapter) => {
    // Load notes
    if (chapterToLoad.subtopics && chapterToLoad.subtopics.length > 0) {
      const subtopicNames = chapterToLoad.subtopics.map(s => s.name);
      const chapterNotes = await ChatStore.getChapterNotes(chapterToLoad.name, subtopicNames);
      setNotes(chapterNotes);
    }

    // Load resource progress
    const tasks = await ResourceStore.getTasksForChapter(chapterToLoad.name);
    setResourceTasks(tasks);
  }, [enrichedChapter]);

  useEffect(() => {
    // On mount, load what we already have (notes, tasks)
    // But don't trigger AI enrichment automatically
    loadChapterData();
  }, [loadChapterData]);

  const handleEnrich = async () => {
    setIsEnriching(true);
    
    // Queue as user-initiated task with highest priority
    ResourcePlanner.queueTask(
      'subtopic',
      enrichedChapter.id,
      '',
      {
        chapterData: enrichedChapter,
        subjectContext: `${curriculum.subject} - ${curriculum.level} (Goal: ${curriculum.goal})`
      },
      true // User-initiated = highest priority
    );
    
    // Subscribe to task completion
    const unsubscribe = EventBus.on('chapter:enriched', async (data) => {
      if (data.chapterId === enrichedChapter.id) {
        // Reload curriculum to get updated chapter
        const updatedCurriculum = await AISyllabusGenerator.loadCurriculum();
        if (updatedCurriculum) {
          const updatedChapter = updatedCurriculum.chapters.find(c => c.id === enrichedChapter.id);
          if (updatedChapter) {
            setEnrichedChapter(updatedChapter);
            await loadChapterData(updatedChapter);
          }
        }
        
        // Only stop loading and unsubscribe when complete
        if (data.phase === 'complete') {
          setIsEnriching(false);
          unsubscribe();
        }
      }
    });
    
    // Timeout fallback
    setTimeout(() => {
      setIsEnriching(false);
      unsubscribe();
    }, 120000); // 2 minutes timeout
  };

  const getProgressForType = (type: ResourceTask['type']) => {
    const typeTasks = resourceTasks.filter(t => t.type === type);
    if (typeTasks.length === 0) return 0;
    const done = typeTasks.filter(t => t.status === 'done').length;
    return (done / typeTasks.length) * 100;
  };

  const handleStartClass = (subtopic?: string) => {
    navigation.navigate('MentorChat', { 
      topic: enrichedChapter.name,
      subtopic: subtopic,
      curriculumContext: `${curriculum.subject} - ${curriculum.level}`
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={24} color={Theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{enrichedChapter.name}</Text>
        <Text style={styles.description}>{enrichedChapter.description}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Clock size={14} color={Theme.colors.text} style={{ marginRight: 4 }} />
            <Text style={styles.metaText}>{enrichedChapter.estimatedHours}h Total</Text>
          </View>
          <View style={styles.metaBadge}>
            <Zap size={14} color={Theme.colors.text} style={{ marginRight: 4 }} />
            <Text style={styles.metaText}>Diff: {enrichedChapter.difficulty}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => handleStartClass()}>
            <Text style={styles.primaryBtnText}>Start Chapter Class</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('TestsHub')}>
            <Text style={styles.secondaryBtnText}>Take Chapter Test</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Chapter Readiness</Text>
          <View style={styles.progressRow}>
             <View style={styles.progItem}>
                <Text style={styles.progLabel}>Theory</Text>
                <View style={styles.barBg}><View style={[styles.barFill, {width: `${Math.max(notes ? 60 : 0, enrichedChapter.subtopics?.length ? 100 : 0)}%`}]}/></View>
             </View>
             <View style={styles.progItem}>
                <Text style={styles.progLabel}>Numericals</Text>
                <View style={styles.barBg}><View style={[styles.barFill, {width: `${getProgressForType('numerical')}%`}]}/></View>
             </View>
             <View style={styles.progItem}>
                <Text style={styles.progLabel}>MCQs</Text>
                <View style={styles.barBg}><View style={[styles.barFill, {width: `${getProgressForType('mcq')}%`}]}/></View>
             </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Subtopics Roadmap</Text>
        
        {isEnriching ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Theme.colors.primary} />
            <Text style={styles.loadingText}>AI is planning topics and concepts for this chapter...</Text>
            <Text style={styles.loadingSubtext}>This may take 30-60 seconds</Text>
          </View>
        ) : (!enrichedChapter.subtopics || enrichedChapter.subtopics.length === 0) ? (
          <View style={styles.emptySubBox}>
            <Text style={styles.emptySubText}>This chapter hasn't been planned yet.</Text>
            <TouchableOpacity style={styles.planBtn} onPress={handleEnrich}>
              <Zap size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.planBtnText}>Plan Topics & Concepts</Text>
            </TouchableOpacity>
          </View>
        ) : (
          enrichedChapter.subtopics?.map((sub, index) => (
            <View key={index} style={styles.subCard}>
              <View style={styles.subHeader}>
                <Text style={styles.subTitle}>{index + 1}. {sub.name}</Text>
                <Text style={styles.subMeta}>{sub.estimatedHours}h • Diff: {sub.difficulty}</Text>
              </View>
              <View style={styles.conceptsList}>
                {sub.concepts?.map((c, i) => (
                  <Text key={i} style={styles.conceptTag}>• {c}</Text>
                ))}
              </View>
              <TouchableOpacity style={styles.subStartBtn} onPress={() => handleStartClass(sub.name)}>
                <Text style={styles.subStartText}>Study Topic</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Learning Digest (Notes)</Text>
        <View style={styles.digestCard}>
          {notes ? (
            <RichText text={notes} />
          ) : (
            <Text style={styles.digestEmpty}>
              Your notes, extracted formulas, and key theories will appear here as you chat with your AI Mentor.
            </Text>
          )}
        </View>
        
        <View style={{height: 50}}/>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  scroll: { padding: 20 },
  header: { marginBottom: 20 },
  backBtn: { paddingVertical: 10 },
  backTxt: { color: Theme.colors.primary, fontSize: 16 },
  title: { color: Theme.colors.text, fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  description: { color: Theme.colors.textMuted, fontSize: 16, lineHeight: 24, marginBottom: 20 },
  metaRow: { flexDirection: 'row', marginBottom: 30 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 10 },
  metaText: { color: Theme.colors.text, fontSize: 12, fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  primaryBtn: { flex: 1, backgroundColor: Theme.colors.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginRight: 10 },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  secondaryBtn: { flex: 1, backgroundColor: Theme.colors.surface, padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Theme.colors.primary },
  secondaryBtnText: { color: Theme.colors.primary, fontWeight: 'bold', fontSize: 16 },
  progressSection: { marginBottom: 30, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 12 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progItem: { flex: 1, marginRight: 8 },
  progLabel: { color: Theme.colors.textMuted, fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  barBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Theme.colors.primary },
  sectionTitle: { color: Theme.colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  loadingBox: { padding: 30, alignItems: 'center', backgroundColor: Theme.colors.surface, borderRadius: 12 },
  loadingText: { color: Theme.colors.text, marginTop: 10, fontSize: 15, fontWeight: '600' },
  loadingSubtext: { color: Theme.colors.textMuted, marginTop: 5, fontSize: 13 },
  subCard: { backgroundColor: Theme.colors.surface, padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: Theme.colors.border },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  subTitle: { color: Theme.colors.text, fontSize: 16, fontWeight: 'bold', flex: 1 },
  subMeta: { color: Theme.colors.textMuted, fontSize: 12 },
  conceptsList: { marginBottom: 15 },
  conceptTag: { color: Theme.colors.textMuted, fontSize: 14, marginBottom: 4 },
  subStartBtn: { backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 10, borderRadius: 8, alignItems: 'center' },
  subStartText: { color: Theme.colors.primary, fontWeight: 'bold' },
  digestCard: { backgroundColor: Theme.colors.surface, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: Theme.colors.border },
  digestText: { color: Theme.colors.text, lineHeight: 22, fontSize: 15 },
  digestEmpty: { color: Theme.colors.textMuted, fontStyle: 'italic', textAlign: 'center' },
  emptySubBox: {
    padding: 32,
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderStyle: 'dashed',
  },
  emptySubText: {
    color: Theme.colors.textSecondary,
    fontSize: 15,
    marginBottom: 20,
    textAlign: 'center',
  },
  planBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  planBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
