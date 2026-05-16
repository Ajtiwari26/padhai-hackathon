import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme/theme';
import { ThinkingIndicator } from '../../components/ThinkingIndicator';
import { ArrowLeft, MoreVertical, Calculator, BarChart2, Clock, Brain, Lightbulb, CheckCircle2, XCircle, GraduationCap } from 'lucide-react-native';
import { AdaptiveQuestionGenerator, GeneratedQuestion } from '../../../core/questions/AdaptiveQuestionGenerator';
import { LearningContextTracker } from '../../../core/intelligence/LearningContextTracker';

interface Props {
  navigation?: any;
  topic?: string;
  subtopic?: string;
}

export const NumericalZone: React.FC<Props> = ({ 
  navigation, 
  topic = "Physics", 
  subtopic = "Kinematics" 
}) => {
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [answer, setAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    loadQuestion();
  }, [topic, subtopic]);

  const loadQuestion = async () => {
    setIsLoading(true);
    setShowSolution(false);
    setShowHint(false);
    setAnswer('');
    setIsCorrect(null);
    setIsEvaluating(false);
    try {
      const request = await LearningContextTracker.getQuestionNeeds();
      // Force numerical type for this zone
      request.type = 'numerical';
      const q = await AdaptiveQuestionGenerator.generate(request);
      setQuestion(q);
      setStartTime(Date.now());
    } catch (e) {
      console.error('[NumericalZone] Error loading question:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim() || !question) return;
    setIsEvaluating(true);
    
    // Simulate evaluation delay
    setTimeout(async () => {
      // Basic check (in reality, use LLM or exact match)
      const correct = answer.toLowerCase().includes(question.solution.toLowerCase());
      setIsCorrect(correct);
      setShowSolution(true);
      setIsEvaluating(false);

      const timeSpent = (Date.now() - startTime) / 60000; // in minutes
      await LearningContextTracker.recordAttempt({
        questionId: question.id,
        correct,
        timeSpent,
        difficulty: question.difficulty,
        expectedTime: question.expectedTime,
        timestamp: Date.now(),
      });
    }, 1000);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThinkingIndicator text="Generating numerical problem..." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => navigation?.goBack()}
        >
          <ArrowLeft size={24} color={Theme.colors.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{topic}</Text>
        <TouchableOpacity style={styles.iconButton}>
          <MoreVertical size={24} color={Theme.colors.primaryLight} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Calculator size={28} color={Theme.colors.text} />
              <Text style={[styles.pageTitle, { marginBottom: 0 }]}>Numerical Zone</Text>
            </View>
            {question && (
              <View style={styles.badgesRow}>
                <View style={[styles.badge, { borderColor: Theme.colors.error + '50' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <BarChart2 size={14} color={Theme.colors.error} />
                    <Text style={[styles.badgeText, { color: Theme.colors.error }]}>
                      {question.difficulty}/100
                    </Text>
                  </View>
                </View>
                <View style={[styles.badge, { borderColor: Theme.colors.primary + '50' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Clock size={14} color={Theme.colors.primaryLight} />
                    <Text style={[styles.badgeText, { color: Theme.colors.primaryLight }]}>
                      {question.expectedTime} min
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
          
          <View style={styles.scorePill}>
            <Text style={styles.scoreText}>Score: 450</Text>
          </View>
        </View>

        {/* Problem Card */}
        <View style={styles.problemCard}>
          <View style={styles.problemHeader}>
            <View style={styles.problemIcon}>
              <Brain size={20} color={Theme.colors.secondary} />
            </View>
            <View>
              <Text style={styles.problemLabel}>CHALLENGE</Text>
              <Text style={styles.problemTitle}>Problem Statement</Text>
            </View>
          </View>
          <View style={styles.problemContent}>
            <Text style={styles.problemText}>
              {question?.problem || "A particle of mass 2kg is moving with velocity 10m/s. Calculate the kinetic energy."}
            </Text>
          </View>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Your Solution</Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="Type your answer..."
            placeholderTextColor={Theme.colors.textMuted}
            value={answer}
            onChangeText={setAnswer}
            editable={!showSolution}
          />
        </View>

        {/* Hint (if revealed) */}
        {showHint && question?.hints && (
          <View style={styles.hintCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Lightbulb size={16} color={Theme.colors.warning} />
              <Text style={[styles.hintTitle, { marginBottom: 0 }]}>Hint</Text>
            </View>
            <Text style={styles.hintText}>{question.hints[0]}</Text>
          </View>
        )}

        {/* Action Buttons */}
        {!showSolution && (
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.hintButton}
              onPress={() => setShowHint(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Lightbulb size={16} color={Theme.colors.primaryLight} />
                <Text style={styles.hintButtonText}>Hint</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isEvaluating || !answer.trim()}
            >
              {isEvaluating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Answer ↗</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Solution Section */}
        {showSolution && question && (
          <View style={styles.solutionContainer}>
            <View style={styles.divider} />
            
            <View style={styles.solutionHeader}>
              {isCorrect ? <CheckCircle2 size={32} color={Theme.colors.success} /> : <XCircle size={32} color={Theme.colors.error} />}
              <Text style={styles.solutionTitle}>Solution Breakdown</Text>
            </View>
            
            <View style={styles.solutionContent}>
              <View style={styles.solutionSteps}>
                <View style={styles.stepCard}>
                  <Text style={styles.stepLabel}>Solution</Text>
                  <Text style={styles.stepText}>{question.solution}</Text>
                </View>

              </View>

              <View style={styles.learningPointsCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <GraduationCap size={18} color={Theme.colors.secondary} />
                  <Text style={[styles.learningPointsTitle, { marginBottom: 0 }]}>Key Takeaways</Text>
                </View>
                <View style={styles.pointRow}>
                  <View style={styles.pointDot} />
                  <Text style={styles.pointText}>Kinetic energy is directly proportional to mass.</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.nextButton}
                onPress={loadQuestion}
              >
                <Text style={styles.submitButtonText}>Next Problem →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: Theme.colors.textMuted,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
    backgroundColor: 'rgba(11, 19, 38, 0.8)',
  },
  iconButton: {
    padding: 8,
  },
  iconText: {
    color: Theme.colors.primaryLight,
    fontSize: 24,
  },
  headerTitle: {
    color: Theme.colors.primaryLight,
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: Theme.colors.glassBackground,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scorePill: {
    backgroundColor: Theme.colors.glassBackground,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  scoreText: {
    color: Theme.colors.primaryLight,
    fontWeight: '600',
    fontSize: 14,
  },
  problemCard: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    marginBottom: 24,
    ...Theme.shadow.md,
  },
  problemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  problemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.2)',
  },
  problemLabel: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.secondary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  problemTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  problemContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  problemText: {
    fontSize: 17,
    color: Theme.colors.text,
    lineHeight: 26,
    fontFamily: Theme.fonts.medium,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Theme.colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  textInput: {
    minHeight: 120,
    backgroundColor: 'rgba(45, 52, 73, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    padding: 16,
    color: Theme.colors.text,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  hintCard: {
    backgroundColor: Theme.colors.warningBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Theme.colors.warning + '50',
  },
  hintTitle: {
    color: Theme.colors.warning,
    fontWeight: '600',
    marginBottom: 4,
  },
  hintText: {
    color: Theme.colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  hintButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary + '10',
  },
  hintButtonText: {
    color: Theme.colors.primaryLight,
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Theme.colors.secondaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.glassBorderLight,
    marginVertical: 32,
  },
  solutionContainer: {
    opacity: 0.9,
  },
  solutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  solutionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  solutionContent: {
    gap: 24,
  },
  solutionSteps: {
    gap: 16,
  },
  stepCard: {
    backgroundColor: 'rgba(45, 52, 73, 0.15)',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.primary,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.primaryLight,
    marginBottom: 8,
  },
  stepText: {
    fontSize: 16,
    color: Theme.colors.text,
    lineHeight: 24,
  },
  learningPointsCard: {
    backgroundColor: 'rgba(45, 52, 73, 0.25)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  learningPointsTitle: {
    color: Theme.colors.secondary,
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.secondary,
    marginTop: 8,
  },
  pointText: {
    flex: 1,
    color: Theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
