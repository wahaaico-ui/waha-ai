/**
 * Idea Verification Engine
 * Core engine for verifying and analyzing research ideas
 * 
 * This engine validates research idea inputs and prepares them for
 * deeper analysis (semantic extraction, evidence gathering, etc.)
 */

import { MeaningfulnessValidator } from '@/lib/validators/meaningfulness.validator';

export interface VerificationError {
  code: string;
  message: string;
}

export interface VerificationSuccess {
  id: string;
  timestamp: string;
  rawInput: string;
  inputLength: number;
  validationPass: boolean;
  status: 'pending_analysis' | 'ready_for_evidence' | 'ready_for_semantic';
}

export interface VerificationResult {
  success: VerificationSuccess | null;
  error: VerificationError | null;
  isValid: boolean;
}

export class IdeaVerificationEngine {
  /**
   * Verify an idea input for meaningfulness and basic structure
   * If invalid, returns error immediately
   * If valid, returns verification success for downstream processing
   */
  static verify(rawInput: string): VerificationResult {
    // Step 1: Validate meaningfulness
    const meaningfulnessResult = MeaningfulnessValidator.validate(rawInput);

    if (!meaningfulnessResult.isMeaningful) {
      return {
        success: null,
        error: {
          code: 'INVALID_INPUT',
          message: `This idea cannot be analyzed because the content is not meaningful. ${meaningfulnessResult.reason || ''}`
        },
        isValid: false
      };
    }

    // Step 2: If valid, create verification success object
    const verificationId = this.generateVerificationId();
    const timestamp = new Date().toISOString();

    const success: VerificationSuccess = {
      id: verificationId,
      timestamp,
      rawInput: rawInput.trim(),
      inputLength: rawInput.trim().length,
      validationPass: true,
      status: 'pending_analysis'
    };

    return {
      success,
      error: null,
      isValid: true
    };
  }

  /**
   * Generate a unique verification ID
   */
  private static generateVerificationId(): string {
    return `idea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
