import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { TestQuestion } from '../../core/storage/TestStore';
import { ModelManager } from '../../core/api/ModelManager';
import { ArrowLeft } from 'lucide-react-native';

export const QuestionDoubtSolver: React.FC<{ route: any, navigation: any }> = ({ route, navigation }) => {
  const { question, topic } = route.params as { question: TestQuestion, topic: string };
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Initial prompt
    const initialMsg = `I got this question wrong: \n\n"${question.problem}"\n\nI answered "${question.studentAnswer}", but the correct answer is "${question.correctAnswer}".\n\nCan you explain how to solve this?`;
    handleSend(initialMsg, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (text: string, isInitial = false) => {
    if (!text.trim() && !isInitial) return;
    
    if (!isInitial) {
      setMessages(prev => [...prev, { role: 'user', content: text }]);
    }
    
    setInputText('');
    setIsTyping(true);

    try {
      const history: any = isInitial ? [] : messages.map(m => ({ role: m.role, content: m.content }));
      
      const systemPrompt = `You are a helpful and expert mentor.
The student is reviewing a test question they got wrong.
Topic: ${topic}
Question: ${question.problem}
Correct Answer: ${question.correctAnswer}
Student's Answer: ${question.studentAnswer}

RULES:
1. Explain WHICH CONCEPT is required to solve this.
2. Provide a step-by-step solution.
3. If applicable, remind them if they learned this in class.
4. DO NOT give a wall of text. Keep it readable.`;

      let fullResponse = '';
      
      const payload: any[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: isInitial ? `Can you explain how to solve this question?` : text }
      ];

      await ModelManager.streamChat(
        payload,
        (token: string) => {
          fullResponse += token;
          // Could update state here if we wanted streaming
        },
        undefined,
        'foreground',
        undefined,
        512,
        false
      );

      setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my brain. Please make sure the engine is running." }]);
    } finally {
      setIsTyping(false);
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Doubt Solver</Text>
        <View style={{width: 50}} />
      </View>

      <View style={styles.qContext}>
        <Text style={styles.qContextLabel}>Question Context:</Text>
        <Text style={styles.qContextText} numberOfLines={2}>{question.problem}</Text>
      </View>

      <ScrollView 
        style={styles.chatArea}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.botBubble]}>
            <Text style={[styles.msgText, msg.role === 'user' ? styles.userMsgText : styles.botMsgText]}>
              {msg.content}
            </Text>
          </View>
        ))}
        {isTyping && (
          <View style={[styles.bubble, styles.botBubble, styles.typingBubble]}>
            <ActivityIndicator size="small" color={Theme.colors.primary} />
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a follow-up question..."
            placeholderTextColor={Theme.colors.textSecondary}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
            onPress={() => handleSend(inputText)}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendTxt}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: Theme.colors.border },
  backBtn: { padding: 5 },
  backTxt: { color: Theme.colors.primary, fontSize: 16 },
  title: { color: Theme.colors.text, fontSize: 18, fontWeight: 'bold' },
  qContext: { padding: 15, backgroundColor: Theme.colors.surface, borderBottomWidth: 1, borderBottomColor: Theme.colors.border },
  qContextLabel: { color: Theme.colors.textMuted, fontSize: 12, marginBottom: 5 },
  qContextText: { color: Theme.colors.text, fontSize: 14 },
  chatArea: { flex: 1, padding: 15 },
  bubble: { maxWidth: '80%', padding: 15, borderRadius: 15, marginBottom: 15 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Theme.colors.primary, borderBottomRightRadius: 5 },
  botBubble: { alignSelf: 'flex-start', backgroundColor: Theme.colors.surface, borderBottomLeftRadius: 5 },
  typingBubble: { paddingVertical: 10, paddingHorizontal: 20 },
  msgText: { fontSize: 16, lineHeight: 24 },
  userMsgText: { color: '#fff' },
  botMsgText: { color: Theme.colors.text },
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: Theme.colors.border, backgroundColor: Theme.colors.background, alignItems: 'center' },
  input: { flex: 1, backgroundColor: Theme.colors.surface, borderRadius: 20, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, color: Theme.colors.text, maxHeight: 100 },
  sendBtn: { marginLeft: 10, backgroundColor: Theme.colors.primary, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20 },
  sendTxt: { color: '#fff', fontWeight: 'bold' }
});
