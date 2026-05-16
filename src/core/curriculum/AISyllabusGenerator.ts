import { ModelManager } from '../api/ModelManager';
import { MemoryFact } from '../memory/SemanticMemory';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Subtopic {
  name: string;
  concepts: string[];
  estimatedHours: number;
  difficulty: number; // 0-100
  dependencies?: string[]; // Names or IDs of subtopics required before this
}

export interface Chapter {
  id: string;
  name: string;
  order: number;
  estimatedHours: number;
  difficulty: number;
  subtopics: Subtopic[];
  description: string;
  dependencies?: string[]; // IDs of chapters required before this
  isEnriched?: boolean;
  status?: 'locked' | 'in_progress' | 'completed';
}

export interface GenerationProgress {
  total: number;
  completed: number;
  percent: number;
}

export interface Curriculum {
  id: string;
  subject: string;
  level: string;
  goal: string;
  difficultyTarget: number;
  chapters: Chapter[];
  totalHours: number;
  createdAt: number;
  generatedBy: 'ai' | 'uploaded' | 'manual';
  status: 'draft' | 'active'; // Added status to track draft vs finalized
  isOutlineOnly?: boolean; 
}

const STORAGE_KEY = '@padhai_curriculum';

class AISyllabusGeneratorService {
  /**
   * Phase 1: Generate high-level outline from a specific user goal
   */
  async generateFromGoal(goal: string, level: string = 'Intermediate', priority: 'foreground' | 'background' = 'foreground'): Promise<Curriculum> {
    console.log(`[SyllabusGen] Generating curriculum for goal: ${goal} (${level})`);

    const prompt = this.buildGoalPrompt(goal, level);
    
    try {
      // Cap output at 1024 tokens to prevent native engine SIGSEGV on long generation
      // Increased timeout to 120s for syllabus generation (heavy local LLM task)
      const response = await this.generateWithTimeout(
        prompt, priority, 1024, 120000 
      );
      const curriculum = this.parseOutline(response, { subject: goal, level, goal, difficulty: level.toLowerCase() });
      curriculum.status = 'draft';
      curriculum.isOutlineOnly = true;
      return curriculum;
    } catch (e) {
      console.error('[SyllabusGen] Goal-based generation failed:', e);
      throw e;
    }
  }

  /**
   * Wrapper with timeout to recover from native engine crashes/hangs.
   */
  private async generateWithTimeout(
    prompt: string,
    priority: 'foreground' | 'background',
    maxTokens: number,
    timeoutMs: number,
    caveman: boolean = false
  ): Promise<string> {
    const controller = new AbortController();
    let timeoutId: any;
    
    const timeoutPromise = new Promise<string>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Generation timed out — the AI engine may have crashed. Please try again.'));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([
        ModelManager.generate(prompt, priority, undefined, maxTokens, true, controller.signal, caveman),
        timeoutPromise
      ]);
      return result;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Phase 1 (Legacy/Automatic): Generate outline from semantic facts
   */
  async generateOutline(semanticFacts: MemoryFact[], priority: 'foreground' | 'background' = 'foreground'): Promise<Curriculum> {
    console.log('[SyllabusGen] ----------------------------------------');
    console.log('[SyllabusGen] Generating outline from', semanticFacts.length, 'facts');

    const summary = this.extractSummary(semanticFacts);
    console.log('[SyllabusGen] Extracted summary:', summary);

    const prompt = this.buildOutlinePrompt(summary);
    
    try {
      // Increased timeout to 120s for complex outlines
      const response = await this.generateWithTimeout(prompt, priority, 1024, 120000);
      const curriculum = this.parseOutline(response, summary);
      curriculum.status = 'active';
      curriculum.isOutlineOnly = true;
      await this.saveCurriculum(curriculum);
      return curriculum;
    } catch (e) {
      console.error('[SyllabusGen] Outline generation failed:', e);
      throw e;
    }
  }

  /**
   * Phase 2: Enrich a single chapter with subtopics and concepts
   */
  async generateChapterDetail(chapter: Chapter, subjectContext: string, priority: 'foreground' | 'background' = 'foreground'): Promise<Chapter> {
    console.log(`[SyllabusGen] Enriching chapter: ${chapter.name}`);
    
    // If it already has subtopics, don't regenerate
    if (chapter.subtopics && chapter.subtopics.length > 0) {
      return chapter;
    }

    const prompt = this.buildChapterPrompt(chapter, subjectContext);
    
    try {
      // Increased timeout to 90s for chapter enrichment
      // Enable Caveman mode for background enrichment to save battery and reduce latency
      const useCaveman = priority === 'background';
      const response = await this.generateWithTimeout(prompt, priority, 768, 90000, useCaveman);
      const enrichedChapter = this.parseChapterDetail(response, chapter);
      return enrichedChapter;
    } catch (e: any) {
      console.error(`[SyllabusGen] Failed to enrich chapter ${chapter.name}:`, e);
      
      const errorMsg = e.message || String(e);
      const isAbort = e.name === 'AbortError' || errorMsg.toLowerCase().includes('aborted');
      const isTimeout = errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('timed out');

      // Re-throw if it's a transient error that ResourcePlanner should retry
      if (isAbort || isTimeout) {
        throw e;
      }
      
      return chapter;
    }
  }

  /**
   * Check progress of generation
   */
  getGenerationProgress(curriculum: Curriculum | null): GenerationProgress {
    if (!curriculum || !curriculum.chapters || curriculum.chapters.length === 0) {
      return { total: 0, completed: 0, percent: 0 };
    }

    const total = curriculum.chapters.length;
    // Check length > 0, because we now supply fallbacks
    const completed = curriculum.chapters.filter(ch => ch.subtopics && ch.subtopics.length > 0).length;
    
    return {
      total,
      completed,
      percent: Math.round((completed / total) * 100)
    };
  }

  /**
   * Extract summary from semantic facts
   */
  public extractSummary(facts: MemoryFact[]): {
    subject: string;
    level: string;
    goal: string;
    focus: string[];
    difficulty: string;
  } {
    const subjectFact = facts.find(f => f.key === 'subject');
    const levelFact = facts.find(f => f.key === 'level');
    const goalFacts = facts.filter(f => f.category === 'goals');
    
    // Dynamically extract focus areas from fact values — no hardcoded subjects
    const focusAreas: string[] = [];
    const focusKeywords = new Set<string>();
    facts.forEach(f => {
      if (f.key === 'focus' || f.key === 'struggle' || f.key === 'interest') {
        const words = f.value.split(/[,;]+/).map(w => w.trim()).filter(w => w.length > 2);
        words.forEach(w => focusKeywords.add(w));
      }
    });
    focusKeywords.forEach(k => focusAreas.push(k));

    // Determine difficulty target from all fact text
    let difficulty = 'intermediate';
    const allText = facts.map(f => f.value.toLowerCase()).join(' ');
    if (allText.includes('olympiad') || allText.includes('master') || allText.includes('advanced') || allText.includes('expert')) {
      difficulty = 'advanced';
    } else if (allText.includes('competitive') || allText.includes('exam') || allText.includes('intermediate')) {
      difficulty = 'intermediate';
    } else if (allText.includes('basic') || allText.includes('beginner') || allText.includes('primary')) {
      difficulty = 'basic';
    }

    return {
      subject: subjectFact?.value || 'General Learning',
      level: levelFact?.value || 'Academic Study',
      goal: goalFacts.map(f => f.value).join(', ') || 'Skill Mastery',
      focus: focusAreas,
      difficulty,
    };
  }

  /**
   * Build prompt for curriculum outline from a specific goal
   */
  private buildGoalPrompt(goal: string, level: string): string {
    return `You are a professional curriculum architect. Your task is to design a high-quality, hierarchical learning path for a student.

GOAL: ${goal}
LEVEL: ${level}

STRICT INSTRUCTIONS:
1. Divide the course into exactly 4-6 sequential chapters.
2. Order chapters from fundamental concepts to advanced applications.
3. For each chapter, provide a clear name, estimated hours (3-15), and difficulty (0-100).
4. Provide a brief, 1-sentence description (max 15 words) for each chapter.
5. Identify dependencies: list the IDs (chapter_1, chapter_2, etc.) of chapters that MUST be completed before starting this one.
6. Respond with ONLY the JSON object. Do not include any introductory or concluding text.

JSON STRUCTURE:
{
  "subject": "${goal}",
  "chapters": [
    {
      "id": "chapter_1",
      "name": "Chapter Title",
      "order": 1,
      "estimatedHours": 5,
      "difficulty": 40,
      "description": "Short overview of this chapter.",
      "dependencies": []
    }
  ]
}`;
  }

  /**
   * Build prompt for curriculum outline (Phase 1)
   */
  private buildOutlinePrompt(summary: any): string {
    return `You are an expert curriculum designer. Create a high-level course outline.

STUDENT PROFILE:
- Subject: ${summary.subject}
- Level: ${summary.level}
- Goal: ${summary.goal}
- Focus Areas: ${summary.focus.length > 0 ? summary.focus.join(', ') : 'Complete syllabus'}
- Difficulty Target: ${summary.difficulty}

CREATE A CHAPTER OUTLINE with:
1. All chapters in logical learning order
2. Estimated learning hours per chapter
3. Difficulty level (0-100)
4. Brief 1-sentence description
5. Semantic dependencies: list IDs of prerequisite chapters.

IMPORTANT:
- Cover the COMPLETE syllabus for ${summary.level} ${summary.subject}
- Order from fundamentals to advanced
- Match difficulty to target (basic=30-50, intermediate=50-70, advanced=70-90)

FORMAT AS JSON:
{
  "subject": "${summary.subject}",
  "level": "${summary.level}",
  "chapters": [
    {
      "id": "ch_1",
      "name": "Chapter Name",
      "order": 1,
      "estimatedHours": 10,
      "difficulty": 60,
      "description": "Brief description",
      "dependencies": []
    }
  ]
}

RESPOND ONLY WITH THE JSON, NO OTHER TEXT.`;
  }

  /**
   * Build prompt for chapter detail (Phase 2)
   */
  private buildChapterPrompt(chapter: Chapter, subjectContext: string): string {
    return `You are an expert curriculum designer. Break down the following chapter into subtopics and concepts.

CONTEXT: ${subjectContext}
CHAPTER: ${chapter.name}
DESCRIPTION: ${chapter.description}
DIFFICULTY: ${chapter.difficulty}
TOTAL HOURS: ${chapter.estimatedHours}

BREAK IT DOWN INTO SUBTOPICS. For each subtopic:
1. Provide a name
2. List 2-4 key concepts to cover
3. Estimate hours (should sum up to ~${chapter.estimatedHours} total)
4. Set difficulty (around ${chapter.difficulty})
5. List dependencies (names of subtopics in this chapter that should be learned first)

FORMAT AS JSON:
{
  "subtopics": [
    {
      "name": "Subtopic Name",
      "concepts": ["Concept 1", "Concept 2", "Concept 3"],
      "estimatedHours": 3,
      "difficulty": ${chapter.difficulty},
      "dependencies": []
    }
  ]
}

RESPOND ONLY WITH THE JSON, NO OTHER TEXT.`;
  }

  /**
   * Extract JSON from a potentially noisy AI response string
   */
  private extractJson(text: string): any {
    try {
      // 1. Try to find a code block first
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      let targetText = codeBlockMatch ? codeBlockMatch[1] : text;

      // 2. Find the first '{' or '[' and last matching brace/bracket
      const startBrace = targetText.indexOf('{');
      const startBracket = targetText.indexOf('[');
      
      let startIndex = -1;
      let endChar = '';
      
      if (startBrace !== -1 && (startBracket === -1 || startBrace < startBracket)) {
        startIndex = startBrace;
        endChar = '}';
      } else if (startBracket !== -1) {
        startIndex = startBracket;
        endChar = ']';
      }

      if (startIndex === -1) {
        // Fallback: try regex for the first object
        const firstObjectMatch = targetText.match(/\{[\s\S]*\}/);
        if (firstObjectMatch) {
          targetText = firstObjectMatch[0];
          startIndex = 0;
          endChar = '}';
        } else {
          throw new Error('No JSON structure ( { or [ ) found in response');
        }
      }

      const endIndex = targetText.lastIndexOf(endChar);
      if (endIndex === -1 || endIndex < startIndex) {
        throw new Error(`No matching ${endChar} found in response`);
      }

      const jsonStr = targetText.substring(startIndex, endIndex + 1);
      
      // 3. Clean up common AI artifacts
      const cleaned = jsonStr
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/,\s*([\}\]])/g, '$1') // Remove trailing commas
        .trim();

      try {
        return JSON.parse(cleaned);
      } catch (parseError) {
        console.error('[SyllabusGen] JSON.parse failed on cleaned string:', cleaned);
        throw parseError;
      }
    } catch (e) {
      console.error('[SyllabusGen] JSON Extraction failed:', e);
      // Log as warn/info to ensure it's visible in user's console
      console.warn('[SyllabusGen] Raw text was:', text);
      throw new Error('Invalid JSON format in AI response');
    }
  }

  /**
   * Parse curriculum outline from AI response
   */
  private parseOutline(response: string, summary: any): Curriculum {
    const parsed = this.extractJson(response);
    
    if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
      throw new Error('Parsed response missing chapters array');
    }

    // Calculate total hours
    const totalHours = parsed.chapters.reduce(
      (sum: number, ch: any) => sum + (ch.estimatedHours || 0),
      0
    );

    // Determine difficulty target
    let difficultyTarget = 60;
    if (summary.difficulty === 'basic') difficultyTarget = 40;
    if (summary.difficulty === 'intermediate') difficultyTarget = 60;
    if (summary.difficulty === 'advanced') difficultyTarget = 80;

    return {
      id: `curriculum_${Date.now()}`,
      subject: parsed.subject || summary.subject,
      level: parsed.level || summary.level,
      goal: summary.goal,
      difficultyTarget,
      chapters: parsed.chapters.map((ch: any, index: number) => ({
        id: ch.id || `chapter_${Date.now()}_${index}`,
        name: ch.name || `Chapter ${index + 1}`,
        order: ch.order || index + 1,
        estimatedHours: ch.estimatedHours || 10,
        difficulty: ch.difficulty || difficultyTarget,
        description: ch.description || '',
        dependencies: ch.dependencies || [],
        subtopics: [], // Empty initially
      })),
      totalHours,
      createdAt: Date.now(),
      generatedBy: 'ai',
      status: 'active',
    };
  }

  /**
   * Parse chapter detail from AI response
   */
  private parseChapterDetail(response: string, chapter: Chapter): Chapter {
    const parsed = this.extractJson(response);
    
    return {
      ...chapter,
      subtopics: (parsed.subtopics || []).map((st: any) => ({
        name: st.name || 'Concepts',
        concepts: st.concepts || [],
        estimatedHours: st.estimatedHours || 2,
        difficulty: st.difficulty || chapter.difficulty,
        dependencies: st.dependencies || [],
      }))
    };
  }

  // No fallback curriculum — all content is AI-generated or manually created.

  /**
   * Save curriculum to storage
   */
  async saveCurriculum(curriculum: Curriculum): Promise<void> {
    try {
      console.log('[SyllabusGen] Saving curriculum to AsyncStorage...');
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(curriculum));
      console.log('[SyllabusGen] Curriculum successfully saved to local storage.');
    } catch (e) {
      console.error('[SyllabusGen] Failed to save curriculum to local storage:', e);
    }
  }

  /**
   * Load curriculum from storage
   */
  async loadCurriculum(): Promise<Curriculum | null> {
    console.log('[SyllabusGen] Loading curriculum from AsyncStorage...');
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        console.log('[SyllabusGen] Found existing curriculum with id:', parsed.id);
        return parsed;
      }
      console.log('[SyllabusGen] No existing curriculum found in storage.');
    } catch (e) {
      console.error('[SyllabusGen] Failed to load curriculum from storage:', e);
    }
    return null;
  }

  /**
   * Update a specific chapter in the stored curriculum
   */
  async updateChapter(chapter: Chapter): Promise<void> {
    const curriculum = await this.loadCurriculum();
    if (!curriculum) return;

    const index = curriculum.chapters.findIndex(c => c.id === chapter.id);
    if (index > -1) {
      curriculum.chapters[index] = chapter;
      
      // Check if all chapters are now enriched
      const allEnriched = curriculum.chapters.every(c => c.subtopics && c.subtopics.length > 0);
      if (allEnriched) {
        curriculum.isOutlineOnly = false;
      }
      
      await this.saveCurriculum(curriculum);
    }
  }

  /**
   * Blast Radius Analysis: Find all chapters/topics that depend on the given chapter
   */
  getImpactedTopics(curriculum: Curriculum, chapterId: string): string[] {
    const impacted: string[] = [];
    const queue = [chapterId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Find all chapters that have this one as a dependency
      const directDependents = curriculum.chapters.filter(ch => 
        ch.dependencies && ch.dependencies.includes(currentId)
      );

      directDependents.forEach(ch => {
        if (!visited.has(ch.id)) {
          impacted.push(ch.name);
          queue.push(ch.id);
        }
      });
    }

    return impacted;
  }
}

export const AISyllabusGenerator = new AISyllabusGeneratorService();
