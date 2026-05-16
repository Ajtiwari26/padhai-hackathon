/**
 * Diagram Decision Engine
 * 
 * Determines if a diagram is truly needed for a document/question
 * Uses AI to evaluate if content is self-explanatory or needs visual aid
 */

import { ModelManager } from '../api/ModelManager';
import { DiagramOrchestrator, DiagramContext } from './DiagramOrchestrator';
import { DiagramType } from '../../skills/DiagramGenerator';

export interface DiagramNeedAssessment {
  needsDiagram: boolean;
  confidence: number; // 0-100
  reason: string;
  suggestedType?: DiagramType; // 'formula' | 'physics' | 'geometry' | 'chemistry' | 'biology'
  libraryReason?: string; // Why this library was chosen
}

class DiagramDecisionEngineService {
  /**
   * Evaluate if content needs a diagram and which library to use
   */
  async evaluateNeed(
    content: string,
    contentType: 'syllabus' | 'subtopic' | 'mcq' | 'numerical' | 'test' | 'dpp' | 'summary',
    subject: string
  ): Promise<DiagramNeedAssessment> {
    // Quick heuristic checks first (no AI needed)
    const quickCheck = this.quickHeuristicCheck(content, contentType, subject);
    if (quickCheck.confidence > 80) {
      return quickCheck;
    }

    // Use AI for complex decision
    return await this.aiEvaluation(content, contentType, subject);
  }

  /**
   * Decide which diagram library to use (integrates with DiagramOrchestrator)
   */
  decideLibrary(content: string, subject: string, topic: string): {
    library: DiagramType;
    reason: string;
    confidence: number;
  } {
    // Use DiagramOrchestrator's decision logic
    const context: DiagramContext = {
      subject,
      topic,
      userMessage: content,
      complexity: this.estimateComplexity(content)
    };

    const decision = DiagramOrchestrator.decideDiagramLibrary(context);
    
    return {
      library: decision.library,
      reason: decision.reason,
      confidence: decision.confidence
    };
  }

  /**
   * Estimate content complexity (0-100)
   */
  private estimateComplexity(content: string): number {
    let complexity = 30; // Base complexity

    // Length factor
    if (content.length > 500) complexity += 20;
    else if (content.length > 200) complexity += 10;

    // Math symbols
    if (/[∫∑∏√^°±≈≠≤≥]/.test(content)) complexity += 15;

    // Multiple equations
    const equationCount = (content.match(/=/g) || []).length;
    complexity += Math.min(equationCount * 5, 20);

    // Technical terms
    const technicalTerms = [
      'derivative', 'integral', 'vector', 'matrix', 'tensor',
      'molecule', 'compound', 'reaction', 'orbital',
      'force', 'momentum', 'energy', 'potential', 'kinetic'
    ];
    const termCount = technicalTerms.filter(term => 
      content.toLowerCase().includes(term)
    ).length;
    complexity += Math.min(termCount * 5, 15);

    return Math.min(complexity, 100);
  }

  /**
   * Quick heuristic checks (no AI needed)
   */
  private quickHeuristicCheck(
    content: string,
    contentType: string,
    subject: string
  ): DiagramNeedAssessment {
    const lowerContent = content.toLowerCase();

    // 1. Explicit diagram requests
    if (lowerContent.includes('diagram') || lowerContent.includes('figure') || lowerContent.includes('graph')) {
      const libraryDecision = this.decideLibrary(content, subject, 'Explicit Request');
      return {
        needsDiagram: true,
        confidence: 95,
        reason: 'Explicit diagram reference in content',
        suggestedType: libraryDecision.library,
        libraryReason: libraryDecision.reason
      };
    }

    // 2. Chemistry molecules - ALWAYS need diagrams (SmilesDrawer)
    if (subject === 'Chemistry' && this.hasChemicalStructure(content)) {
      const libraryDecision = this.decideLibrary(content, subject, 'Chemistry Molecule');
      return {
        needsDiagram: true,
        confidence: 100,
        reason: 'Chemical structure requires molecular diagram',
        suggestedType: libraryDecision.library,
        libraryReason: libraryDecision.reason
      };
    }

    // 3. Math formulas - check complexity (KaTeX)
    if (this.hasComplexFormula(content)) {
      const libraryDecision = this.decideLibrary(content, subject, 'Mathematical Formula');
      return {
        needsDiagram: true,
        confidence: 90,
        reason: 'Complex mathematical formula benefits from visual representation',
        suggestedType: libraryDecision.library,
        libraryReason: libraryDecision.reason
      };
    }

    // 4. Physics trajectories/motion (JSXGraph)
    if (subject === 'Physics' && this.hasMotionConcept(content)) {
      const libraryDecision = this.decideLibrary(content, subject, 'Physics Motion');
      return {
        needsDiagram: true,
        confidence: 85,
        reason: 'Motion/trajectory concepts need visual representation',
        suggestedType: libraryDecision.library,
        libraryReason: libraryDecision.reason
      };
    }

    // 5. Geometry problems - ALWAYS need diagrams (JSXGraph)
    if (subject === 'Math' && this.hasGeometryConcept(content)) {
      const libraryDecision = this.decideLibrary(content, subject, 'Geometry');
      return {
        needsDiagram: true,
        confidence: 95,
        reason: 'Geometry problems require visual diagrams',
        suggestedType: libraryDecision.library,
        libraryReason: libraryDecision.reason
      };
    }

    // 6. Biology anatomy/structures (SVG)
    if (subject === 'Biology' && this.hasAnatomyConcept(content)) {
      const libraryDecision = this.decideLibrary(content, subject, 'Biology Structure');
      return {
        needsDiagram: true,
        confidence: 80,
        reason: 'Biological structures benefit from labeled diagrams',
        suggestedType: libraryDecision.library,
        libraryReason: libraryDecision.reason
      };
    }

    // 7. Simple text-based content - NO diagram needed
    if (contentType === 'summary' || this.isTextOnly(content)) {
      return {
        needsDiagram: false,
        confidence: 85,
        reason: 'Content is self-explanatory text'
      };
    }

    // 8. Short MCQs without spatial concepts - NO diagram needed
    if (contentType === 'mcq' && content.length < 200 && !this.hasSpatialConcept(content)) {
      return {
        needsDiagram: false,
        confidence: 75,
        reason: 'Simple MCQ without spatial concepts'
      };
    }

    // Uncertain - need AI evaluation
    return {
      needsDiagram: false,
      confidence: 50,
      reason: 'Uncertain - needs AI evaluation'
    };
  }

  /**
   * AI-based evaluation for complex cases
   */
  private async aiEvaluation(
    content: string,
    contentType: string,
    subject: string
  ): Promise<DiagramNeedAssessment> {
    const prompt = `You are a diagram necessity evaluator. Analyze if the following ${contentType} content needs a visual diagram.

Subject: ${subject}
Content Type: ${contentType}
Content: ${content}

Respond in this exact format:
NEEDS_DIAGRAM: yes/no
CONFIDENCE: 0-100
REASON: brief explanation
TYPE: formula/physics/geometry/chemistry/biology (if yes)

Consider:
- Is the content self-explanatory with text alone?
- Would a visual aid significantly improve understanding?
- Are there spatial relationships, structures, or complex formulas?
- Is this a simple definition or concept that doesn't need visualization?`;

    try {
      const response = await ModelManager.streamChat([
        { role: 'system', content: 'You are a concise diagram evaluator. Respond in the exact format requested.' },
        { role: 'user', content: prompt }
      ], () => {});

      // Parse response
      const needsMatch = response.match(/NEEDS_DIAGRAM:\s*(yes|no)/i);
      const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/);
      const reasonMatch = response.match(/REASON:\s*(.+)/);
      const typeMatch = response.match(/TYPE:\s*(formula|physics|geometry|chemistry|biology)/i);

      return {
        needsDiagram: needsMatch?.[1]?.toLowerCase() === 'yes',
        confidence: parseInt(confidenceMatch?.[1] || '60'),
        reason: reasonMatch?.[1]?.trim() || 'AI evaluation',
        suggestedType: typeMatch?.[1] as any
      };
    } catch (error) {
      console.error('[DiagramDecisionEngine] AI evaluation failed:', error);
      // Fallback to conservative approach
      return {
        needsDiagram: false,
        confidence: 40,
        reason: 'AI evaluation failed, defaulting to no diagram'
      };
    }
  }

  // ==================== Helper Methods ====================

  private hasChemicalStructure(content: string): boolean {
    const keywords = [
      'molecule', 'molecular', 'compound', 'structure', 'bond',
      'benzene', 'alkane', 'alkene', 'alkyne', 'organic',
      'functional group', 'isomer', 'polymer'
    ];
    const lower = content.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }

  private hasComplexFormula(content: string): boolean {
    // Check for mathematical symbols and operators
    const patterns = [
      /\^|\√|∫|∑|∏|∆/,           // Math symbols
      /\bsin\b|\bcos\b|\btan\b/i, // Trig functions
      /\blog\b|\bln\b/i,          // Log functions
      /[a-z]\s*=\s*.+[+\-*/].+/i  // Equations with variables
    ];
    return patterns.some(p => p.test(content));
  }

  private hasMotionConcept(content: string): boolean {
    const keywords = [
      'trajectory', 'projectile', 'motion', 'velocity', 'acceleration',
      'orbit', 'path', 'parabola', 'circular motion', 'force diagram',
      'free body diagram', 'vector'
    ];
    const lower = content.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }

  private hasGeometryConcept(content: string): boolean {
    const keywords = [
      'triangle', 'circle', 'rectangle', 'polygon', 'angle',
      'perpendicular', 'parallel', 'tangent', 'chord', 'radius',
      'diameter', 'area', 'perimeter', 'coordinate', 'graph'
    ];
    const lower = content.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }

  private hasAnatomyConcept(content: string): boolean {
    const keywords = [
      'cell', 'organ', 'tissue', 'system', 'structure',
      'anatomy', 'diagram', 'labeled', 'parts', 'components'
    ];
    const lower = content.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }

  private hasSpatialConcept(content: string): boolean {
    const keywords = [
      'above', 'below', 'left', 'right', 'between', 'inside', 'outside',
      'position', 'location', 'arrangement', 'layout', 'configuration'
    ];
    const lower = content.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }

  private isTextOnly(content: string): boolean {
    // Check if content is purely textual without complex concepts
    const hasNoSpecialChars = !/[∫∑∏√^°±≈≠≤≥]/.test(content);
    const hasNoFormulas = !/[a-z]\s*=\s*[^,\s]+/i.test(content);
    return hasNoSpecialChars && hasNoFormulas && content.length < 500;
  }

  private inferDiagramType(subject: string, content: string): DiagramNeedAssessment['suggestedType'] {
    const lower = content.toLowerCase();
    
    if (subject === 'Chemistry' || lower.includes('molecule') || lower.includes('compound')) {
      return 'chemistry';
    }
    if (subject === 'Physics' || lower.includes('motion') || lower.includes('force')) {
      return 'physics';
    }
    if (subject === 'Math' || lower.includes('triangle') || lower.includes('angle')) {
      return 'geometry';
    }
    if (lower.includes('formula') || lower.includes('equation')) {
      return 'formula';
    }
    if (subject === 'Biology' || lower.includes('cell') || lower.includes('organ')) {
      return 'biology';
    }
    
    return 'formula'; // Default
  }
}

export const DiagramDecisionEngine = new DiagramDecisionEngineService();
