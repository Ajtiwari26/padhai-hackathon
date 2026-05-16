import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme/theme';
import { ArrowLeft, MoreVertical, MessageCircle, Bot, Camera, PenTool, ArrowUp } from 'lucide-react-native';

interface Props {
  navigation?: any;
  topic?: string;
  initialDoubt?: string;
}

export const DoubtSession: React.FC<Props> = ({ 
  navigation, 
  topic = "Physics",
  initialDoubt = ""
}) => {
  const [messages, setMessages] = useState([
    { id: '1', role: 'ai', text: `Hi! I'm here to help clear your doubts on ${topic}. What's confusing you?` }
  ]);
  const [inputText, setInputText] = useState(initialDoubt);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    // Add user message
    const newMsgs = [...messages, { id: Date.now().toString(), role: 'user', text: inputText.trim() }];
    setMessages(newMsgs);
    setInputText('');
    
    // Mock AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'ai', 
        text: "That's a great question. Let's break it down step-by-step. First, consider..." 
      }]);
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={24} color={Theme.colors.primaryLight} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MessageCircle size={20} color={Theme.colors.text} />
          <Text style={styles.headerTitle}>Doubt Clearing</Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <MoreVertical size={24} color={Theme.colors.primaryLight} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scroll} 
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View 
              key={msg.id} 
              style={[
                styles.messageBubble, 
                msg.role === 'user' ? styles.userBubble : styles.aiBubble
              ]}
            >
              {msg.role === 'ai' && (
                <View style={styles.aiAvatar}>
                  <Bot size={18} color={Theme.colors.primaryLight} />
                </View>
              )}
              <View style={[styles.messageContent, msg.role === 'user' ? styles.userContent : styles.aiContent]}>
                <Text style={[styles.messageText, msg.role === 'user' && styles.userMessageText]}>
                  {msg.text}
                </Text>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={styles.inputArea}>
          <View style={styles.attachmentRow}>
            <TouchableOpacity style={styles.attachOption}>
              <Camera size={16} color={Theme.colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.attachText}>Upload Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption}>
              <PenTool size={16} color={Theme.colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.attachText}>Draw</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Type your doubt here..."
              placeholderTextColor={Theme.colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              <ArrowUp size={24} color="#FFF" />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
    backgroundColor: 'rgba(11, 19, 38, 0.9)',
  },
  iconButton: { padding: 8 },
  iconText: { color: Theme.colors.primaryLight, fontSize: 24 },
  headerTitle: { color: Theme.colors.text, fontSize: 18, fontWeight: '700' },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  messageContent: {
    padding: 16,
    borderRadius: 20,
  },
  aiContent: {
    backgroundColor: Theme.colors.surfaceHigh,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  userContent: {
    backgroundColor: Theme.colors.primary,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: Theme.colors.text,
    lineHeight: 24,
  },
  userMessageText: {
    color: '#ffffff',
  },
  inputArea: {
    padding: 16,
    backgroundColor: 'rgba(11, 19, 38, 0.9)',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
  },
  attachmentRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  attachIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  attachText: {
    color: Theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    color: Theme.colors.text,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Theme.colors.surfaceHigh,
  },
  sendIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
});
