/**
 * Diagram Orchestrator
 * 
 * Smart decision-making for which diagram library to use
 * Based on subject, content type, and user message
 */

import { DiagramType } from '../../skills/DiagramGenerator';

export interface DiagramDecision {
  library: DiagramType;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number; // 0-100
}

export interface DiagramContext {
  subject: string;
  topic: string;
  contentType?: string;
  userMessage: string;
  complexity: number; // 0-100
  previousDiagrams?: DiagramType[];
}

class DiagramOrchestratorService {
  /**
   * Main decision function - decides which library to use
   */
  decideDiagramLibrary(context: DiagramContext): DiagramDecision {
    console.log('[DiagramOrchestrator] Analyzing context:', {
      subject: context.subject,
      topic: context.topic,
      messageLength: context.userMessage.length,
      complexity: context.complexity
    });

    // Priority order: Chemistry → Formula → Graph (Only if requested) → SVG (Default)

    // 1. Chemistry molecules → SmilesDrawer (HIGHEST PRIORITY)
    if (this.isChemistryMolecule(context)) {
      return {
        library: 'chemistry',
        reason: 'Organic chemistry molecule structure detected',
        priority: 'high',
        confidence: 95
      };
    }

    // 2. Math formulas → KaTeX (VERY HIGH PRIORITY)
    if (this.isMathFormula(context)) {
      return {
        library: 'formula',
        reason: 'Mathematical formula or equation detected',
        priority: 'high',
        confidence: 90
      };
    }

    // 3. Interactive graphs → JSXGraph (HIGH PRIORITY - only when explicitly needed)
    if (this.needsInteractiveGraph(context)) {
      return {
        library: context.subject === 'Math' ? 'geometry' : 'physics',
        reason: 'Physics trajectory or geometric graph requested',
        priority: 'high',
        confidence: 85
      };
    }

    // 4. Default: SVG Illustration (using 'biology' type which maps to SVG)
    return {
      library: 'biology',
      reason: 'General illustration - using flexible SVG for characters and labelling',
      priority: 'medium',
      confidence: 80
    };
  }

  /**
   * Check if diagram should be generated at all
   */
  shouldGenerateDiagram(message: string): boolean {
    const triggers = [
      // Explicit requests
      'show', 'diagram', 'draw', 'visualize', 'graph', 'plot', 'image',
      'dikhao', 'बनाओ', 'दिखाओ', 'samjhao',
      
      // Implicit triggers
      'formula', 'equation', 'structure', 'explain with',
      'trajectory', 'motion', 'force', 'vector', 'orbit', 'path',
      'potential', 'gravitation', 'gravity', 'field', 'satellite',
      'molecule', 'compound', 'cell', 'organ', 'anatomy',
      'character', 'label', 'element'
    ];

    const lowerMessage = message.toLowerCase();
    return triggers.some(trigger => lowerMessage.includes(trigger));
  }

  /**
   * Detect if multiple diagrams needed
   */
  detectMultipleDiagrams(context: DiagramContext): DiagramDecision[] {
    const decisions: DiagramDecision[] = [];

    // Check for formula + graph combination (common in physics)
    if (this.isMathFormula(context) && this.needsInteractiveGraph(context)) {
      decisions.push({
        library: 'formula',
        reason: 'Formula for mathematical representation',
        priority: 'high',
        confidence: 90
      });
      decisions.push({
        library: 'physics',
        reason: 'Graph for visual representation',
        priority: 'high',
        confidence: 85
      });
      return decisions;
    }

    // Single diagram
    decisions.push(this.decideDiagramLibrary(context));
    return decisions;
  }

  // ==================== Detection Methods ====================

  /**
   * Detect chemistry molecule
   */
  private isChemistryMolecule(context: DiagramContext): boolean {
    if (context.subject !== 'Chemistry') return false;

    const keywords = [
      'molecule', 'molecular', 'compound', 'structure',
      'benzene', 'alkane', 'alkene', 'alkyne',
      'organic', 'chemical structure', 'bond',
      'aspirin', 'glucose', 'ethanol', 'caffeine',
      'अणु', 'संरचना', 'यौगिक'
    ];

    const lowerMessage = context.userMessage.toLowerCase();
    return keywords.some(k => lowerMessage.includes(k));
  }

  /**
   * Detect math formula
   */
  private isMathFormula(context: DiagramContext): boolean {
    const message = context.userMessage;
    const lowerMessage = message.toLowerCase();

    // Keyword detection
    const keywords = [
      'formula', 'equation', 'expression',
      'derive', 'derivation', 'calculate',
      'सूत्र', 'समीकरण'
    ];

    if (keywords.some(k => lowerMessage.includes(k))) {
      return true;
    }

    // Pattern detection
    const patterns = [
      /=.*[+\-*/]/,           // Math operators
      /\^|\√|∫|∑|∏|∆/,        // Math symbols
      /\bsin\b|\bcos\b|\btan\b/i,  // Trig functions
      /\blog\b|\bln\b/i,      // Log functions
      /\d+\s*[+\-*/]\s*\d+/   // Numeric operations
    ];

    return patterns.some(p => p.test(message));
  }

    /**
   * Detect need for interactive graph
   */
  private needsInteractiveGraph(context: DiagramContext): boolean {
    const lowerMessage = context.userMessage.toLowerCase();

    // Only use JSXGraph for specific graph-related requests
    const graphKeywords = [
      'graph', 'plot', 'parabola', 'ellipse',
      'function', 'coordinate', 'curve', 'graph of',
      'ग्राफ'
    ];

    return graphKeywords.some(k => lowerMessage.includes(k));
  }

  /**
   * Extract concepts from message
   */
  extractConcepts(message: string): string[] {
    const concepts: string[] = [];

    // Common physics concepts
    const physicsKeywords = [
      'velocity', 'acceleration', 'force', 'energy', 'momentum',
      'gravity', 'gravitation', 'gravitational', 'friction', 'pressure', 'work', 'power',
      'orbit', 'potential', 'field', 'mass', 'weight'
    ];

    // Common chemistry concepts
    const chemistryKeywords = [
      'atom', 'molecule', 'bond', 'reaction', 'electron',
      'proton', 'neutron', 'ion', 'compound', 'element'
    ];

    // Common biology concepts
    const biologyKeywords = [
      'cell', 'nucleus', 'mitochondria', 'membrane', 'DNA',
      'protein', 'enzyme', 'tissue', 'organ', 'system'
    ];

    // Common math concepts
    const mathKeywords = [
      'angle', 'radius', 'diameter', 'tangent', 'chord',
      'area', 'perimeter', 'volume', 'slope', 'intercept'
    ];

    const allKeywords = [
      ...physicsKeywords,
      ...chemistryKeywords,
      ...biologyKeywords,
      ...mathKeywords
    ];

    const lowerMessage = message.toLowerCase();
    
    // Use word boundary matching to avoid substring false positives
    // e.g. 'ion' should NOT match inside 'gravitation'
    const matchesWord = (word: string) => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(lowerMessage);
    };
    
    for (const keyword of allKeywords) {
      if (matchesWord(keyword)) {
        concepts.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    }

    return Array.from(new Set(concepts)); // Remove duplicates
  }

  /**
   * Extract a concise topic from the message
   */
  extractTopic(message: string): string {
    const concepts = this.extractConcepts(message);
    if (concepts.length > 0) {
      return concepts.join(' and ');
    }

    // Fallback: cleaning up the message to be a short topic
    let topic = message.split(/[.?!]/)[0]; // Take first sentence
    topic = topic.replace(/create a (diagram|mind map|map) for/gi, '').trim();
    
    if (topic.length > 30) {
      topic = topic.substring(0, 27) + '...';
    }
    
    return topic || 'General';
  }

  /**
   * Get library name for display
   */
  getLibraryName(type: string): string {
    const names: Record<string, string> = {
      formula: 'KaTeX Math',
      physics: 'JSXGraph Physics',
      geometry: 'JSXGraph Geometry',
      chemistry: 'SmilesDrawer Chemistry',
      biology: 'SVG Illustration',
      flowchart: 'SVG Flowchart',
      process: 'SVG Process',
      sequence: 'SVG Sequence'
    };

    return names[type] || 'SVG Illustration';
  }
}

export const DiagramOrchestrator = new DiagramOrchestratorService();
