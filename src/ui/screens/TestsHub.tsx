import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { TestStore, TestEntry, AssignmentEntry } from '../../core/storage/TestStore';
import { AdaptiveQuestionGenerator } from '../../core/questions/AdaptiveQuestionGenerator';
import { KnowledgeGraphBuilder } from '../../core/analytics/KnowledgeGraphBuilder';
import { Bot, FileText, HelpCircle, BookOpen, Camera, ArrowRight, Zap, Trophy, History } from 'lucide-react-native';

interface Props {
  navigation: any;
}

export const TestsHub: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'assignments'>('tests');
  const [tests, setTests] = useState<TestEntry[]>([]);
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [t, a] = await Promise.all([
      TestStore.getTests(),
      TestStore.getAssignments()
    ]);
    setTests(t);
    setAssignments(a);
  };

  const handleGenerateTest = async () => {
    try {
      setIsGenerating(true);
      const { nodes } = KnowledgeGraphBuilder.getGraph();
      // Pick a topic the student is working on (lowest confidence > 0)
      const activeTopics = nodes.filter(n => n.confidence > 0 && n.confidence < 90);
      const target = activeTopics.sort((a, b) => a.confidence - b.confidence)[0] || nodes[0];

      if (!target) {
        Alert.alert('No Progress Yet', 'Complete some learning sessions first so I can generate a test for you.');
        setIsGenerating(false);
        return;
      }

      // In a real app, we might generate multiple questions. For now, let's create a "Test" entry.
      const newTest: TestEntry = {
        id: Date.now().toString(),
        title: `${target.label} Progress Test`,
        type: 'MCQ',
        questions: 5,
        difficulty: target.confidence < 40 ? 'Easy' : target.confidence < 70 ? 'Medium' : 'Hard',
        topic: target.label,
        status: 'available',
        timestamp: Date.now(),
      };

      await TestStore.saveTest(newTest);
      await loadData();
      Alert.alert('Test Ready', `I've generated a new test on ${target.label}. Good luck!`);
    } catch (e) {
      Alert.alert('Generation Failed', 'Could not reach AI engine. Is it running?');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartTest = (test: any) => {
    Alert.alert(
      'Start Exam',
      `This is a timed ${test.type} test with ${test.questions} questions.\n\n⚠️ Once started:\n• Timer cannot be paused\n• Leaving aborts the test\n\nReady?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Exam', onPress: () => {
          navigation.navigate('ExamScreen', { test });
        }},
      ]
    );
  };

  const handleReviewTest = (test: any) => {
    navigation.navigate('ScoreCard', { test });
  };

  const getDifficultyColor = (d: string) => {
    switch (d) {
      case 'Easy': return Theme.colors.success;
      case 'Medium': return Theme.colors.warning;
      case 'Hard': return Theme.colors.error;
      default: return Theme.colors.textMuted;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Tests & Exams</Text>
        <Text style={styles.pageSubtitle}>AI-generated tests based on your progress</Text>

        {/* Tab Toggle */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'tests' && styles.tabActive]}
            onPress={() => setActiveTab('tests')}
          >
            <Text style={[styles.tabText, activeTab === 'tests' && styles.tabTextActive]}>Tests</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'assignments' && styles.tabActive]}
            onPress={() => setActiveTab('assignments')}
          >
            <Text style={[styles.tabText, activeTab === 'assignments' && styles.tabTextActive]}>Assignments</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'tests' ? (
          <>
            {/* Generate New Test */}
            <TouchableOpacity 
              style={[styles.generateBtn, isGenerating && { opacity: 0.7 }]} 
              activeOpacity={0.8}
              onPress={handleGenerateTest}
              disabled={isGenerating}
            >
              <View style={styles.generateIconContainer}>
                {isGenerating ? (
                  <ActivityIndicator color={Theme.colors.secondary} />
                ) : (
                  <Zap size={24} color={Theme.colors.secondary} />
                )}
              </View>
              <View style={styles.generateContent}>
                <Text style={styles.generateTitle}>{isGenerating ? 'Synthesizing Test...' : 'AI Adaptive Test'}</Text>
                <Text style={styles.generateSub}>Based on your weak areas in recent chats</Text>
              </View>
              {!isGenerating && <ArrowRight size={20} color={Theme.colors.textMuted} />}
            </TouchableOpacity>

            {/* Test Cards */}
            {tests.length === 0 && !isGenerating && (
              <View style={styles.emptyState}>
                <Trophy size={48} color={Theme.colors.surfaceHigh} style={{marginBottom: 16}} />
                <Text style={styles.emptyStateText}>No tests available yet. Click above to generate your first adaptive test!</Text>
              </View>
            )}
            {tests.map(test => (
              <View key={test.id} style={styles.testCard}>
                <View style={styles.testHeader}>
                  <Text style={styles.testTitle}>{test.title}</Text>
                  <View style={[styles.diffBadge, { backgroundColor: getDifficultyColor(test.difficulty) + '15' }]}>
                    <Text style={[styles.diffText, { color: getDifficultyColor(test.difficulty) }]}>
                      {test.difficulty}
                    </Text>
                  </View>
                </View>

                <View style={styles.testMeta}>
                  <View style={styles.metaItem}>
                    <FileText size={12} color={Theme.colors.textMuted} />
                    <Text style={styles.testMetaText}>{test.type}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <HelpCircle size={12} color={Theme.colors.textMuted} />
                    <Text style={styles.testMetaText}>{test.questions} Qs</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <BookOpen size={12} color={Theme.colors.textMuted} />
                    <Text style={styles.testMetaText}>{test.topic}</Text>
                  </View>
                </View>

                {test.status === 'completed' ? (
                  <View style={styles.completedRow}>
                    <View>
                      <Text style={styles.scoreLabel}>Final Score</Text>
                      <Text style={styles.scoreText}>{test.score}</Text>
                    </View>
                    <TouchableOpacity style={styles.reviewBtn} onPress={() => handleReviewTest(test)}>
                      <Text style={styles.reviewBtnText}>Review Results</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={() => handleStartTest(test)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.startBtnText}>Start Examination</Text>
                    <ArrowRight size={16} color="#FFF" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        ) : (
          <>
            {assignments.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No assignments pending. Keep learning!</Text>
              </View>
            )}
            {assignments.map(a => (
              <View key={a.id} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                  <Text style={styles.assignmentTitle}>{a.title}</Text>
                  <View style={[styles.statusBadge, {
                    backgroundColor: a.status === 'pending' ? Theme.colors.warningBg : Theme.colors.successBg,
                  }]}>
                    <Text style={[styles.statusText, {
                      color: a.status === 'pending' ? Theme.colors.warning : Theme.colors.success,
                    }]}>{a.status === 'pending' ? 'Pending' : `Score: ${a.score}%`}</Text>
                  </View>
                </View>
                <Text style={styles.assignmentMeta}>
                  {a.chapter} {a.status === 'pending' ? `• Due in ${a.dueIn}` : ''}
                </Text>
                {a.status === 'pending' && (
                  <TouchableOpacity style={styles.uploadBtn}>
                    <Camera size={16} color={Theme.colors.textSecondary} style={{ marginRight: 8 }} />
                    <Text style={styles.uploadBtnText}>Upload Solution</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scroll: {
    padding: 20,
    paddingTop: 48,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Theme.colors.text,
    letterSpacing: -0.8,
    fontFamily: Theme.fonts.bold,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    marginTop: 6,
    marginBottom: 28,
    fontFamily: Theme.fonts.regular,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: Theme.colors.primary,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.semiBold,
  },
  tabTextActive: {
    color: '#FFF',
  },

  // Generate
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '20',
    borderStyle: 'dashed',
    gap: 16,
  },
  generateIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateContent: {
    flex: 1,
  },
  generateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.bold,
  },
  generateSub: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 4,
    fontFamily: Theme.fonts.medium,
  },

  // Test Card
  testCard: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  testTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.text,
    flex: 1,
    marginRight: 10,
    fontFamily: Theme.fonts.bold,
  },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  diffText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  testMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testMetaText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
  },
  startBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Theme.fonts.bold,
  },
  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 16,
  },
  scoreLabel: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.bold,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.success,
    fontFamily: Theme.fonts.bold,
  },
  reviewBtn: {
    backgroundColor: Theme.colors.success + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  reviewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.success,
    fontFamily: Theme.fonts.bold,
  },

  // Assignments
  assignmentCard: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    flex: 1,
    marginRight: 10,
    fontFamily: Theme.fonts.bold,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  assignmentMeta: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    marginBottom: 18,
    fontFamily: Theme.fonts.medium,
  },
  uploadBtn: {
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.bold,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: Theme.colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Theme.fonts.regular,
  },
});
