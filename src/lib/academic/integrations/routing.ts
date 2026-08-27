import type { AcademicDomain, AcademicProvider } from './types';

const BIOMEDICAL = /طب|تمريض|صيدل|أحياء|حيوي|صحة|مرض|علاج|سرير|medical|medicine|nurs|pharma|biology|health|clinical|patient|disease/i;
const COMPUTING = /ذكاء اصطناعي|حاسوب|برمج|خوارزم|رياضيات|فيزياء|تعلم آلي|computer|software|algorithm|artificial intelligence|machine learning|mathematics|physics/i;
const SOCIAL = /اجتماع|إنسان|تاريخ|تربية|تعليم|إعلام|قانون|لغة|أدب|دين|إسلام|اقتصاد|إدارة|social|humanit|history|education|law|language|literature|religion|econom|management/i;
const ENGINEERING = /هندس|طاقة|مواد|إنشاء|كهرب|ميكاني|engineering|energy|materials|electrical|mechanical|civil/i;

export function detectAcademicDomain(query: string, specialty = ''): AcademicDomain {
  const value = `${query} ${specialty}`;
  if (BIOMEDICAL.test(value)) return 'biomedical';
  if (COMPUTING.test(value)) return 'computing';
  if (SOCIAL.test(value)) return 'social-humanities';
  if (ENGINEERING.test(value)) return 'engineering';
  return 'general';
}

const BASE: AcademicProvider[] = ['openalex', 'semantic-scholar', 'crossref'];
export function providersForDomain(domain: AcademicDomain): AcademicProvider[] {
  const routed: Record<AcademicDomain, AcademicProvider[]> = {
    biomedical: [...BASE, 'pubmed', 'europe-pmc', 'plos', 'core'],
    computing: [...BASE, 'arxiv', 'core', 'datacite'],
    'social-humanities': [...BASE, 'core', 'openaire', 'doab'],
    engineering: [...BASE, 'arxiv', 'core', 'openaire', 'datacite'],
    general: [...BASE, 'core', 'openaire', 'datacite'],
  };
  return [...new Set(routed[domain])];
}
