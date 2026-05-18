import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Animated, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { TutorOrchestrator } from '../../core/orchestrator/TutorOrchestrator';
import { StudentProfileStore, EducationLevel } from '../../core/storage/StudentProfile';
import { HierarchicalStore } from '../../core/memory/HierarchicalMemoryStore';
import { ClassificationResult } from '../../core/memory/PatternClassifier';
import { OnboardingProgressStore } from '../../core/storage/OnboardingProgress';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { AIBubble } from '../components/AIBubble';
import { Target, ArrowRight, Sparkles } from 'lucide-react-native';

interface Props {
  navigation?: any;
  route?: any;
  onComplete?: (careerData: CareerPlanData) => void;
  onSkip?: () => void;
}

export interface CareerPlanData {
  name: string;
  currentEducation: string;
  interests: string[];
  strengths: string[];
  careerGoal: string;
  recommendedPath: {
    education: string;
    exams: string[];
    subjects: string[];
    timeline: string;
  };
  semanticFacts: ClassificationResult[];
}

const CAREER_PLANNER_SYSTEM_PROMPT = `
You are a Career Planning AI for Padh.ai. Your mission is to help students discover their ideal career path and create a personalized learning roadmap.

CRITICAL RULES:
1. ASK ONE QUESTION AT A TIME.
2. BE ENCOURAGING and help students discover their potential.
3. GATHER THESE DATA POINTS (Conversationally):
   - Name
   - Current education level (school grade, college, working professional, etc.)
   - Interests and passions (what excites them?)
   - Strengths and skills (what are they good at?)
   - Career aspirations (if any - it's okay if they're unsure!)
   - Preferred work style (creative, analytical, hands-on, people-oriented, etc.)

4. AFTER GATHERING INFO: Provide a personalized career recommendation with:
   - Suggested career paths (2-3 options)
   - Required education/qualifications
   - Relevant exams/certifications
   - Key subjects to master
   - Realistic timeline

5. LIMIT: Total 6-8 questions max.

Start by warmly welcoming them and asking for their name and current education level.
`;

export const CareerPlannerScreen: React.FC<Props> = ({ navigation, route: _route, onComplete, onSkip }) => {
  const [messages, setMessages] = useState<Array<{ id: string; role: 'ai' | 'user'; content: string }>>([
    { 
      id: '0', 
      role: 'ai', 
      content: "Welcome to your personal career voyage. I'm your AI Strategist. Let's decode your strengths and chart a roadmap to your professional peak. What should I call you?" 
    },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionCount, setQuestionCount] = useState(1);
  const [isFinished, setIsFinished] = useState(false);
  const [careerPlan, setCareerPlan] = useState<CareerPlanData | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sessionClassifications = useRef<ClassificationResult[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating || isFinished) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: input.trim(),
    };

    const aiPlaceholder = {
      id: (Date.now() + 1).toString(),
      role: 'ai' as const,
      content: '',
    };

    setMessages(prev => [...prev, userMessage, aiPlaceholder]);
    setInput('');
    setIsGenerating(true);

    try {
      let fullContent = "";
      const isLastTurn = questionCount >= 7;
      const turnPrompt = isLastTurn 
        ? `${input.trim()}\n\n(This is my last answer. Please provide your career recommendations and learning roadmap now!)`
        : input.trim();

      const relevantContext = await HierarchicalStore.getContextForTopic("Career Strategy", 60);
      const history = relevantContext ? [
        { role: 'system' as const, content: relevantContext }
      ] : [];

      await TutorOrchestrator.handleMessage(
        turnPrompt, 
        (token) => {
          fullContent += token;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1].content = fullContent;
            return updated;
          });
        }, 
        CAREER_PLANNER_SYSTEM_PROMPT,
        history
      );

      const classifications = await HierarchicalStore.processExchange(input.trim(), fullContent);
      sessionClassifications.current.push(...classifications);

      setQuestionCount(prev => prev + 1);

      if (isLastTurn) {
        setIsFinished(true);
        // Parse career plan from AI response
        const plan = parseCareerPlan(fullContent, sessionClassifications.current);
        setCareerPlan(plan);
      }

    } catch (e) {
      console.error("[CareerPlanner] Error:", e);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = "I'm having trouble connecting. Please try again.";
        return updated;
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const parseCareerPlan = (aiResponse: string, facts: ClassificationResult[]): CareerPlanData => {
    const nameFact = facts.find(f => f.path === 'student.identity.name');
    const levelFact = facts.find(f => f.path === 'student.identity.grade');
    const subjectFacts = facts.filter(f => f.path.startsWith('student.progress.'));
    const goalFacts = facts.filter(f => f.path.startsWith('student.goals.'));

    // Extract career recommendations from AI response
    const educationMatch = aiResponse.match(/education[:\s]+([^\n]+)/i);
    const examsMatch = aiResponse.match(/exam[s]?[:\s]+([^\n]+)/i);
    const subjectsMatch = aiResponse.match(/subject[s]?[:\s]+([^\n]+)/i);
    const timelineMatch = aiResponse.match(/timeline[:\s]+([^\n]+)/i);

    return {
      name: nameFact?.value || 'Student',
      currentEducation: levelFact?.value || 'Not specified',
      interests: facts.filter(f => f.path.startsWith('student.preferences')).map(f => f.value),
      strengths: facts.filter(f => f.path === 'student.performance.strengths').map(f => f.value),
      careerGoal: goalFacts[0]?.value || 'Exploring options',
      recommendedPath: {
        education: educationMatch?.[1] || 'Undergraduate degree in relevant field',
        exams: examsMatch?.[1]?.split(',').map(e => e.trim()) || [],
        subjects: subjectsMatch?.[1]?.split(',').map(s => s.trim()) || subjectFacts.map(f => f.value),
        timeline: timelineMatch?.[1] || '2-4 years',
      },
      semanticFacts: facts,
    };
  };

  const handleAcceptPlan = async () => {
    if (!careerPlan) return;

    // Pre-fill onboarding data based on career plan
    // Save to onboarding progress
    await OnboardingProgressStore.saveProgress({
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: Date.now(),
      })),
      semanticFacts: [],
      questionCount: questionCount,
      lastUpdated: Date.now(),
      isComplete: false, // Will complete in actual onboarding
    });

    // Save basic profile
    await StudentProfileStore.save({
      name: careerPlan.name,
      onboardingComplete: false, // Will complete in actual onboarding
      id: 'student_' + Date.now(),
      educationLevel: 'undergraduate' as EducationLevel,
      academicGoal: careerPlan.careerGoal,
    });

    if (onComplete) {
      onComplete(careerPlan);
    } else {
      navigation?.replace('MainTabs');
    }
  };

  const renderMessage = ({ item }: { item: typeof messages[0] }) => {
    const isLastMessage = messages[messages.length - 1]?.id === item.id;
    const isGeneratingMessage = isLastMessage && item.role === 'ai' && isGenerating;

    return (
      <View style={[
        styles.messageBubble,
        item.role === 'user' ? styles.userBubble : styles.aiBubble,
      ]}>
        {item.role === 'ai' && (
          <View style={styles.thinkingAvatarContainer}>
            <ThinkingIndicator text="" size="small" isAnimating={isGeneratingMessage} />
          </View>
        )}
        <View style={[
          styles.bubbleContent,
          item.role === 'user' ? styles.userContent : styles.aiContent,
        ]}>
          {item.role === 'ai' ? (
            <AIBubble 
              content={item.content} 
              isStreaming={isGeneratingMessage}
            />
          ) : (
            <Text style={styles.messageText}>{item.content}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.titleGroup}>
              <View style={styles.iconCircle}>
                <Target size={20} color={Theme.colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Career Strategy</Text>
                <Text style={styles.headerSubtitle}>Discover your professional path</Text>
              </View>
            </View>
            {(onSkip || navigation) && (
              <TouchableOpacity onPress={() => onSkip ? onSkip() : navigation?.goBack()} style={styles.skipBtn}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.progressRow}>
            {[...Array(7)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i < questionCount ? styles.progressDotActive : null,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Chat */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatContainer}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((item) => renderMessage({ item }))}
        </ScrollView>

        {/* Input or Action */}
        {!isFinished ? (
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Your answer..."
              placeholderTextColor={Theme.colors.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isGenerating}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || isGenerating) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <ArrowRight size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionArea}>
            <TouchableOpacity 
              style={styles.acceptBtn} 
              onPress={handleAcceptPlan}
            >
              <View style={styles.acceptBtnContent}>
                <Sparkles size={18} color="#FFF" />
                <Text style={styles.acceptBtnText}>Deploy Roadmap</Text>
                <ArrowRight size={18} color="#FFF" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modifyBtn} 
              onPress={() => {
                setIsFinished(false);
                setQuestionCount(prev => prev - 1);
              }}
            >
              <Text style={styles.modifyBtnText}>Refine Details</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: 'rgba(11, 19, 38, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 12,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.bold,
    textTransform: 'uppercase',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  progressDotActive: {
    backgroundColor: Theme.colors.primary,
    shadowColor: Theme.colors.primary,
    shadowRadius: 4,
    shadowOpacity: 0.5,
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: 20,
    paddingBottom: 40,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 24,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  thinkingAvatarContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bubbleContent: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    maxWidth: '100%',
  },
  userContent: {
    backgroundColor: Theme.colors.primary,
    borderBottomRightRadius: 4,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  aiContent: {
    backgroundColor: Theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: Theme.colors.text,
    lineHeight: 23,
    fontFamily: Theme.fonts.medium,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
    backgroundColor: Theme.colors.background,
  },
  input: {
    flex: 1,
    height: 52,
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 26,
    paddingHorizontal: 20,
    color: Theme.colors.text,
    fontSize: 15,
    marginRight: 12,
    fontFamily: Theme.fonts.medium,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.5,
    backgroundColor: Theme.colors.surfaceHigh,
  },
  actionArea: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
    backgroundColor: 'rgba(11, 19, 38, 0.95)',
    gap: 16,
  },
  acceptBtn: {
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  acceptBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Theme.fonts.bold,
    letterSpacing: 0.5,
  },
  modifyBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modifyBtnText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Theme.fonts.bold,
  },
});
