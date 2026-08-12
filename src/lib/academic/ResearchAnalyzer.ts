export interface ResearchEvidence {
  [key: string]: any;
}

export interface ResearchAnalysis {
  totalPapers: number;
  numberOfCountries: number;
  journal: { value: string; hint: string };
  country: { value: string; hint: string };
  [key: string]: any;
}

export class ResearchAnalyzer {
  static analyze(papers: ResearchEvidence[]): ResearchAnalysis {
    const totalPapers = papers ? papers.length : 0;
    
    const countries = new Set(papers?.map(p => p.country || p.geo || p.location).filter(Boolean));
    const numberOfCountries = countries.size > 0 ? countries.size : 1;

    const journalCounts: { [key: string]: number } = {};
    const countryCounts: { [key: string]: number } = {};

    papers?.forEach(p => {
      const journal = p.journal || p.source || "N/A";
      const country = p.country || "N/A";
      journalCounts[journal] = (journalCounts[journal] || 0) + 1;
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    const topJournal = Object.entries(journalCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
    const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      totalPapers,
      numberOfCountries,
      journal: { value: topJournal, hint: "المجلة الأكثر تكراراً" },
      country: { value: topCountry, hint: "الدولة الأكثر تكراراً" }
    };
  }
}
