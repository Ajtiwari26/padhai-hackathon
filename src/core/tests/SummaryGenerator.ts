/**
 * Summary Generator
 * 
 * Generates chapter summaries with key points, formulas, and concepts
 */

import { ModelManager } from '../api/ModelManager';
import { DiagramDecisionEngine } from '../orchestrator/DiagramDecisionEngine';
import { DiagramAI } from '../../skills/DiagramAIIntegration';

export interface SummarySection {
  title: string;
  content: string;
  keyPoints: string[];
  diagram?: any;
}

export interface Summary {
  id: string;
  chapterId: string;
  chapterName: string;
  overview: string;
  sections: SummarySection[];
  keyFormulas: string[];
  importantConcepts: string[];
  commonMistakes: string[];
  quickRevisionPoints: string[];
  createdAt: number;
}

export interface SummaryConfig {
  chapterId: string;
  chapterName: string;
  subtopics: string[];
  subject: string;
  detailLevel: 'brief' | 'detailed' | 'comprehensive';
}

class SummaryGeneratorService {
  async generate(config: SummaryConfig): Promise<Summary> {
    console.log('[SummaryGenerator] Generating summary for:', config.chapterName);

    const detailInstructions = {
      brief: 'Keep it concise - 2-3 key points per subtopic',
      detailed: 'Provide thorough explanations with examples',
      comprehensive: 'Include all important details, derivations, and applications'
    };

    const prompt = `Generate a comprehensive summary for the chapter "${config.chapterName}" in ${config.subject}.

Subtopics: ${config.subtopics.join(', ')}
Detail Level: ${config.detailLevel} (${detailInstructions[config.detailLevel]})

Structure the summary as follows:

1. OVERVIEW
[Brief 2-3 sentence overview of the chapter]

2. SECTIONS (one per subtopic)
For each subtopic, provide:
- Title
- Content (explanation)
- Key Points (bullet points)

Format:
---SECTION---
TITLE: [subtopic name]
CONTENT: [explanation]
KEY_POINTS:
- [point 1]
- [point 2]
- [point 3]
---END_SECTION---

3. KEY FORMULAS
List all important formulas with brief descriptions:
FORMULA: [formula] - [what it represents]

4. IMPORTANT CONCEPTS
List core concepts that must be remembered:
- [concept 1]
- [concept 2]

5. COMMON MISTAKES
List typical errors students make:
- [mistake 1]
- [mistake 2]

6. QUICK REVISION POINTS
List one-liners for last-minute revision:
- [point 1]
- [point 2]

Generate the complete summary now:`;

    try {
      const response = await ModelManager.streamChat([
        { role: 'system', content: 'You are an expert educator creating clear, structured summaries for students.' },
        { role: 'user', content: prompt }
      ], () => {});

      // Parse summary from response
      const parsed = this.parseSummary(response);

      // Evaluate diagram needs for each section
      for (const section of parsed.sections) {
        const assessment = await DiagramDecisionEngine.evaluateNeed(
          section.content,
          'summary',
          config.subject
        );

        if (assessment.needsDiagram && assessment.confidence > 70) {
          console.log(`[SummaryGenerator] Generating diagram for section: ${section.title}`);
          try {
            const diagram = await DiagramAI.generateFromPrompt(
              assessment.suggestedType || 'formula',
              section.content
            );
            section.diagram = diagram;
          } catch (error) {
            console.warn('[SummaryGenerator] Diagram generation failed:', error);
          }
        }
      }

      const summary: Summary = {
        id: `summary_${Date.now()}`,
        chapterId: config.chapterId,
        chapterName: config.chapterName,
        overview: parsed.overview,
        sections: parsed.sections,
        keyFormulas: parsed.keyFormulas,
        importantConcepts: parsed.importantConcepts,
        commonMistakes: parsed.commonMistakes,
        quickRevisionPoints: parsed.quickRevisionPoints,
        createdAt: Date.now()
      };

      console.log('[SummaryGenerator] Summary generated with', summary.sections.length, 'sections');
      return summary;
    } catch (error) {
      console.error('[SummaryGenerator] Generation failed:', error);
      throw error;
    }
  }

  private parseSummary(response: string): Omit<Summary, 'id' | 'chapterId' | 'chapterName' | 'createdAt'> {
    // Extract overview
    const overviewMatch = response.match(/OVERVIEW\s*(.+?)(?=SECTIONS|---SECTION---|$)/s);
    const overview = overviewMatch?.[1]?.trim() || 'Chapter summary';

    // Extract sections
    const sections: SummarySection[] = [];
    const sectionBlocks = response.match(/---SECTION---(.+?)---END_SECTION---/gs);
    
    if (sectionBlocks) {
      for (const block of sectionBlocks) {
        const titleMatch = block.match(/TITLE:\s*(.+)/);
        const contentMatch = block.match(/CONTENT:\s*(.+?)(?=KEY_POINTS:|$)/s);
        const keyPointsMatch = block.match(/KEY_POINTS:\s*(.+?)(?=---END_SECTION---|$)/s);

        if (titleMatch && contentMatch) {
          const keyPoints = keyPointsMatch?.[1]
            ?.split('\n')
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(line => line.length > 0) || [];

          sections.push({
            title: titleMatch[1].trim(),
            content: contentMatch[1].trim(),
            keyPoints
          });
        }
      }
    }

    // Extract key formulas
    const formulasMatch = response.match(/KEY FORMULAS\s*(.+?)(?=IMPORTANT CONCEPTS|$)/s);
    const keyFormulas = formulasMatch?.[1]
      ?.split('\n')
      .map(line => line.replace(/^FORMULA:\s*/, '').replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0) || [];

    // Extract important concepts
    const conceptsMatch = response.match(/IMPORTANT CONCEPTS\s*(.+?)(?=COMMON MISTAKES|$)/s);
    const importantConcepts = conceptsMatch?.[1]
      ?.split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0) || [];

    // Extract common mistakes
    const mistakesMatch = response.match(/COMMON MISTAKES\s*(.+?)(?=QUICK REVISION|$)/s);
    const commonMistakes = mistakesMatch?.[1]
      ?.split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0) || [];

    // Extract quick revision points
    const revisionMatch = response.match(/QUICK REVISION POINTS\s*(.+?)$/s);
    const quickRevisionPoints = revisionMatch?.[1]
      ?.split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0) || [];

    return {
      overview,
      sections,
      keyFormulas,
      importantConcepts,
      commonMistakes,
      quickRevisionPoints
    };
  }
}

export const SummaryGenerator = new SummaryGeneratorService();
