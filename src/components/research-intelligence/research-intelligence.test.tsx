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
    expect(html).toContain('Unavailable during this search: core.');
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
    expect(html).toContain('تعذّر الوصول إلى: core');
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
