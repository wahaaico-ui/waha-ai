import type { AcademicThinkingResult } from '@/services/academic-thinking.service';
import type { ResearchAggregation, UnifiedResearchPaper } from '@/types/ResearchAggregation';
import type {
  CoverageValue,
  ResearchGapReport,
} from '@/types/ResearchGapReport';
import type {
  IntelligenceRankedValue,
  ResearchIntelligence,
} from '@/types/ResearchIntelligence';

interface DetectionDefinition {
  name: string;
  patterns: RegExp[];
}

interface TargetCountry {
  label: string;
  aliases: Set<string>;
}

const POPULATIONS: DetectionDefinition[] = [
  { name: 'University Students', patterns: [/\buniversity students?\b/i, /\bcollege students?\b/i, /\bhigher education\b/i, /طلب[هة]\s+الجامعات|طلاب\s+الجامعات|التعليم\s+العالي|التعليم\s+الجامعي/u] },
  { name: 'School Students', patterns: [/\bschool students?\b/i, /\bpupils?\b/i, /طلب[هة]\s+المدارس|طلاب\s+المدارس/u] },
  { name: 'Students', patterns: [/\bstudents?\b/i, /\blearners?\b/i, /\bundergraduates?\b/i, /طلاب|طلبه|متعلمين/u] },
  { name: 'Teachers', patterns: [/\bteachers?\b/i, /\beducators?\b/i, /معلمين|معلمات|مدرسين/u] },
  { name: 'Patients', patterns: [/\bpatients?\b/i, /مرضى|مريض/u] },
  { name: 'Employees', patterns: [/\bemployees?\b/i, /\bworkers?\b/i, /موظفين|عاملين|عمال/u] },
  { name: 'Companies', patterns: [/\bcompan(?:y|ies)\b/i, /\bfirms?\b/i, /شركات|شركه/u] },
  { name: 'Universities', patterns: [/\buniversit(?:y|ies)\b/i, /\bcolleges?\b/i, /جامعات|جامعه|كليات/u] },
  { name: 'Schools', patterns: [/\bschools?\b/i, /مدارس|مدرسه/u] },
];

const METHODOLOGIES: DetectionDefinition[] = [
  { name: 'Survey', patterns: [/\bsurveys?\b/i, /\bquestionnaires?\b/i, /استبيان|استبانه|مسح/u] },
  { name: 'Case Study', patterns: [/\bcase stud(?:y|ies)\b/i, /دراسه حاله|دراسات حاله/u] },
  { name: 'Experiment', patterns: [/\bexperiments?\b/i, /\bexperimental\b/i, /تجربه|تجريبي|تجريبيه/u] },
  { name: 'Systematic Review', patterns: [/\bsystematic reviews?\b/i, /مراجعه منهجيه|مراجعات منهجيه/u] },
  { name: 'Meta Analysis', patterns: [/\bmeta[ -]analys(?:is|es)\b/i, /تحليل تلوي|التحليل التلوي/u] },
  { name: 'Qualitative', patterns: [/\bqualitative\b/i, /نوعي|نوعيه/u] },
  { name: 'Quantitative', patterns: [/\bquantitative\b/i, /كمي|كميه/u] },
  { name: 'Mixed Methods', patterns: [/\bmixed methods?\b/i, /منهج مختلط|طرق مختلطه/u] },
];

const COUNTRY_ALIASES: Array<{ locations: string[]; target: TargetCountry }> = [
  { locations: ['فلسطين', 'palestine'], target: { label: 'Palestine', aliases: new Set(['ps', 'pse', 'palestine', 'state of palestine']) } },
  { locations: ['السعوديه', 'saudi arabia'], target: { label: 'Saudi Arabia', aliases: new Set(['sa', 'sau', 'saudi arabia']) } },
  { locations: ['الامارات', 'united arab emirates'], target: { label: 'United Arab Emirates', aliases: new Set(['ae', 'are', 'united arab emirates', 'uae']) } },
  { locations: ['مصر', 'egypt'], target: { label: 'Egypt', aliases: new Set(['eg', 'egy', 'egypt']) } },
  { locations: ['الاردن', 'jordan'], target: { label: 'Jordan', aliases: new Set(['jo', 'jor', 'jordan']) } },
];

const DEFAULT_TARGET_COUNTRY = COUNTRY_ALIASES[0].target;

export class ResearchGapService {
  static calculate(
    aggregation: ResearchAggregation,
    intelligence: ResearchIntelligence,
    academicThinking: AcademicThinkingResult,
    globalPaperCount: number
  ): ResearchGapReport {
    const papers = Array.isArray(aggregation.papers) ? aggregation.papers.filter(Boolean) : [];
    const populationCoverage = this.detectCoverage(papers, POPULATIONS, true, true);
    const methodologyCoverage = this.detectCoverage(papers, METHODOLOGIES);
    const rareConcepts = this.conceptFrequency(papers).filter(item => item.count === 1);
    const topCountries = intelligence.topCountries.slice(0, 5);
    const targetCountry = this.targetCountry(academicThinking.structure.location);
    const hasTargetCountry = topCountries.some(country =>
      targetCountry.aliases.has(country.name.trim().toLowerCase())
    ) || papers.some(paper => paper.countries.some(country =>
      targetCountry.aliases.has(country.trim().toLowerCase())
    ));
    const missingCountries = hasTargetCountry ? [] : [targetCountry.label];
    const geographicalSummary = this.geographicalSummary(
      papers,
      topCountries,
      hasTargetCountry,
      targetCountry.label
    );
    const density = this.researchDensity(globalPaperCount);
    const gap = this.potentialGap(
      hasTargetCountry,
      targetCountry.label,
      density,
      populationCoverage.covered,
      populationCoverage.missing,
      methodologyCoverage.missing,
      rareConcepts
    );

    return {
      topicCoverage: {
        globalPaperCount,
        coveredConceptCount: this.conceptFrequency(papers).length,
        dominantConcepts: intelligence.topConcepts.slice(0, 10),
        rareConcepts: rareConcepts.slice(0, 10),
      },
      researchDensity: density,
      recentResearchTrend: this.recentTrend(intelligence),
      geographicalCoverage: {
        summary: geographicalSummary,
        topCountries,
        missingCountries,
      },
      populationCoverage: {
        coveredPopulations: populationCoverage.covered,
        missingPopulations: populationCoverage.missing,
      },
      methodologyCoverage: {
        coveredMethodologies: methodologyCoverage.covered,
        missingMethodologies: methodologyCoverage.missing,
      },
      keywordCoverage: {
        topRepeatedConcepts: intelligence.topConcepts.slice(0, 10),
        rareConcepts: rareConcepts.slice(0, 10),
      },
      potentialResearchGap: gap.statement,
      recommendation: gap.recommendation,
      confidence: this.confidence(aggregation, intelligence, academicThinking),
    };
  }

  private static researchDensity(totalPapers: number): ResearchGapReport['researchDensity'] {
    if (totalPapers > 100_000) return 'Very High';
    if (totalPapers >= 10_000) return 'High';
    if (totalPapers >= 1_000) return 'Medium';
    return 'Low';
  }

  private static recentTrend(intelligence: ResearchIntelligence): ResearchGapReport['recentResearchTrend'] {
    const timeline = intelligence.publicationTimeline;
    const latest = intelligence.latestPublicationYear;
    if (latest === null || timeline.length < 3) return 'Stable';

    const counts = new Map(timeline.map(point => [point.year, point.count]));
    const sixYears = Array.from(
      { length: 6 },
      (_, index) => counts.get(latest - 5 + index) ?? 0
    );
    const previousAverage = sixYears.slice(0, 3).reduce((sum, count) => sum + count, 0) / 3;
    const recentAverage = sixYears.slice(3).reduce((sum, count) => sum + count, 0) / 3;
    const growthRate = (recentAverage - previousAverage) / Math.max(previousAverage, 1);

    if (growthRate > 0.15) return 'Growing';
    if (growthRate < -0.15) return 'Declining';
    return 'Stable';
  }

  private static geographicalSummary(
    papers: UnifiedResearchPaper[],
    topCountries: IntelligenceRankedValue[],
    hasTargetCountry: boolean,
    targetCountry: string
  ): string {
    const papersWithCountry = papers.filter(paper => paper.countries.length > 0).length;
    const dominant = topCountries[0];

    if (dominant && papersWithCountry > 0 && dominant.count / papersWithCountry > 0.5) {
      return `Research concentrated in ${dominant.name}.`;
    }
    if (!hasTargetCountry) return `No evidence from ${targetCountry}.`;
    if (topCountries.length === 0) return 'No geographical metadata available.';
    return 'Research distributed across multiple countries.';
  }

  private static detectCoverage(
    papers: UnifiedResearchPaper[],
    definitions: DetectionDefinition[],
    avoidGenericStudents: boolean = false,
    includeConcepts: boolean = false
  ): { covered: CoverageValue[]; missing: string[] } {
    const counts = new Map<string, number>();

    for (const paper of papers) {
      const evidenceText = includeConcepts
        ? `${paper.title} ${paper.concepts.join(' ')}`
        : paper.title;
      const detected = new Set<string>();
      for (const definition of definitions) {
        if (definition.patterns.some(pattern => pattern.test(evidenceText))) detected.add(definition.name);
      }
      if (
        avoidGenericStudents &&
        (detected.has('University Students') || detected.has('School Students'))
      ) {
        detected.delete('Students');
      }
      for (const name of detected) counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const covered = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      covered,
      missing: definitions
        .map(definition => definition.name)
        .filter(name => !counts.has(name)),
    };
  }

  private static conceptFrequency(papers: UnifiedResearchPaper[]): CoverageValue[] {
    const counts = new Map<string, { name: string; count: number }>();
    for (const paper of papers) {
      const seen = new Set<string>();
      for (const rawConcept of paper.concepts) {
        const name = rawConcept?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const current = counts.get(key);
        if (current) current.count += 1;
        else counts.set(key, { name, count: 1 });
      }
    }
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name)
    );
  }

  private static potentialGap(
    hasTargetCountry: boolean,
    targetCountry: string,
    density: ResearchGapReport['researchDensity'],
    coveredPopulations: CoverageValue[],
    missingPopulations: string[],
    missingMethodologies: string[],
    rareConcepts: CoverageValue[]
  ): { statement: string; recommendation: string } {
    if (!hasTargetCountry && (density === 'Very High' || density === 'High')) {
      return {
        statement: 'Globally mature but locally underexplored.',
        recommendation: `Prioritize locally grounded studies using data from ${targetCountry}.`,
      };
    }

    if (!hasTargetCountry) {
      return {
        statement: `There is limited evidence from ${targetCountry}.`,
        recommendation: `Prioritize studies using data from ${targetCountry}.`,
      };
    }

    const universityStudentsCovered = coveredPopulations.some(
      population => population.name === 'University Students'
    );
    if (universityStudentsCovered && missingPopulations.includes('School Students')) {
      return {
        statement: 'School students remain underrepresented.',
        recommendation: 'Prioritize studies focused on school students.',
      };
    }

    const missingMethodology = missingMethodologies[0];
    if (missingMethodology) {
      return {
        statement: `${missingMethodology} remains underrepresented in the retrieved literature.`,
        recommendation: `Prioritize studies using ${missingMethodology}.`,
      };
    }

    const rareConcept = rareConcepts[0];
    if (rareConcept) {
      return {
        statement: `${rareConcept.name} appears rarely in the retrieved literature.`,
        recommendation: `Examine ${rareConcept.name} in additional empirical studies.`,
      };
    }

    return {
      statement: 'No clear metadata-based gap was detected.',
      recommendation: 'Expand the metadata sample before selecting a research gap.',
    };
  }

  private static confidence(
    aggregation: ResearchAggregation,
    intelligence: ResearchIntelligence,
    academicThinking: AcademicThinkingResult
  ): number {
    const total = intelligence.totalPapers;
    const volumeScore = total >= 100 ? 50 : total >= 50 ? 40 : total >= 20 ? 30 : total >= 10 ? 20 : total > 0 ? 10 : 0;
    const quality = intelligence.dataQuality;
    const averageMissing = (
      quality.missingDoiPercentage +
      quality.missingAbstractPercentage +
      quality.missingJournalPercentage +
      quality.missingCountryPercentage
    ) / 4;
    const qualityScore = Math.max(0, (100 - averageMissing) * 0.3);
    const bothSources = aggregation.openAlexPapers > 0 && aggregation.semanticScholarPapers > 0;
    const sourceAgreement = bothSources
      ? 10 + Math.min(10, (aggregation.duplicatesRemoved / Math.max(total, 1)) * 100)
      : 0;
    const thinkingScore = Math.min(10, academicThinking.ideaConfidence / 10);

    return Math.round(Math.min(100, volumeScore + qualityScore + sourceAgreement + thinkingScore));
  }

  private static targetCountry(location: string | null): TargetCountry {
    if (!location) return DEFAULT_TARGET_COUNTRY;
    const normalized = location.trim().toLowerCase();
    return COUNTRY_ALIASES.find(entry => entry.locations.includes(normalized))?.target ?? {
      label: location,
      aliases: new Set([normalized]),
    };
  }
}
