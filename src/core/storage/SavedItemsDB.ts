// Saved Items — bookmarks for questions, drawings, formulas, analogies, notes
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedItemType = 'question' | 'drawing' | 'note' | 'formula' | 'analogy' | 'chapter_important';

export interface SavedItem {
  id: string;
  type: SavedItemType;
  title: string;
  content: string;          // The actual content (text, drawing JSON, etc.)
  chapterId?: string;
  subjectId?: string;
  tags: string[];
  createdAt: string;
  isPinned: boolean;
}

const SAVED_KEY = '@padhai_saved_items';

export class SavedItemsDB {
  static async getAll(): Promise<SavedItem[]> {
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static async getByType(type: SavedItemType): Promise<SavedItem[]> {
    const all = await this.getAll();
    return all.filter(i => i.type === type);
  }

  static async getByChapter(chapterId: string): Promise<SavedItem[]> {
    const all = await this.getAll();
    return all.filter(i => i.chapterId === chapterId);
  }

  static async save(item: SavedItem): Promise<void> {
    const all = await this.getAll();
    const index = all.findIndex(i => i.id === item.id);
    if (index >= 0) {
      all[index] = item;
    } else {
      all.push(item);
    }
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(all));
  }

  static async remove(id: string): Promise<void> {
    const all = await this.getAll();
    const filtered = all.filter(i => i.id !== id);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(filtered));
  }

  static async togglePin(id: string): Promise<void> {
    const all = await this.getAll();
    const item = all.find(i => i.id === id);
    if (item) {
      item.isPinned = !item.isPinned;
      await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(all));
    }
  }
}
