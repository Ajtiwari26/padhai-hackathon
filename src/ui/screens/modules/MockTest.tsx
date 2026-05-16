import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme/theme';
import { ThinkingIndicator } from '../../components/ThinkingIndicator';
import { Trophy, Timer, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { AdaptiveQuestionGenerator, GeneratedQuestion } from '../../../core/questions/AdaptiveQuestionGenerator';
import { LearningContextTracker } from '../../../core/intelligence/LearningContextTracker';

interface Props {
  navigation?: any;
  topic?: string;
  totalTimeMinutes?: number;
}

export const MockTest: React.FC<Props> = ({ 
  navigation, 
  topic = "General Learning",
  totalTimeMinutes = 45
}) => {
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(totalTimeMinutes * 60); // seconds
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    loadTest();
  }, [topic]);

  useEffect(() => {
    if (isLoading || isSubmitted || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isLoading, isSubmitted, timeLeft]);

  const loadTest = async () => {
    setIsLoading(true);
    setAnswers({});
    setCurrentIndex(0);
    setMarkedForReview(new Set());
    setIsSubmitted(false);
    setTimeLeft(totalTimeMinutes * 60);

    try {
      const baseReq = {
        topic,
        subtopic: "Comprehensive",
        concepts: [topic],
        difficulty: 60,
        mathComplexity: 'basic',
        thinkingDepth: 'analysis',
        studentUnderstanding: 60,
        previousAttempts: { correct: 0, wrong: 0, avgTime: 0 },
        type: 'mcq',
        style: 'direct',
      };

      // Generate 10 real questions for the mock test
      const qPromises = Array.from({ length: 10 }).map(() => 
        AdaptiveQuestionGenerator.generate({ ...baseReq } as any)
      );
      
      const results = await Promise.all(qPromises);
      setQuestions(results);
    } catch (e) {
      console.error('[MockTest] Error loading test:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (optionIndex: number) => {
    if (isSubmitted) return;
    setAnswers(prev => ({ ...prev, [questions[currentIndex].id]: optionIndex }));
  };

  const toggleReview = () => {
    const qId = questions[currentIndex].id;
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const submitTest = () => {
    setIsSubmitted(true);
    
    let correctCount = 0;
    questions.forEach((q) => {
      const selectedIndex = answers[q.id];
      if (selectedIndex === q.correctOption) {
        correctCount++;
      }
    });

    // Record mock test result
    LearningContextTracker.recordAttempt({
      questionId: 'mock_test_session',
      correct: correctCount > questions.length / 2, // arbitrary logic for passing
      timeSpent: (totalTimeMinutes * 60 - timeLeft) / 60,
      difficulty: 60,
      expectedTime: totalTimeMinutes,
      timestamp: Date.now(),
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex];
  const qId = currentQ?.id;
  const selectedOption = answers[qId];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThinkingIndicator text="Curating your mock test..." />
        </View>
      </SafeAreaView>
    );
  }

  if (isSubmitted) {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctOption) score++;
    });

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <Trophy size={64} color={Theme.colors.primaryLight} style={{marginBottom: 24}} />
          <Text style={styles.resultTitle}>Test Submitted</Text>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreText}>Your Score</Text>
            <Text style={styles.scoreValue}>{score} / {questions.length}</Text>
          </View>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation?.goBack()}>
            <Text style={styles.actionButtonText}>Return to Mentorship</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Trophy size={20} color={Theme.colors.text} />
            <Text style={styles.headerTitle}>Mock Test</Text>
          </View>
          <Text style={styles.headerSubtitle}>{topic}</Text>
        </View>
        <View style={styles.timerBadge}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Timer size={16} color={timeLeft < 300 ? Theme.colors.error : Theme.colors.text} />
            <Text style={[styles.timerText, timeLeft < 300 && { color: Theme.colors.error }]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Navigation Grid */}
        <View style={styles.gridSection}>
          <Text style={styles.sectionTitle}>Question Grid</Text>
          <View style={styles.grid}>
            {questions.map((q, i) => {
              const isAnswered = answers[q.id] !== undefined;
              const isReview = markedForReview.has(q.id);
              const isCurrent = i === currentIndex;
              
              let gridItemStyle: any = [styles.gridItem];
              let gridTextStyle: any = [styles.gridItemText];

              if (isCurrent) {
                gridItemStyle.push(styles.gridItemCurrent);
                gridTextStyle.push(styles.gridItemTextCurrent);
              } else if (isReview) {
                gridItemStyle.push(styles.gridItemReview);
                gridTextStyle.push(styles.gridItemTextReview);
              } else if (isAnswered) {
                gridItemStyle.push(styles.gridItemAnswered);
                gridTextStyle.push(styles.gridItemTextAnswered);
              }

              return (
                <TouchableOpacity
                  key={q.id}
                  style={gridItemStyle}
                  onPress={() => setCurrentIndex(i)}
                >
                  <Text style={gridTextStyle}>{i + 1}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Current Question */}
        <View style={styles.questionSection}>
          <View style={styles.questionHeaderRow}>
            <Text style={styles.questionNumber}>Question {currentIndex + 1}</Text>
            <TouchableOpacity style={styles.reviewToggle} onPress={toggleReview}>
              <Text style={styles.reviewToggleText}>
                {markedForReview.has(qId) ? '★ Marked' : '☆ Mark for Review'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.questionText}>{currentQ.problem}</Text>

          <View style={styles.optionsContainer}>
            {currentQ.options?.map((option, index) => {
              const isSelected = selectedOption === index;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.optionCard, isSelected && styles.optionSelected]}
                  onPress={() => handleSelect(index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionIndicator}>
                    <Text style={styles.indicatorText}>{['A', 'B', 'C', 'D'][index]}</Text>
                  </View>
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <View style={styles.navButtonsRow}>
          <TouchableOpacity 
            style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
            onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <ArrowLeft size={16} color={Theme.colors.text} />
              <Text style={styles.navButtonText}>Prev</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.navButton}
            onPress={() => {
              if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1);
            }}
            disabled={currentIndex === questions.length - 1}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Text style={styles.navButtonText}>Next</Text>
              <ArrowRight size={16} color={Theme.colors.text} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={submitTest}>
          <Text style={styles.submitButtonText}>Submit Test</Text>
        </TouchableOpacity>
      </View>
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
    gap: 16,
  },
  loadingText: {
    color: Theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(11, 19, 38, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  timerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorderLight,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  gridSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  gridItemText: {
    color: Theme.colors.primaryLight,
    fontWeight: '600',
  },
  gridItemAnswered: {
    backgroundColor: Theme.colors.secondary,
    borderColor: Theme.colors.secondaryDark,
  },
  gridItemTextAnswered: {
    color: '#003731',
  },
  gridItemReview: {
    backgroundColor: Theme.colors.warning,
    borderColor: Theme.colors.warning,
  },
  gridItemTextReview: {
    color: '#000',
  },
  gridItemCurrent: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  gridItemTextCurrent: {
    color: '#fff',
    fontWeight: '800',
  },
  questionSection: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  questionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  reviewToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Theme.colors.warningBg,
    borderWidth: 1,
    borderColor: Theme.colors.warning + '50',
  },
  reviewToggleText: {
    color: Theme.colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 18,
    color: Theme.colors.text,
    lineHeight: 28,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 52, 73, 0.15)',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderRadius: 16,
    padding: 16,
  },
  optionSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '15',
  },
  optionIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.glassBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  indicatorText: {
    color: Theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  optionText: {
    flex: 1,
    color: Theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32, // Safe area
    backgroundColor: 'rgba(11, 19, 38, 0.95)',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
    gap: 16,
  },
  navButtonsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  navButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Theme.colors.surfaceHigh,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    color: Theme.colors.text,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Theme.colors.error,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 32,
  },
  scoreCard: {
    backgroundColor: Theme.colors.surfaceCard,
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    marginBottom: 48,
    width: '100%',
  },
  scoreText: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: Theme.colors.primaryLight,
  },
  actionButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
    width: '100%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
