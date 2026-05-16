import { NativeModules } from 'react-native';

const { PadhVision } = NativeModules;

export interface VisionAnalysis {
  text: string;
  confidence: number;
}

export class VisionMentor {
  /**
   * Runs Google ML Kit Text Recognition on an image
   * @param imageUri Local path to the image
   */
  static async analyzeHandwriting(imageUri: String): Promise<VisionAnalysis> {
    if (!PadhVision) {
      throw new Error("Native PadhVision module is not linked.");
    }
    return await PadhVision.recognizeText(imageUri);
  }

  /**
   * Specific wrapper for analyzing equations.
   * Currently just falls back to text recognition.
   */
  static async analyzeEquation(imageUri: String): Promise<VisionAnalysis> {
    if (!PadhVision) {
      throw new Error("Native PadhVision module is not linked.");
    }
    return await PadhVision.analyzeEquation(imageUri);
  }
}
