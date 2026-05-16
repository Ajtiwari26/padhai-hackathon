import { NativeModules } from 'react-native';

const { PadhVision } = NativeModules;

export interface OCRResult {
  text: string;
  mathExpressions: string[];
  stepsFound: number;
}

class VisionService {
  /**
   * Captures an image and performs on-device OCR/Math analysis.
   * This is used for the "Vision Mentor" skill.
   */
  public async analyzeWorksheet(): Promise<OCRResult> {
    try {
      const result = await PadhVision.captureAndProcess();
      return {
        text: result.text,
        mathExpressions: result.mathExpressions || [],
        stepsFound: result.stepsFound || 0
      };
    } catch (e) {
      console.warn('[VisionService] OCR failed or was cancelled.');
      throw e;
    }
  }
}

export const Vision = new VisionService();
