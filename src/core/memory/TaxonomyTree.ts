/**
 * TaxonomyTree — Predefined semantic path hierarchy for student knowledge.
 *
 * Inspired by memoir's SemanticTaxonomy but hardcoded for on-device use.
 * No LLM expansion needed — education domains are well-defined.
 *
 * Paths follow dot-notation:  student.progress.physics.mechanics
 *   Level 1: domain   (student, session)
 *   Level 2: category (identity, progress, preferences, goals, performance)
 *   Level 3: subject  (math, physics, chemistry, ...)
 *   Level 4: topic    (algebra, mechanics, organic, ...)
 *
 * @see https://github.com/zhangfengcdt/memoir — taxonomy/semantic.py
 */

/** All valid taxonomy paths. A Set for O(1) validation. */
const PATHS = new Set<string>([
  // ── IDENTITY ──────────────────────────────────────────────────
  'student.identity',
  'student.identity.name',
  'student.identity.grade',
  'student.identity.school',
  'student.identity.language',
  'student.identity.age',
  'student.identity.location',

  // ── PROGRESS (per-subject, per-topic) ─────────────────────────
  // Mathematics
  'student.progress.math',
  'student.progress.math.algebra',
  'student.progress.math.geometry',
  'student.progress.math.calculus',
  'student.progress.math.statistics',
  'student.progress.math.trigonometry',
  'student.progress.math.number_theory',

  // Physics
  'student.progress.physics',
  'student.progress.physics.mechanics',
  'student.progress.physics.thermodynamics',
  'student.progress.physics.electromagnetism',
  'student.progress.physics.optics',
  'student.progress.physics.waves',
  'student.progress.physics.modern_physics',

  // Chemistry
  'student.progress.chemistry',
  'student.progress.chemistry.organic',
  'student.progress.chemistry.inorganic',
  'student.progress.chemistry.physical',

  // Biology
  'student.progress.biology',
  'student.progress.biology.botany',
  'student.progress.biology.zoology',
  'student.progress.biology.genetics',
  'student.progress.biology.ecology',

  // Computer Science
  'student.progress.cs',
  'student.progress.cs.programming',
  'student.progress.cs.data_structures',
  'student.progress.cs.algorithms',
  'student.progress.cs.web',
  'student.progress.cs.ml',

  // Humanities & Social Sciences
  'student.progress.english',
  'student.progress.history',
  'student.progress.economics',
  'student.progress.geography',

  // General catch-all for subjects not explicitly listed
  'student.progress.general',

  // ── PREFERENCES ───────────────────────────────────────────────
  'student.preferences',
  'student.preferences.learning_style',
  'student.preferences.pace',
  'student.preferences.difficulty',
  'student.preferences.explanation_type',

  // ── GOALS ─────────────────────────────────────────────────────
  'student.goals',
  'student.goals.exam',
  'student.goals.career',
  'student.goals.short_term',
  'student.goals.long_term',

  // ── PERFORMANCE ───────────────────────────────────────────────
  'student.performance',
  'student.performance.strengths',
  'student.performance.weaknesses',
  'student.performance.test_scores',
  'student.performance.confidence',

  // ── SESSION (ephemeral, per-conversation) ─────────────────────
  'session',
  'session.current_topic',
  'session.current_subject',
  'session.understanding_level',
  'session.formulas_discussed',
  'session.misconceptions',
]);

/**
 * Metadata per taxonomy node.
 * Used by the classifier and store for weighting / display.
 */
export interface TaxonomyNodeMeta {
  description: string;
  /** Maximum memories to keep before condensing */
  maxEntries: number;
  /** Whether this node is ephemeral (cleared on session end) */
  ephemeral: boolean;
}

const NODE_META: Record<string, TaxonomyNodeMeta> = {
  'student.identity':              { description: 'Who the student is',                   maxEntries: 10, ephemeral: false },
  'student.identity.name':         { description: 'Student full name',                    maxEntries: 1,  ephemeral: false },
  'student.identity.grade':        { description: 'Class / year / academic level',        maxEntries: 1,  ephemeral: false },
  'student.identity.school':       { description: 'School or institution name',           maxEntries: 1,  ephemeral: false },
  'student.identity.language':     { description: 'Preferred language',                   maxEntries: 1,  ephemeral: false },
  'student.identity.age':          { description: 'Student age',                          maxEntries: 1,  ephemeral: false },
  'student.identity.location':     { description: 'City / region',                        maxEntries: 1,  ephemeral: false },
  'student.progress.math':         { description: 'Mathematics progress overall',         maxEntries: 10, ephemeral: false },
  'student.progress.physics':      { description: 'Physics progress overall',             maxEntries: 10, ephemeral: false },
  'student.progress.chemistry':    { description: 'Chemistry progress overall',           maxEntries: 10, ephemeral: false },
  'student.progress.biology':      { description: 'Biology progress overall',             maxEntries: 10, ephemeral: false },
  'student.progress.cs':           { description: 'Computer Science progress',            maxEntries: 10, ephemeral: false },
  'student.preferences':           { description: 'How the student likes to learn',       maxEntries: 5,  ephemeral: false },
  'student.goals':                 { description: 'What the student wants to achieve',    maxEntries: 5,  ephemeral: false },
  'student.goals.exam':            { description: 'Specific exam targets (JEE, NEET…)',   maxEntries: 3,  ephemeral: false },
  'student.performance':           { description: 'Student strengths & weaknesses',       maxEntries: 10, ephemeral: false },
  'student.performance.strengths': { description: 'Topics the student excels at',         maxEntries: 10, ephemeral: false },
  'student.performance.weaknesses':{ description: 'Topics the student struggles with',    maxEntries: 10, ephemeral: false },
  'session':                       { description: 'Current conversation state',           maxEntries: 20, ephemeral: true },
  'session.current_topic':         { description: 'Active topic being discussed',         maxEntries: 1,  ephemeral: true },
  'session.misconceptions':        { description: 'Misunderstandings identified',         maxEntries: 5,  ephemeral: true },
};

export class TaxonomyTree {
  // ── Validation ────────────────────────────────────────────────

  /** O(1) check whether a path exists in the taxonomy. */
  static isValidPath(path: string): boolean {
    return PATHS.has(path);
  }

  /**
   * Find the closest valid ancestor path for an unknown path.
   * e.g. "student.progress.physics.quantum_field_theory"
   *   → "student.progress.physics" (closest match)
   */
  static getClosestPath(path: string): string | null {
    if (PATHS.has(path)) return path;
    const parts = path.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parent = parts.join('.');
      if (PATHS.has(parent)) return parent;
    }
    return null;
  }

  // ── Traversal ─────────────────────────────────────────────────

  /** Get all paths that start with the given prefix. */
  static getByPrefix(prefix: string): string[] {
    const dot = prefix + '.';
    const results: string[] = [];
    for (const p of PATHS) {
      if (p === prefix || p.startsWith(dot)) {
        results.push(p);
      }
    }
    return results;
  }

  /** Get immediate children of a path. */
  static getChildren(path: string): string[] {
    const depth = path.split('.').length + 1;
    const dot = path + '.';
    const children: string[] = [];
    for (const p of PATHS) {
      if (p.startsWith(dot) && p.split('.').length === depth) {
        children.push(p);
      }
    }
    return children;
  }

  /** Get all top-level domains (student, session). */
  static getRoots(): string[] {
    const roots = new Set<string>();
    for (const p of PATHS) {
      roots.add(p.split('.')[0]);
    }
    return Array.from(roots);
  }

  /** Get total number of taxonomy paths. */
  static size(): number {
    return PATHS.size;
  }

  // ── Metadata ──────────────────────────────────────────────────

  /** Get node metadata. Falls back to nearest ancestor metadata. */
  static getMeta(path: string): TaxonomyNodeMeta {
    if (NODE_META[path]) return NODE_META[path];
    // Walk up the tree for inherited metadata
    const parts = path.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parent = parts.join('.');
      if (NODE_META[parent]) return NODE_META[parent];
    }
    // Default
    return { description: path, maxEntries: 10, ephemeral: false };
  }

  /** Whether a path (or its ancestor) is ephemeral. */
  static isEphemeral(path: string): boolean {
    return this.getMeta(path).ephemeral;
  }

  // ── All paths (for debugging / export) ────────────────────────

  /** Return a sorted list of every taxonomy path. */
  static allPaths(): string[] {
    return Array.from(PATHS).sort();
  }

  // ── Dynamic path registration ─────────────────────────────────

  /**
   * Register a new path at runtime.
   * Used when the classifier encounters a subject not in the predefined set.
   * The path must have a valid parent.
   */
  static registerPath(path: string): boolean {
    if (PATHS.has(path)) return false; // already exists
    const parent = path.split('.').slice(0, -1).join('.');
    if (!parent || !PATHS.has(parent)) return false; // invalid parent
    PATHS.add(path);
    return true;
  }
}
