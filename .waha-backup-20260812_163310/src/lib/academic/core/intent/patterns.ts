import type { ResearchIntentType } from '../../types/IntentAnalysisResult';

export interface PatternGroup {
  ar: string[];
  en: string[];
  score: number;
}

export const INTENT_PATTERNS: Record<ResearchIntentType, PatternGroup> = {
  NO_IDEA: {
    ar: ['ليس لدي فكرة', 'ما عندي فكرة', 'لا أعرف', 'مش عارف', 'اقترح علي', 'اختر لي', 'مو عارف', 'بدي فكرة'],
    en: ['no idea', "don't know", 'suggest a topic', 'help me choose'],
    score: 90,
  },
  REJECTED_TITLE: {
    ar: ['عنواني رفضه', 'رفضه المشرف', 'رفض عنواني', 'العنوان مرفوض', 'اللجنة رفضت'],
    en: ['supervisor rejected', 'title rejected', 'committee rejected'],
    score: 95,
  },
  HAS_PROPOSAL: {
    ar: ['بروبوزال', 'مقترح بحثي', 'خطة بحثي', 'مقترح الدراسة', 'خطة الدراسة'],
    en: ['research proposal', 'research plan', 'study proposal'],
    score: 90,
  },
  WANTS_PUBLICATION: {
    ar: ['أريد نشر', 'بدي انشر', 'نشر بحث', 'نشر في مجلة', 'ورقة علمية', 'نشر علمي'],
    en: ['want to publish', 'publish research', 'publish a paper', 'journal publication'],
    score: 90,
  },
  INITIAL_IDEA: {
    ar: ['أفكر في', 'لدي فكرة', 'عندي فكرة', 'أريد البحث في', 'مهتم بدراسة'],
    en: ['thinking about', 'want to research', 'interested in studying'],
    score: 80,
  },
  HAS_TITLE: {
    ar: ['عنواني', 'العنوان:', 'عنوان دراستي', 'عنوان البحث', 'أثر', 'فاعلية', 'دور', 'مدى'],
    en: ['my title', 'title:', 'impact of', 'effect of', 'role of'],
    score: 70,
  },
  NON_RESEARCH: {
    ar: ['مرحبا', 'كيف حالك', 'شعر', 'قصة', 'ترجم', 'لخص'],
    en: ['hello', 'hi', 'how are you', 'translate', 'summarize'],
    score: 100,
  }
};

export const REGEX_PATTERNS = {
  academicLevel: /(ماجستير|دكتوراه|بكالوريوس|رسالة|أطروحة|phd|master|bachelor)/i,
  independentVarAr: /(?:أثر|تأثير|فاعلية|دور|واقع)\s+([^\s]+(?:\s+[^\s]+)?)\s+(?:على|في|لدى)/i,
  dependentVarAr: /(?:على|في)\s+([^\s]+(?:\s+[^\s]+)?)(?:\s+(?:لدى|في|بين|من منظور)|$)/i,
  locationAr: /في\s+(السعودية|الرياض|جدة|مكة|الأردن|عمان|فلسطين|القدس|غزة|مصر|القاهرة|الإمارات|دبي|الكويت|قطر|البحرين|عمان|العراق)/i,
  populationAr: /(?:لدى|بين|من منظور|عينة من)\s+([^\s]+(?:\s+[^\s]+){0,3})/i
};
