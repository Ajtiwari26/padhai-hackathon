import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  skillUsed?: string;
  isStreaming?: boolean;
  timestamp: number;
  type?: 'text' | 'mcq' | 'numerical';
  mcqOptions?: { label: string; text: string; isCorrect?: boolean }[];
  diagrams?: any[]; // Using any[] to avoid circular dependency with DiagramGenerator, serialization will handle it
}

const STORAGE_KEY_PREFIX = '@padhai_chat_';

export class ChatStore {
  /**
   * Save messages for a specific topic/session
   */
  static async saveMessages(topicId: string, messages: ChatMessage[]): Promise<void> {
    try {
      // Filter out streaming messages before saving
      const finalizedMessages = messages.filter(m => !m.isStreaming);
      await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${topicId}`, JSON.stringify(finalizedMessages));
    } catch (e) {
      console.error('[ChatStore] Failed to save messages:', e);
    }
  }

  /**
   * Load messages for a specific topic/session
   */
  static async loadMessages(topicId: string): Promise<ChatMessage[]> {
    try {
      const raw = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${topicId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[ChatStore] Failed to load messages:', e);
    }
    return [];
  }

  /**
   * Clear messages for a specific topic
   */
  static async clearMessages(topicId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${STORAGE_KEY_PREFIX}${topicId}`);
      await AsyncStorage.removeItem(`${STORAGE_KEY_PREFIX}${topicId}_summary`);
    } catch (e) {
      console.error('[ChatStore] Failed to clear messages:', e);
    }
  }

  /**
   * Save a session summary (cheatsheet) for a topic
   */
  static async saveSessionSummary(topicId: string, summary: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${topicId}_summary`, summary);
    } catch (e) {
      console.error('[ChatStore] Failed to save session summary:', e);
    }
  }

  /**
   * Load the session summary (cheatsheet) for a topic
   */
  static async getSessionSummary(topicId: string): Promise<string> {
    try {
      const raw = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${topicId}_summary`);
      return raw || '';
    } catch (e) {
      console.error('[ChatStore] Failed to load session summary:', e);
      return '';
    }
  }

  /**
   * Extract notes for a specific chapter
   * For Phase 5: Gathers summaries from all subtopics under a chapter
   */
  static async getChapterNotes(chapterName: string, subtopics: string[]): Promise<string> {
    try {
      let combinedNotes = '';
      for (const subtopic of subtopics) {
        // We assume topicId used in chat was either the subtopic name or chapter_subtopic
        // In MentorChat, topic is often passed as chapterName, but let's check subtopic summaries if they exist
        const subtopicSummary = await this.getSessionSummary(subtopic);
        if (subtopicSummary) {
          combinedNotes += `### ${subtopic}\n${subtopicSummary}\n\n`;
        }
      }
      
      // Also check if there's a chapter-level summary
      const chapterSummary = await this.getSessionSummary(chapterName);
      if (chapterSummary) {
         combinedNotes += `### General Notes\n${chapterSummary}\n\n`;
      }

      return combinedNotes.trim() || 'No notes generated yet. Start learning to build your digest!';
    } catch (e) {
      console.error('[ChatStore] Failed to get chapter notes:', e);
      return 'Error loading notes.';
    }
  }
}
