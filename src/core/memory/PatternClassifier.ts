/**
 * PatternClassifier — Zero-LLM semantic classifier for student conversations.
 *
 * Memoir's SemanticClassifier uses an LLM call (~100-500ms, burns tokens).
 * This on-device replacement uses pure regex + keyword matching:
 *   • <1ms per classification
 *   • 0 LLM tokens
 *   • ~70-80% accuracy (vs. ~95% for LLM, acceptable for tutoring)
 *
 * Rules are ordered by specificity — first match wins for identity fields,
 * but multiple matches are collected for progress/performance.
 *
 * @see https://github.com/zhangfengcdt/memoir — classifier/semantic.py
 */

import { TaxonomyTree } from './TaxonomyTree';

// ── Types ───────────────────────────────────────────────────────

export interface ClassificationResult {
  path: string;
  value: string;
  confidence: number;
}

interface RegexRule {
  type: 'regex';
  pattern: RegExp;
  path: string;
  /** Extract the stored value from the match. Defaults to match[1] || full match. */
  extractValue?: (match: RegExpMatchArray, fullText: string) => string;
  confidence: number;
  /** If true, only the first match per conversation turn is kept for this path */
  unique?: boolean;
}

interface KeywordRule {
  type: 'keyword';
  keywords: string[];
  path: string;
  confidence: number;
  /** Minimum keywords that must match (default 1) */
  minHits?: number;
  /** Store the original message as value? (default true) */
  storeMessage?: boolean;
}

type ClassificationRule = RegexRule | KeywordRule;

// ── Rules ───────────────────────────────────────────────────────

const RULES: ClassificationRule[] = [
  // ─── IDENTITY (regex, high specificity) ───────────────────────

  {
    type: 'regex',
    pattern: /(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    path: 'student.identity.name',
    extractValue: (m) => m[1],
    confidence: 0.95,
    unique: true,
  },
  {
    type: 'regex',
    pattern: /(?:class|grade|standard)\s*(\d{1,2}(?:th|st|nd|rd)?)/i,
    path: 'student.identity.grade',
    extractValue: (m) => m[1],
    confidence: 0.92,
    unique: true,
  },
  {
    type: 'regex',
    pattern: /(?:i (?:am|study) in|i go to|my (?:school|college|university) is)\s+(.+?)(?:\.|$)/i,
    path: 'student.identity.school',
    extractValue: (m) => m[1].trim(),
    confidence: 0.88,
    unique: true,
  },
  {
    type: 'regex',
    pattern: /(?:i am|i'm)\s+(\d{1,2})\s*(?:years?\s*old|yrs?)/i,
    path: 'student.identity.age',
    extractValue: (m) => m[1],
    confidence: 0.90,
    unique: true,
  },
  {
    type: 'regex',
    pattern: /(?:i live in|from|based in|my city is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    path: 'student.identity.location',
    extractValue: (m) => m[1].trim(),
    confidence: 0.82,
    unique: true,
  },
  {
    type: 'regex',
    pattern: /(?:undergraduate|bachelors?|b\.?tech|b\.?sc|b\.?a\.?|masters?|m\.?tech|m\.?sc|phd|doctorate)/i,
    path: 'student.identity.grade',
    extractValue: (m) => m[0],
    confidence: 0.88,
    unique: true,
  },

  // ─── GOALS (regex, specific exam mentions) ────────────────────

  {
    type: 'regex',
    pattern: /(?:preparing|prepare|study|studying|appearing|attempt)\s+(?:for\s+)?(?:the\s+)?(jee|neet|upsc|gate|cat|gre|gmat|sat|boards?|ias|ies|clat)/i,
    path: 'student.goals.exam',
    extractValue: (m) => m[1].toUpperCase(),
    confidence: 0.93,
  },
  {
    type: 'regex',
    pattern: /(?:want to (?:be(?:come)?|work as)|career (?:in|as)|dream (?:job|career))\s+(.+?)(?:\.|,|$)/i,
    path: 'student.goals.career',
    extractValue: (m) => m[1].trim(),
    confidence: 0.85,
  },

  // ─── PREFERENCES (regex) ──────────────────────────────────────

  {
    type: 'regex',
    pattern: /(?:i (?:learn|understand) (?:better|best|more) (?:with|through|by|when))\s+(.+?)(?:\.|$)/i,
    path: 'student.preferences.learning_style',
    extractValue: (m) => m[1].trim(),
    confidence: 0.80,
  },

  // ─── SUBJECT PROGRESS (keyword buckets) ───────────────────────
  // Math subtopics
  {
    type: 'keyword',
    keywords: ['quadratic', 'equation', 'linear', 'polynomial', 'factoring', 'inequality', 'variables', 'simultaneous', 'roots', 'binomial'],
    path: 'student.progress.math.algebra',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['triangle', 'circle', 'angle', 'polygon', 'congruent', 'similar', 'area', 'perimeter', 'theorem', 'coordinate geometry'],
    path: 'student.progress.math.geometry',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['derivative', 'integral', 'differentiation', 'integration', 'limit', 'continuity', 'maxima', 'minima', 'differential'],
    path: 'student.progress.math.calculus',
    confidence: 0.88,
  },
  {
    type: 'keyword',
    keywords: ['sine', 'cosine', 'tangent', 'sin', 'cos', 'tan', 'trigonometric', 'radian', 'degree', 'pythagoras'],
    path: 'student.progress.math.trigonometry',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['probability', 'statistics', 'mean', 'median', 'mode', 'standard deviation', 'variance', 'distribution', 'regression'],
    path: 'student.progress.math.statistics',
    confidence: 0.85,
  },
  // Physics subtopics
  {
    type: 'keyword',
    keywords: ['force', 'velocity', 'acceleration', 'momentum', 'newton', 'friction', 'gravity', 'projectile', 'motion', 'mass', 'weight', 'torque', 'rotational'],
    path: 'student.progress.physics.mechanics',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['heat', 'temperature', 'entropy', 'enthalpy', 'thermal', 'calorimetry', 'specific heat', 'gas law', 'carnot', 'thermodynamic'],
    path: 'student.progress.physics.thermodynamics',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['electric', 'magnetic', 'charge', 'current', 'voltage', 'resistance', 'capacitor', 'inductor', 'coulomb', 'ohm', 'faraday', 'circuit', 'electromagnetic'],
    path: 'student.progress.physics.electromagnetism',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['light', 'lens', 'mirror', 'reflection', 'refraction', 'prism', 'diffraction', 'interference', 'optical'],
    path: 'student.progress.physics.optics',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['wave', 'frequency', 'wavelength', 'amplitude', 'sound', 'oscillation', 'resonance', 'harmonic', 'doppler'],
    path: 'student.progress.physics.waves',
    confidence: 0.85,
  },
  // Chemistry subtopics
  {
    type: 'keyword',
    keywords: ['carbon', 'hydrocarbon', 'alkane', 'alkene', 'alkyne', 'benzene', 'isomer', 'functional group', 'ester', 'aldehyde', 'ketone', 'amine', 'organic compound'],
    path: 'student.progress.chemistry.organic',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['periodic table', 'element', 'metal', 'nonmetal', 'ion', 'oxidation', 'reduction', 'acid', 'base', 'salt', 'bond', 'electron configuration'],
    path: 'student.progress.chemistry.inorganic',
    confidence: 0.82,
  },
  {
    type: 'keyword',
    keywords: ['reaction rate', 'equilibrium', 'catalyst', 'mole', 'molarity', 'electrochemistry', 'kinetics', 'thermochemistry', 'ph', 'buffer'],
    path: 'student.progress.chemistry.physical',
    confidence: 0.82,
  },
  // Biology
  {
    type: 'keyword',
    keywords: ['dna', 'rna', 'gene', 'chromosome', 'allele', 'mutation', 'heredity', 'mendel', 'genetics', 'genome'],
    path: 'student.progress.biology.genetics',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['cell', 'organism', 'tissue', 'organ', 'species', 'evolution', 'photosynthesis', 'respiration', 'mitosis', 'meiosis', 'anatomy'],
    path: 'student.progress.biology',
    confidence: 0.80,
  },
  // CS
  {
    type: 'keyword',
    keywords: ['python', 'java', 'javascript', 'c++', 'code', 'program', 'function', 'variable', 'loop', 'array', 'recursion', 'class', 'object', 'coding'],
    path: 'student.progress.cs.programming',
    confidence: 0.85,
  },
  {
    type: 'keyword',
    keywords: ['linked list', 'stack', 'queue', 'tree', 'graph', 'hash', 'sorting', 'searching', 'binary search', 'big o', 'complexity', 'dynamic programming'],
    path: 'student.progress.cs.data_structures',
    confidence: 0.85,
  },
  // Broad subject fallbacks (lower confidence, matched after specifics)
  {
    type: 'keyword',
    keywords: ['math', 'mathematics', 'maths', 'arithmetic', 'number'],
    path: 'student.progress.math',
    confidence: 0.70,
  },
  {
    type: 'keyword',
    keywords: ['physics', 'physical'],
    path: 'student.progress.physics',
    confidence: 0.70,
  },
  {
    type: 'keyword',
    keywords: ['chemistry', 'chemical'],
    path: 'student.progress.chemistry',
    confidence: 0.70,
  },
  {
    type: 'keyword',
    keywords: ['biology', 'biological', 'botany', 'zoology'],
    path: 'student.progress.biology',
    confidence: 0.70,
  },
  {
    type: 'keyword',
    keywords: ['computer', 'programming', 'software', 'algorithm'],
    path: 'student.progress.cs',
    confidence: 0.70,
  },
  {
    type: 'keyword',
    keywords: ['english', 'literature', 'grammar', 'essay', 'writing', 'poem', 'poetry', 'prose'],
    path: 'student.progress.english',
    confidence: 0.75,
  },
  {
    type: 'keyword',
    keywords: ['history', 'historical', 'civilization', 'war', 'dynasty', 'empire', 'independence'],
    path: 'student.progress.history',
    confidence: 0.75,
  },
  {
    type: 'keyword',
    keywords: ['economics', 'economy', 'gdp', 'inflation', 'demand', 'supply', 'market'],
    path: 'student.progress.economics',
    confidence: 0.75,
  },

  // ─── PERFORMANCE ──────────────────────────────────────────────

  {
    type: 'keyword',
    keywords: ['difficult', 'hard', 'confused', 'stuck', 'don\'t understand', 'struggling', 'can\'t solve', 'weak in', 'bad at', 'trouble with'],
    path: 'student.performance.weaknesses',
    confidence: 0.80,
  },
  {
    type: 'keyword',
    keywords: ['good at', 'strong in', 'easy', 'love', 'enjoy', 'favorite', 'best subject', 'scored well', 'topper'],
    path: 'student.performance.strengths',
    confidence: 0.78,
  },

  // ─── LEARNING PREFERENCES ─────────────────────────────────────

  {
    type: 'keyword',
    keywords: ['example', 'examples', 'show me', 'practical', 'hands-on', 'visual', 'diagram', 'picture', 'video'],
    path: 'student.preferences.explanation_type',
    confidence: 0.72,
  },
  {
    type: 'keyword',
    keywords: ['slower', 'slow down', 'too fast', 'step by step', 'one at a time', 'simple language'],
    path: 'student.preferences.pace',
    confidence: 0.75,
  },

  // ─── SESSION (ephemeral, extracted from active conversation) ──

  {
    type: 'keyword',
    keywords: ['wrong', 'mistake', 'misconception', 'thought it was', 'isn\'t it', 'but i thought', 'wait, so'],
    path: 'session.misconceptions',
    confidence: 0.70,
  },
];

// ── Classifier ──────────────────────────────────────────────────

export class PatternClassifier {
  /**
   * Classify a user message into taxonomy paths.
   * Returns all matching classifications (may be multiple).
   *
   * @param userMessage  The raw user message
   * @param topic        Optional current topic context (improves session classification)
   * @returns            Array of { path, value, confidence }
   */
  classify(userMessage: string, topic?: string): ClassificationResult[] {
    const results: ClassificationResult[] = [];
    const seenPaths = new Set<string>();
    const lower = userMessage.toLowerCase();

    for (const rule of RULES) {
      if (rule.type === 'regex') {
        const match = userMessage.match(rule.pattern);
        if (match) {
          // Skip if unique and already matched this path
          if (rule.unique && seenPaths.has(rule.path)) continue;

          const value = rule.extractValue
            ? rule.extractValue(match, userMessage)
            : match[1] || match[0];

          results.push({ path: rule.path, value, confidence: rule.confidence });
          seenPaths.add(rule.path);
        }
      } else {
        // Keyword rule
        let hits = 0;
        for (const kw of rule.keywords) {
          if (lower.includes(kw)) hits++;
        }
        const minHits = rule.minHits ?? 1;
        if (hits >= minHits && !seenPaths.has(rule.path)) {
          // Boost confidence by hit ratio (more keywords matched = more confident)
          const boost = Math.min(hits / 3, 0.15);
          const finalConf = Math.min(rule.confidence + boost, 1.0);

          const value = rule.storeMessage === false
            ? rule.keywords.filter(kw => lower.includes(kw)).join(', ')
            : this.truncate(userMessage, 120);

          results.push({ path: rule.path, value, confidence: finalConf });
          seenPaths.add(rule.path);
        }
      }
    }

    // If a topic is provided and no progress path was matched, add session context
    if (topic && !results.some(r => r.path.startsWith('student.progress.'))) {
      const topicPath = this.topicToPath(topic);
      if (topicPath) {
        results.push({
          path: 'session.current_topic',
          value: topic,
          confidence: 0.60,
        });
      }
    }

    return results;
  }

  /**
   * Convert a topic name (from MentorChat) to a taxonomy path.
   * e.g. "Newton's Laws" → "student.progress.physics.mechanics"
   */
  topicToPath(topic: string): string | null {
    const lower = topic.toLowerCase();
    // Try classifying the topic name itself
    const results = this.classify(topic);
    const progressResult = results.find(r => r.path.startsWith('student.progress.'));
    if (progressResult) return progressResult.path;

    // Fallback: try direct subject matching
    const subjectMap: Record<string, string> = {
      'math': 'student.progress.math',
      'mathematics': 'student.progress.math',
      'physics': 'student.progress.physics',
      'chemistry': 'student.progress.chemistry',
      'biology': 'student.progress.biology',
      'computer': 'student.progress.cs',
      'english': 'student.progress.english',
      'history': 'student.progress.history',
      'economics': 'student.progress.economics',
    };

    for (const [key, path] of Object.entries(subjectMap)) {
      if (lower.includes(key)) return path;
    }

    return 'student.progress.general';
  }

  /**
   * Convert old SemanticMemory categories to taxonomy paths.
   * Backward compatibility bridge.
   */
  legacyCategoryToPath(category: string, key: string): string {
    const map: Record<string, string> = {
      'personal': 'student.identity',
      'academic': 'student.progress.general',
      'goals': 'student.goals',
      'struggles': 'student.performance.weaknesses',
      'preferences': 'student.preferences',
    };
    const basePath = map[category] || 'student.progress.general';

    // Refine based on key
    if (key === 'name') return 'student.identity.name';
    if (key === 'level') return 'student.identity.grade';
    if (key === 'subject') return 'student.progress.general';
    if (key === 'exam_prep') return 'student.goals.exam';

    return basePath;
  }

  /** Truncate a value for compact storage. */
  private truncate(val: string, maxLen: number): string {
    if (val.length <= maxLen) return val;
    return val.substring(0, maxLen).trim() + '…';
  }
}

/** Singleton instance for use across the app. */
export const Classifier = new PatternClassifier();
