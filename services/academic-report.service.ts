import type { AcademicThinkingResult } from './academic-thinking.service';

export interface SuitabilityLevel {
  suitable: boolean;
  level: 'ممتاز' | 'مناسب' | 'يحتاج تطوير' | 'غير مناسب';
  reason: string;
}

export interface TitleSuggestion {
  title: string;
  rank: number;
  reason: string;
  strength: 'قوي جداً' | 'قوي' | 'مقبول';
}

export interface AcademicReport {
  score: number;
  isSuitableAsTitle: boolean;
  suitabilityReason: string;
  strengths: string[];
  weaknesses: string[];
  needsNarrowing: boolean;
  narrowingAdvice: string | null;
  suggestedTitles: TitleSuggestion[];
  finalRecommendation: string;
  recommendedTitle: string;
  recommendedTitleReason: string;
  mastersLevel: SuitabilityLevel;
  phdLevel: SuitabilityLevel;
  publicationLevel: SuitabilityLevel;
  isRejectedTitle: boolean;
  rejectionAnalysis: string | null;
  rejectionFixes: string[] | null;
  language: 'ar' | 'en';
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export class AcademicReportService {
  static async generateReport(
    ideaText: string,
    thinking: AcademicThinkingResult
  ): Promise<AcademicReport> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured');

    const language = thinking.structure.language === 'ar' ? 'ar' : 'en';
    const isRejected = this.detectRejectedTitle(ideaText);
    const prompt = this.buildPrompt(ideaText, thinking, language, isRejected);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: language === 'ar'
              ? 'أنت مستشار أكاديمي خبير متخصص في تقييم أفكار وعناوين الأبحاث العلمية. تجيب دائماً بصيغة JSON فقط بدون أي نص إضافي.'
              : 'You are an expert academic advisor. Always respond in JSON format only, no extra text.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from Groq API');

    try {
      const clean = content.replace(/```json|```/g, '').trim();
      return JSON.parse(clean) as AcademicReport;
    } catch {
      throw new Error('Failed to parse Groq response');
    }
  }

  private static detectRejectedTitle(text: string): boolean {
    const rejectedMarkers = [
      'مرفوض', 'رُفض', 'رفض المشرف', 'عنوان مرفوض', 'rejected', 'supervisor rejected',
      'قال المشرف لا', 'لم يقبل', 'لم يوافق'
    ];
    return rejectedMarkers.some(marker => text.toLowerCase().includes(marker.toLowerCase()));
  }

  private static buildPrompt(
    ideaText: string,
    thinking: AcademicThinkingResult,
    language: 'ar' | 'en',
    isRejected: boolean
  ): string {
    const ctx = {
      category: thinking.category,
      iv: thinking.structure.independentVariable ?? (language === 'ar' ? 'غير محدد' : 'not identified'),
      dv: thinking.structure.dependentVariable ?? (language === 'ar' ? 'غير محدد' : 'not identified'),
      population: thinking.structure.population ?? (language === 'ar' ? 'غير محدد' : 'not identified'),
      location: thinking.structure.location ?? (language === 'ar' ? 'غير محدد' : 'not identified'),
      concepts: thinking.academicConcepts.join(', '),
      studyType: thinking.structure.studyType,
    };

    if (language === 'ar') {
      return `أنت مشرف أكاديمي خبير. قيّم هذا المدخل البحثي بدقة علمية كاملة وأرجع JSON فقط.

المدخل: "${ideaText}"
التصنيف: ${ctx.category}
${isRejected ? '⚠️ هذا عنوان مرفوض من المشرف - حلل سبب الرفض وقدم حلولاً' : ''}
المتغير المستقل: ${ctx.iv}
المتغير التابع: ${ctx.dv}
المجتمع: ${ctx.population}
المكان: ${ctx.location}
المفاهيم: ${ctx.concepts}
نوع الدراسة: ${ctx.studyType}

أرجع JSON بهذا الشكل بالضبط:
{
  "score": <رقم 0-100>,
  "isSuitableAsTitle": <true أو false>,
  "suitabilityReason": "<سبب واضح>",
  "strengths": ["<نقطة قوة 1>", "<نقطة قوة 2>", "<نقطة قوة 3>"],
  "weaknesses": ["<نقطة ضعف 1>", "<نقطة ضعف 2>"],
  "needsNarrowing": <true أو false>,
  "narrowingAdvice": "<نصيحة تضييق أو null>",
  "suggestedTitles": [
    {"title": "<عنوان 1 كامل ودقيق>", "rank": 1, "reason": "<سبب>", "strength": "قوي جداً"},
    {"title": "<عنوان 2>", "rank": 2, "reason": "<سبب>", "strength": "قوي"},
    {"title": "<عنوان 3>", "rank": 3, "reason": "<سبب>", "strength": "مقبول"}
  ],
  "finalRecommendation": "<توصية نهائية شاملة>",
  "recommendedTitle": "<أفضل عنوان من القائمة>",
  "recommendedTitleReason": "<سبب اختياره تحديداً>",
  "mastersLevel": {
    "suitable": <true أو false>,
    "level": "<ممتاز أو مناسب أو يحتاج تطوير أو غير مناسب>",
    "reason": "<سبب واضح ومحدد>"
  },
  "phdLevel": {
    "suitable": <true أو false>,
    "level": "<ممتاز أو مناسب أو يحتاج تطوير أو غير مناسب>",
    "reason": "<سبب واضح ومحدد>"
  },
  "publicationLevel": {
    "suitable": <true أو false>,
    "level": "<ممتاز أو مناسب أو يحتاج تطوير أو غير مناسب>",
    "reason": "<سبب واضح ومحدد>"
  },
  "isRejectedTitle": ${isRejected},
  "rejectionAnalysis": ${isRejected ? '"<تحليل سبب الرفض المحتمل من المشرف>"' : 'null'},
  "rejectionFixes": ${isRejected ? '["<حل 1>", "<حل 2>", "<حل 3>"]' : 'null'},
  "language": "ar"
}`;
    }

    return `You are an expert academic supervisor. Evaluate this research input scientifically and return JSON only.

Input: "${ideaText}"
Category: ${ctx.category}
${isRejected ? '⚠️ This is a REJECTED title - analyze rejection reason and provide fixes' : ''}
Independent Variable: ${ctx.iv}
Dependent Variable: ${ctx.dv}
Population: ${ctx.population}
Location: ${ctx.location}
Concepts: ${ctx.concepts}
Study Type: ${ctx.studyType}

Return JSON in this exact format:
{
  "score": <0-100>,
  "isSuitableAsTitle": <true or false>,
  "suitabilityReason": "<clear reason>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "needsNarrowing": <true or false>,
  "narrowingAdvice": "<advice or null>",
  "suggestedTitles": [
    {"title": "<full precise title 1>", "rank": 1, "reason": "<reason>", "strength": "قوي جداً"},
    {"title": "<title 2>", "rank": 2, "reason": "<reason>", "strength": "قوي"},
    {"title": "<title 3>", "rank": 3, "reason": "<reason>", "strength": "مقبول"}
  ],
  "finalRecommendation": "<comprehensive final recommendation>",
  "recommendedTitle": "<best title>",
  "recommendedTitleReason": "<why this one>",
  "mastersLevel": {
    "suitable": <true or false>,
    "level": "<ممتاز or مناسب or يحتاج تطوير or غير مناسب>",
    "reason": "<specific clear reason>"
  },
  "phdLevel": {
    "suitable": <true or false>,
    "level": "<ممتاز or مناسب or يحتاج تطوير or غير مناسب>",
    "reason": "<specific clear reason>"
  },
  "publicationLevel": {
    "suitable": <true or false>,
    "level": "<ممتاز or مناسب or يحتاج تطوير or غير مناسب>",
    "reason": "<specific clear reason>"
  },
  "isRejectedTitle": ${isRejected},
  "rejectionAnalysis": ${isRejected ? '"<analysis of likely rejection reason>"' : 'null'},
  "rejectionFixes": ${isRejected ? '["<fix 1>", "<fix 2>", "<fix 3>"]' : 'null'},
  "language": "en"
}`;
  }
}
