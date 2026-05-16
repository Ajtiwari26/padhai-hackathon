import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Animated, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { TestEntry, TestStore, TestQuestion } from '../../core/storage/TestStore';
import { AdaptiveQuestionGenerator } from '../../core/questions/AdaptiveQuestionGenerator';
import { Clock, ChevronLeft, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-react-native';

export const ExamScreen: React.FC<{ route: any, navigation: any }> = ({ route, navigation }) => {
  const { test } = route.params as { test: TestEntry };
  
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(test.questions * 150); // 2.5 mins per question
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    // Ideally we load pre-generated ones from ResourceStore.
    // For now we'll do a simple dynamic fetch if missing.
    loadOrGenerateQuestions();
  }, []);

  useEffect(() => {
    if (questions.length === 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          submitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [questions.length]);

  const loadOrGenerateQuestions = async () => {
    setCurrentIndex(0);
    setAnswers({});
    setIsSubmitting(false);

    if (test.data && test.data.length > 0) {
      setQuestions(test.data);
      return;
    }
    
    // Fallback: Generate mock questions
    const mock: TestQuestion[] = [];
    for(let i=0; i<test.questions; i++) {
      mock.push({
        id: `q${i}`,
        type: 'mcq',
        problem: `Question ${i+1} on ${test.topic}. Calculate the required value.`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Because A is the correct derived formula.'
      });
    }
    setQuestions(mock);
  };

  const submitExam = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    questions.forEach(q => {
      const ans = answers[q.id];
      if (!ans) {
        skipped++;
      } else if (ans === q.correctAnswer) {
        correct++;
      } else {
        wrong++;
      }
    });

    const score = correct; // Standard +1 per correct answer grading

    const updatedTest: TestEntry = {
      ...test,
      status: 'completed',
      score,
      maxScore: questions.length,
      correctCount: correct,
      wrongCount: wrong,
      skippedCount: skipped,
      durationMs: (test.questions * 150 - timeLeft) * 1000,
      data: questions.map(q => ({ ...q, studentAnswer: answers[q.id] }))
    };

    await TestStore.saveTest(updatedTest);
    
    navigation.replace('ScoreCard', { test: updatedTest });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Preparing Exam Environment...</Text>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentIndex];
  const progress = (currentIndex + 1) / questions.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Progress */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>{test.topic}</Text>
            <Text style={styles.headerSubtitle}>Adaptive Assessment</Text>
          </View>
          <View style={styles.timerContainer}>
            <Clock size={14} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          </View>
        </View>
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
        <View style={styles.qHeader}>
          <Text style={styles.qCount}>Question {currentIndex + 1} of {questions.length}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{currentQ.type.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.problemText}>{currentQ.problem}</Text>
        
        <View style={styles.optionsContainer}>
          {currentQ.options?.map((opt, i) => {
            const isSelected = answers[currentQ.id] === opt;
            return (
              <TouchableOpacity 
                key={i}
                activeOpacity={0.7}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => setAnswers(prev => ({...prev, [currentQ.id]: opt}))}
              >
                <View style={[styles.optIndicator, isSelected && styles.optIndicatorSelected]}>
                  <Text style={[styles.optLabel, isSelected && styles.optLabelSelected]}>
                    {String.fromCharCode(65 + i)}
                  </Text>
                </View>
                <Text style={[styles.optContent, isSelected && styles.optContentSelected]}>{opt}</Text>
                {isSelected && <CheckCircle2 size={20} color={Theme.colors.secondary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]} 
          disabled={currentIndex === 0}
          onPress={() => setCurrentIndex(c => c - 1)}
        >
          <ChevronLeft size={20} color={Theme.colors.text} />
          <Text style={styles.navBtnText}>Previous</Text>
        </TouchableOpacity>

        {currentIndex === questions.length - 1 ? (
          <TouchableOpacity style={styles.submitBtn} onPress={submitExam}>
            <Text style={styles.submitBtnText}>Finish Examination</Text>
            <ArrowRight size={20} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentIndex(c => c + 1)}>
            <Text style={styles.navBtnText}>Next Question</Text>
            <ChevronRight size={20} color={Theme.colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingText: {
    color: Theme.colors.textMuted,
    alignSelf: 'center',
    marginTop: 100,
    fontFamily: Theme.fonts.medium,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: 'rgba(11, 19, 38, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: Theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Theme.fonts.bold,
  },
  headerSubtitle: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timerText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Theme.fonts.bold,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Theme.colors.secondary,
    shadowColor: Theme.colors.secondary,
    shadowRadius: 4,
    shadowOpacity: 0.5,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  qHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qCount: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontFamily: Theme.fonts.bold,
    textTransform: 'uppercase',
  },
  typeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.bold,
  },
  problemText: {
    color: Theme.colors.text,
    fontSize: 19,
    lineHeight: 28,
    marginBottom: 40,
    fontFamily: Theme.fonts.medium,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: Theme.colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: Theme.colors.glassBorder,
  },
  optionCardSelected: {
    borderColor: Theme.colors.secondary,
    backgroundColor: 'rgba(45, 212, 191, 0.05)',
  },
  optIndicator: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optIndicatorSelected: {
    backgroundColor: Theme.colors.secondary,
  },
  optLabel: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Theme.fonts.bold,
  },
  optLabelSelected: {
    color: Theme.colors.background,
  },
  optContent: {
    flex: 1,
    color: Theme.colors.textSecondary,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
  },
  optContentSelected: {
    color: Theme.colors.text,
    fontWeight: '700',
    fontFamily: Theme.fonts.bold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
    backgroundColor: Theme.colors.background,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Theme.colors.surfaceHigh,
    gap: 8,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnText: {
    color: Theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Theme.fonts.bold,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 10,
    shadowColor: Theme.colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitBtnText: {
    color: Theme.colors.background,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Theme.fonts.bold,
  },
});
