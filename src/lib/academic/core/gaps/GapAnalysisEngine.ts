import { GapAnalysisResult, ResearchGap } from '../../types/GapAnalysisResult';
import { IntelligenceReport } from '../../types/IntelligenceReport';
import { EvidencePackage } from '../../types/EvidencePackage';
import { ParsedAcademicIntent } from '../../types/IntentAnalysisResult';

export class GapAnalysisEngine {
  public analyze(
    intent: ParsedAcademicIntent,
    evidence: EvidencePackage,
    intelligence: IntelligenceReport
  ): GapAnalysisResult {

    // Deterministic gap identification based on field saturation and known gaps
    const identifiedGaps: ResearchGap[] = intelligence.knownGaps.map((gapDesc, index) => ({
      id: `GAP-${index + 1}`,
      description: gapDesc,
      significance: intelligence.fieldSaturation > 0.7 ? 'HIGH' : 'MODERATE'
    }));

    const gapRelevance: Record<string, number> = {};
    identifiedGaps.forEach(gap => {
      gapRelevance[gap.id] = Number((0.75 + (Math.random() * 0.2)).toFixed(2));
    });

    const overlapDegree = Number((intelligence.fieldSaturation * 0.8).toFixed(2));

    const differentiators = [
      'استخدام إطار ميثودولوجي حديث',
      'التركيز على عينة مستهدفة جديدة لم تُدرس كفاية'
    ];

    const narrowingOpportunities = intent.independentVariable ? [
      'تحديد القطاع أو البيئة الجغرافية بشكل أضيق (مثل قطاع التعليم الثانوي فقط)',
      'إضافة متغير معدل (Moderator) لتحديد شروط الأثر'
    ] : [];

    const expansionOpportunities = [
      'التحول من دراسة حالة محلية إلى مقارنة إقليمية',
      'توسيع إطار المتغيرات التابعة ليشمل جوانب اقتصادية أو سلوكية'
    ];

    return {
      identifiedGaps,
      gapRelevance,
      overlapDegree,
      differentiators,
      narrowingOpportunities,
      expansionOpportunities
    };
  }
}

