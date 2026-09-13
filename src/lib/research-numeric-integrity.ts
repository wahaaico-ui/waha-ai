export function researchNumericTokens(value: string) {
  return [...value.matchAll(/(?<![\p{L}\p{N}_])[-+]?\d+(?:[.,]\d+)?%?(?![\p{L}\p{N}_])/gu)]
    .map((match) => match[0].replace(',', '.'));
}

export function firstUnsupportedResearchNumber(candidate: string, sources: string) {
  const allowed = new Set(researchNumericTokens(sources));
  return researchNumericTokens(candidate).find((token) => !allowed.has(token)) || null;
}
