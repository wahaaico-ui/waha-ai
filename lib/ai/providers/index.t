import { AIProvider } from './providers/provider';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';

// محرك الذكاء الاصطناعي المركزي (AI Engine Core Manager)
// هنا يمكنك مستقبلاً توجيه الطلبات ديناميكياً: الكتابة عبر OpenAI والترجمة عبر Gemini بضغطة زر!
export const AIEngine = {
  getProvider: (taskType?: 'writing' | 'translation' | 'review'): AIProvider => {
    if (taskType === 'translation') return GeminiProvider;
    if (taskType === 'review') return ClaudeProvider;
    
    // المزود الافتراضي الحالي للمنصة 
    return OpenAIProvider;
  }
};