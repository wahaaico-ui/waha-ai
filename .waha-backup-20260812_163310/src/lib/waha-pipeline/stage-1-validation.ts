export interface PipelineContext {
  rawInput: string;
  parsedIntent?: string;
  academicValid: boolean;
  rejectionReason?: string;
}

/**
 * المرحلة الأولى: التسلسل الإجباري (Input -> Parsing -> Intent Detection -> Academic Validation)
 */
export async function executeStage1_IdeaValidation(rawInput: string): Promise<PipelineContext> {
  // 1. Parsing & Cleaning
  const cleanedInput = rawInput ? rawInput.trim() : '';

  if (cleanedInput.length < 10) {
    return {
      rawInput,
      academicValid: false,
      rejectionReason: 'فشلت المرحلة الأولى: النص المدخل قصير جداً ولا يمثل فكرة بحثية أكاديمية قابلة للتحليل.'
    };
  }

  // 2. Intent Detection
  const isResearchIntent = /دراسة|أثر|تحليل|تقييم|دور|العلاقة|Impact|Analysis|Study|Effect|Role/i.test(cleanedInput);

  if (!isResearchIntent) {
    return {
      rawInput,
      parsedIntent: 'General Text',
      academicValid: false,
      rejectionReason: 'فشلت بوابة النوايا (Intent Detection): المدخل لا يحتوي على صيغة بحثية واضحة (مثل دراسة أثر، تحليل، تقييم).'
    };
  }

  // 3. Academic Validation Success
  return {
    rawInput: cleanedInput,
    parsedIntent: 'Empirical/Theoretical Research Idea',
    academicValid: true
  };
}
