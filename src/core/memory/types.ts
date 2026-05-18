/**
 * Shared memory types
 */

export interface MemoryFact {
  category: 'personal' | 'academic' | 'goals' | 'struggles' | 'preferences';
  key: string;
  value: string;
  confidence: number;
  timestamp: number;
}
