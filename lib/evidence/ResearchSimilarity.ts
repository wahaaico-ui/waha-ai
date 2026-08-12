// @ts-nocheck
interface SimilarityPaper {
  title?: string;
}

export class ResearchSimilarity {
  public calculateSimilarity(userQuery: string, papers: SimilarityPaper[]): { similarityScore: number; topKeywords: string[] } {
    if (papers.length === 0) return { similarityScore: 0, topKeywords: [] };
    const stopWords = ["أثر", "تأثير", "العلاقة", "بين", "في", "على", "لدى", "مشروع", "بحثي", "دراسة"];
    const userTokens = userQuery.toLowerCase().split(/[\s,.\-\/]+/).filter(t => t.length > 2 && !stopWords.includes(t));
    let maxMatchCount = 0;
    const allKeywordsMap: { [key: string]: number } = {};
    papers.forEach(paper => {
      const paperTitleLower = (paper.title ?? '').toLowerCase();
      let matchCount = 0;
      userTokens.forEach(token => {
        if (paperTitleLower.includes(token)) {
          matchCount++;
          allKeywordsMap[token] = (allKeywordsMap[token] || 0) + 1;
        }
      });
      if (matchCount > maxMatchCount) maxMatchCount = matchCount;
    });
    const baseTokensCount = Math.max(userTokens.length, 1);
    const similarityScore = Math.min(Math.round((maxMatchCount / baseTokensCount) * 100), 100);
    const topKeywords = Object.keys(allKeywordsMap).sort((a, b) => allKeywordsMap[b] - allKeywordsMap[a]).slice(0, 5);
    return { similarityScore, topKeywords };
  }
}
