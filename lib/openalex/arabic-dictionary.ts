/**
 * Arabic Research Dictionary
 *
 * A fixed, internal Arabic → English lookup table for research vocabulary,
 * plus Arabic text normalization. Pure table lookup — NO AI, no translation
 * API, no network, no guessing.
 *
 * Why it exists: OpenAlex indexes almost no Arabic full text, so an Arabic
 * query like "الذكاء الاصطناعي والإنتاجية" legitimately matches zero works
 * even though the topic has thousands of English papers. Mapping the terms to
 * their English equivalents finds that literature. A term that is not in the
 * table is simply left out — the dictionary never invents a translation.
 */

/**
 * Multi-word phrases, checked before single words so "ذكاء اصطناعي" becomes
 * "artificial intelligence" rather than the looser "intelligence artificial".
 */
const PHRASES: Record<string, string> = {
  'الذكاء الاصطناعي': 'artificial intelligence',
  'التعلم الآلي': 'machine learning',
  'تعلم الآلة': 'machine learning',
  'التعلم العميق': 'deep learning',
  'الشبكات العصبية': 'neural networks',
  'معالجة اللغات الطبيعية': 'natural language processing',
  'البيانات الضخمة': 'big data',
  'تحليل البيانات': 'data analysis',
  'علم البيانات': 'data science',
  'الحوسبة السحابية': 'cloud computing',
  'إنترنت الأشياء': 'internet of things',
  'الأمن السيبراني': 'cybersecurity',
  'أمن المعلومات': 'information security',
  'التحول الرقمي': 'digital transformation',
  'الاقتصاد الرقمي': 'digital economy',
  'المدن الذكية': 'smart cities',
  'الواقع المعزز': 'augmented reality',
  'الواقع الافتراضي': 'virtual reality',
  'سلاسل الكتل': 'blockchain',
  'التعليم الإلكتروني': 'e-learning',
  'التعليم عن بعد': 'distance education',
  'التعلم عن بعد': 'distance learning',
  'التعليم العالي': 'higher education',
  'التعليم الجامعي': 'university education',
  'التعليم العام': 'general education',
  'التربية الخاصة': 'special education',
  'رياض الأطفال': 'kindergarten',
  'الطفولة المبكرة': 'early childhood',
  'صعوبات التعلم': 'learning disabilities',
  'التحصيل الدراسي': 'academic achievement',
  'الدافعية للتعلم': 'learning motivation',
  'أعضاء هيئة التدريس': 'faculty members',
  'الدراسات العليا': 'graduate studies',
  'البحث العلمي': 'scientific research',
  'المناهج الدراسية': 'curriculum',
  'طرق التدريس': 'teaching methods',
  'ضمان الجودة': 'quality assurance',
  'الجودة الشاملة': 'total quality management',
  'الموارد البشرية': 'human resources',
  'الرضا الوظيفي': 'job satisfaction',
  'الأداء الوظيفي': 'job performance',
  'الالتزام التنظيمي': 'organizational commitment',
  'الثقافة التنظيمية': 'organizational culture',
  'السلوك التنظيمي': 'organizational behavior',
  'القيادة التحويلية': 'transformational leadership',
  'اتخاذ القرار': 'decision making',
  'إدارة المخاطر': 'risk management',
  'إدارة المعرفة': 'knowledge management',
  'سلسلة التوريد': 'supply chain',
  'ريادة الأعمال': 'entrepreneurship',
  'المشروعات الصغيرة': 'small enterprises',
  'المنشآت الصغيرة والمتوسطة': 'small and medium enterprises',
  'التجارة الإلكترونية': 'e-commerce',
  'التسويق الإلكتروني': 'digital marketing',
  'سلوك المستهلك': 'consumer behavior',
  'المسؤولية الاجتماعية': 'corporate social responsibility',
  'التنمية المستدامة': 'sustainable development',
  'التنمية الاقتصادية': 'economic development',
  'النمو الاقتصادي': 'economic growth',
  'الاستثمار الأجنبي': 'foreign investment',
  'القوائم المالية': 'financial statements',
  'المراجعة الداخلية': 'internal audit',
  'الحوكمة المؤسسية': 'corporate governance',
  'البنوك الإسلامية': 'islamic banking',
  'التمويل الإسلامي': 'islamic finance',
  'الشمول المالي': 'financial inclusion',
  'الرعاية الصحية': 'healthcare',
  'الصحة النفسية': 'mental health',
  'الصحة العامة': 'public health',
  'جودة الحياة': 'quality of life',
  'الرعاية التمريضية': 'nursing care',
  'ضغط الدم': 'blood pressure',
  'داء السكري': 'diabetes',
  'أمراض القلب': 'heart disease',
  'الأمن الغذائي': 'food security',
  'التغير المناخي': 'climate change',
  'التغيّر المناخي': 'climate change',
  'الطاقة المتجددة': 'renewable energy',
  'الطاقة الشمسية': 'solar energy',
  'التلوث البيئي': 'environmental pollution',
  'الموارد المائية': 'water resources',
  'وسائل التواصل الاجتماعي': 'social media',
  'شبكات التواصل الاجتماعي': 'social networks',
  'الإعلام الرقمي': 'digital media',
  'الرأي العام': 'public opinion',
  'حقوق الإنسان': 'human rights',
  'العلاقات الدولية': 'international relations',
  'المملكة العربية السعودية': 'saudi arabia',
  'الإمارات العربية المتحدة': 'united arab emirates',
  'دول الخليج': 'gulf countries',
  'الشرق الأوسط': 'middle east',
  'العالم العربي': 'arab world',
  'الدول العربية': 'arab countries',
  'المنهج الوصفي': 'descriptive method',
  'المنهج التجريبي': 'experimental method',
  'المنهج الكمي': 'quantitative method',
  'المنهج النوعي': 'qualitative method',
  'تحليل المحتوى': 'content analysis',
  'الإحصاء الوصفي': 'descriptive statistics',
};

/** Single words. Keys are matched after Arabic normalization (see `normalize`). */
const WORDS: Record<string, string> = {
  // --- Technology & computing ---
  ذكاء: 'intelligence',
  اصطناعي: 'artificial',
  خوارزمية: 'algorithm',
  خوارزميات: 'algorithms',
  برمجة: 'programming',
  برمجيات: 'software',
  حاسوب: 'computer',
  حاسب: 'computer',
  شبكة: 'network',
  شبكات: 'networks',
  بيانات: 'data',
  معلومات: 'information',
  نظام: 'system',
  أنظمة: 'systems',
  تقنية: 'technology',
  تقنيات: 'technologies',
  تكنولوجيا: 'technology',
  رقمي: 'digital',
  رقمية: 'digital',
  إلكتروني: 'electronic',
  آلي: 'automated',
  أتمتة: 'automation',
  روبوت: 'robot',
  روبوتات: 'robotics',
  استشعار: 'sensing',
  تطبيق: 'application',
  تطبيقات: 'applications',
  منصة: 'platform',
  منصات: 'platforms',
  خصوصية: 'privacy',
  تشفير: 'encryption',
  اختراق: 'hacking',
  محاكاة: 'simulation',
  نمذجة: 'modeling',
  تصنيف: 'classification',
  تنبؤ: 'prediction',
  استشراف: 'foresight',

  // --- Education ---
  تعليم: 'education',
  تربية: 'education',
  تربوي: 'educational',
  تعليمي: 'educational',
  تعلم: 'learning',
  جامعة: 'university',
  جامعات: 'universities',
  جامعي: 'university',
  كلية: 'college',
  مدرسة: 'school',
  مدارس: 'schools',
  طالب: 'student',
  طلاب: 'students',
  طلبة: 'students',
  معلم: 'teacher',
  معلمين: 'teachers',
  معلمات: 'teachers',
  مدرس: 'teacher',
  أستاذ: 'professor',
  منهج: 'curriculum',
  مناهج: 'curriculum',
  تدريس: 'teaching',
  تدريب: 'training',
  مهارات: 'skills',
  كفايات: 'competencies',
  تحصيل: 'achievement',
  دافعية: 'motivation',
  تقويم: 'assessment',
  تقييم: 'evaluation',
  اختبار: 'test',
  اختبارات: 'tests',
  أكاديمي: 'academic',
  علمي: 'scientific',
  بحث: 'research',
  دراسة: 'study',
  أطروحة: 'thesis',
  ابتكار: 'innovation',
  إبداع: 'creativity',
  موهبة: 'giftedness',
  أمية: 'illiteracy',
  مناقشة: 'discussion',
  حضور: 'attendance',
  تسرب: 'dropout',

  // --- Health & medicine ---
  صحة: 'health',
  صحي: 'health',
  طب: 'medicine',
  طبي: 'medical',
  مرض: 'disease',
  أمراض: 'diseases',
  مرضى: 'patients',
  تشخيص: 'diagnosis',
  علاج: 'treatment',
  دواء: 'drug',
  أدوية: 'drugs',
  تمريض: 'nursing',
  ممرضات: 'nurses',
  مستشفى: 'hospital',
  مستشفيات: 'hospitals',
  عيادة: 'clinic',
  رعاية: 'care',
  وقاية: 'prevention',
  تغذية: 'nutrition',
  سمنة: 'obesity',
  سرطان: 'cancer',
  سكري: 'diabetes',
  وباء: 'epidemic',
  جائحة: 'pandemic',
  كورونا: 'covid-19',
  تطعيم: 'vaccination',
  نفسي: 'psychological',
  نفسية: 'psychological',
  قلق: 'anxiety',
  اكتئاب: 'depression',
  ضغوط: 'stress',
  إجهاد: 'burnout',
  إدمان: 'addiction',
  إعاقة: 'disability',
  توحد: 'autism',
  شيخوخة: 'aging',
  حمل: 'pregnancy',
  أطفال: 'children',
  طفل: 'child',
  مسنين: 'elderly',

  // --- Management, business & economics ---
  إدارة: 'management',
  إداري: 'administrative',
  تنظيمي: 'organizational',
  قيادة: 'leadership',
  قيادي: 'leadership',
  حوكمة: 'governance',
  استراتيجية: 'strategy',
  استراتيجي: 'strategic',
  تخطيط: 'planning',
  أداء: 'performance',
  إنتاجية: 'productivity',
  إنتاج: 'production',
  كفاءة: 'efficiency',
  فاعلية: 'effectiveness',
  جودة: 'quality',
  موظفين: 'employees',
  موظف: 'employee',
  عاملين: 'workers',
  عمالة: 'labor',
  توظيف: 'employment',
  بطالة: 'unemployment',
  رضا: 'satisfaction',
  ولاء: 'loyalty',
  تحفيز: 'motivation',
  شركة: 'company',
  شركات: 'companies',
  مؤسسة: 'organization',
  مؤسسات: 'institutions',
  منظمة: 'organization',
  منشآت: 'enterprises',
  قطاع: 'sector',
  صناعة: 'industry',
  تسويق: 'marketing',
  علامة: 'brand',
  مبيعات: 'sales',
  عملاء: 'customers',
  مستهلك: 'consumer',
  تجارة: 'commerce',
  اقتصاد: 'economics',
  اقتصادي: 'economic',
  مالية: 'finance',
  مالي: 'financial',
  محاسبة: 'accounting',
  مراجعة: 'auditing',
  ضرائب: 'taxation',
  زكاة: 'zakat',
  بنوك: 'banks',
  مصرفي: 'banking',
  تمويل: 'financing',
  استثمار: 'investment',
  أسهم: 'stocks',
  تأمين: 'insurance',
  مخاطر: 'risk',
  أرباح: 'profitability',
  تكاليف: 'costs',
  ميزانية: 'budget',
  تضخم: 'inflation',
  تنمية: 'development',
  تطوير: 'development',
  استدامة: 'sustainability',
  مستدام: 'sustainable',
  تنافسية: 'competitiveness',
  مشروع: 'project',
  مشروعات: 'projects',
  ريادة: 'entrepreneurship',
  إمداد: 'supply',
  لوجستيات: 'logistics',
  نقل: 'transportation',
  سياحة: 'tourism',
  ضيافة: 'hospitality',
  عقار: 'real estate',
  زراعة: 'agriculture',
  زراعي: 'agricultural',
  تصدير: 'exports',
  خصخصة: 'privatization',
  رؤية: 'vision',

  // --- Society, media, law & environment ---
  مجتمع: 'society',
  اجتماعي: 'social',
  ثقافة: 'culture',
  ثقافي: 'cultural',
  أسرة: 'family',
  زواج: 'marriage',
  شباب: 'youth',
  مرأة: 'women',
  نساء: 'women',
  جنس: 'gender',
  سكان: 'population',
  هجرة: 'migration',
  لاجئين: 'refugees',
  فقر: 'poverty',
  جريمة: 'crime',
  عنف: 'violence',
  تنمر: 'bullying',
  إعلام: 'media',
  صحافة: 'journalism',
  اتصال: 'communication',
  تواصل: 'communication',
  خطاب: 'discourse',
  لغة: 'language',
  ترجمة: 'translation',
  أدب: 'literature',
  تاريخ: 'history',
  دين: 'religion',
  إسلامي: 'islamic',
  شريعة: 'sharia',
  فقه: 'jurisprudence',
  قانون: 'law',
  قانوني: 'legal',
  قضاء: 'judiciary',
  حقوق: 'rights',
  سياسة: 'policy',
  سياسي: 'political',
  دبلوماسية: 'diplomacy',
  حرب: 'war',
  أمن: 'security',
  إرهاب: 'terrorism',
  بيئة: 'environment',
  بيئي: 'environmental',
  مناخ: 'climate',
  تلوث: 'pollution',
  طاقة: 'energy',
  كهرباء: 'electricity',
  مياه: 'water',
  نفايات: 'waste',
  تصحر: 'desertification',
  مدينة: 'city',
  حضري: 'urban',
  ريفي: 'rural',
  إسكان: 'housing',
  عمارة: 'architecture',
  هندسة: 'engineering',
  إنشاءات: 'construction',
  مواد: 'materials',
  نفط: 'petroleum',
  كيمياء: 'chemistry',
  فيزياء: 'physics',
  أحياء: 'biology',
  رياضيات: 'mathematics',
  إحصاء: 'statistics',
  جغرافيا: 'geography',
  رياضة: 'sport',
  فنون: 'arts',
  تصميم: 'design',

  // --- Research method vocabulary ---
  منهجية: 'methodology',
  استبانة: 'questionnaire',
  استبيان: 'questionnaire',
  مقابلات: 'interviews',
  عينة: 'sample',
  متغيرات: 'variables',
  فرضيات: 'hypotheses',
  ارتباط: 'correlation',
  انحدار: 'regression',
  كمي: 'quantitative',
  نوعي: 'qualitative',
  تجريبي: 'experimental',
  مسح: 'survey',
  مقارنة: 'comparative',
  حالة: 'case',
  مؤشرات: 'indicators',
  نموذج: 'model',
  إطار: 'framework',
  معوقات: 'barriers',
  تحديات: 'challenges',
  فرص: 'opportunities',
  آثار: 'effects',
  علاقة: 'relationship',
  اتجاهات: 'attitudes',
  تصورات: 'perceptions',
  وعي: 'awareness',
  سلوك: 'behavior',
  ممارسات: 'practices',
  تجربة: 'experience',
  رقابة: 'control',
  شفافية: 'transparency',
  فساد: 'corruption',
  عدالة: 'justice',
  مساواة: 'equality',
  أخلاقيات: 'ethics',
  معايير: 'standards',
  تشريع: 'legislation',
  سياسات: 'policies',
  خدمات: 'services',
  خدمة: 'service',
  عمليات: 'operations',
  تشغيل: 'operation',

  // --- Places ---
  السعودية: 'saudi arabia',
  سعودي: 'saudi',
  المملكة: 'kingdom',
  الإمارات: 'united arab emirates',
  إماراتي: 'emirati',
  مصر: 'egypt',
  مصري: 'egyptian',
  الأردن: 'jordan',
  أردني: 'jordanian',
  الكويت: 'kuwait',
  كويتي: 'kuwaiti',
  قطر: 'qatar',
  قطري: 'qatari',
  البحرين: 'bahrain',
  عمان: 'oman',
  اليمن: 'yemen',
  العراق: 'iraq',
  عراقي: 'iraqi',
  سوريا: 'syria',
  لبنان: 'lebanon',
  فلسطين: 'palestine',
  فلسطيني: 'palestinian',
  المغرب: 'morocco',
  الجزائر: 'algeria',
  تونس: 'tunisia',
  ليبيا: 'libya',
  السودان: 'sudan',
  تركيا: 'turkey',
  الخليج: 'gulf',
  خليجي: 'gulf',
  عربي: 'arab',
  عربية: 'arabic',
  إفريقيا: 'africa',
  آسيا: 'asia',
  أوروبا: 'europe',
  دولي: 'international',
  عالمي: 'global',
  محلي: 'local',
  إقليمي: 'regional',
};

/** Arabic diacritics and tatweel — never meaningful for a lookup. */
const DIACRITICS = /[ً-ٰٟـۖ-ۭ]/g;

/** Prefixes that attach the definite article to a word: ال، وال، بال، كال، فال، لل. */
const ARTICLE_PREFIX = /^(?:و|ف|ب|ك|ل)?ال|^لل/;

/** One translated term plus the Arabic it came from, for traceability. */
export interface DictionaryHit {
  /** The Arabic phrase or word that matched a table key. */
  source: string;
  /** The English term the table maps it to. */
  translation: string;
}

export interface TranslationResult {
  /** English terms, phrase matches first, deduplicated, ready to join into a query. */
  terms: string[];
  /** Every match, in the order found. */
  hits: DictionaryHit[];
  /** Arabic keywords the dictionary has no entry for. Never guessed at. */
  untranslated: string[];
  /** Latin-script terms taken from the idea as-is (already English). */
  passthrough: string[];
}

export class ArabicResearchDictionary {
  /** Normalized-key lookups, built once at module load. */
  private static readonly phraseIndex = this.buildIndex(PHRASES);
  private static readonly wordIndex = this.buildIndex(WORDS);

  /**
   * Phrase keys longest-first, so "الذكاء الاصطناعي" is consumed before any
   * shorter phrase that overlaps it.
   */
  private static readonly phraseKeys = [...this.phraseIndex.keys()].sort(
    (a, b) => b.length - a.length
  );

  /** Total entries — reported by the health route so the table is never a black box. */
  static get size(): number {
    return this.phraseIndex.size + this.wordIndex.size;
  }

  /**
   * Normalize Arabic for matching: drop diacritics, unify alef/ya/ta-marbuta
   * spellings, and strip the definite article. Latin text is only lowercased.
   */
  static normalize(text: string): string {
    return text
      .replace(DIACRITICS, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /** Normalize a single token and strip its definite article. */
  static normalizeWord(word: string): string {
    const normalized = this.normalize(word);
    const stripped = normalized.replace(ARTICLE_PREFIX, '');
    // Only accept the strip if a real word remains ("الله" must not become "له").
    return stripped.length >= 3 ? stripped : normalized;
  }

  /**
   * Resolve a token against the dictionary, allowing the attached Arabic
   * conjunction (و) only when the stripped form is an actual dictionary key.
   * This handles words such as "وجودة" without blindly removing the first
   * letter from genuine words that begin with waw.
   */
  private static resolveWord(word: string): {
    normalized: string;
    entry?: { source: string; translation: string };
  } {
    const normalized = this.normalizeWord(word);
    const direct = this.wordIndex.get(normalized);
    if (direct) return { normalized, entry: direct };

    if (normalized.startsWith('و') && normalized.length > 3) {
      const withoutConjunction = this.normalizeWord(normalized.slice(1));
      const conjunctionEntry = this.wordIndex.get(withoutConjunction);
      if (conjunctionEntry) {
        return { normalized: withoutConjunction, entry: conjunctionEntry };
      }
    }

    return { normalized };
  }

  /**
   * Translate a research idea into English search terms.
   *
   * Phrases are matched against the whole normalized idea first; the remaining
   * keywords are then looked up word by word. Terms with no entry are returned
   * in `untranslated` and left out of the query — the dictionary never
   * fabricates a translation.
   *
   * @param originalIdea The idea text, used for phrase detection.
   * @param keywords     Keywords from KeywordExtractionService.
   */
  static translate(originalIdea: string, keywords: string[]): TranslationResult {
    const normalizedIdea = this.normalize(originalIdea ?? '');
    const hits: DictionaryHit[] = [];
    const consumed = new Set<string>();

    // Pass 1: multi-word phrases.
    for (const key of this.phraseKeys) {
      if (!normalizedIdea.includes(key)) continue;

      const entry = this.phraseIndex.get(key);
      if (!entry) continue;

      hits.push({ source: entry.source, translation: entry.translation });
      // Mark the phrase's own words as handled so they are not translated twice.
      for (const word of key.split(' ')) {
        consumed.add(this.normalizeWord(word));
      }
    }

    // Pass 2: single words from the extracted keywords.
    const untranslated: string[] = [];
    const passthrough: string[] = [];

    for (const keyword of keywords ?? []) {
      if (!keyword) continue;

      // Latin-script keywords are already English — keep them verbatim.
      if (!/[؀-ۿ]/.test(keyword)) {
        passthrough.push(keyword.toLowerCase());
        continue;
      }

      const { normalized, entry } = this.resolveWord(keyword);
      if (consumed.has(normalized)) continue;

      if (entry) {
        hits.push({ source: keyword, translation: entry.translation });
        consumed.add(normalized);
      } else {
        untranslated.push(keyword);
      }
    }

    // Dictionary terms first, then Latin passthrough; duplicates collapsed.
    const terms = [...new Set([...hits.map(hit => hit.translation), ...passthrough])];

    return { terms, hits, untranslated, passthrough };
  }

  /** Build a normalized-key index from a raw table, keeping the original spelling. */
  private static buildIndex(
    table: Record<string, string>
  ): Map<string, { source: string; translation: string }> {
    const index = new Map<string, { source: string; translation: string }>();

    for (const [arabic, english] of Object.entries(table)) {
      const key = arabic.includes(' ') ? this.normalize(arabic) : this.normalizeWord(arabic);
      // First spelling wins, so two variants mapping to one key stay deterministic.
      if (!index.has(key)) {
        index.set(key, { source: arabic, translation: english });
      }
    }

    return index;
  }
}
