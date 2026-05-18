import { ModelManager } from '../api/ModelManager';
import { EventBus } from '../bus/EventBus';
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
  taxonomyPath?: string; // Hierarchical path for memory storage
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
      // Use retry logic for resilience (will try up to 3 times with increasing timeouts)
      const response = await this.generateWithRetry(
        prompt, priority, 1024, 3, false
      );
      const curriculum = this.parseOutline(response, { subject: goal, level, goal, difficulty: level.toLowerCase() });
      curriculum.status = 'draft';
      curriculum.isOutlineOnly = true;
      return curriculum;
    } catch (e) {
      console.error('[SyllabusGen] Goal-based generation failed after retries:', e);
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
   * Wrapper with retry logic for resilient generation.
   * Retries with exponential backoff on timeout/crash.
   */
  private async generateWithRetry(
    prompt: string,
    priority: 'foreground' | 'background',
    maxTokens: number,
    maxRetries: number = 2,
    caveman: boolean = false
  ): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Increase timeout with each retry: 60s, 120s, 180s
        const timeout = 60000 * (attempt + 1);
        console.log(`[SyllabusGen] Attempt ${attempt + 1}/${maxRetries} (timeout: ${timeout}ms)`);
        
        return await this.generateWithTimeout(prompt, priority, maxTokens, timeout, caveman);
      } catch (e) {
        lastError = e as Error;
        const errorMsg = lastError.message || String(e);
        
        console.warn(`[SyllabusGen] Attempt ${attempt + 1} failed:`, errorMsg);
        
        // Don't retry on abort (user cancelled)
        if (errorMsg.toLowerCase().includes('abort')) {
          throw lastError;
        }
        
        // Wait before retry (exponential backoff: 2s, 4s)
        if (attempt < maxRetries - 1) {
          const waitMs = 2000 * (attempt + 1);
          console.log(`[SyllabusGen] Waiting ${waitMs}ms before retry...`);
          await new Promise<void>(resolve => setTimeout(() => resolve(), waitMs));
        }
      }
    }
    
    throw lastError || new Error('Generation failed after all retries');
  }



  /**
   * Phase 2: Enrich a single chapter with subtopics and concepts (Chunked)
   */
  async generateChapterDetail(chapter: Chapter, subjectContext: string, priority: 'foreground' | 'background' = 'foreground'): Promise<Chapter> {
    console.log(`[SyllabusGen] Enriching chapter: ${chapter.name}`);
    
    let currentChapter = { ...chapter };

    // Step 1: Generate Outline if missing
    if (!currentChapter.subtopics || currentChapter.subtopics.length === 0) {
      console.log(`[SyllabusGen] Generating outline for chapter: ${chapter.name}`);
      const prompt = this.buildChapterOutlinePrompt(currentChapter, subjectContext);
      const useCaveman = priority === 'background';
      
      try {
        const response = await this.generateWithRetry(prompt, priority, 512, 2, useCaveman);
        const parsed = this.extractJson(response);
        
        if (parsed.subtopics && Array.isArray(parsed.subtopics)) {
          currentChapter.subtopics = parsed.subtopics.map((st: any) => ({
            name: st.name || 'Concepts',
            concepts: [],
            estimatedHours: 0,
            difficulty: 0,
            dependencies: []
          }));
          
          // Save state after outline generation
          await this.updateChapter(currentChapter);
          console.log(`[SyllabusGen] Outline generated and saved for ${chapter.name}. ${currentChapter.subtopics.length} subtopics found.`);
          
          // Emit event for outline completion
          EventBus.emit('chapter:enriched', { chapterId: currentChapter.id, phase: 'outline' });
        } else {
          throw new Error('Failed to generate chapter outline: Invalid response format');
        }
      } catch (e) {
        console.error(`[SyllabusGen] Failed to generate outline for ${chapter.name}:`, e);
        throw e;
      }
    }

    // Step 2: Generate Details for each subtopic that lacks concepts
    const incompleteSubtopics = currentChapter.subtopics.filter(st => !st.concepts || st.concepts.length === 0);
    
    if (incompleteSubtopics.length > 0) {
      console.log(`[SyllabusGen] Generating details for ${incompleteSubtopics.length} incomplete subtopics in ${chapter.name}`);
      
      for (const subtopic of incompleteSubtopics) {
        console.log(`[SyllabusGen] Generating details for subtopic: ${subtopic.name}`);
        const prompt = this.buildSubtopicDetailsPrompt(currentChapter, subtopic.name, subjectContext);
        const useCaveman = priority === 'background';
        
        try {
          const response = await this.generateWithRetry(prompt, priority, 512, 2, useCaveman);
          const parsedDetails = this.extractJson(response);
          
          // Update the specific subtopic in currentChapter
          const index = currentChapter.subtopics.findIndex(st => st.name === subtopic.name);
          if (index > -1) {
            currentChapter.subtopics[index] = {
              ...currentChapter.subtopics[index],
              concepts: parsedDetails.concepts || [],
              estimatedHours: parsedDetails.estimatedHours || 2,
              difficulty: parsedDetails.difficulty || chapter.difficulty,
              dependencies: parsedDetails.dependencies || []
            };
            
            // Save state after each subtopic to support resuming
            await this.updateChapter(currentChapter);
            console.log(`[SyllabusGen] Saved details for subtopic: ${subtopic.name}`);
            
            // Emit event for partial update
            EventBus.emit('chapter:enriched', { chapterId: currentChapter.id, phase: 'subtopic', subtopic: subtopic.name });
          }
        } catch (e) {
          console.error(`[SyllabusGen] Failed to generate details for subtopic ${subtopic.name}:`, e);
          // Re-throw to let ResourcePlanner handle retries or failure
          throw e;
        }
      }
    }

    // Emit event for full completion
    EventBus.emit('chapter:enriched', { chapterId: currentChapter.id, phase: 'complete' });

    return currentChapter;
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
   * Build prompt for chapter outline (subtopic names only)
   */
  private buildChapterOutlinePrompt(chapter: Chapter, subjectContext: string): string {
    return `You are an expert curriculum designer. Generate a high-level outline of subtopic names for the following chapter.
Do NOT generate concepts or details. Just the list of subtopic names.

CONTEXT: ${subjectContext}
CHAPTER: ${chapter.name}
DESCRIPTION: ${chapter.description}

IMPORTANT:
- The subtopics must be strictly appropriate for the level specified in CONTEXT (e.g., Class 11 CBSE Commerce).
- Do NOT generate advanced topics suitable for higher education like BBA or MBA.
- Keep the scope aligned with high school level understanding.

FORMAT AS JSON:
{
  "subtopics": [
    {
      "name": "Subtopic Name"
    }
  ]
}

RESPOND ONLY WITH THE JSON, NO OTHER TEXT.`;
  }

  /**
   * Build prompt for a specific subtopic's details
   */
  private buildSubtopicDetailsPrompt(chapter: Chapter, subtopicName: string, subjectContext: string): string {
    return `You are an expert curriculum designer. Provide the detailed concepts and metadata for the following subtopic within its chapter context.

CONTEXT: ${subjectContext}
CHAPTER: ${chapter.name}
SUBTOPIC: ${subtopicName}

IMPORTANT:
- The concepts must be strictly appropriate for the level specified in CONTEXT (e.g., Class 11 CBSE Commerce).
- Do NOT generate concepts or details suitable for higher education like BBA or MBA.
- Keep the scope aligned with high school level understanding.

Provide:
1. List 2-4 key concepts to cover
2. Estimate hours (typically 1-3)
3. Set difficulty (around ${chapter.difficulty})
4. List dependencies (names of other subtopics in this chapter that should be learned first)

FORMAT AS JSON:
{
  "concepts": ["Concept 1", "Concept 2", "Concept 3"],
  "estimatedHours": 2,
  "difficulty": ${chapter.difficulty},
  "dependencies": []
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
      
      // 3. Clean up common AI artifacts and fix malformed JSON
      let cleaned = jsonStr
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
        .replace(/\[\s*\{\s*\{/g, '[{') // Fix [{{ to [{
        .replace(/\}\s*\}\s*\]/g, '}]') // Fix }}] to }]
        .replace(/"\s*"([^":])/g, '", "$1') // Fix missing commas between strings
        .replace(/(\w+)"\s*"(\w+)/g, '$1", "$2') // Fix missing commas in arrays
        .replace(/"\s*,\s*,/g, '",') // Fix double commas
        .replace(/,\s*,/g, ',') // Fix double commas
        .trim();
      
      // Fix missing commas between object properties (common AI error)
      // Pattern: "value"<newline>"key": matches missing comma
      cleaned = cleaned.replace(/("\s*)\n\s*"/g, '$1,\n"');
      // Pattern: ]<newline>"key": matches missing comma after array
      cleaned = cleaned.replace(/(\])\s*\n\s*"/g, '$1,\n"');
      // Pattern: }<newline>"key": matches missing comma after object
      cleaned = cleaned.replace(/(\})\s*\n\s*"/g, '$1,\n"');
      
      // Fix missing quotes around strings in arrays
      // Pattern: ["text",unquoted text] -> ["text","unquoted text"]
      cleaned = cleaned.replace(/,\s*([A-Z][a-zA-Z\s&]+)(?=\]|,)/g, ',"$1"');
      // Pattern: ["text"unquoted] -> ["text","unquoted"]  
      cleaned = cleaned.replace(/"\s*([A-Z][a-zA-Z\s&]+)(?=\]|,)/g, '","$1"');
      
      // Fix missing quotes in property values
      // Pattern: "key":unquoted -> "key":"unquoted"
      cleaned = cleaned.replace(/:\s*([A-Z][a-zA-Z\s&]+)(?=,|\})/g, ':"$1"');
      
      // Fix missing quote before colon: Hours":3 -> Hours": 3
      cleaned = cleaned.replace(/([a-zA-Z])"\s*:/g, '$1":');
      
      // Fix truncated strings in arrays: ["text"] -> ["text"]
      cleaned = cleaned.replace(/\["([^"]*)"?\]/g, (match, content) => {
        // If content doesn't end with quote, add it
        if (!match.endsWith('"]')) {
          return `["${content}"]`;
        }
        return match;
      });
      
      // Fix missing commas in arrays: "text""text2" -> "text","text2"
      cleaned = cleaned.replace(/"([^"]*)"([^,\]}])"([^"]*)"/, '"$1","$3"');
      
      // Fix missing quotes around property names: estimatedHours":3 -> "estimatedHours":3
      cleaned = cleaned.replace(/([,{]\s*)([a-zA-Z]+)("?\s*:)/g, '$1"$2"$3');

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
        taxonomyPath: `student.progress.${(parsed.subject || summary.subject).toLowerCase().replace(/\s+/g, '_')}.${(ch.name || `Chapter ${index + 1}`).toLowerCase().replace(/\s+/g, '_')}`,
      })),
      totalHours,
      createdAt: Date.now(),
      generatedBy: 'ai',
      status: 'active',
    };
  }

  // Removed parseChapterDetail as parsing is now done inline in generateChapterDetail

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
    let retries = 3;
    while (retries > 0) {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          console.log('[SyllabusGen] Found existing curriculum with id:', parsed.id);
          return parsed;
        }
        console.log('[SyllabusGen] No existing curriculum found in storage.');
        return null;
      } catch (e: any) {
        console.warn(`[SyllabusGen] Failed to load curriculum (attempt ${4 - retries}/3):`, e);
        if (retries > 1) {
          await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
          retries--;
          continue;
        }
      }
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
      
      // Check if all chapters are now fully enriched (have subtopics and all subtopics have concepts)
      const allEnriched = curriculum.chapters.every(c => 
        c.subtopics && 
        c.subtopics.length > 0 && 
        c.subtopics.every(st => st.concepts && st.concepts.length > 0)
      );
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
