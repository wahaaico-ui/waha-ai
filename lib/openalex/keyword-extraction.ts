/**
 * Keyword Extraction Service
 * Simple text processing - NO AI
 * Extracts meaningful keywords from research ideas
 */

import { KeywordExtractionResult } from '@/types/OpenAlex';

const ARABIC_STOP_WORDS = new Set([
  'و', 'في', 'هو', 'هي', 'من', 'إلى', 'أن', 'عن', 'مع', 'على', 'كان', 'كانت',
  'ل', 'ب', 'ك', 'لم', 'قد', 'كل', 'بعض', 'هذا', 'ذلك', 'التي', 'الذي',
  'ما', 'مثل', 'عندما', 'حيث', 'لكن', 'أو', 'إذا', 'كيف', 'أين', 'متى'
]);

const ENGLISH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'are', 'was', 'be', 'been', 'as', 'it', 'this', 'that',
  'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
  'some', 'any', 'no', 'not', 'can', 'could', 'should', 'would', 'may', 'might'
]);

/**
 * Words that appear in almost every research title and therefore carry no
 * discriminating power in a fulltext search. Keeping them pushes the terms
 * that actually define the topic out of the keyword budget: the idea
 * "تأثير استخدام الذكاء الاصطناعي على جودة التعليم في الجامعات السعودية"
 * otherwise searches on تأثير/استخدام and drops التعليم/الجامعات/السعودية,
 * returning papers about supply chains and auditing instead of education.
 */
const GENERIC_RESEARCH_FILLER = new Set([
  // Arabic
  'تأثير', 'تاثير', 'أثر', 'اثر', 'استخدام', 'استعمال', 'توظيف', 'تطبيق',
  'دراسة', 'بحث', 'تحليل', 'دور', 'واقع', 'مدى', 'درجة', 'مستوى',
  'نحو', 'حول', 'بين', 'خلال', 'عبر', 'ضوء', 'حالة', 'بعض',
  // English
  'impact', 'effect', 'effects', 'affect', 'influence', 'using', 'use', 'usage',
  'role', 'study', 'studies', 'research', 'analysis', 'analyzing', 'investigation',
  'examining', 'exploring', 'evaluating', 'assessment', 'towards', 'toward',
  'based', 'case', 'level', 'degree', 'extent', 'among', 'between', 'through',
]);

/** Enough room for the topical terms to survive, short enough to stay specific. */
const MAX_KEYWORDS = 8;

export class KeywordExtractionService {
  /**
   * Extract keywords from research idea text
   * No AI - just text processing
   */
  static extract(text: string): KeywordExtractionResult {
    const cleaned = text.trim();

    // Step 1: Split into words
    const words = this.tokenize(cleaned);

    // Step 2: Remove stop words and short words
    const filtered = words.filter(word => {
      const lowerWord = word.toLowerCase();
      return (
        word.length > 2 &&
        !ARABIC_STOP_WORDS.has(lowerWord) &&
        !ENGLISH_STOP_WORDS.has(lowerWord)
      );
    });

    // Step 3: Prefer topic-bearing terms over generic research filler.
    // Filler is kept as a fallback so a short idea still produces a query.
    const unique = Array.from(new Set(filtered));
    const topical = unique.filter(w => !GENERIC_RESEARCH_FILLER.has(w.toLowerCase()));
    const ranked = topical.length > 0 ? topical : unique;

    const keywords = ranked.slice(0, MAX_KEYWORDS).filter(k => k.length > 0);

    // Step 4: Build search query
    const searchQuery = keywords.join(' ');

    return {
      originalText: cleaned,
      keywords,
      searchQuery: searchQuery || cleaned // Fall back to full text if no keywords
    };
  }

  /**
   * Tokenize text into words (handles Arabic and English)
   */
  private static tokenize(text: string): string[] {
    // Match Arabic words, English words, and numbers
    const regex = /[\u0600-\u06FF]+|[a-zA-Z]+|[0-9]+/g;
    const matches = text.match(regex);
    return matches || [];
  }
}
