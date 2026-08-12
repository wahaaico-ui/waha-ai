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
    const arabicRegex = /[\u0600-\u06FF]/;
    const englishRegex = /[a-zA-Z]/;
    const hasArabic = arabicRegex.test(text);
    const hasEnglish = englishRegex.test(text);
    if (hasArabic && hasEnglish) return 'mixed';
    if (hasArabic) return 'ar';
    return 'en';
  }

  private detectIntent(text: string): { intent: ResearchIntentType, confidence: number } {
    let highestScore = 0;
    let detectedIntent: ResearchIntentType = 'NON_RESEARCH';

    for (const [intentType, data] of Object.entries(INTENT_PATTERNS)) {
      const allKeywords = [...data.ar, ...data.en];
      const match = allKeywords.some(keyword => text.includes(keyword.toLowerCase()));
      
      if (match && data.score > highestScore) {
        highestScore = data.score;
        detectedIntent = intentType as ResearchIntentType;
      }
    }

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

