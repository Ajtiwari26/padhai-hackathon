import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, Animated, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { TutorOrchestrator } from '../../core/orchestrator/TutorOrchestrator';
import { TopicConvergenceTracker } from '../../core/orchestrator/TopicConvergenceTracker';
import { launchImageLibrary } from 'react-native-image-picker';
import { VisionMentor } from '../../core/api/VisionMentor';
import { ArrowLeft, Camera, ArrowUp, Search, Brain, Hammer, Palette, Ruler, Eye, GraduationCap, MessageSquare } from 'lucide-react-native';
import { ModuleManager, ModuleContext } from '../../core/modules/ModuleManager';
import { NumericalZone } from './modules/NumericalZone';
import { PracticalLab } from './modules/PracticalLab';
import { QuickTest } from './modules/QuickTest';
import { KeyPoints } from './modules/KeyPoints';
import { DoubtSession } from './modules/DoubtSession';
import { MockTest } from './modules/MockTest';
import { LocalServerManager } from '../../core/api/LocalServerManager';
import { StatusBanner } from '../components/StatusBanner';
import { useEffect } from 'react';
import { AIBubble } from '../components/AIBubble';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { ChatStore } from '../../core/storage/ChatStore';
import { HierarchicalStore } from '../../core/memory/HierarchicalMemoryStore';
import { RichText } from '../components/RichText';
import { EventBus } from '../../core/bus/EventBus';
import { ResourcePlanner } from '../../core/planner/ResourcePlanner';

import type { GeneratedDiagram } from '../../skills/DiagramGenerator';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  skillUsed?: string;
  isStreaming?: boolean;
  timestamp: number;
  type?: 'text' | 'mcq' | 'numerical';
  mcqOptions?: { label: string; text: string; isCorrect?: boolean }[];
  diagrams?: GeneratedDiagram[];
}

interface Props {
  route?: any;
  navigation?: any;
}

export const MentorChat: React.FC<Props> = ({ route, navigation }) => {
  const chapterName = route?.params?.topic || 'General';
  const subtopicName = route?.params?.subtopic;
  const topic = subtopicName || chapterName;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Memory Management: Maximum messages kept in React state to prevent OOM
  const MAX_IN_MEMORY_MESSAGES = 50;
  // Throttle ref for streaming updates (prevents hundreds of state copies per response)
  const lastStreamUpdate = useRef<number>(0);
  const pendingStreamContent = useRef<string>('');
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleContext | null>(null);
  const [convergenceData, setConvergenceData] = useState({ percent: 0, text: 'Initializing topic...' });
  
  const flatListRef = useRef<FlatList>(null);
  const isUserScrolling = useRef(false);


  // Convergence polling
  useEffect(() => {
    const interval = setInterval(() => {
      const progress = TopicConvergenceTracker.getProgress();
      if (progress) {
        setConvergenceData({
          percent: progress.overallConvergence,
          text: TopicConvergenceTracker.getProgressString()
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadChatHistory = async () => {
      await TutorOrchestrator.setTopic(topic, subtopicName);
      
      const history = await ChatStore.loadMessages(topic);
      if (history.length > 0) {
        setMessages(history);
      } else {
        // Default initial message
        setMessages([
          {
            id: '0',
            role: 'ai',
            content: `I'm your Padh.ai mentor. Let's work on **${topic}** together.\n\nRemember — I won't hand you answers. I'll guide you to discover them yourself.\n\nWhat do you already know about this topic? Let's see where you stand.`,
            skillUsed: 'BreadthSweeper',
            timestamp: Date.now(),
          },
        ]);
      }
    };

    loadChatHistory();
    // Initial state
    setActiveModule(ModuleManager.getCurrentModule());

    // Listen to changes
    const unsubscribe = ModuleManager.subscribe((mod) => {
      setActiveModule(mod);
    });

    return () => {
      unsubscribe();
    };
  }, [topic, subtopicName]);

  // Auto-save when messages change (and aren't streaming)
  useEffect(() => {
    const hasStreaming = messages.some(m => m.isStreaming);
    if (!hasStreaming && messages.length > 1) {
      // Only save the most recent MAX_IN_MEMORY_MESSAGES to AsyncStorage
      const toSave = messages.slice(-MAX_IN_MEMORY_MESSAGES);
      ChatStore.saveMessages(topic, toSave as any);
      
      // Memory management: Periodically reset cache to prevent bloat
      // This clears KV-cache but preserves context via semantic memory
      if (messages.length % 15 === 0 && messages.length > 15) {
        console.log(`[MentorChat] Resetting model cache at ${messages.length} messages to prevent memory bloat.`);
        console.log('[MentorChat] Context preserved via: Semantic Memory + Session Cheatsheet + Last 3 turns');
        LocalServerManager.resetCache().catch(err => 
          console.warn('[MentorChat] Failed to reset cache:', err)
        );
      }
      
      // Prune in-memory messages if they exceed the cap
      if (messages.length > MAX_IN_MEMORY_MESSAGES) {
        console.log(`[MentorChat] Pruning messages: ${messages.length} -> ${MAX_IN_MEMORY_MESSAGES}`);
        setMessages(prev => prev.slice(-MAX_IN_MEMORY_MESSAGES));
      }
    }
  }, [messages, topic]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const aiPlaceholder: ChatMessage = {
      id: `ai_${Date.now()}`,
      role: 'ai',
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg, aiPlaceholder]);
    setInput('');
    setIsGenerating(true);
    isUserScrolling.current = false;

    const startTime = Date.now();
    
    // EventBus: Emit user message event
    EventBus.emitSync('user:message', {
      text: input.trim(),
      topic: topic,
      timestamp: Date.now()
    });
    
    // Request foreground access (preempts background tasks)
    await ResourcePlanner.requestForegroundAccess();

    try {
      const manualCommand = ModuleManager.userInvokeModule(input.trim());
      if (manualCommand) {
        ModuleManager.enterModule(manualCommand, topic, 'General', 'User invoked command');
        setIsGenerating(false);
        return;
      }

      // Stream response from orchestrator
      let fullContent = "";
      let displayedContent = "";
      let detectedSkill = activeSkill;

      // Throttled UI update function — prevents per-token state copies
      const flushStreamUpdate = () => {
        const content = pendingStreamContent.current;
        if (!content && !displayedContent) return;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.isStreaming) {
            last.content = content || '💭';
            last.skillUsed = detectedSkill || undefined;
          }
          return [...updated];
        });
        lastStreamUpdate.current = Date.now();
      };

      // USE OPTIMIZED CONTEXT MANAGEMENT PIPELINE (same as OnboardingChat)
      // TutorOrchestrator now handles ContextBudget/ContextWindow internally
      const response = await TutorOrchestrator.handleMessage(
        input.trim(), 
        (token: string) => {
          fullContent += token;
          
          // Match both [SKILL:...] and [SWITCH_SKILL: ...]
          const skillMatch = fullContent.match(/^\[(?:SKILL|SWITCH_SKILL):\s*([a-zA-Z]+)\]\s*/);
          if (skillMatch) {
            detectedSkill = skillMatch[1];
            displayedContent = fullContent.substring(skillMatch[0].length);
            setActiveSkill(detectedSkill);
          } else if (fullContent.startsWith('[')) {
            // Hide any other bracketed metadata until we see the closing bracket
            if (fullContent.includes(']') && !fullContent.match(/^\[(?:SKILL|SWITCH_SKILL):/)) {
              displayedContent = fullContent;
            } else if (fullContent.length > 40) {
              // If it's too long and still no closing bracket, show it anyway
              displayedContent = fullContent;
            } else {
              // Still waiting for closing bracket
              displayedContent = '';
            }
          } else {
            displayedContent = fullContent;
          }

          pendingStreamContent.current = displayedContent;

          // Throttle: update UI at most every 80ms to reduce GC pressure
          const now = Date.now();
          if (now - lastStreamUpdate.current >= 80) {
            flushStreamUpdate();
          } else if (!streamTimerRef.current) {
            streamTimerRef.current = setTimeout(() => {
              streamTimerRef.current = null;
              flushStreamUpdate();
            }, 80);
          }
        },
        undefined, // customSystemPrompt
        // Pass recent messages - TutorOrchestrator applies ContextWindow + ContextBudget
        messages.slice(-10).map(m => ({ 
          role: m.role === 'ai' ? 'assistant' : 'user', 
          content: m.content 
        }))
        // Caveman mode removed - never use for student-facing chat
      );

      // Flush any remaining pending stream content
      if (streamTimerRef.current) {
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = null;
      }

      // Mark streaming as done
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        last.isStreaming = false;
        last.content = response.text;
        last.skillUsed = detectedSkill || undefined;
        last.diagrams = response.diagrams;
        return [...updated];
      });
      
      // EventBus: Emit AI response event
      const duration = Date.now() - startTime;
      const estimatedTokens = Math.ceil(fullContent.length / 4);
      EventBus.emitSync('ai:response', {
        text: fullContent,
        topic: topic,
        duration,
        tokensUsed: estimatedTokens,
        userMsg: input.trim(),
        activeSkill: detectedSkill || undefined
      });

      // 5. Extract semantic facts for long-term memory
      await HierarchicalStore.processExchange(input.trim(), fullContent);
      
      // EventBus: Emit memory update event
      EventBus.emitSync('memory:updated', {
        factCount: 1, // processExchange doesn't return count, so we use 1 as indicator
        topic: topic
      });

    } catch {
      Alert.alert(
        "Engine Error",
        "I'm having trouble connecting to my local inference engine. Please check if the model is downloaded in Settings."
      );
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          const last = updated[updated.length - 1];
          if (last.isStreaming && (!last.content || last.content === '💭')) {
            updated.pop();
          } else {
            last.isStreaming = false;
            last.skillUsed = 'SystemError';
          }
        }
        return [...updated];
      });
    } finally {
      // Release foreground access (resumes background tasks)
      ResourcePlanner.releaseForegroundAccess();
    }

    setIsGenerating(false);
    isUserScrolling.current = false;
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
  }, [input, isGenerating, activeSkill, messages, topic]);

  const handleCameraPress = useCallback(async () => {
    if (isGenerating) return;

    try {
      console.log('[Vision] Opening Image Library...');
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      });

      if (result.didCancel || !result.assets?.[0]?.uri) {
        console.log('[Vision] User cancelled image selection or no URI found.');
        return;
      }

      const imageUri = result.assets[0].uri;
      console.log(`[Vision] Image selected successfully. URI: ${imageUri}`);
      
      // 1. Show user that we are analyzing
      const userMsg: ChatMessage = {
        id: `user_vision_${Date.now()}`,
        role: 'user',
        content: "[Image Attachment]", // We could show a thumbnail here in a real app
        timestamp: Date.now(),
      };
      
      const aiPlaceholder: ChatMessage = {
        id: `ai_vision_${Date.now()}`,
        role: 'ai',
        content: 'Analyzing your handwriting...',
        isStreaming: true,
        skillUsed: 'VisionMentor',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, userMsg, aiPlaceholder]);
      setIsGenerating(true);
      isUserScrolling.current = false;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);

      // 2. Run Native OCR
      console.log('[Vision] Sending image to Native ML Kit OCR...');
      const visionResult = await VisionMentor.analyzeHandwriting(imageUri);
      console.log('[Vision] OCR Result Extracted: ', visionResult);
      
      // 3. Pass the recognized text to the TutorOrchestrator
      // We append a prefix to help the AI understand this is from a photo
      const promptWithContext = `I have uploaded a photo of my work. Here is the text I extracted from it: "${visionResult.text}". Please help me understand it or find any mistakes.`;
      console.log('[Vision] Final Prompt sent to Orchestrator: ', promptWithContext);

      // 4. Stream response
      let fullContent = "";
      await TutorOrchestrator.handleMessage(promptWithContext, (token: string) => {
        fullContent += token;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.isStreaming) {
            last.content = fullContent;
          }
          return [...updated];
        });
      });

      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        last.isStreaming = false;
        return [...updated];
      });

    } catch (e: any) {
      console.error("Vision Error:", e);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        last.content = "I couldn't read that image. Make sure it's clear and has enough light!";
        last.isStreaming = false;
        return [...updated];
      });
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating]);

  const getSkillEmoji = (skill?: string) => {
    const props = { size: 14, color: Theme.colors.secondary };
    switch (skill) {
      case 'BreadthSweeper': return <Search {...props} />;
      case 'SocraticMolder': return <Brain {...props} />;
      case 'TopBuilder': return <Hammer {...props} />;
      case 'VisualExplainer': return <Palette {...props} />;
      case 'PracticalTester': return <Ruler {...props} />;
      case 'VisionMentor': return <Eye {...props} />;
      case 'ConceptTeacher': return <GraduationCap {...props} />;
      default: return <MessageSquare {...props} />;
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isStreaming = item.isStreaming;
    
    return (
    <View style={[styles.messageRow, item.role === 'user' && styles.messageRowUser]}>
      {item.role === 'ai' && (
        <View style={styles.thinkingAvatarContainer}>
          <ThinkingIndicator text="" size="small" isAnimating={isStreaming} />
        </View>
      )}
      <View style={[
        styles.bubble,
        item.role === 'user' ? styles.userBubble : styles.aiBubble,
      ]}>
        {item.role === 'ai' ? (
          <AIBubble 
            content={item.content} 
            isStreaming={item.isStreaming}
            skillEmoji={getSkillEmoji(item.skillUsed)}
            skillName={item.skillUsed}
            diagrams={item.diagrams}
          />
        ) : (
          <RichText text={item.content} isUser={true} />
        )}
      </View>
    </View>
    );
  };

  if (activeModule && activeModule.type !== 'concept_class') {
    switch (activeModule.type) {
      case 'numerical_zone':
        return <NumericalZone topic={topic} navigation={navigation} />;
      case 'practical_lab':
        return <PracticalLab topic={topic} navigation={navigation} />;
      case 'quick_test':
        return <QuickTest topic={topic} navigation={navigation} />;
      case 'key_points':
        return <KeyPoints topic={topic} navigation={navigation} />;
      case 'doubt_session':
        return <DoubtSession topic={topic} navigation={navigation} />;
      case 'mock_test':
        return <MockTest topic={topic} navigation={navigation} />;
    }
  }


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={Theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{topic}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.headerSub}>Adaptive Mentor</Text>
            </View>
          </View>
        </View>
        <StatusBanner />
      </View>

      {/* Engine Status Banner */}


      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: `${Math.max(5, convergenceData.percent)}%` }]} />
        </View>
        <Text style={styles.progressText}>{convergenceData.text}</Text>
      </View>

      {/* Chat and Input */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          windowSize={10}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          removeClippedSubviews={true}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
            isUserScrolling.current = !isCloseToBottom;
          }}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (!isUserScrolling.current) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />

        <View style={styles.inputArea}>
          <TouchableOpacity 
            style={styles.cameraBtn} 
            onPress={handleCameraPress}
            disabled={isGenerating}
            activeOpacity={0.7}
          >
            <Camera size={22} color={Theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { maxHeight: 100 }]}
              placeholder="Message your mentor..."
              placeholderTextColor={Theme.colors.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline={true}
              editable={!isGenerating}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || isGenerating) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || isGenerating}
              activeOpacity={0.8}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <ArrowUp size={24} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(11, 19, 38, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.secondary,
    marginRight: 6,
  },
  headerSub: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.secondary,
    shadowColor: Theme.colors.secondary,
    shadowRadius: 4,
    shadowOpacity: 0.5,
  },
  progressText: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    fontWeight: '700',
    fontFamily: Theme.fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chatContent: {
    padding: 20,
    paddingBottom: 30,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 24,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  thinkingAvatarContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bubble: {
    maxWidth: '100%',
  },
  aiBubble: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 24,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  userBubble: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 24,
    borderBottomRightRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  inputArea: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: Theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 28,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 20,
    color: Theme.colors.text,
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowRadius: 6,
    shadowOpacity: 0.3,
  },
  sendBtnDisabled: {
    opacity: 0.4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
