import { StudentProfile, EducationLevel } from '../storage/StudentProfile';
import { MemoryFact } from '../memory/SemanticMemory';

export type ProfilingPhase = 
  | 'identity' 
  | 'education' 
  | 'academicBaseline'
  | 'studentArchetype'
  | 'cognitiveStyle'
  | 'inquiryMethod'
  | 'engagementTone'
  | 'metaInfo'
  | 'complete';

export interface ProfilerState {
  currentPhase: ProfilingPhase;
  data: Partial<StudentProfile>;
  facts: MemoryFact[];
}

const PHASES: ProfilingPhase[] = [
  'identity',
  'education',
  'academicBaseline',
  'studentArchetype',
  'cognitiveStyle',
  'inquiryMethod',
  'engagementTone',
  'metaInfo',
  'complete'
];

export class StudentProfiler {
  private state: ProfilerState;

  constructor(initialState?: ProfilerState) {
    this.state = initialState || {
      currentPhase: 'identity',
      data: {},
      facts: []
    };
  }

  public getState(): ProfilerState {
    return this.state;
  }

  public getProgress(): number {
    const index = PHASES.indexOf(this.state.currentPhase);
    return Math.max(0, index);
  }

  public getTotalPhases(): number {
    return PHASES.length - 1; // Exclude 'complete'
  }

  /**
   * Generates a turn-specific system prompt based on current profiling phase.
   */
  public getSystemPrompt(): string {
    const { currentPhase, data } = this.state;
    
    let taskHint = "";
    switch (currentPhase) {
      case 'identity': 
        taskHint = "EXTRACT IDENTITY: Welcome the student and demand their full name to initialize the profile."; 
        break;
      case 'education': 
        taskHint = `EXTRACT ACADEMIC ARENA: You have the name. Now, identify their current battlefield. Ask specifically: 'Are you in school, university, or the professional world?' and follow up by asking for their major or primary focus.`; 
        break;
      case 'academicBaseline': 
        taskHint = "EXTRACT MASTERY: What is the specific exam or subject you are conquering? What concepts do you already own, and where is your foundation crumbling (struggle points)?"; 
        break;
      case 'studentArchetype': 
        taskHint = "EXTRACT ARCHETYPE: Determine if they seek deep conceptual 'why' (Thinker) or rapid 'how-to' (Builder). Ask which one they identify with."; 
        break;
      case 'cognitiveStyle': 
        taskHint = "EXTRACT COGNITIVE MODALITY: Do you think in high-fidelity visual diagrams or the raw logic of mathematical derivations? Demand a choice."; 
        break;
      case 'inquiryMethod': 
        taskHint = "EXTRACT PROTOCOL: Choose your mode: The Socratic Method (I challenge you with questions) or Direct Mode (I deliver high-density knowledge). Which protocol shall we initiate?"; 
        break;
      case 'engagementTone': 
        taskHint = "EXTRACT ATMOSPHERE: Do you thrive under a strict, intense regime or a supportive, humored coaching style? Set the tone now."; 
        break;
      case 'metaInfo': 
        taskHint = "EXTRACT VISION: What is the single highest-stakes vision driving you? How many hours of absolute deep work can you commit daily? No fluff, just numbers and vision."; 
        break;
      default: 
        taskHint = "Finalize the profile and prepare for launch.";
    }

    const contextStr = JSON.stringify(data, null, 2);

    return `You are the Padh.ai "Elite Cognitive Architect & Information Extractor". Your absolute priority is to build a high-performance Student Profile.
You are NOT a friendly assistant; you are a high-status mentor who needs specific data points to initialize the learning engine.

CURRENT STUDENT DATA (EXTRACTED SO FAR):
${contextStr}

YOUR MISSION THIS TURN:
1. ${taskHint}
2. BE AN EXTROVERTED EXTRACTOR: Show intense passion for their potential, but NEVER drift into "How can I help you?" or open-ended fluff.
3. DEMAND PRECISION: If they are vague, call it out professionally. You need to know exactly who you are coaching.
4. PROACTIVE QUESTIONING: Your response must always end with a DEFINITIVE question related to the CURRENT PHASE.
5. SMART INFERENCE: If they already mentioned something in a previous turn (check DATA), skip that question and move to the next phase.

RULES:
- NEVER ask "How can I help you?" or "What would you like to do?".
- PERSONALITY: High-status, visionary, intense, and data-driven.
- TONE: Magnetic, professional, and uncompromising on quality.
- OUTPUT: 3-4 high-impact sentences followed by exactly ONE definitive question.
- DATA MISSION: You are here to extract, not to chat.
`;
  }

  /**
   * Processes user input and updates the internal state.
   * Uses "Smart Extraction" to potentially skip phases.
   */
  public processResponse(userMessage: string, _aiResponse: string): ProfilingPhase {
    const lowerInput = userMessage.toLowerCase();
    const newData: Partial<StudentProfile> = { ...this.state.data };
    const newFacts: MemoryFact[] = [...this.state.facts];

    // --- Smart Extraction Logic ---
    
    // 1. Identity
    if (!newData.name) {
      const nameMatch = userMessage.match(/(?:my name is|i am|i'm|call me|this is)\s+([a-z\s]+)/i);
      const potentialName = nameMatch ? nameMatch[1].trim() : userMessage.trim();
      if (potentialName && potentialName.length > 1 && potentialName.length < 50) {
        newData.name = potentialName;
        this.addFact(newFacts, 'personal', 'name', potentialName);
      }
    }

    // 2. Education Level
    if (!newData.educationLevel) {
      const level = this.parseEducationLevel(lowerInput);
      if (level) {
        newData.educationLevel = level;
        this.addFact(newFacts, 'academic', 'level', level);
      }
    }

    // 3. Academic Baseline
    if (!newData.academicBaseline) {
      newData.academicBaseline = {
        priorKnowledgeLevel: {},
        knownTopics: [],
        strugglePoints: []
      };
    }
    
    if (lowerInput.includes('know') || lowerInput.includes('study') || lowerInput.includes('expert') || lowerInput.includes('master')) {
      const topics = this.extractList(userMessage);
      if (topics.length > 0) {
        newData.academicBaseline.knownTopics = [...new Set([...(newData.academicBaseline.knownTopics || []), ...topics])];
        topics.forEach(t => this.addFact(newFacts, 'academic', 'known_topic', t));
      }
    }

    // 4. Student Archetype
    if (!newData.archetype) {
      newData.archetype = {
        proficiency: 'moderate',
        focusType: 'mixed',
        learningDepth: 'breadth-sweeper',
        motivation: 'academic'
      };
    }
    
    if (lowerInput.includes('why') || lowerInput.includes('prepping') || lowerInput.includes('interview') || lowerInput.includes('job')) {
        newData.archetype.motivation = 'career';
        this.addFact(newFacts, 'goals', 'motivation', 'career');
    }

    if (lowerInput.includes('how it works') || lowerInput.includes('conceptual') || lowerInput.includes('theory')) {
        newData.archetype.focusType = 'conceptual';
    } else if (lowerInput.includes('build') || lowerInput.includes('practical') || lowerInput.includes('application')) {
        newData.archetype.focusType = 'application';
    }

    // 5. Cognitive Profile
    if (!newData.cognitiveProfile) {
        newData.cognitiveProfile = {
            modality: 'theory',
            logicStyle: 'procedural',
            inquiryMethod: 'direct'
        };
    }

    if (lowerInput.includes('diagram') || lowerInput.includes('visual') || lowerInput.includes('see')) {
        newData.cognitiveProfile.modality = 'visual';
        newData.learningStyle = 'visual';
    } else if (lowerInput.includes('problem') || lowerInput.includes('math') || lowerInput.includes('number')) {
        newData.cognitiveProfile.modality = 'numerical';
        newData.learningStyle = 'numerical';
    }

    // 6. Inquiry Method (Socratic vs Direct)
    if (lowerInput.includes('question') || lowerInput.includes('guide') || lowerInput.includes('ask me')) {
        newData.cognitiveProfile.inquiryMethod = 'socratic';
    }

    // 7. Engagement Tone
    if (!newData.engagement) {
        newData.engagement = {
            tone: 'supportive',
            pacing: 'moderate',
            feedbackStyle: 'summary'
        };
    }

    if (lowerInput.includes('funny') || lowerInput.includes('joke') || lowerInput.includes('humor') || lowerInput.includes('lol')) {
        newData.engagement.tone = 'humored';
    } else if (lowerInput.includes('strict') || lowerInput.includes('serious') || lowerInput.includes('focused')) {
        newData.engagement.tone = 'strict';
    }

    // 8. Meta Info (Time, Vision)
    if (!newData.dailyHours && (lowerInput.includes('hour') || lowerInput.includes('time'))) {
      const hourMatch = userMessage.match(/(\d+)\s*hour/i);
      if (hourMatch) {
        const hours = parseInt(hourMatch[1], 10);
        newData.dailyHours = hours;
        this.addFact(newFacts, 'preferences', 'daily_hours', hours.toString());
      }
    }

    if (!newData.careerVision && (lowerInput.includes('become') || lowerInput.includes('dream') || lowerInput.includes('vision'))) {
        newData.careerVision = userMessage;
    }

    // --- Phase Advancement ---
    this.state.data = newData;
    this.state.facts = newFacts;
    
    this.advancePhase();
    return this.state.currentPhase;
  }

  private advancePhase() {
    const currentIdx = PHASES.indexOf(this.state.currentPhase);
    if (currentIdx >= PHASES.length - 1) return;

    // Check if we can skip the next phase because we already have the data
    let nextIdx = currentIdx + 1;
    while (nextIdx < PHASES.length - 1) {
      const nextPhase = PHASES[nextIdx];
      if (this.hasDataForPhase(nextPhase)) {
        nextIdx++;
      } else {
        break;
      }
    }
    
    this.state.currentPhase = PHASES[nextIdx];
  }

  private hasDataForPhase(phase: ProfilingPhase): boolean {
    const { data } = this.state;
    switch (phase) {
      case 'identity': return !!data.name;
      case 'education': return !!data.educationLevel;
      case 'academicBaseline': return !!(data.academicBaseline?.knownTopics && data.academicBaseline.knownTopics.length > 0);
      case 'studentArchetype': return data.archetype?.focusType !== 'mixed';
      case 'cognitiveStyle': return !!data.cognitiveProfile?.modality && data.cognitiveProfile.modality !== 'theory';
      case 'inquiryMethod': return data.cognitiveProfile?.inquiryMethod !== 'direct';
      case 'engagementTone': return data.engagement?.tone !== 'supportive';
      case 'metaInfo': return !!data.dailyHours;
      default: return false;
    }
  }

  private addFact(facts: MemoryFact[], category: MemoryFact['category'], key: string, value: string) {
    facts.push({
      category,
      key,
      value,
      confidence: 1.0,
      timestamp: Date.now()
    });
  }

  private parseEducationLevel(input: string): EducationLevel | null {
    if (input.includes('junior') || input.includes('middle school') || input.includes('9th') || input.includes('8th')) return 'junior';
    if (input.includes('senior') || input.includes('high school') || input.includes('10th') || input.includes('11th') || input.includes('12th')) return 'senior';
    if (input.includes('undergrad') || input.includes('bachelor') || input.includes('college') || input.includes('university')) return 'undergraduate';
    if (input.includes('master') || input.includes('graduate school') || input.includes('phd')) return 'masters';
    if (input.includes('competitive') || input.includes('aspirant') || input.includes('upsc') || input.includes('jee') || input.includes('neet')) return 'competitive';
    if (input.includes('advanced') || input.includes('professional') || input.includes('expert')) return 'advanced';
    return null;
  }

  private parseLearningStyle(input: string): StudentProfile['learningStyle'] | null {
    if (input.includes('visual') || input.includes('diagram') || input.includes('picture')) return 'visual';
    if (input.includes('numerical') || input.includes('problem') || input.includes('math')) return 'numerical';
    if (input.includes('theory') || input.includes('read') || input.includes('concept')) return 'theory';
    if (input.includes('practical') || input.includes('hands-on') || input.includes('experiment')) return 'practical';
    return null;
  }

  private extractList(input: string): string[] {
    return input
      .split(/[,;&]|\band\b/i)
      .map(s => s.trim())
      .filter(s => s.length > 1 && !/^(i|my|the|a|an|studying|learning)$/i.test(s));
  }
}
