const TEXT_KEYS = ['text', 'output', 'translated_text', 'translatedText', 'translation', 'corrected_text', 'correctedText', 'proofread_text', 'proofreadText'] as const;

// A deliberately bounded glossary, not a claim to recognise every scientific term.
const METRIC_NAMES = ['Inception Score', 'FID', 'BLEU'] as const;
function hasMetric(text: string, metric: string) {
  const normalized = text.normalize('NFKC').replace(/\s+/g, ' ');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${metric}(?![\\p{L}\\p{N}_])`, 'iu').test(normalized);
}

export function metricPreservationInstruction(input: string): string {
  const names = METRIC_NAMES.filter((metric) => hasMetric(input, metric));
  return names.length ? ` Keep these metric names in their original Latin spelling in the final text: ${names.join(', ')}. You may add a translation alongside them, but never replace or omit the original name.` : '';
}

/** Accept plain text or a single, explicit text field; never display provider metadata. */
export function normalizeLanguageOutput(raw: string): string {
  const text = raw.trim().replace(/^```(?:json|text)?\s*\n?([\s\S]*?)\n?```$/i, '$1').trim();
  if (!text || text.length > 24_000) throw new Error('Invalid language output');
  if (!/^[{\["]/.test(text)) return text;
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch {
    if (/^[{\[]/.test(text)) throw new Error('Malformed language output');
    return text;
  }
  if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid language output');
  const record = parsed as Record<string, unknown>;
  const candidates = TEXT_KEYS.flatMap((key) => typeof record[key] === 'string' && record[key].trim() ? [record[key].trim()] : []);
  const distinct = [...new Set(candidates)];
  if (distinct.length !== 1) throw new Error('Ambiguous language output');
  return normalizeLanguageOutput(distinct[0]);
}

function numericTokens(text: string) {
  const normalized = text.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) >= 0x6f0 ? digit.charCodeAt(0) - 0x6f0 : digit.charCodeAt(0) - 0x660));
  return new Set(normalized.match(/\d+(?:[.٫]\d+)?/g)?.map((token) => token.replace('٫', '.')) || []);
}

/** Structural guard only: semantic quality still requires the researcher's review. */
export function validateLanguageOutput(input: string, output: string) {
  if (METRIC_NAMES.some((metric) => hasMetric(input, metric) && !hasMetric(output, metric))) {
    throw new Error('Scientific metric name changed during editing');
  }
  const original = numericTokens(input); const result = numericTokens(output);
  if ([...original].some((value) => !result.has(value)) || [...result].some((value) => !original.has(value))) throw new Error('Numbers changed during editing');
  const dois = input.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi) || [];
  if (dois.some((doi) => !output.toLowerCase().includes(doi.toLowerCase()))) throw new Error('DOI changed during editing');
}
