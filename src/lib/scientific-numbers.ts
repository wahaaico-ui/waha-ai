/** A conservative check of numerical expressions, not a semantic or statistical
 * assessment. It preserves sign, inequalities, uncertainty and percentages.
 * It deliberately does not infer unit conversions or perform new calculations. */
function normalizeNotation(text: string): string {
  return text.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0))
    .replace(/٫/g, '.').replace(/٬/g, ',')
    .replace(/[٪％]/g, '%').replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
}

/** Decimal/exponent equivalence without rounding through a JavaScript float.
 * Ambiguous comma notation stays literal rather than guessing its locale. */
function magnitude(literal: string): string {
  const match = /^([+-]?)(\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(literal);
  if (!match || (!match[2] && !match[3])) return `literal:${literal}`;
  const exponent = Number(match[4] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) return `literal:${literal}`;
  const fraction = match[3] || '';
  const digits = (match[2] + fraction).replace(/^0+/, '');
  if (!digits) return '0';
  const trailing = /0*$/.exec(digits)![0].length;
  return `${match[1] === '-' ? '-' : ''}${trailing ? digits.slice(0, -trailing) : digits}e${exponent - fraction.length + trailing}`;
}

function percentageSuffix(text: string): string {
  // Percentage points are a change in a percentage, not the percentage itself.
  if (/^\s*(?:percentage\s+points?\b|نق(?:طة|اط)\s+مئوية)/i.test(text)) return 'pp';
  if (/^\s*(?:%|percent(?:age)?\b|per\s+cent\b|pct\b|بالم(?:ئة|ائة)|في\s+الم(?:ئة|ائة))/i.test(text)) return '%';
  return '';
}

function expressions(text: string): string[] {
  const normalized = normalizeNotation(text);
  const tokens: string[] = [];
  const pattern = /(?:±\s*)?[+\-−﹣－]?\s*(?:\d+(?:[.,]\d+)*|\.\d+)(?:[eE][+\-−﹣－]?\d+)?/g;
  for (const match of normalized.matchAll(pattern)) {
    const start = match.index!;
    const before = normalized.slice(0, start).trimEnd();
    let literal = match[0].replace(/\s/g, '');
    // Only an adjacent ASCII hyphen is treated as a range separator.
    // Preserve mathematical minus signs and whitespace-delimited negatives.
    if (literal.startsWith('-') && /\d/.test(normalized[start - 1] || '')) literal = literal.slice(1);
    literal = literal.replace(/[−﹣－]/g, '-');
    const uncertainty = literal.startsWith('±') ? '±' : '';
    if (uncertainty) literal = literal.slice(1);
    const comparator = /(?:<=|>=|!=|<|>|=|≤|≥|≠|≈|~)$/.exec(before.slice(-2))?.[0] || '';
    const relation = ({ '<=': '≤', '>=': '≥', '!=': '≠', '~': '≈', '=': '' } as Record<string, string>)[comparator] ?? comparator;
    const suffix = percentageSuffix(normalized.slice(start + match[0].length));
    tokens.push(`${relation}${uncertainty}${magnitude(literal)}${suffix}`);
  }
  return tokens;
}

export function scientificNumbersAreGrounded(value: string, evidence: string): boolean {
  const available = new Set(expressions(evidence));
  return expressions(value).every(expression => available.has(expression));
}
