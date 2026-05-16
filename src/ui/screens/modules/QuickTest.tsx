import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme/theme';
import { ThinkingIndicator } from '../../components/ThinkingIndicator';
import { Timer, Check, X, ArrowLeft } from 'lucide-react-native';
import { AdaptiveQuestionGenerator, GeneratedQuestion } from '../../../core/questions/AdaptiveQuestionGenerator';
import { LearningContextTracker } from '../../../core/intelligence/LearningContextTracker';

interface Props {
  navigation?: any;
  topic?: string;
}

export const QuickTest: React.FC<Props> = ({ 
  navigation, 
  topic = "Physics" 
}) => {
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTest();
  }, [topic]);

  const loadTest = async () => {
    setIsLoading(true);
    try {
      const baseReq = {
        topic,
        subtopic: "General",
        concepts: [topic],
        difficulty: 50,
        mathComplexity: 'basic',
        thinkingDepth: 'application',
        studentUnderstanding: 50,
        previousAttempts: { correct: 0, wrong: 0, avgTime: 0 },
        type: 'mcq',
        style: 'direct',
      };

      // Generate 3 unique questions for the test
      const qPromise = [
        AdaptiveQuestionGenerator.generate({ ...baseReq, difficulty: 40 } as any),
        AdaptiveQuestionGenerator.generate({ ...baseReq, difficulty: 50 } as any),
        AdaptiveQuestionGenerator.generate({ ...baseReq, difficulty: 60 } as any),
      ];
      
      const results = await Promise.all(qPromise);
      setQuestions(results);
    } catch (e) {
      console.error('[QuickTest] Error loading test:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (index: number) => {
    if (isSubmitted) return;
    setSelectedOption(index);
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setIsSubmitted(true);
    
    const currentQ = questions[currentIndex];
    const isCorrect = selectedOption === currentQ.correctOption;
    if (isCorrect) setScore(score + 1);

    // Record attempt
    LearningContextTracker.recordAttempt({
      questionId: currentQ.id,
      correct: isCorrect,
      timeSpent: 1, // mock
      difficulty: currentQ.difficulty,
      expectedTime: currentQ.expectedTime,
      timestamp: Date.now(),
    });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    } else {
      // Finish Test
      navigation?.goBack();
    }
  };

  if (isLoading || questions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThinkingIndicator text="Preparing your test..." />
        </View>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentIndex];
  const isCorrect = isSubmitted && selectedOption === currentQ.correctOption;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={24} color={Theme.colors.primaryLight} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Timer size={18} color={Theme.colors.text} />
          <Text style={styles.headerTitle}>Quick Test</Text>
        </View>
        <Text style={styles.progressText}>{currentIndex + 1} / {questions.length}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQ.problem}</Text>
        </View>

        <View style={styles.optionsContainer}>
          {currentQ.options?.map((option, index) => {
            const isSelected = selectedOption === index;
            const isCorrectOption = index === currentQ.correctOption;
            
            let containerStyle: any = [styles.optionCard];
            let textStyle: any = [styles.optionText];
            let indicatorContent = <Text style={styles.indicatorText}>{['A', 'B', 'C', 'D'][index]}</Text>;

            if (isSubmitted) {
              if (isCorrectOption) {
                containerStyle.push(styles.optionCorrect);
                textStyle.push({ color: Theme.colors.success });
                indicatorContent = <Check size={16} color={Theme.colors.success} />;
              } else if (isSelected) {
                containerStyle.push(styles.optionIncorrect);
                textStyle.push({ color: Theme.colors.error });
                indicatorContent = <X size={16} color={Theme.colors.error} />;
              }
            } else if (isSelected) {
              containerStyle.push(styles.optionSelected);
            }

            return (
              <TouchableOpacity
                key={index}
                style={containerStyle}
                onPress={() => handleSelect(index)}
                activeOpacity={0.7}
              >
                <View style={styles.optionIndicator}>
                  {indicatorContent}
                </View>
                <Text style={textStyle}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isSubmitted && (
          <View style={[
            styles.feedbackCard, 
            { borderLeftColor: isCorrect ? Theme.colors.success : Theme.colors.error }
          ]}>
            <Text style={[styles.feedbackTitle, { color: isCorrect ? Theme.colors.success : Theme.colors.error }]}>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </Text>
            <Text style={styles.feedbackText}>{currentQ.solution}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        {!isSubmitted ? (
          <TouchableOpacity 
            style={[styles.actionButton, selectedOption === null && styles.actionButtonDisabled]}
            onPress={handleSubmit}
            disabled={selectedOption === null}
          >
            <Text style={styles.actionButtonText}>Submit Answer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionButton} onPress={handleNext}>
            <Text style={styles.actionButtonText}>
              {currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish Test'}
            </Text>
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
    height: 60,
  },
  iconButton: { padding: 8 },
  iconText: { color: Theme.colors.primaryLight, fontSize: 24 },
  headerTitle: { color: Theme.colors.text, fontSize: 18, fontWeight: '700' },
  progressText: { color: Theme.colors.textSecondary, fontWeight: '600' },
  progressBarContainer: {
    height: 4,
    backgroundColor: Theme.colors.glassBorder,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  questionCard: {
    marginBottom: 32,
  },
  questionText: {
    fontSize: 22,
    fontWeight: '600',
    color: Theme.colors.text,
    lineHeight: 32,
  },
  optionsContainer: {
    gap: 16,
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
  optionCorrect: {
    borderColor: Theme.colors.success,
    backgroundColor: Theme.colors.successBg,
  },
  optionIncorrect: {
    borderColor: Theme.colors.error,
    backgroundColor: Theme.colors.errorBg,
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
  feedbackCard: {
    marginTop: 24,
    backgroundColor: 'rgba(45, 52, 73, 0.25)',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  feedbackText: {
    color: Theme.colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32, // Safe area
    backgroundColor: 'rgba(11, 19, 38, 0.9)',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
  },
  actionButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: Theme.colors.glassBorderLight,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
