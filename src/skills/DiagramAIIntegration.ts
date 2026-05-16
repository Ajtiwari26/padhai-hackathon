/**
 * Diagram AI Integration
 * 
 * Connects DiagramGenerator with local AI model (Gemma 4)
 * to generate diagram code from natural language requests
 */

import { DiagramGenerator, DiagramType, DiagramRequest } from './DiagramGenerator';
import { DiagramPrompts } from './DiagramPrompts';
import { GemmaService } from '../core/api/GemmaService';

export interface DiagramGenerationRequest {
  topic: string;
  type: DiagramType;
  concepts?: string[];
  difficulty?: number;
  additionalContext?: string;
  port?: number;
}

class DiagramAIIntegrationService {
  /**
   * Generate diagram from natural language request
   */
  async generateFromRequest(request: DiagramGenerationRequest): Promise<any> {
    const { topic, type, concepts = [], difficulty = 50, additionalContext, port } = request;
    
    // Get appropriate prompt for diagram type
    const prompt = this.buildPrompt(type, topic, concepts, additionalContext);
    
    // Generate diagram code using AI
    const diagramCode = await this.generateDiagramCode(type, prompt, port);
    
    // Create diagram request
    const diagramRequest: DiagramRequest = {
      type,
      topic,
      difficulty,
      content: diagramCode,
      metadata: {
        concepts,
      },
    };
    
    // Generate final diagram with HTML
    return await DiagramGenerator.generate(diagramRequest);
  }
  
  /**
   * Build prompt based on diagram type
   */
  private buildPrompt(
    type: DiagramType,
    topic: string,
    concepts: string[],
    additionalContext?: string
  ): { system: string; user: string } {
    let system: string;
    let user: string;
    
    switch (type) {
      case 'formula':
        system = DiagramPrompts.katex.system;
        user = DiagramPrompts.katex.user(topic, concepts);
        break;
      
      case 'physics':
      case 'geometry':
        system = DiagramPrompts.jsxgraph.system;
        user = DiagramPrompts.jsxgraph.user(topic, type);
        break;
      
      case 'chemistry':
        system = DiagramPrompts.smilesdrawer.system;
        user = DiagramPrompts.smilesdrawer.user(topic);
        break;
      
      case 'biology':
      default:
        // If we have the AI's text response, use context-aware SVG for much better diagrams
        if (additionalContext && additionalContext.length > 100) {
          system = DiagramPrompts.svgFromContext.system;
          user = DiagramPrompts.svgFromContext.user(topic, additionalContext);
        } else {
          system = DiagramPrompts.svg.system;
          user = DiagramPrompts.svg.user(topic, concepts);
        }
        break;
    }
    
    return { system, user };
  }
  
  /**
   * Generate diagram code using AI model
   */
  private async generateDiagramCode(type: DiagramType, prompt: { system: string; user: string }, port?: number): Promise<string> {
    try {
      // Call Gemma 4 model
      const response = await GemmaService.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.3, // Low temperature for precise syntax
        maxTokens: 4000, // Full budget for detailed SVG diagrams
        stopSequences: ['```', 'Explanation:', 'Note:'],
        port,
      });
      
      // Clean up response - more aggressive removal of conversational filler
      let code = response.trim();
      
      // 1. Try to extract from triple backticks first
      const codeBlockMatch = code.match(/```(?:[\w]*)\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        code = codeBlockMatch[1].trim();
      } else {
        // 2. Remove markdown code blocks markers if they were unclosed
        code = code.replace(/```[\w]*\n?/g, '');
        code = code.replace(/```$/g, '');
      }
      
      // 3. Final line-by-line cleanup
      const lines = code.split('\n');
      const codeLines = lines.filter(line => {
        const lower = line.toLowerCase().trim();
        return !lower.startsWith('explanation:') &&
               !lower.startsWith('note:') &&
               !lower.startsWith('here is') &&
               !lower.startsWith('sure') &&
               !lower.startsWith('//') &&
               line.trim().length > 0;
      });
      
      code = codeLines.join('\n').trim();
      
      // Validate based on type
      this.validateDiagramCode(type, code);
      
      return code;
    } catch (error) {
      console.error('[DiagramAI] Generation failed:', error);
      
      // Fallback to example
      const examples = DiagramGenerator.getExamples();
      return examples[type];
    }
  }
  
  /**
   * Validate diagram code syntax
   */
  private validateDiagramCode(type: DiagramType, code: string): void {
    switch (type) {
      case 'formula':
        if (!code.includes('$') && !code.includes('\\')) {
          throw new Error('Invalid LaTeX syntax');
        }
        break;
      
      case 'physics':
      case 'geometry':
        if (!code.includes('board.create')) {
          throw new Error('Invalid JSXGraph syntax');
        }
        break;
      
      case 'chemistry':
        // SMILES validation - should be alphanumeric with special chars
        if (!/^[A-Za-z0-9@+\-\[\]\(\)=#]+$/.test(code.trim())) {
          throw new Error('Invalid SMILES notation');
        }
        break;
      
      case 'biology':
      case 'flowchart':
      case 'process':
      case 'sequence':
        if (!code.includes('<svg')) {
          throw new Error('Invalid SVG syntax');
        }
        break;
    }
  }
  
  /**
   * Detect diagram type from user message
   */
  detectDiagramType(message: string): DiagramType | null {
    const lower = message.toLowerCase();
    
    // Flowchart/Process keywords
    if (lower.match(/\b(flowchart|flow chart|process|workflow|steps|sequence)\b/)) {
      if (lower.includes('sequence')) return 'sequence';
      return 'flowchart';
    }
    
    // Formula keywords
    if (lower.match(/\b(formula|equation|expression|calculate|derive)\b/)) {
      return 'formula';
    }
    
    // Formula keywords
    if (lower.match(/\b(formula|equation|expression|calculate|derive)\b/)) {
      return 'formula';
    }
    
    // Physics keywords
    if (lower.match(/\b(projectile|motion|force|vector|velocity|acceleration|trajectory|pulley|weight|gravity)\b/)) {
      return 'physics';
    }
    
    // Geometry keywords
    if (lower.match(/\b(circle|triangle|parabola|ellipse|tangent|coordinate|graph)\b/)) {
      return 'geometry';
    }
    
    // Chemistry keywords
    if (lower.match(/\b(molecule|compound|structure|benzene|organic|chemical)\b/)) {
      return 'chemistry';
    }
    
    // Biology keywords
    if (lower.match(/\b(cell|organ|tissue|neuron|heart|plant|animal|anatomy)\b/)) {
      return 'biology';
    }
    
    return 'biology'; // Default to SVG for anything else
  }
  
  /**
   * Extract concepts from message
   */
  extractConcepts(message: string): string[] {
    // Simple keyword extraction
    const concepts: string[] = [];
    
    // Common physics concepts
    const physicsKeywords = ['velocity', 'acceleration', 'force', 'energy', 'momentum', 'gravity', 'friction'];
    // Common chemistry concepts
    const chemistryKeywords = ['atom', 'molecule', 'bond', 'reaction', 'electron', 'proton', 'neutron'];
    // Common biology concepts
    const biologyKeywords = ['cell', 'nucleus', 'mitochondria', 'membrane', 'DNA', 'protein', 'enzyme'];
    // Common math concepts
    const mathKeywords = ['angle', 'radius', 'diameter', 'tangent', 'chord', 'area', 'perimeter'];
    
    const allKeywords = [...physicsKeywords, ...chemistryKeywords, ...biologyKeywords, ...mathKeywords];
    
    const lower = message.toLowerCase();
    for (const keyword of allKeywords) {
      if (lower.includes(keyword)) {
        concepts.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    }
    
    return concepts;
  }
  
  /**
   * Quick diagram generation from natural language
   */
  async quickGenerate(message: string, difficulty: number = 50): Promise<any> {
    // Detect diagram type
    const type = this.detectDiagramType(message);
    if (!type) {
      throw new Error('Could not detect diagram type from message');
    }
    
    // Extract concepts
    const concepts = this.extractConcepts(message);
    
    // Extract topic (first few words)
    const words = message.split(' ').slice(0, 5).join(' ');
    const topic = words.charAt(0).toUpperCase() + words.slice(1);
    
    // Generate diagram
    return await this.generateFromRequest({
      topic,
      type,
      concepts,
      difficulty,
      additionalContext: message,
    });
  }

  /**
   * Legacy wrapper for generateFromRequest
   */
  async generateFromPrompt(type: DiagramType, prompt: string, difficulty: number = 50): Promise<any> {
    return await this.generateFromRequest({
      topic: prompt.split(' ').slice(0, 5).join(' '),
      type,
      difficulty,
      additionalContext: prompt
    });
  }
}

export const DiagramAI = new DiagramAIIntegrationService();
