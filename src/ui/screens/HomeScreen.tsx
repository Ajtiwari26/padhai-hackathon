import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Theme } from '../theme/theme';
import { StudentProfileStore, StudentProfile } from '../../core/storage/StudentProfile';
import { AISyllabusGenerator, Curriculum, GenerationProgress } from '../../core/curriculum/AISyllabusGenerator';
import { ResourcePlanner } from '../../core/planner/ResourcePlanner';
import { StatusBanner } from '../components/StatusBanner';
import { 
  Target, Compass, Globe, Zap, Magnet, Flame, Lightbulb, Waves, 
  Atom, Sigma, Hash, Ruler, Beaker, Briefcase, BookOpen, User, Rocket, LineChart, Book,
  Clock, Loader, MessageCircle, PenTool
} from 'lucide-react-native';



interface Props {
  navigation: any;
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enrichmentProgress, setEnrichmentProgress] = useState<GenerationProgress | null>(null);
  const [taskStats, setTaskStats] = useState({ queued: 0, running: 0, done: 0, failed: 0, total: 0, completionPercent: 0 });
  const [currentTask, setCurrentTask] = useState<any>(null);

  /**
   * Queue initial background tasks for the curriculum
   * This schedules chapter enrichment and initial content generation
   */
  // const queueInitialTasks = async (curr: Curriculum) => {
  //   console.log('[HomeScreen] Scheduling background tasks for', curr.chapters.length, 'chapters');
  //   
  //   // For each chapter, queue a subtopic enrichment task
  //   for (const chapter of curr.chapters) {
  //     if (!chapter.subtopics || chapter.subtopics.length === 0) {
  //       ResourcePlanner.queueTask('subtopic', chapter.id, '', {
  //         chapterData: chapter,
  //         subjectContext: `${curr.subject} - ${curr.level}`
  //       });
  //     }
  //   }
  //   
  //   console.log('[HomeScreen] Background task scheduling complete');
  // };

  const loadCurriculum = useCallback(async () => {
    try {
      const userProfile = await StudentProfileStore.get();
      setProfile(userProfile);

      // Try to load existing curriculum
      let existingCurriculum = await AISyllabusGenerator.loadCurriculum();
      
      if (existingCurriculum) {
        console.log('[HomeScreen] Loaded existing curriculum');
        setCurriculum(existingCurriculum);
        
        // Check if we need to queue enrichment tasks
        const progress = AISyllabusGenerator.getGenerationProgress(existingCurriculum);
        setEnrichmentProgress(progress);
        
        // Disabled auto-queueing as per user request
        // if (progress.percent < 100) {
        //   queueInitialTasks(existingCurriculum);
        // }
        
        setIsLoading(false);
      } else {
        // No saved curriculum — show empty state immediately
        console.log('[HomeScreen] No curriculum found.');
        setCurriculum(null);
        setIsLoading(false);
      }
    } catch (e) {
      console.error('[HomeScreen] Failed to load curriculum:', e);
      setCurriculum(null);
      setIsLoading(false);
    }
  }, []);

  const loadTaskStats = useCallback(async () => {
    try {
      const stats = await ResourcePlanner.getStats();
      setTaskStats(stats);
      
      const current = ResourcePlanner.getCurrentTask();
      setCurrentTask(current);
    } catch (e) {
      console.error('[HomeScreen] Failed to load task stats:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCurriculum();
      loadTaskStats();
    }, [loadCurriculum, loadTaskStats])
  );

  // Poll for progress if enrichment is active
  useEffect(() => {
    let interval: any;
    if (curriculum && enrichmentProgress && enrichmentProgress.percent < 100) {
      interval = setInterval(async () => {
        const fresh = await AISyllabusGenerator.loadCurriculum();
        if (fresh) {
          const progress = AISyllabusGenerator.getGenerationProgress(fresh);
          setEnrichmentProgress(progress);
          setCurriculum(fresh);
          if (progress.percent === 100) {
            clearInterval(interval);
          }
        }
        
        // Also update task stats
        await loadTaskStats();
      }, 5000); // Poll every 5 seconds
    }
    return () => clearInterval(interval);
  }, [curriculum, curriculum?.id, enrichmentProgress?.percent, enrichmentProgress, loadTaskStats]);

  const getChapterIcon = (chapterName: string) => {
    const name = chapterName.toLowerCase();
    const size = 24;
    const color = Theme.colors.primary;
    if (name.includes('welcome')) return <Book size={size} color={color} />;
    if (name.includes('goal')) return <Target size={size} color={color} />;
    if (name.includes('mechanic')) return <Compass size={size} color={color} />;
    if (name.includes('gravit')) return <Globe size={size} color={color} />;
    if (name.includes('electro') || name.includes('electric')) return <Zap size={size} color={color} />;
    if (name.includes('magnet')) return <Magnet size={size} color={color} />;
    if (name.includes('thermo')) return <Flame size={size} color={color} />;
    if (name.includes('optic') || name.includes('light')) return <Lightbulb size={size} color={color} />;
    if (name.includes('wave')) return <Waves size={size} color={color} />;
    if (name.includes('modern') || name.includes('quantum')) return <Atom size={size} color={color} />;
    if (name.includes('calculus')) return <Sigma size={size} color={color} />;
    if (name.includes('algebra')) return <Hash size={size} color={color} />;
    if (name.includes('geometry')) return <Ruler size={size} color={color} />;
    if (name.includes('atom')) return <Atom size={size} color={color} />;
    if (name.includes('organic')) return <Beaker size={size} color={color} />;
    if (name.includes('inorganic')) return <Beaker size={size} color={color} />;
    if (name.includes('career')) return <Briefcase size={size} color={color} />;
    return <BookOpen size={size} color={color} />;
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty < 40) return '#10b981'; // Easy - Green
    if (difficulty < 60) return '#f59e0b'; // Medium - Orange
    if (difficulty < 80) return '#ef4444'; // Hard - Red
    return '#9333ea'; // Very Hard - Purple
  };

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty < 40) return 'Basic';
    if (difficulty < 60) return 'Intermediate';
    if (difficulty < 80) return 'Advanced';
    return 'Expert';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Theme.colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">
              Hello, {profile?.name || 'Student'}
            </Text>
            {curriculum && (
              <View style={styles.badgeRow}>
                <View style={styles.subjectBadge}>
                  <Text style={styles.subjectBadgeText}>{curriculum.subject}</Text>
                </View>
                <Text style={styles.subGreeting}>• {curriculum.level}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.headerAction} 
              onPress={() => navigation.navigate('CareerPlanner')}
            >
              <Rocket size={20} color={Theme.colors.secondary} />
            </TouchableOpacity>
            <StatusBanner />
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <User size={22} color={Theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Tracker (Enrichment) */}
        {enrichmentProgress && enrichmentProgress.percent < 100 && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                Enriching Curriculum Topics...
              </Text>
              <Text style={styles.progressSubtext}>
                {enrichmentProgress.completed}/{enrichmentProgress.total} Chapters
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${enrichmentProgress.percent}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressSubtext}>
              Our AI is mapping out the best subtopics and concepts for your path. You can start learning the already prepared chapters.
            </Text>
          </View>
        )}
        
        {/* Task Widget - Shows current generating task */}
        {(taskStats.running > 0 || taskStats.queued > 0) && (
          <TouchableOpacity 
            style={styles.taskWidget}
            onPress={() => {
              // Show task details in an alert for now
              const taskInfo = currentTask 
                ? `Current: ${currentTask.type} - ${currentTask.chapterName || currentTask.chapterId}\n\nQueued: ${taskStats.queued} tasks\nRunning: ${taskStats.running}\nCompleted: ${taskStats.done}\nFailed: ${taskStats.failed}`
                : `Queued: ${taskStats.queued} tasks\nRunning: ${taskStats.running}\nCompleted: ${taskStats.done}\nFailed: ${taskStats.failed}`;
              
              // You can replace this with navigation to a proper TaskManager screen later
              console.log('[HomeScreen] Task stats:', taskInfo);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.taskWidgetHeader}>
              <View style={styles.taskWidgetIconContainer}>
                <Loader size={16} color={Theme.colors.primary} />
              </View>
              <View style={styles.taskWidgetInfo}>
                <Text style={styles.taskWidgetTitle}>
                  {currentTask ? 'Generating Content' : 'Tasks Queued'}
                </Text>
                {currentTask && (
                  <Text style={styles.taskWidgetSubtitle}>
                    {currentTask.type === 'subtopic' ? 'Enriching' : 
                     currentTask.type === 'mcq' ? 'Generating MCQs for' :
                     currentTask.type === 'numerical' ? 'Creating problems for' :
                     'Processing'} {currentTask.chapterName || currentTask.chapterId}
                  </Text>
                )}
              </View>
              <View style={styles.taskWidgetBadge}>
                <Text style={styles.taskWidgetBadgeText}>{taskStats.queued}</Text>
              </View>
            </View>
            
            {currentTask?.subtasks && currentTask.currentSubtask !== undefined && (
              <View style={styles.taskWidgetProgress}>
                <Text style={styles.taskWidgetProgressText}>
                  {currentTask.subtasks[currentTask.currentSubtask]?.name || 'Processing...'}
                </Text>
                <View style={styles.taskWidgetProgressBar}>
                  <View 
                    style={[
                      styles.taskWidgetProgressFill, 
                      { width: `${((currentTask.currentSubtask + 1) / currentTask.subtasks.length) * 100}%` }
                    ]} 
                  />
                </View>
              </View>
            )}
            
            <View style={styles.taskWidgetFooter}>
              <Text style={styles.taskWidgetQueue}>
                {taskStats.queued} task{taskStats.queued !== 1 ? 's' : ''} queued
                {taskStats.running > 0 && ` • ${taskStats.running} running`}
              </Text>
              <Text style={styles.taskWidgetAction}>Tap to manage →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Curriculum Overview */}
        {curriculum && (
          <TouchableOpacity 
            style={styles.overviewCard}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Analytics')}
          >
            <View style={styles.overviewHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.overviewIconContainer}>
                  <LineChart size={18} color={Theme.colors.secondary} />
                </View>
                <Text style={styles.overviewTitle}>Learning Mastery</Text>
              </View>
              <View style={styles.masteryBadge}>
                <Text style={styles.masteryBadgeText}>82% Complete</Text>
              </View>
            </View>

            <View style={styles.overviewStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{curriculum.chapters.length}</Text>
                <Text style={styles.statLabel}>Chapters</Text>
              </View>
              <View style={styles.statSeparator} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{curriculum.totalHours}h</Text>
                <Text style={styles.statLabel}>Est. Time</Text>
              </View>
              <View style={styles.statSeparator} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{getDifficultyLabel(curriculum.difficultyTarget)}</Text>
                <Text style={styles.statLabel}>Level</Text>
              </View>
            </View>

            <View style={styles.goalContainer}>
              <Target size={16} color={Theme.colors.secondary} />
              <Text style={styles.overviewGoal} numberOfLines={1}>{curriculum.goal}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Chapters */}
        <View style={styles.chaptersContainer}>
          <Text style={styles.sectionTitle}>Course Syllabus</Text>
          
          {!curriculum ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Target size={48} color={Theme.colors.primary} />
              </View>
              <Text style={styles.emptyStateTitle}>Your learning journey starts here.</Text>
              <Text style={styles.emptyStateDesc}>Tell us what you want to master, and we'll create a professional, hierarchical curriculum tailored just for you.</Text>
              <TouchableOpacity 
                style={styles.createBtn}
                onPress={() => navigation.navigate('CurriculumCreator')}
              >
                <Text style={styles.createBtnText}>Create My Path</Text>
              </TouchableOpacity>
            </View>
          ) : (
            curriculum.chapters.map((chapter) => {
              const isGenerated = chapter.subtopics && chapter.subtopics.length > 0;
              return (
                <TouchableOpacity
                  key={chapter.id}
                  style={[styles.chapterCard, !isGenerated && styles.chapterCardGenerating]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ChapterDetail', { 
                    chapter: chapter,
                    curriculum: curriculum
                  })}
                >
                  <View style={styles.chapterHeader}>
                    <View style={styles.chapterIconContainer}>
                      {getChapterIcon(chapter.name)}
                    </View>
                    <View style={styles.chapterInfo}>
                      <Text style={styles.chapterOrder}>Chapter {chapter.order}</Text>
                      <Text style={styles.chapterTitle}>{chapter.name}</Text>
                    </View>
                    <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(chapter.difficulty) + '15' }]}>
                      <Text style={[styles.difficultyText, { color: getDifficultyColor(chapter.difficulty) }]}>
                        {getDifficultyLabel(chapter.difficulty)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.chapterDescription}>{chapter.description}</Text>

                  <View style={styles.chapterFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} color={Theme.colors.onSurfaceVariant} />
                      <Text style={styles.chapterTime}>{chapter.estimatedHours}h</Text>
                    </View>
                    {isGenerated ? (
                      <Text style={styles.startButton}>Explore Chapter →</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Loader size={14} color={Theme.colors.primary} />
                        <Text style={styles.generatingBadge}>Generating topics...</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Learning Tools</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Chat')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconCircle}>
                <MessageCircle size={24} color={Theme.colors.primary} />
              </View>
              <Text style={styles.quickLabel}>Ask AI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Tests')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconCircle}>
                <PenTool size={24} color={Theme.colors.secondary} />
              </View>
              <Text style={styles.quickLabel}>Practice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Learnings')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconCircle}>
                <BookOpen size={24} color={Theme.colors.primaryLight} />
              </View>
              <Text style={styles.quickLabel}>Library</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 12,
  },
  headerLeft: { 
    flex: 2,
    marginRight: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.onSurface,
    letterSpacing: -0.8,
    fontFamily: Theme.fonts.bold,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  subjectBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  subjectBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Theme.colors.primary,
    textTransform: 'uppercase',
    fontFamily: Theme.fonts.bold,
    letterSpacing: 0.8,
  },
  subGreeting: {
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    fontWeight: '600',
    fontFamily: Theme.fonts.medium,
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  headerAction: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },

  // Overview Card
  overviewCard: {
    backgroundColor: 'rgba(23, 31, 51, 0.6)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  overviewIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.bold,
    letterSpacing: -0.3,
  },
  masteryBadge: {
    backgroundColor: Theme.colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  masteryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0b1326',
    fontFamily: Theme.fonts.bold,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statSeparator: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.bold,
  },
  statLabel: {
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontFamily: Theme.fonts.medium,
    letterSpacing: 0.8,
  },
  goalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(45, 212, 191, 0.08)',
    padding: 16,
    borderRadius: 16,
  },
  overviewGoal: {
    flex: 1,
    fontSize: 14,
    color: Theme.colors.onSurface,
    fontWeight: '500',
    fontFamily: Theme.fonts.medium,
    lineHeight: 20,
  },

  // Chapters
  chaptersContainer: {
    gap: 20,
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.onSurface,
    marginBottom: 16,
    letterSpacing: -0.5,
    fontFamily: Theme.fonts.bold,
  },
  chapterCard: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  chapterIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterOrder: {
    fontSize: 11,
    fontWeight: '800',
    color: Theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 2,
    fontFamily: Theme.fonts.bold,
  },
  chapterTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.bold,
    letterSpacing: -0.3,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: Theme.fonts.bold,
  },
  chapterDescription: {
    fontSize: 15,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: Theme.fonts.medium,
  },
  chapterFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  chapterTime: {
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    fontWeight: '700',
    fontFamily: Theme.fonts.bold,
  },
  startButton: {
    fontSize: 15,
    fontWeight: '800',
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.bold,
  },

  // Quick Actions
  quickActionsContainer: {
    marginBottom: 32,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  quickIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.bold,
  },
  chapterCardGenerating: {
    opacity: 0.6,
  },
  generatingBadge: {
    fontSize: 13,
    color: Theme.colors.primary,
    fontWeight: '700',
    fontFamily: Theme.fonts.medium,
  },
  progressCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.bold,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
    fontFamily: Theme.fonts.medium,
  },
  
  // Task Widget Styles
  taskWidget: {
    backgroundColor: 'rgba(45, 212, 191, 0.08)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.2)',
  },
  taskWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  taskWidgetIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(45, 212, 191, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskWidgetInfo: {
    flex: 1,
  },
  taskWidgetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.bold,
    marginBottom: 4,
  },
  taskWidgetSubtitle: {
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    fontFamily: Theme.fonts.medium,
  },
  taskWidgetBadge: {
    backgroundColor: Theme.colors.secondary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskWidgetBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0b1326',
    fontFamily: Theme.fonts.bold,
  },
  taskWidgetProgress: {
    marginBottom: 16,
  },
  taskWidgetProgressText: {
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    fontFamily: Theme.fonts.medium,
    marginBottom: 8,
  },
  taskWidgetProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  taskWidgetProgressFill: {
    height: '100%',
    backgroundColor: Theme.colors.secondary,
    borderRadius: 3,
  },
  taskWidgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  taskWidgetQueue: {
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    fontFamily: Theme.fonts.medium,
  },
  taskWidgetAction: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.bold,
  },
  
  emptyState: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    minHeight: 320,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.colors.onSurface,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: Theme.fonts.bold,
    letterSpacing: -0.5,
  },
  emptyStateDesc: {
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
    fontFamily: Theme.fonts.medium,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  createBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
  },
});
