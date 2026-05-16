// Student Profile — persisted via AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EducationLevel = 'junior' | 'senior' | 'undergraduate' | 'masters' | 'competitive' | 'advanced';

export interface StudentProfile {
  id: string;
  name: string;
  educationLevel: EducationLevel;
  academicGoal: string;             // e.g., "Pass JEE", "Learn Quantum Physics", "Job Interview"
  subjects: string[];             // ["Physics", "Mathematics", "Chemistry"]
  
  // --- Deep Profiling Fields ---
  
  // Academic Baseline
  academicBaseline?: {
    major?: string;
    priorKnowledgeLevel: Record<string, 'weak' | 'moderate' | 'expert'>;
    knownTopics: string[];
    strugglePoints: string[];
  };

  // Student Archetype
  archetype?: {
    proficiency: 'weak' | 'moderate' | 'strong';
    focusType: 'conceptual' | 'application' | 'mixed';
    learningDepth: 'breadth-sweeper' | 'deep-diver';
    motivation: 'career' | 'academic' | 'curiosity';
  };

  // Cognitive Profile
  cognitiveProfile?: {
    modality: 'visual' | 'numerical' | 'theory' | 'practical';
    logicStyle: 'first-principles' | 'analogical' | 'procedural';
    inquiryMethod: 'socratic' | 'direct' | 'collaborative';
  };

  // Engagement Preferences
  engagement?: {
    tone: 'humored' | 'strict' | 'supportive';
    pacing: 'fast' | 'moderate' | 'steady';
    feedbackStyle: 'instant' | 'summary' | 'strict';
  };

  strengths: string[];            
  weaknesses: string[];           
  learningStyle: 'visual' | 'theory' | 'numerical' | 'practical' | 'mixed';
  interests: string[];            
  targetExam?: string;            
  examDate?: string;              
  careerVision: string;           
  dailyHours: number;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

const PROFILE_KEY = '@padhai_student_profile';

const DEFAULT_PROFILE: StudentProfile = {
  id: '',
  name: '',
  educationLevel: 'senior',
  academicGoal: '',
  subjects: [],
  strengths: [],
  weaknesses: [],
  learningStyle: 'mixed',
  interests: [],
  careerVision: '',
  dailyHours: 2,
  onboardingComplete: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export class StudentProfileStore {
  private static cache: StudentProfile | null = null;

  static async get(): Promise<StudentProfile> {
    if (this.cache) return this.cache;
    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      if (!raw) return { ...DEFAULT_PROFILE };
      this.cache = { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
      return this.cache!;
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }

  static async save(profile: Partial<StudentProfile>): Promise<void> {
    const current = await this.get();
    const updated = { ...current, ...profile, updatedAt: new Date().toISOString() };
    this.cache = updated;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  }

  static async isOnboarded(): Promise<boolean> {
    const profile = await this.get();
    return profile.onboardingComplete;
  }

  static async clear(): Promise<void> {
    this.cache = null;
    await AsyncStorage.removeItem(PROFILE_KEY);
  }
}
