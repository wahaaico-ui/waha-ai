/**
 * Meaningfulness Validator
 * Detects if input text contains meaningful research content
 * or is nonsense (numbers only, random symbols, gibberish)
 */

interface ValidationResult {
  isMeaningful: boolean;
  reason?: string;
  confidence?: number;
}

const STOP_WORDS = new Set([
  'و', 'في', 'هو', 'هي', 'من', 'إلى', 'أن', 'عن', 'مع', 'على', 'كان', 'كانت',
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'are'
]);

export class MeaningfulnessValidator {
  /**
   * Validate if the input text contains meaningful research content
   */
  static validate(text: string): ValidationResult {
    const cleaned = text.trim();

    // Check 1: Empty or too short
    if (cleaned.length === 0) {
      return {
        isMeaningful: false,
        reason: 'Empty input'
      };
    }

    if (cleaned.length < 10) {
      return {
        isMeaningful: false,
        reason: 'Input too short (less than 10 characters)'
      };
    }

    // Check 2: All numbers
    if (/^\d+$/.test(cleaned.replace(/\s/g, ''))) {
      return {
        isMeaningful: false,
        reason: 'Content contains only numbers'
      };
    }

    // Check 3: All symbols/special characters (no alphanumeric)
    if (!/[a-zA-Z0-9\u0600-\u06FF]/.test(cleaned)) {
      return {
        isMeaningful: false,
        reason: 'Content contains only symbols and no meaningful text'
      };
    }

    // Check 4: Detect gibberish (random repeating characters)
    if (this.isGibberish(cleaned)) {
      return {
        isMeaningful: false,
        reason: 'Content appears to be random characters without semantic meaning'
      };
    }

    // Check 5: Detect if content has meaningful words (not just stop words)
    const words = this.extractWords(cleaned);
    const meaningfulWords = words.filter(w => !STOP_WORDS.has(w.toLowerCase()));

    if (meaningfulWords.length < 2) {
      return {
        isMeaningful: false,
        reason: 'Content lacks meaningful keywords or concepts'
      };
    }

    // Check 6: Detect if content has some academic/research indicators
    const hasResearchIndicators = this.hasResearchContext(cleaned);

    return {
      isMeaningful: true,
      confidence: hasResearchIndicators ? 0.95 : 0.75
    };
  }

  /**
   * Detect random gibberish (e.g., "aaaaaabbbbccccc" or "xyzxyzxyz")
   */
  private static isGibberish(text: string): boolean {
    const words = text.split(/\s+/);
    
    for (const word of words) {
      if (word.length > 4) {
        // Check for repeating character patterns
        const charCounts = new Map<string, number>();
        for (const char of word) {
          charCounts.set(char, (charCounts.get(char) || 0) + 1);
        }
        
        // If one character appears > 50% of the word, it's likely gibberish
        const maxCount = Math.max(...charCounts.values());
        if (maxCount / word.length > 0.5) {
          continue; // Could be gibberish
        }
      }
    }

    // Check overall entropy - if text has very limited character variety
    const uniqueChars = new Set(text.toLowerCase().replace(/\s/g, ''));
    if (uniqueChars.size < 3 && text.length > 20) {
      return true; // Very low character diversity = gibberish
    }

    return false;
  }

  /**
   * Extract words from text (handles Arabic and English)
   */
  private static extractWords(text: string): string[] {
    // Match Arabic words and English words
    const regex = /[\u0600-\u06FF]+|[a-zA-Z]+/g;
    const matches = text.match(regex);
    return matches || [];
  }

  /**
   * Detect if text has research/academic context indicators
   */
  private static hasResearchContext(text: string): boolean {
    const researchKeywords = [
      // English
      'research', 'study', 'analysis', 'hypothesis', 'theory', 'method',
      'investigation', 'examine', 'explore', 'evaluate', 'impact', 'effect',
      'relationship', 'correlation', 'data', 'variable', 'sample', 'population',
      'methodology', 'framework', 'model', 'approach', 'development', 'implementation',
      // Arabic
      'بحث', 'دراسة', 'تحليل', 'فرضية', 'نظرية', 'منهج',
      'تحقيق', 'فحص', 'استكشاف', 'تقييم', 'تأثير', 'تأثر',
      'علاقة', 'ارتباط', 'بيانات', 'متغير', 'عينة', 'مجتمع',
      'منهجية', 'إطار', 'نموذج', 'مدخل', 'تطوير', 'تطبيق'
    ];

    const lowerText = text.toLowerCase();
    return researchKeywords.some(keyword => lowerText.includes(keyword));
  }
}
