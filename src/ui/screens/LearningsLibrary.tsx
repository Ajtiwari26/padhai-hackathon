import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme, getConfidenceColor, getConfidenceLabel } from '../theme/theme';
import { Book, ChevronRight, ChevronDown, CheckCircle2, Clock, Layers, BookOpen } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import { KnowledgeGraphBuilder, GraphNode } from '../../core/analytics/KnowledgeGraphBuilder';

interface Props {
  navigation: any;
}

// We'll dynamically build this structure from the graph nodes
interface SubjectData {
  id: string;
  name: string;
  icon: string;
  topics: {
    id: string;
    name: string;
    chapters: any[];
  }[];
}

const SUBJECT_ICONS: Record<string, any> = {
  'General': <Book size={24} color={Theme.colors.primary} />,
  'Science': <Layers size={24} color={Theme.colors.secondary} />,
  'Math': <Layers size={24} color={Theme.colors.secondary} />,
};

export const LearningsLibrary: React.FC<Props> = ({ navigation }) => {
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [subjectsData, setSubjectsData] = useState<SubjectData[]>([]);

  useEffect(() => {
    // Transform flat nodes from Graph into Subjects -> Topics -> Chapters hierarchy
    const { nodes } = KnowledgeGraphBuilder.getGraph();
    
    const subjectMap: Record<string, SubjectData> = {};

    nodes.forEach((node: GraphNode) => {
      const subjName = node.subject || 'Uncategorized';
      if (!subjectMap[subjName]) {
        subjectMap[subjName] = {
          id: `subj_${subjName}`,
          name: subjName,
          icon: SUBJECT_ICONS[subjName] || '📚',
          topics: [],
        };
      }

      // We don't have explicit "Topic vs Chapter" nesting in the graph node schema,
      // so we'll group nodes loosely or treat them as topics.
      // For a more advanced mapping, we'd need a taxonomy. Here we just put nodes directly into a "General" topic.
      let generalTopic = subjectMap[subjName].topics.find(t => t.name === 'General Concepts');
      if (!generalTopic) {
        generalTopic = { id: `topic_${subjName}_gen`, name: 'General Concepts', chapters: [] };
        subjectMap[subjName].topics.push(generalTopic);
      }

      generalTopic.chapters.push({
        id: node.id,
        title: node.label,
        confidence: node.confidence,
        lastDate: node.lastPhase !== 'BREADTH_SWEEP' ? 'Recently' : '',
      });
    });

    const data = Object.values(subjectMap);
    setSubjectsData(data);
    
    // Auto-expand first subject and its first topic if available
    if (data.length > 0) {
      setExpandedSubject(data[0].id);
      if (data[0].topics.length > 0) {
        setExpandedTopic(data[0].topics[0].id);
      }
    }
  }, []);

  const getOverallProgress = (chapters: any[]) => {
    if (chapters.length === 0) return 0;
    const total = chapters.reduce((sum: number, c: any) => sum + c.confidence, 0);
    return Math.round(total / chapters.length);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.pageTitle}>My Learnings</Text>
        <Text style={styles.pageSubtitle}>Subjects → Topics → Chapters</Text>

        {/* Subject Cards */}
        {subjectsData.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Your library is empty.</Text>
            <Text style={styles.emptyStateDesc}>Start chatting with the AI Mentor or complete tests to build your knowledge library.</Text>
          </View>
        ) : (
            subjectsData.map(subject => {
          const isExpanded = expandedSubject === subject.id;
          const allChapters = subject.topics.flatMap(t => t.chapters);
          const progress = getOverallProgress(allChapters);
          const clearCount = allChapters.filter(c => c.confidence >= 80).length;

          return (
            <View key={subject.id} style={[styles.subjectCard, isExpanded && styles.subjectCardExpanded]}>
              <TouchableOpacity
                style={styles.subjectHeader}
                onPress={() => setExpandedSubject(isExpanded ? null : subject.id)}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  {SUBJECT_ICONS[subject.name] || <BookOpen size={24} color={Theme.colors.primary} />}
                </View>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{subject.name}</Text>
                  <Text style={styles.subjectMeta}>
                    {clearCount}/{allChapters.length} chapters mastered • {progress}%
                  </Text>
                </View>
                {isExpanded ? 
                  <ChevronDown size={20} color={Theme.colors.textMuted} /> : 
                  <ChevronRight size={20} color={Theme.colors.textMuted} />
                }
              </TouchableOpacity>

              {/* Progress bar */}
              <View style={styles.subjectBarBg}>
                <View style={[styles.subjectBarFill, {
                  width: `${progress}%`,
                  backgroundColor: getConfidenceColor(progress),
                }]} />
              </View>

              {/* Topics */}
              {isExpanded && subject.topics.map(topic => {
                const topicExpanded = expandedTopic === topic.id;
                return (
                  <View key={topic.id} style={styles.topicContainer}>
                    <TouchableOpacity
                      style={styles.topicRow}
                      onPress={() => setExpandedTopic(topicExpanded ? null : topic.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.topicHeaderLeft}>
                        <View style={styles.topicIndicator} />
                        <Text style={styles.topicName}>{topic.name}</Text>
                      </View>
                      <Text style={styles.topicCount}>{topic.chapters.length} items</Text>
                    </TouchableOpacity>

                    {/* Chapters */}
                    {topicExpanded && topic.chapters.map(chapter => (
                      <TouchableOpacity
                        key={chapter.id}
                        style={styles.chapterRow}
                        onPress={() => navigation.navigate('MentorChat', { topic: chapter.title })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.chapterContent}>
                          <View style={styles.chapterTitleRow}>
                            <Text style={styles.chapterTitle}>{chapter.title}</Text>
                            {chapter.confidence >= 80 && (
                              <CheckCircle2 size={14} color={Theme.colors.success} style={{marginLeft: 6}} />
                            )}
                          </View>
                          <View style={styles.chapterMetaRow}>
                            <Clock size={10} color={Theme.colors.textMuted} />
                            <Text style={styles.chapterMeta}>
                              {chapter.lastDate ? `Reviewed ${chapter.lastDate}` : 'New concept'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.chapterRight}>
                          <Text style={[styles.chapterScore, {
                            color: getConfidenceColor(chapter.confidence),
                          }]}>
                            {chapter.confidence > 0 ? `${chapter.confidence}%` : '0%'}
                          </Text>
                          <Text style={[styles.chapterStatus, {
                            color: getConfidenceColor(chapter.confidence),
                          }]}>
                            {getConfidenceLabel(chapter.confidence)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </View>
          );
        })
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

  // Empty State
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    minHeight: 240,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 10,
    fontFamily: Theme.fonts.bold,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Theme.fonts.regular,
  },

  // Subject
  subjectCard: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    overflow: 'hidden',
  },
  subjectCardExpanded: {
    borderColor: Theme.colors.primary + '30',
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Theme.colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  subjectInfo: { flex: 1 },
  subjectName: {
    fontSize: 19,
    fontWeight: '700',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
  },
  subjectMeta: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 3,
    fontFamily: Theme.fonts.medium,
  },
  subjectBarBg: {
    height: 4,
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 18,
  },
  subjectBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Topic
  topicContainer: {
    marginTop: 12,
  },
  topicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorderLight,
    marginTop: 12,
  },
  topicHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: Theme.colors.secondary,
    marginRight: 10,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.semiBold,
  },
  topicCount: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
    backgroundColor: Theme.colors.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  // Chapter
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginLeft: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chapterContent: { flex: 1 },
  chapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.semiBold,
  },
  chapterMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  chapterMeta: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.regular,
  },
  chapterRight: {
    alignItems: 'flex-end',
  },
  chapterScore: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: Theme.fonts.bold,
  },
  chapterStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: Theme.fonts.bold,
    textTransform: 'uppercase',
  },
});
