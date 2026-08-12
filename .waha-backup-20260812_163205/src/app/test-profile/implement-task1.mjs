// implement-task1.mjs
// WAHA — Sprint 1 | Task 1 | Research Intent Engine
// Pure rule-based classification — zero LLM, zero external APIs
// Run: node implement-task1.mjs

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
let count = 0;

function dir(p) { mkdirSync(join(ROOT, p), { recursive: true }); }
function write(p, c) {
  writeFileSync(join(ROOT, p), c.trimStart() + '\n', 'utf-8');
  count++;
  console.log('  ✔  ' + p);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Sprint 1  Task 1  —  Research Intent Engine          ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

dir('src/lib/academic/types');
dir('src/lib/academic/core/intent');
dir('src/lib/academic/core/intent/__tests__');
dir('src/app/api/academic/intent');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 1 — IntentAnalysisResult type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/types/IntentAnalysisResult.ts', `
export type ResearchIntentType =
  | 'NO_IDEA'
  | 'INITIAL_IDEA'
  | 'HAS_TITLE'
  | 'REJECTED_TITLE'
  | 'HAS_PROPOSAL'
  | 'WANTS_PUBLICATION'
  | 'NON_RESEARCH';

export type DetectedLanguage = 'ar' | 'en' | 'mixed';

export interface IntentAnalysisResult {
  intent:              ResearchIntentType;
  confidence:          number;
  language:            DetectedLanguage;
  independentVariable: string | null;
  dependentVariable:   string | null;
  population:          string | null;
  location:            string | null;
  discipline:          string | null;
  academicLevel:       string | null;
  missingParts:        string[];
  nextRoute:           string;
}
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 2 — patterns.ts 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/intent/patterns.ts', `
import type { ResearchIntentType } from '../../types/IntentAnalysisResult';

export interface PatternGroup {
  ar: string[];
  en: string[];
  score: number;
}

export const INTENT_PATTERNS: Record<ResearchIntentType, PatternGroup> = {
  NO_IDEA: {
    ar: ['ليس لدي فكرة', 'ما عندي فكرة', 'لا أعرف', 'مش عارف', 'اقترح علي', 'اختر لي', 'مو عارف', 'بدي فكرة'],
    en: ['no idea', 'don\\'t know', 'suggest a topic', 'help me choose'],
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
  independentVarAr: /(?:أثر|تأثير|فاعلية|دور|واقع)\s+([\\w\\s]{3,30}?)\s+(?:على|في|لدى)/i,
  dependentVarAr: /(?:على|في)\s+([\\w\\s]{3,30}?)\s+(?:لدى|في|بين|من منظور)/i,
  locationAr: /في\s+(السعودية|الرياض|جدة|مكة|الأردن|عمان|فلسطين|القدس|غزة|مصر|القاهرة|الإمارات|دبي|الكويت|قطر|البحرين|عمان|العراق)/i,
  populationAr: /(?:لدى|بين|من منظور|عينة من)\s+([\\w\\s]{3,20})(?:في|$)/i
};
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 3 — ResearchIntentEngine.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/intent/ResearchIntentEngine.ts', `
import { IntentAnalysisResult, ResearchIntentType, DetectedLanguage } from '../../types/IntentAnalysisResult';
import { INTENT_PATTERNS, REGEX_PATTERNS } from './patterns';

export class ResearchIntentEngine {
  
  public analyze(text: string): IntentAnalysisResult {
    if (!text || text.trim().length === 0) {
      return this.buildDefaultResult('NON_RESEARCH', 100, 'mixed');
    }

    const cleanText = text.toLowerCase().trim();
    const language = this.detectLanguage(cleanText);
    const { intent, confidence } = this.detectIntent(cleanText);
    
    const independentVariable = this.extractRegex(cleanText, REGEX_PATTERNS.independentVarAr);
    const dependentVariable = this.extractRegex(cleanText, REGEX_PATTERNS.dependentVarAr);
    const location = this.extractRegex(cleanText, REGEX_PATTERNS.locationAr);
    const population = this.extractRegex(cleanText, REGEX_PATTERNS.populationAr);
    const academicLevel = this.extractRegex(cleanText, REGEX_PATTERNS.academicLevel);
    
    // Simple mock for discipline (would need a large taxonomy in a real scenario)
    const discipline = cleanText.includes('تعليم') || cleanText.includes('تحصيل') ? 'التربية والتعليم' : null;

    let missingParts: string[] = [];
    if (intent === 'HAS_TITLE' || intent === 'REJECTED_TITLE') {
      if (!independentVariable) missingParts.push('المتغير المستقل غير واضح');
      if (!dependentVariable) missingParts.push('المتغير التابع غير واضح');
      if (!population) missingParts.push('مجتمع الدراسة غير محدد');
      if (!academicLevel) missingParts.push('المستوى الأكاديمي غير محدد');
    }

    return {
      intent,
      confidence,
      language,
      independentVariable,
      dependentVariable,
      population,
      location,
      discipline,
      academicLevel,
      missingParts,
      nextRoute: this.getRouteForIntent(intent)
    };
  }

  private detectLanguage(text: string): DetectedLanguage {
    const arabicRegex = /[\\u0600-\\u06FF]/;
    const englishRegex = /[a-zA-Z]/;
    const hasArabic = arabicRegex.test(text);
    const hasEnglish = englishRegex.test(text);
    if (hasArabic && hasEnglish) return 'mixed';
    if (hasArabic) return 'ar';
    return 'en';
  }

  private detectIntent(text: string): { intent: ResearchIntentType, confidence: number } {
    let highestScore = 0;
    let detectedIntent: ResearchIntentType = 'NON_RESEARCH'; // Default fallback

    for (const [intentType, data] of Object.entries(INTENT_PATTERNS)) {
      const allKeywords = [...data.ar, ...data.en];
      const match = allKeywords.some(keyword => text.includes(keyword.toLowerCase()));
      
      if (match && data.score > highestScore) {
        highestScore = data.score;
        detectedIntent = intentType as ResearchIntentType;
      }
    }

    // Fallback logic if no explicit keywords matched but looks like an academic title
    if (detectedIntent === 'NON_RESEARCH' && (text.includes('أثر') || text.includes('فاعلية') || text.includes('impact'))) {
       return { intent: 'HAS_TITLE', confidence: 60 };
    }

    return { intent: detectedIntent, confidence: highestScore > 0 ? highestScore : 100 };
  }

  private extractRegex(text: string, regex: RegExp): string | null {
    const match = text.match(regex);
    return match && match[1] ? match[1].trim() : null;
  }

  private getRouteForIntent(intent: ResearchIntentType): string {
    const routes: Record<ResearchIntentType, string> = {
      NO_IDEA: '/dashboard/idea-generator',
      INITIAL_IDEA: '/dashboard/idea-developer',
      HAS_TITLE: '/dashboard/title-evaluator',
      REJECTED_TITLE: '/dashboard/rejection-analyzer',
      HAS_PROPOSAL: '/dashboard/proposal-auditor',
      WANTS_PUBLICATION: '/dashboard/publication-readiness',
      NON_RESEARCH: '/dashboard/error'
    };
    return routes[intent];
  }

  private buildDefaultResult(intent: ResearchIntentType, confidence: number, language: DetectedLanguage): IntentAnalysisResult {
    return {
      intent, confidence, language,
      independentVariable: null, dependentVariable: null,
      population: null, location: null, discipline: null, academicLevel: null,
      missingParts: [],
      nextRoute: this.getRouteForIntent(intent)
    };
  }
}
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 4 — API Route (Next.js)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/app/api/academic/intent/route.ts', `
import { NextResponse } from 'next/server';
import { ResearchIntentEngine } from '@/lib/academic/core/intent/ResearchIntentEngine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const engine = new ResearchIntentEngine();
    const result = engine.analyze(text);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 5 — Unit Tests (Testing the 5 cases)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/intent/__tests__/ResearchIntentEngine.test.ts', `
import { ResearchIntentEngine } from '../ResearchIntentEngine';

describe('ResearchIntentEngine - Sprint 1 Task 1', () => {
  let engine: ResearchIntentEngine;

  beforeEach(() => {
    engine = new ResearchIntentEngine();
  });

  test('Case 1: NON_RESEARCH - "مرحبا كيف حالك"', () => {
    const result = engine.analyze('مرحبا كيف حالك');
    expect(result.intent).toBe('NON_RESEARCH');
    expect(result.confidence).toBe(100);
  });

  test('Case 2: INITIAL_IDEA - "أفكر في أثر الذكاء الاصطناعي على التحصيل الأكاديمي"', () => {
    const result = engine.analyze('أفكر في أثر الذكاء الاصطناعي على التحصيل الأكاديمي');
    expect(result.intent).toBe('INITIAL_IDEA');
    expect(result.confidence).toBe(80);
    expect(result.independentVariable).toBe('الذكاء الاصطناعي');
    expect(result.dependentVariable).toBe('التحصيل الأكاديمي');
  });

  test('Case 3: HAS_TITLE - "عنواني: أثر الذكاء الاصطناعي على التعليم"', () => {
    const result = engine.analyze('عنواني: أثر الذكاء الاصطناعي على التعليم');
    expect(result.intent).toBe('HAS_TITLE');
    expect(result.independentVariable).toBe('الذكاء الاصطناعي');
    expect(result.dependentVariable).toBe('التعليم');
    expect(result.missingParts.length).toBeGreaterThan(0); // Should flag missing population/level
  });

  test('Case 4: REJECTED_TITLE - "عنواني رفضه المشرف: أثر الذكاء الاصطناعي على التعليم"', () => {
    const result = engine.analyze('عنواني رفضه المشرف: أثر الذكاء الاصطناعي على التعليم');
    expect(result.intent).toBe('REJECTED_TITLE');
    expect(result.confidence).toBe(95);
  });

  test('Case 5: WANTS_PUBLICATION - "نود نشر بحث عن..."', () => {
    const result = engine.analyze('نود نشر بحث عن الذكاء الاصطناعي');
    expect(result.intent).toBe('WANTS_PUBLICATION');
    expect(result.confidence).toBe(90);
  });
});
`);

console.log('\n✅ Task 1 implementation completed successfully.\n');