/**
 * Gemma Service
 * 
 * Wrapper around ModelManager for diagram generation
 * Provides a simple interface for AI-powered diagram code generation
 */

import { ModelManager } from './ModelManager';

export interface GenerateRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  port?: number;
}

export interface GenerateResponse {
  content: string;
  tokensUsed?: number;
}

class GemmaServiceClass {
  /**
   * Generate text from prompts using local Gemma model
   */
  async generate(request: GenerateRequest): Promise<string> {
    const {
      systemPrompt,
      userPrompt,
      temperature = 0.3,
      maxTokens = 2000,
      stopSequences = [],
      port,
    } = request;

    console.log('[GemmaService] Generating with temperature:', temperature);
    console.log('[GemmaService] System prompt length:', systemPrompt.length);
    console.log('[GemmaService] User prompt length:', userPrompt.length);

    try {
      // Use ModelManager's streamChat directly with separate roles for better steering
      const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await ModelManager.streamChat(
        messages,
        () => {}, // Non-streaming callback
        undefined,
        'foreground',
        port
      );

      console.log('[GemmaService] Generation successful, response length:', response.length);

      // Check for stop sequences and truncate if found
      let finalResponse = response;
      for (const stopSeq of stopSequences) {
        const index = finalResponse.indexOf(stopSeq);
        if (index !== -1) {
          finalResponse = finalResponse.substring(0, index);
          console.log('[GemmaService] Truncated at stop sequence:', stopSeq);
        }
      }

      return finalResponse.trim();
    } catch (error) {
      console.error('[GemmaService] Generation failed:', error);
      throw new Error(`Failed to generate diagram code: ${error}`);
    }
  }

  /**
   * Generate with streaming support
   */
  async generateStream(
    request: GenerateRequest,
    onToken: (delta: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const {
      systemPrompt,
      userPrompt,
      temperature = 0.3,
      stopSequences = [],
      port,
    } = request;

    console.log('[GemmaService] Streaming generation started');

    try {
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ];

      let fullResponse = '';
      let stopped = false;

      const wrappedOnToken = (delta: string) => {
        if (stopped) return;

        // Check for stop sequences
        fullResponse += delta;
        for (const stopSeq of stopSequences) {
          if (fullResponse.includes(stopSeq)) {
            stopped = true;
            const index = fullResponse.indexOf(stopSeq);
            fullResponse = fullResponse.substring(0, index);
            return;
          }
        }

        onToken(delta);
      };

      const response = await ModelManager.streamChat(
        messages,
        wrappedOnToken,
        signal,
        'foreground',
        port
      );

      console.log('[GemmaService] Streaming complete, response length:', response.length);

      return stopped ? fullResponse : response.trim();
    } catch (error) {
      console.error('[GemmaService] Streaming generation failed:', error);
      throw new Error(`Failed to generate diagram code: ${error}`);
    }
  }
}

export const GemmaService = new GemmaServiceClass();
