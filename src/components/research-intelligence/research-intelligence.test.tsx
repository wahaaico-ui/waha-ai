// Research Intelligence UI: conservative labels, contradictions and
// limitations always visible, scope stated, and no browser request carrying
// server-owned fields.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import ClaimSupportBoard from './ClaimSupportBoard';
import EvidenceCard from './EvidenceCard';
import GapAssessmentCard from './GapAssessmentCard';
import SearchScopePanel from './SearchScopePanel';
import SourceStatus from './SourceStatus';
import type { ClaimRecord, EvidenceRecord, GapRecord, SearchRunRecord } from './types';
import {
  claimCreateBody, EVIDENCE_STATE_LABELS, evidenceCreateBody, evidenceUpdateBody, GAP_CLASSIFICATION_LABELS, gapAssessBody,
  gapClassificationLabel, gapDecisionBody, SOURCE_ORIGIN_LABELS, supportCreateBody,
} from '@/lib/research-intelligence-ui';
import { assessGap, type GapLink } from '@/lib/research-gaps';
import { searchLimitations } from '@/lib/research-search-results';
import { providerDisplayName, systemTextArabic } from '@/lib/research-system-text';

const OVERCLAIMING = /verified|proven|VERIFIED_GAP|موثّق|موثق|مثبت|ثبت أن|فجوة مؤكدة|novel/i;

function evidence(id: string, content: string, overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return { id, project_reference_id: 'ref-1', source_kind: 'server_discovered', evidence_type: 'finding', content, locator: null, origin: 'researcher', state: 'recorded', state_set_by: 'system', created_at: '2026-10-06T10:00:00.000Z', updated_at: '2026-10-06T10:00:00.000Z', ...overrides };
}
const evidenceById = new Map([
  ['e-support', evidence('e-support', 'Supporting finding text')],
  ['e-against', evidence('e-against', 'Contradicting finding text')],
  ['e-suggested', evidence('e-suggested', 'Suggested link evidence')],
]);

const assessment: GapRecord = {
  id: 'gap-1', claim_id: 'claim-1', classification: 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE',
  rationale: ['Two source-grounded items from two distinct sources.'], limitations: ['Not an exhaustive review.', 'Unavailable during this search: core.'],
  basis: { supportingEvidence: ['e-support'], contradictingEvidence: ['e-against'], contextualEvidence: [], unclearEvidence: [] },
  search_run_ids: ['run-1'], scope: { searches: [{ id: 'run-1', query: 'AI postgraduate learning', executedAt: '2026-10-06T09:00:00.000Z', providersAvailable: 2, providersAttempted: 3, resultCount: 14 }] },
  origin: 'system', method_version: 'gap-rules-v1', researcher_confirmation: 'unreviewed', confirmed_at: null, generated_at: '2026-10-06T11:00:00.000Z',
};

describe('gap assessment card', () => {
  const html = renderToStaticMarkup(<GapAssessmentCard assessment={assessment} evidenceById={evidenceById} />);

  test('the strongest classification is limited to the recorded search scope', () => {
    expect(html).toContain('فجوة مدعومة بالأدلة ضمن نطاق البحث المسجل');
    expect(html).toContain('نطاق البحث المسجل لهذا التقييم');
    expect(html).toContain('AI postgraduate learning');
  });

  test('limitations and contradicting evidence are visible next to supporting evidence', () => {
    expect(html).toContain('حدود هذا التقييم');
    expect(html).toContain('Not an exhaustive review.');
    expect(html).toContain('تعذر الوصول أثناء هذا البحث إلى: CORE.');
    expect(html).toContain('أدلة معارضة (1)');
    expect(html).toContain('Contradicting finding text');
    expect(html).toContain('Supporting finding text');
  });

  test('the researcher decision is shown, and acceptance is described as the researcher\'s decision', () => {
    expect(html).toContain('لم يُراجع بعد');
    const accepted = renderToStaticMarkup(<GapAssessmentCard assessment={{ ...assessment, researcher_confirmation: 'accepted', confirmed_at: '2026-10-06T12:00:00.000Z' }} evidenceById={evidenceById} />);
    expect(accepted).toContain('قبله الباحث لمشروعه');
    expect(accepted).toContain('ليس تحققاً موضوعياً');
  });

  test('every classification renders with conservative wording, and none says verified', () => {
    for (const classification of [...Object.keys(GAP_CLASSIFICATION_LABELS), 'VERIFIED_GAP']) {
      const rendered = renderToStaticMarkup(<GapAssessmentCard assessment={{ ...assessment, classification }} evidenceById={evidenceById} />);
      expect(rendered.replace(/ليس تحققاً موضوعياً/g, '')).not.toMatch(OVERCLAIMING);
    }
    expect(Object.keys(GAP_CLASSIFICATION_LABELS)).not.toContain('VERIFIED_GAP');
    expect(gapClassificationLabel('VERIFIED_GAP').label).toBe('تصنيف غير معروف');
    expect(GAP_CLASSIFICATION_LABELS.SIGNAL.label).toBe('إشارة بحثية');
    expect(GAP_CLASSIFICATION_LABELS.POTENTIAL_GAP.label).toBe('فجوة محتملة');
  });

  test('a scope without searches is stated, not hidden', () => {
    const rendered = renderToStaticMarkup(<GapAssessmentCard assessment={{ ...assessment, classification: 'POTENTIAL_GAP', search_run_ids: [], scope: { searches: [] } }} evidenceById={evidenceById} />);
    expect(rendered).toContain('لم تُسجَّل عمليات بحث لهذا المشروع وقت التقييم');
  });
});

describe('claim support board', () => {
  const claim: ClaimRecord = {
    id: 'claim-1', statement: 'A gap claim', claim_type: 'gap', origin: 'researcher', status: 'active', created_at: '', supports: [
      { id: 's1', claim_id: 'claim-1', evidence_item_id: 'e-support', relation: 'supports', origin: 'researcher', confirmation: 'confirmed', rationale: null, created_at: '' },
      { id: 's2', claim_id: 'claim-1', evidence_item_id: 'e-against', relation: 'contradicts', origin: 'researcher', confirmation: 'confirmed', rationale: 'Reports the opposite.', created_at: '' },
      { id: 's3', claim_id: 'claim-1', evidence_item_id: 'e-suggested', relation: 'supports', origin: 'system', confirmation: 'suggested', rationale: null, created_at: '' },
    ],
  };
  const html = renderToStaticMarkup(<ClaimSupportBoard claim={claim} evidenceById={evidenceById} />);

  test('contradicting evidence is shown alongside supporting evidence', () => {
    expect(html).toContain('أدلة داعمة (2)');
    expect(html).toContain('أدلة معارضة (1)');
    expect(html).toContain('Contradicting finding text');
    expect(html).toContain('Reports the opposite.');
    expect(html).toContain('علاقة غير واضحة (0)');
  });

  test('an unreviewed system suggestion is marked differently from a researcher link', () => {
    expect(html).toContain('ربطه الباحث');
    expect(html).toContain('اقتراح آلي لم يُراجع');
    expect(html).toMatch(/data-confirmation="suggested"[^>]*border-dashed/);
  });

  test('a claim without links explains what to do', () => {
    expect(renderToStaticMarkup(<ClaimSupportBoard claim={{ ...claim, supports: [] }} evidenceById={evidenceById} />)).toContain('اربط الأدلة بالادعاء');
  });
});

describe('recorded search scope', () => {
  const runs: SearchRunRecord[] = [
    { id: 'run-1', context: 'evidence_panel', query: 'AI postgraduate learning', domain: 'general', providers: [{ provider: 'openalex', available: true, returned: 10 }, { provider: 'core', available: false, returned: 0, error: 'timeout' }], providers_attempted: 2, providers_available: 1, candidate_count: 20, result_count: 10, limitations: ['Not exhaustive', 'Unavailable during this search: core.'], executed_at: '2026-10-06T09:00:00.000Z' },
    { id: 'run-2', context: 'literature', query: 'Partial record', domain: null, providers: null, providers_attempted: 0, providers_available: 0, candidate_count: null, result_count: 0, limitations: null, executed_at: '2026-10-06T08:00:00.000Z' },
  ];
  const html = renderToStaticMarkup(<SearchScopePanel runs={runs} />);

  test('shows query, time, results, providers and unavailable providers, and says it is not exhaustive', () => {
    expect(html).toContain('نطاق البحث المسجل');
    expect(html).toContain('لا تمثل مراجعة شاملة');
    expect(html).toContain('AI postgraduate learning');
    expect(html).toContain('10 نتيجة محفوظة من 20 مسترجعة');
    expect(html).toContain('المصادر المتاحة: 1 من 2');
    expect(html).toContain('تعذّر الوصول إلى: CORE');
  });

  test('missing provider details are handled and stated', () => {
    expect(html).toContain('Partial record');
    expect(html).toContain('تفاصيل المزوّدين غير مسجلة');
  });

  test('an empty scope explains how it is recorded', () => {
    expect(renderToStaticMarkup(<SearchScopePanel runs={[]} />)).toContain('لا توجد عمليات بحث مسجلة بعد');
  });
});

describe('sources and evidence', () => {
  test('a saved source shows where it came from, with no verification status or percentage', () => {
    for (const origin of [...Object.keys(SOURCE_ORIGIN_LABELS), undefined, 'something-else']) {
      const html = renderToStaticMarkup(<SourceStatus origin={origin} canonicalLinked />);
      expect(html).not.toMatch(/unverified|verified|%|ثقة/);
    }
    expect(renderToStaticMarkup(<SourceStatus origin="server_discovered" canonicalLinked />)).toContain('مرتبط بسجل علمي موحّد');
    expect(renderToStaticMarkup(<SourceStatus origin="user_asserted" />)).toContain('مصدر أدخله الباحث');
  });

  test('evidence shows its source, DOI and grounding state; no state label claims truth', () => {
    const html = renderToStaticMarkup(<EvidenceCard evidence={evidence('e1', 'A finding', { state: 'source_supported', state_set_by: 'researcher' })} source={{ id: 'ref-1', title: 'Source title', authors: [], year: 2024, doi: '10.1000/x', url: null }} />);
    expect(html).toContain('Source title');
    expect(html).toContain('DOI: 10.1000/x');
    expect(html).toContain('أكّد الباحث وروده في المصدر');
    for (const state of Object.values(EVIDENCE_STATE_LABELS)) expect(`${state.label} ${state.hint}`.replace(/ليس حكماً بصحته/, '')).not.toMatch(OVERCLAIMING);
    expect(renderToStaticMarkup(<EvidenceCard evidence={evidence('e2', 'Note', { project_reference_id: null, source_kind: 'none', state: 'user_asserted' })} />)).toContain('ملاحظة الباحث دون مصدر مرتبط');
  });

  test('the library and the evidence panel no longer show a verification status or confidence score', () => {
    for (const file of ['src/app/research/library/page.tsx', 'src/components/ResearchEvidenceSidebar.tsx']) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/confidenceScore|\{[^}]*verificationStatus\}|ثقة \{/);
    }
  });
});

describe('requests send only researcher-controlled fields', () => {
  test('no request carries a work id, state set by the server, origin, classification or coverage', () => {
    const bodies = [
      evidenceCreateBody({ projectReferenceId: 'ref-1', evidenceType: 'finding', content: ' text ', locator: '' }),
      evidenceUpdateBody('e1', { content: 'new', state: 'source_supported' }),
      claimCreateBody({ statement: ' claim ', claimType: 'gap' }),
      supportCreateBody({ claimId: 'c1', evidenceItemId: 'e1', relation: 'contradicts', rationale: '' }),
      gapAssessBody('c1'),
      gapDecisionBody('g1', 'accept'),
    ];
    const forbidden = ['work_id', 'workId', 'origin', 'classification', 'state_set_by', 'source_kind', 'confirmation', 'basis', 'search_run_ids', 'providers', 'project_id', 'created_by'];
    for (const body of bodies) for (const key of forbidden) expect(body).not.toHaveProperty(key);
    expect(evidenceCreateBody({ projectReferenceId: null, evidenceType: 'finding', content: ' text ', locator: ' p. 4 ' })).toEqual({ projectReferenceId: null, evidenceType: 'finding', content: 'text', locator: 'p. 4' });
  });
});

// ---- Pre-production hardening: Arabic system texts and qualifying evidence ----------

const ARABIC = /[؀-ۿ]/;
const FORBIDDEN_UI = /VERIFIED_GAP|verified gap|proven gap|objective verification|فجوة موثقة|فجوة مثبتة|فجوة مؤكدة/i;

function gapLink(relation: GapLink['relation'], state: string, source: string): GapLink {
  return { id: `l-${source}-${state}-${relation}`, relation, origin: 'researcher', confirmation: 'confirmed', evidence: { id: `e-${source}-${state}`, state, project_reference_id: `ref-${source}`, work_id: `work-${source}`, source_kind: 'server_discovered' } };
}

describe('system texts render in Arabic', () => {
  test('every rationale and limitation the classifier and search recording can produce has a fixed Arabic rendering', () => {
    const run = { id: 'r', query: 'q', executed_at: '2026-10-06T00:00:00.000Z', providers_attempted: 3, providers_available: 1, result_count: 5,
      limitations: searchLimitations({ domain: null, candidateCount: 9, providers: [{ provider: 'openalex', available: true, papers: [], durationMs: 1 }, { provider: 'crossref', available: false, papers: [], durationMs: 1 }, { provider: 'core', available: false, papers: [], durationMs: 1 }] }, 5) };
    const scenarios: GapLink[][] = [
      [],
      [{ ...gapLink('supports', 'recorded', 'a'), origin: 'system', confirmation: 'suggested' }],
      [gapLink('supports', 'recorded', 'a')],
      [gapLink('supports', 'source_supported', 'a'), gapLink('supports', 'source_supported', 'b'), gapLink('contradicts', 'recorded', 'c'), gapLink('supports', 'insufficient_support', 'd')],
      [gapLink('supports', 'recorded', 'a'), gapLink('contradicts', 'recorded', 'b'), gapLink('contradicts', 'recorded', 'c')],
    ];
    const texts = new Set<string>([
      ...searchLimitations(undefined, 0),
      ...searchLimitations({ domain: null, candidateCount: 0, providers: [{ provider: 'core', available: false, papers: [], durationMs: 1 }] }, 0),
    ]);
    for (const links of scenarios) for (const runs of [[run], []]) {
      const result = assessGap(links, runs);
      for (const text of [...result.rationale, ...result.limitations]) texts.add(text);
    }
    expect(texts.size).toBeGreaterThan(12);
    for (const text of texts) {
      const rendered = systemTextArabic(text);
      expect({ text, translated: rendered.translated }).toEqual({ text, translated: true });
      expect(rendered.text).toMatch(ARABIC);
      expect(rendered.text).not.toMatch(FORBIDDEN_UI);
    }
  });

  test('the observed browser texts read as conservative academic Arabic', () => {
    expect(systemTextArabic('Supporting evidence is limited: 1 source-grounded item(s) from 1 distinct source(s); at least two of each are needed for an evidence-backed gap.').text)
      .toContain('الأدلة الداعمة محدودة');
    expect(systemTextArabic('This assessment covers only the recorded searches and the evidence linked to the claim. It is not an exhaustive review and does not establish that no study exists.').text)
      .toBe('يغطي هذا التقييم عمليات البحث المسجلة والأدلة المرتبطة بالادعاء فقط. ولا يمثل مراجعة شاملة للأدبيات، ولا يثبت عدم وجود دراسات أخرى.');
    expect(systemTextArabic('Each provider returns a limited number of top-ranked records per query.').text).toBe('يعيد كل مزود عدداً محدوداً من النتائج الأعلى ترتيباً لكل استعلام.');
  });

  test('provider names are kept intact', () => {
    expect(systemTextArabic('Unavailable during this search: crossref, core.').text).toBe('تعذر الوصول أثناء هذا البحث إلى: Crossref، CORE.');
    expect(systemTextArabic('Unavailable during this search: some_new_index.').text).toBe('تعذر الوصول أثناء هذا البحث إلى: some_new_index.');
    expect(providerDisplayName('openalex')).toBe('OpenAlex');
  });

  test('an unknown stored text is shown as stored, not hidden or rewritten', () => {
    expect(systemTextArabic('A new limitation the mapping does not know.')).toEqual({ text: 'A new limitation the mapping does not know.', translated: false });
    const html = renderToStaticMarkup(<GapAssessmentCard assessment={{ ...assessment, limitations: ['A new limitation the mapping does not know.'] }} evidenceById={evidenceById} />);
    expect(html).toContain('A new limitation the mapping does not know.');
  });
});

describe('linked evidence versus qualifying evidence', () => {
  const unconfirmed = evidence('e-unconfirmed', 'Linked but not confirmed', { state: 'recorded' });
  const confirmed = evidence('e-confirmed', 'Confirmed in its source', { state: 'source_supported', state_set_by: 'researcher' });
  const byId = new Map([...evidenceById, ['e-unconfirmed', unconfirmed], ['e-confirmed', confirmed]]);
  const real = assessGap([gapLink('supports', 'recorded', 'x')], [{ id: 'run-1', query: 'q', executed_at: '2026-10-06T00:00:00.000Z', providers_attempted: 3, providers_available: 1, result_count: 4, limitations: searchLimitations({ domain: null, candidateCount: 4, providers: [{ provider: 'openalex', available: true, papers: [], durationMs: 1 }, { provider: 'crossref', available: false, papers: [], durationMs: 1 }, { provider: 'core', available: false, papers: [], durationMs: 1 }] }, 4) }]);
  const browserCase: GapRecord = {
    ...assessment, classification: real.classification, rationale: real.rationale, limitations: real.limitations, method_version: 'gap-rules-v2', search_run_ids: real.searchRunIds,
    basis: { ...real.basis, supportingEvidence: ['e-unconfirmed', 'e-confirmed'], qualifyingSupportingEvidence: ['e-confirmed'], contradictingEvidence: ['e-against'] },
  };
  const html = renderToStaticMarkup(<GapAssessmentCard assessment={browserCase} evidenceById={byId} />);

  test('the gap card separates linked supporting evidence from qualifying confirmed evidence', () => {
    expect(real.classification).toBe('POTENTIAL_GAP');
    expect(html).toContain('فجوة محتملة');
    expect(html).toContain('أدلة داعمة مرتبطة (2)');
    expect(html).toContain('أدلة مؤكدة مؤهلة للتقييم: 1 من 2');
    expect(html).toMatch(/data-qualifying="false"[^>]*>[\s\S]*?Linked but not confirmed[\s\S]*?يحتاج تأكيد وروده في المصدر/);
    expect(html).toMatch(/data-qualifying="true"[^>]*>[\s\S]*?Confirmed in its source[\s\S]*?مؤهل للتقييم/);
  });

  test('rationale, limitations and providers render in Arabic; contradictions and scope limits stay visible', () => {
    expect(html).toContain('الأدلة الداعمة محدودة');
    expect(html).toContain('يغطي هذا التقييم عمليات البحث المسجلة والأدلة المرتبطة بالادعاء فقط');
    expect(html).toContain('تعذر الوصول أثناء هذا البحث إلى: Crossref، CORE.');
    expect(html).toContain('يعيد كل مزود عدداً محدوداً من النتائج الأعلى ترتيباً لكل استعلام.');
    expect(html).not.toMatch(/Supporting evidence is limited|This assessment covers only|Unavailable during this search|Each provider returns/);
    expect(html).toContain('أدلة معارضة (1)');
    expect(html).toContain('Contradicting finding text');
    expect(html).toContain('حدود هذا التقييم');
    expect(html).toContain('لم يُراجع بعد');
  });

  test('an assessment made under the earlier rules says so and asks for a new assessment', () => {
    const legacy = renderToStaticMarkup(<GapAssessmentCard assessment={{ ...browserCase, method_version: 'gap-rules-v1', basis: { supportingEvidence: ['e-unconfirmed', 'e-confirmed'], contradictingEvidence: [] } }} evidenceById={byId} />);
    expect(legacy).toContain('وفق قواعد سابقة');
    expect(legacy).toContain('أدلة مؤكدة مؤهلة للتقييم: 1 من 2');
  });

  test('the claim board marks a supporting link whose evidence is not yet confirmed in its source', () => {
    const claim: ClaimRecord = { id: 'c', statement: 's', claim_type: 'gap', origin: 'researcher', status: 'active', created_at: '', supports: [
      { id: 's1', claim_id: 'c', evidence_item_id: 'e-unconfirmed', relation: 'supports', origin: 'researcher', confirmation: 'confirmed', rationale: null, created_at: '' },
      { id: 's2', claim_id: 'c', evidence_item_id: 'e-confirmed', relation: 'supports', origin: 'researcher', confirmation: 'confirmed', rationale: null, created_at: '' },
    ] };
    const board = renderToStaticMarkup(<ClaimSupportBoard claim={claim} evidenceById={byId} />);
    expect(board).toMatch(/Linked but not confirmed[\s\S]*?يحتاج تأكيد وروده في المصدر · غير مؤهل للتصنيف الأعلى/);
    expect(board).toMatch(/Confirmed in its source[\s\S]*?أكّد الباحث وروده في المصدر · مؤهل للتقييم/);
  });

  test('no gap, scope or claim view uses verified-gap wording', () => {
    const views = [
      html,
      renderToStaticMarkup(<GapAssessmentCard assessment={{ ...browserCase, classification: 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE', researcher_confirmation: 'accepted', confirmed_at: '2026-10-06T12:00:00.000Z' }} evidenceById={byId} />),
      renderToStaticMarkup(<SearchScopePanel runs={[]} />),
    ];
    for (const view of views) expect(view).not.toMatch(FORBIDDEN_UI);
  });
});
