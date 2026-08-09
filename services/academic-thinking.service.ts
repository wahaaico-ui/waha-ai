import { ArabicResearchDictionary } from '@/lib/openalex/arabic-dictionary';

export type AcademicInputCategory =
  | 'Greeting'
  | 'Random Text'
  | 'Question'
  | 'Research Title'
  | 'Research Idea'
  | 'Research Problem';

export type AcademicLanguage = 'ar' | 'en' | 'mixed' | 'unknown';

export interface ResearchStructure {
  researchTopic: string | null;
  independentVariable: string | null;
  dependentVariable: string | null;
  population: string | null;
  location: string | null;
  time: string | null;
  studyType: 'Causal' | 'Correlational' | 'Descriptive' | 'Problem-focused' | 'Unspecified';
  language: AcademicLanguage;
}

export interface AcademicThinkingResult {
  valid: boolean;
  readyForSearch: boolean;
  category: AcademicInputCategory;
  reason: string | null;
  normalizedInput: string;
  academicConcepts: string[];
  translatedAcademicConcepts: string[];
  structure: ResearchStructure;
  missingComponents: string[];
  ideaConfidence: number;
}

const INVALID_REASON = 'This is not an academic research idea.';
const MINIMUM_LENGTH = 16;

const GREETING_TOKENS = new Set([
  'مرحبا', 'اهلا', 'هلا', 'سلام', 'السلام', 'عليكم', 'كيف', 'الحال', 'حال', 'حالك',
  'شو', 'ايش', 'اخبارك', 'الاخبار', 'اخبار', 'صباح', 'مساء', 'الخير', 'خير', 'هاي',
  'hello', 'hi', 'hey', 'greetings', 'how', 'are', 'you', 'good', 'morning', 'evening',
]);

const QUESTION_STARTERS = new Set([
  'هل', 'كيف', 'لماذا', 'ليش', 'ماذا', 'ما', 'متي', 'اين', 'مين',
  'what', 'why', 'how', 'when', 'where', 'who', 'can', 'could', 'should', 'is', 'are', 'do', 'does',
]);

const ENGLISH_ACADEMIC_PHRASES = [
  'artificial intelligence', 'machine learning', 'deep learning', 'neural networks',
  'natural language processing', 'higher education', 'academic achievement',
  'digital transformation', 'social media', 'public health', 'mental health',
  'health care', 'healthcare', 'job satisfaction', 'organizational performance',
  'quality of life', 'climate change', 'renewable energy', 'sustainable development',
];

const ENGLISH_ACADEMIC_NOUNS = new Set([
  'education', 'learning', 'health', 'healthcare', 'medicine', 'diagnosis', 'technology',
  'productivity', 'performance', 'quality', 'management', 'leadership', 'employees',
  'students', 'teachers', 'universities', 'university', 'schools', 'population',
  'innovation', 'economy', 'economics', 'finance', 'marketing', 'environment',
  'climate', 'energy', 'security', 'privacy', 'data', 'algorithm', 'algorithms',
  'depression', 'anxiety', 'cancer', 'diabetes', 'nursing', 'governance',
  'sustainability', 'achievement', 'motivation', 'satisfaction', 'behavior',
  'communication', 'media', 'society', 'culture', 'development', 'research',
]);

const ARABIC_ACADEMIC_PHRASES = [
  'الذكاء الاصطناعي', 'التعلم الالي', 'تعلم الاله', 'التعلم العميق',
  'الشبكات العصبيه', 'معالجه اللغات الطبيعيه', 'البيانات الضخمه',
  'تحليل البيانات', 'علم البيانات', 'التحول الرقمي', 'التعليم العالي',
  'التعليم الجامعي', 'التعليم الالكتروني', 'التحصيل الدراسي',
  'صعوبات التعلم', 'الصحه النفسيه', 'الصحه العامه', 'الرعايه الصحيه',
  'الرضا الوظيفي', 'الاداء الوظيفي', 'الثقافه التنظيميه', 'القياده التحويليه',
  'التنميه المستدامه', 'التغير المناخي', 'الطاقه المتجدده',
  'وسايل التواصل الاجتماعي', 'جوده الحياه', 'جوده التعليم',
];

const ARABIC_ACADEMIC_NOUNS = new Set([
  'تعليم', 'تعلم', 'صحه', 'طب', 'تشخيص', 'تقنيه', 'تكنولوجيا', 'انتاجيه',
  'اداء', 'جوده', 'اداره', 'قياده', 'موظفين', 'عاملين', 'طلاب', 'طلبه',
  'معلمين', 'جامعات', 'جامعه', 'مدارس', 'مدرسه', 'مرضى', 'اطفال',
  'ابتكار', 'اقتصاد', 'ماليه', 'تسويق', 'بييه', 'مناخ', 'طاقه', 'امن',
  'خصوصيه', 'بيانات', 'خوارزميات', 'اكتئاب', 'قلق', 'سرطان', 'سكري',
  'تمريض', 'حوكمه', 'استدامه', 'تحصيل', 'دافعيه', 'رضا', 'سلوك',
  'اعلام', 'مجتمع', 'ثقافه', 'تنميه', 'بطاله', 'فقر', 'عنف', 'تنمر',
  'تلوث', 'مياه', 'زراعه', 'سياحه', 'تجاره', 'استثمار', 'تمويل',
  'فلسطين', 'سعوديه', 'امارات', 'مصر', 'اردن', 'كويت', 'قطر', 'بحرين',
  'عمان', 'يمن', 'عراق', 'سوريا', 'لبنان', 'مغرب', 'جزاير', 'تونس', 'ليبيا',
]);

const STRUCTURAL_TERMS = new Set([
  'اثر', 'تاثير', 'دور', 'علاقه', 'فاعليه', 'دراسه', 'بحث', 'مشكله',
  'impact', 'effect', 'role', 'relationship', 'study', 'research', 'problem',
]);

const PROBLEM_MARKERS = [
  'مشكله', 'قصور', 'ضعف', 'ندره', 'فجوه', 'يعاني', 'تحديات',
  'problem', 'lack', 'shortage', 'gap', 'challenge', 'challenges', 'decline',
];

const IDEA_MARKERS = [
  'اريد', 'اقترح', 'افكر', 'فكره', 'سوف ادرس',
  'i want', 'i propose', 'i plan', 'research idea', 'we propose',
];

const POPULATIONS = [
  'طلاب الجامعات', 'طلبه الجامعات', 'طلاب', 'طلبه', 'معلمين', 'معلمات',
  'موظفين', 'عاملين', 'مرضى', 'اطفال', 'نساء', 'شباب', 'اعضاء هييه التدريس',
  'university students', 'students', 'teachers', 'employees', 'workers', 'patients',
  'children', 'women', 'youth', 'faculty members',
];

const LOCATIONS = [
  'فلسطين', 'السعوديه', 'الامارات', 'مصر', 'الاردن', 'الكويت', 'قطر', 'البحرين',
  'عمان', 'اليمن', 'العراق', 'سوريا', 'لبنان', 'المغرب', 'الجزائر', 'تونس', 'ليبيا',
  'palestine', 'saudi arabia', 'united arab emirates', 'egypt', 'jordan', 'kuwait',
  'qatar', 'bahrain', 'oman', 'yemen', 'iraq', 'syria', 'lebanon', 'morocco',
  'algeria', 'tunisia', 'libya',
];

export class AcademicThinkingService {
  static analyze(input: unknown): AcademicThinkingResult {
    const original = typeof input === 'string' ? input.trim() : '';
    const normalizedInput = this.normalize(original);
    const language = this.detectLanguage(original);
    const tokens = this.tokens(normalizedInput);
    const canonicalTokens = tokens.map(token => this.canonicalToken(token));
    const isGreeting = this.isGreeting(canonicalTokens);
    const isQuestion = this.isQuestion(original, canonicalTokens);
    const academicConcepts = this.extractAcademicConcepts(normalizedInput, tokens, language);
    const category = this.category(normalizedInput, tokens, academicConcepts, isGreeting, isQuestion);

    if (isGreeting) {
      return this.invalid(category, normalizedInput, language, 0);
    }

    const random = this.isRandom(normalizedInput, academicConcepts);
    if (!original || normalizedInput.length < MINIMUM_LENGTH || random) {
      return this.invalid('Random Text', normalizedInput, language, 5);
    }

    if (isQuestion) {
      return this.invalid('Question', normalizedInput, language, 40, academicConcepts);
    }

    const structure = this.extractStructure(normalizedInput, academicConcepts, category, language);
    const missingComponents = [
      ...(!structure.independentVariable ? ['independentVariable'] : []),
      ...(!structure.dependentVariable ? ['dependentVariable'] : []),
    ];
    const translatedAcademicConcepts = this.translateConcepts(academicConcepts, language);
    const confidence = category === 'Research Problem'
      ? 95
      : missingComponents.length === 0
        ? 80
        : 40;

    return {
      valid: true,
      readyForSearch: missingComponents.length === 0,
      category,
      reason: missingComponents.length > 0 ? 'Missing required research components.' : null,
      normalizedInput,
      academicConcepts,
      translatedAcademicConcepts,
      structure,
      missingComponents,
      ideaConfidence: confidence,
    };
  }

  static normalize(text: string): string {
    return text
      .normalize('NFKC')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/([\p{L}])\1{2,}/gu, '$1')
      .replace(/[^\p{L}\p{N}\s?؟-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private static category(
    normalized: string,
    tokens: string[],
    concepts: string[],
    greeting: boolean,
    question: boolean
  ): AcademicInputCategory {
    if (greeting) return 'Greeting';
    if (question) return 'Question';
    if (this.includesAny(normalized, PROBLEM_MARKERS)) return 'Research Problem';
    if (concepts.length === 0) return 'Random Text';
    if (this.includesAny(normalized, IDEA_MARKERS)) return 'Research Idea';

    const hasRelationship = /(?:اثر|تاثير|دور|علاقه|فاعليه|impact|effect|role|relationship)/.test(normalized);
    return hasRelationship || tokens.length <= 16 ? 'Research Title' : 'Research Idea';
  }

  private static extractStructure(
    normalized: string,
    concepts: string[],
    category: AcademicInputCategory,
    language: AcademicLanguage
  ): ResearchStructure {
    const causal = language === 'en'
      ? normalized.match(/(?:impact|effect|role)\s+of\s+(.+?)\s+(?:on|in)\s+(.+?)(?:\s+(?:among|in)\s+|$)/)
      : normalized.match(/(?:اثر|تاثير|دور|فاعليه)\s+(.+?)\s+(?:علي|في)\s+(.+?)(?:\s+(?:لدي|بين)\s+|$)/);
    const correlation = language === 'en'
      ? normalized.match(/relationship\s+between\s+(.+?)\s+and\s+(.+?)(?:\s+(?:among|in)\s+|$)/)
      : normalized.match(/العلاقه\s+بين\s+(.+?)\s+و\s+(.+?)(?:\s+(?:لدي|بين)\s+|$)/);
    const match = causal ?? correlation;
    let independentVariable = this.cleanComponent(match?.[1] ?? null);
    const dependentVariable = this.cleanComponent(match?.[2] ?? null);

    if (
      !independentVariable &&
      concepts.length > 0 &&
      (category === 'Research Title' || category === 'Research Idea')
    ) {
      independentVariable = concepts[0];
    }
    return {
      researchTopic: concepts.length > 0 ? concepts.join(' | ') : null,
      independentVariable,
      dependentVariable,
      population: this.firstIncluded(normalized, POPULATIONS),
      location: this.firstIncluded(normalized, LOCATIONS),
      time: this.extractTime(normalized),
      studyType: correlation
        ? 'Correlational'
        : causal
          ? 'Causal'
          : category === 'Research Problem'
            ? 'Problem-focused'
            : category === 'Research Title' || category === 'Research Idea'
              ? 'Descriptive'
              : 'Unspecified',
      language,
    };
  }

  private static extractAcademicConcepts(
    normalized: string,
    tokens: string[],
    language: AcademicLanguage
  ): string[] {
    const concepts: string[] = [];

    if (language === 'ar' || language === 'mixed') {
      const consumed = new Set<string>();
      for (const phrase of ARABIC_ACADEMIC_PHRASES) {
        if (normalized.includes(phrase)) {
          concepts.push(phrase);
          phrase.split(' ').forEach(word => consumed.add(this.canonicalToken(word)));
        }
      }
      for (const token of tokens) {
        const canonical = this.canonicalToken(token);
        if (
          ARABIC_ACADEMIC_NOUNS.has(canonical) &&
          !STRUCTURAL_TERMS.has(canonical) &&
          !consumed.has(canonical)
        ) {
          concepts.push(token);
        }
      }
    }

    if (language === 'en' || language === 'mixed') {
      const consumed = new Set<string>();
      for (const phrase of ENGLISH_ACADEMIC_PHRASES) {
        if (normalized.includes(phrase)) {
          concepts.push(phrase);
          phrase.split(' ').forEach(word => consumed.add(word));
        }
      }
      for (const token of tokens) {
        if (ENGLISH_ACADEMIC_NOUNS.has(token) && !consumed.has(token)) concepts.push(token);
      }
    }

    return [...new Set(concepts)];
  }

  private static translateConcepts(concepts: string[], language: AcademicLanguage): string[] {
    if (language === 'en') return [...concepts];
    const conceptTokens = concepts.flatMap(concept => this.tokens(concept));
    const translated = ArabicResearchDictionary.translate(concepts.join(' '), conceptTokens);
    return translated.terms;
  }

  private static invalid(
    category: AcademicInputCategory,
    normalizedInput: string,
    language: AcademicLanguage,
    confidence: number,
    academicConcepts: string[] = []
  ): AcademicThinkingResult {
    return {
      valid: false,
      readyForSearch: false,
      category,
      reason: INVALID_REASON,
      normalizedInput,
      academicConcepts,
      translatedAcademicConcepts: [],
      structure: {
        researchTopic: academicConcepts.length > 0 ? academicConcepts.join(' | ') : null,
        independentVariable: null,
        dependentVariable: null,
        population: null,
        location: null,
        time: null,
        studyType: 'Unspecified',
        language,
      },
      missingComponents: [],
      ideaConfidence: confidence,
    };
  }

  private static isGreeting(tokens: string[]): boolean {
    return tokens.length > 0 && tokens.every(token => GREETING_TOKENS.has(token));
  }

  private static isQuestion(original: string, tokens: string[]): boolean {
    return /[?؟]\s*$/.test(original) || QUESTION_STARTERS.has(tokens[0]);
  }

  private static isRandom(normalized: string, concepts: string[]): boolean {
    if (concepts.length < 2) return true;
    if (/(\p{L}{1,3})\1{2,}/u.test(normalized.replace(/\s/g, ''))) return true;
    return false;
  }

  private static canonicalToken(token: string): string {
    if (/^[\u0600-\u06FF]+$/.test(token)) {
      const withoutArticle = token.replace(/^(?:و|ف|ب|ك|ل)?ال/, '');
      return withoutArticle.length >= 3 ? withoutArticle : token;
    }
    return token;
  }

  private static tokens(text: string): string[] {
    return text.match(/[\p{L}\p{N}]+/gu) ?? [];
  }

  private static detectLanguage(text: string): AcademicLanguage {
    const arabic = text.match(/[\u0600-\u06FF]/g)?.length ?? 0;
    const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
    if (arabic === 0 && latin === 0) return 'unknown';
    if (arabic > 0 && latin > 0) return 'mixed';
    return arabic > 0 ? 'ar' : 'en';
  }

  private static includesAny(text: string, values: string[]): boolean {
    return values.some(value => text.includes(value));
  }

  private static firstIncluded(text: string, values: string[]): string | null {
    return values.find(value => text.includes(value)) ?? null;
  }

  private static extractTime(text: string): string | null {
    const range = text.match(/\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\b/);
    if (range) return range[0];
    return text.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;
  }

  private static cleanComponent(value: string | null): string | null {
    const cleaned = value?.replace(/\s+/g, ' ').trim();
    return cleaned || null;
  }
}
