// Arabic wording for the machine-generated rationale and limitation texts that
// the server stores with gap assessments (src/lib/research-gaps.ts) and recorded
// searches (searchLimitations in src/lib/research-search-results.ts).
//
// The mapping is deterministic: each known sentence pattern has one fixed,
// conservative Arabic rendering, and numbers and provider names are carried
// over unchanged. No model is involved. A text that matches no pattern is
// returned as stored, never hidden. Researcher-written content never passes
// through here.

const PROVIDER_NAMES: Record<string, string> = {
  openalex: 'OpenAlex', crossref: 'Crossref', core: 'CORE', semantic_scholar: 'Semantic Scholar',
  semanticscholar: 'Semantic Scholar', pubmed: 'PubMed', arxiv: 'arXiv', zotero: 'Zotero',
};

/** Display name for a search provider id; unknown ids are shown as recorded. */
export function providerDisplayName(provider: string) {
  return PROVIDER_NAMES[provider.trim().toLowerCase()] || provider.trim();
}

const providerList = (value: string) => value.split(',').map((name) => providerDisplayName(name)).filter(Boolean).join('، ');

type Rule = { pattern: RegExp; arabic: (match: RegExpMatchArray) => string };

const RULES: Rule[] = [
  // Gap assessment rationale (gap-rules-v1 and gap-rules-v2).
  { pattern: /^No researcher-confirmed evidence supports this gap yet; it is recorded as a signal to investigate\.$/,
    arabic: () => 'لا توجد بعد أدلة داعمة أكد الباحث ربطها بهذه الفجوة؛ لذا سُجّلت إشارةً بحثية تستحق الاستقصاء.' },
  { pattern: /^Contradicting evidence \((\d+)\) is at least as frequent as supporting evidence \((\d+)\); the gap is contested\.$/,
    arabic: (m) => `عدد الأدلة المعارضة (${m[1]}) لا يقل عن عدد الأدلة الداعمة (${m[2]})؛ لذا فهذه الفجوة موضع خلاف وتحتاج أدلة إضافية.` },
  { pattern: /^There is confirmed supporting evidence, but no recorded search with an available provider defines the scope, so it cannot be evidence-backed\.$/,
    arabic: () => 'توجد أدلة داعمة مرتبطة، لكن لا توجد عملية بحث مسجلة توفّر فيها مزود واحد على الأقل لتحديد نطاق التقييم؛ لذا لا يمكن تصنيفها فجوةً مدعومة بالأدلة.' },
  { pattern: /^(\d+) supporting evidence items confirmed by the researcher as source-supported, from (\d+) distinct sources, within (\d+) recorded search\(es\)\.$/,
    arabic: (m) => `عدد الأدلة الداعمة التي أكد الباحث ورودها في مصادرها: ${m[1]}، من مصادر مختلفة عددها ${m[2]}، ضمن عمليات بحث مسجلة عددها ${m[3]}.` },
  { pattern: /^(\d+) source-grounded supporting evidence items from (\d+) distinct sources, within (\d+) recorded search\(es\)\.$/,
    arabic: (m) => `عدد الأدلة الداعمة المستندة إلى مصادر: ${m[1]}، من مصادر مختلفة عددها ${m[2]}، ضمن عمليات بحث مسجلة عددها ${m[3]} (وفق قواعد تقييم سابقة).` },
  { pattern: /^Supporting evidence is limited: (\d+) item\(s\) confirmed by the researcher as source-supported, from (\d+) distinct source\(s\); at least two of each are needed for an evidence-backed gap\.$/,
    arabic: (m) => `الأدلة الداعمة محدودة: عدد الأدلة التي أكد الباحث ورودها في مصادرها ${m[1]}، من مصادر مختلفة عددها ${m[2]}. يتطلب تصنيف الفجوة كمدعومة بالأدلة ضمن نطاق البحث المسجل دليلين مؤكدين على الأقل من مصدرين مختلفين على الأقل وفق قواعد التقييم.` },
  { pattern: /^Supporting evidence is limited: (\d+) source-grounded item\(s\) from (\d+) distinct source\(s\); at least two of each are needed for an evidence-backed gap\.$/,
    arabic: (m) => `الأدلة الداعمة محدودة: عدد الأدلة المستندة إلى مصادر ${m[1]}، من مصادر مختلفة عددها ${m[2]}. يتطلب تصنيف الفجوة كمدعومة بالأدلة ضمن نطاق البحث المسجل أدلة ومصادر إضافية وفق قواعد التقييم.` },
  { pattern: /^(\d+) contradicting evidence item\(s\) are recorded and must be addressed\.$/,
    arabic: (m) => `سُجّلت أدلة معارضة عددها ${m[1]}، وينبغي مناقشتها في البحث.` },

  // Gap assessment limitations.
  { pattern: /^This assessment covers only the recorded searches and the evidence linked to the claim\. It is not an exhaustive review and does not establish that no study exists\.$/,
    arabic: () => 'يغطي هذا التقييم عمليات البحث المسجلة والأدلة المرتبطة بالادعاء فقط. ولا يمثل مراجعة شاملة للأدبيات، ولا يثبت عدم وجود دراسات أخرى.' },
  { pattern: /^No recorded search with an available provider exists for this project\.$/,
    arabic: () => 'لا توجد في هذا المشروع عملية بحث مسجلة توفّر فيها مزود واحد على الأقل.' },
  { pattern: /^(\d+) system-suggested link\(s\) not confirmed by the researcher were not counted\.$/,
    arabic: (m) => `لم تُحتسب روابط اقترحها النظام ولم يؤكدها الباحث، وعددها ${m[1]}.` },
  { pattern: /^(\d+) supporting item\(s\) have not been confirmed by the researcher as present in their source and were not counted toward an evidence-backed gap\.$/,
    arabic: (m) => `أدلة داعمة لم يؤكد الباحث ورودها في مصادرها، وعددها ${m[1]}، ولم تُحتسب ضمن شروط الفجوة المدعومة بالأدلة.` },
  { pattern: /^(\d+) supporting item\(s\) rely on researcher-asserted or unreviewed sources and were not counted toward an evidence-backed gap\.$/,
    arabic: (m) => `أدلة داعمة تستند إلى مصادر أدخلها الباحث أو لم تُراجع، وعددها ${m[1]}، ولم تُحتسب ضمن شروط الفجوة المدعومة بالأدلة.` },
  { pattern: /^(\d+) linked item\(s\) marked insufficient support by the researcher were not counted\.$/,
    arabic: (m) => `لم تُحتسب أدلة مرتبطة قرر الباحث أن مصادرها لا تكفي لدعمها، وعددها ${m[1]}.` },
  { pattern: /^(\d+) contradicting evidence item\(s\) are part of this record\.$/,
    arabic: (m) => `يتضمن هذا التقييم أدلة معارضة عددها ${m[1]}.` },

  // Recorded search limitations.
  { pattern: /^Covers only the providers and query recorded here; not an exhaustive review of the literature\.$/,
    arabic: () => 'يغطي هذا البحث المزودين والاستعلام المسجلين هنا فقط، ولا يمثل مراجعة شاملة للأدبيات.' },
  { pattern: /^Provider coverage for this search was not recorded\.$/,
    arabic: () => 'لم تُسجَّل تغطية المزودين لهذا البحث.' },
  { pattern: /^Unavailable during this search: (.+)\.$/,
    arabic: (m) => `تعذر الوصول أثناء هذا البحث إلى: ${providerList(m[1])}.` },
  { pattern: /^No provider was available; the absence of results says nothing about the literature\.$/,
    arabic: () => 'لم يتوفر أي مزود أثناء هذا البحث؛ وغياب النتائج لا يدل على شيء بشأن الأدبيات.' },
  { pattern: /^(\d+) retrieved record\(s\) were not kept after relevance filtering\.$/,
    arabic: (m) => `لم تُحفظ سجلات مسترجعة بعد تصفيتها حسب الصلة بالموضوع، وعددها ${m[1]}.` },
  { pattern: /^Each provider returns a limited number of top-ranked records per query\.$/,
    arabic: () => 'يعيد كل مزود عدداً محدوداً من النتائج الأعلى ترتيباً لكل استعلام.' },
];

/** Arabic rendering of a known system text; `translated` is false when the stored text is shown as is. */
export function systemTextArabic(text: string): { text: string; translated: boolean } {
  const trimmed = text.trim();
  for (const rule of RULES) {
    const match = trimmed.match(rule.pattern);
    if (match) return { text: rule.arabic(match), translated: true };
  }
  return { text, translated: false };
}
