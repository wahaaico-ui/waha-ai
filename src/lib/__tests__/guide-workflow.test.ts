import { approvedStyleProfile, guideExportGaps, guideRuleCandidates, GUIDE_RULE_EXPORT, GUIDE_RULE_KEYS, readSavedGuide, saveGuideEnvelope } from '../guide-workflow';
import { buildProjectExportModel } from '../project-export';

const text = ['الجامعة: جامعة الاختبار', 'حجم المتن العربي: 14 نقطة', 'تباعد الأسطر: 1.5', 'الهامش العلوي: 3 سم', 'نظام التوثيق: APA 7'].join('\n');

describe('reviewed university guide', () => {
  it('keeps text, evidence and approval together and uses only approved rules in exports', () => {
    const candidates = guideRuleCandidates(text);
    const size = candidates.find(rule => rule.key === 'arabic_font_size_body')!;
    const stored = saveGuideEnvelope(text, [{ ...size, status: 'approved' }, ...candidates.filter(rule => rule.key !== size.key)]);
    expect(stored).toBeTruthy();
    const guide = readSavedGuide(stored);
    expect(guide.text).toBe(text);
    expect(approvedStyleProfile(guide).language_rules.arabic_font_size_body?.value).toBe(14);
    expect(approvedStyleProfile(guide).page_layout.margin_top).toBeNull();
    const model = buildProjectExportModel({ title: 'بحث', university_policy: stored }, [], []);
    expect(model.styleProfile?.language_rules.arabic_font_size_body?.value).toBe(14);
    expect(model.styleProfile?.page_layout.margin_top).toBeNull();
    expect(JSON.stringify(model.sections)).not.toContain('WAHA_GUIDE_V1:');
  });

  it('rejects invented evidence, duplicate keys and unsafe values', () => {
    const original = guideRuleCandidates(text)[0];
    expect(saveGuideEnvelope(text, [{ ...original, evidence: 'invented' }])).toBeNull();
    expect(saveGuideEnvelope(text, [original, original])).toBeNull();
    expect(saveGuideEnvelope(text, [{ ...original, status: 'approved', value: '<script>' }])).toBeNull();
  });
});

describe('what each export file does with an approved rule', () => {
  it('lists approved rules a file cannot apply, so the researcher is warned before download', () => {
    const guide = ['Arabic font: Simplified Arabic', 'Arabic body font size: 16 pt', 'Line spacing: 2', 'Paragraph indentation: 1 cm', 'Top margin: 2.5 cm', 'University: Mutah University'].join('\n');
    const rules = guideRuleCandidates(guide).map(rule => ({ ...rule, status: 'approved' as const }));
    const saved = readSavedGuide(saveGuideEnvelope(guide, rules));
    expect(guideExportGaps(saved)).toEqual([
      { key: 'university_or_journal_name', value: 'Mutah University', word: 'not_applied', pdf: 'not_applied' },
      { key: 'arabic_font_family', value: 'Simplified Arabic', word: 'applied', pdf: 'not_applied' },
      { key: 'line_spacing', value: '2', word: 'applied', pdf: 'approximate' },
      { key: 'paragraph_indentation', value: '1', word: 'applied', pdf: 'not_applied' },
    ]);
    // A rule still under review is not reported as applied or missing; it is not used at all.
    const reviewOnly = readSavedGuide(saveGuideEnvelope(guide, guideRuleCandidates(guide)));
    expect(guideExportGaps(reviewOnly)).toEqual([]);
  });

  it('describes every guide rule for both files', () => {
    for (const key of GUIDE_RULE_KEYS) expect(GUIDE_RULE_EXPORT[key]).toEqual({ word: expect.stringMatching(/^(applied|approximate|not_applied)$/), pdf: expect.stringMatching(/^(applied|approximate|not_applied)$/) });
  });
});

it('the matrix matches the files: Word names the approved font, the PDF embeds its own', async () => {
  const { buildProjectDocx, buildProjectPdf } = await import('../project-document-export');
  const guide = 'Arabic font: Simplified Arabic\nParagraph indentation: 1 cm';
  const saved = readSavedGuide(saveGuideEnvelope(guide, guideRuleCandidates(guide).map(rule => ({ ...rule, status: 'approved' as const }))));
  const model = { title: 'عنوان', notice: 'نص', language: 'ar' as const, styleProfile: approvedStyleProfile(saved), sections: [{ title: 'المسودة', paragraphs: ['فقرة عربية.'] }] };
  const pdf = (await buildProjectPdf(model)).toString('latin1');
  expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Amiri-Regular/u);
  expect(pdf).not.toContain('Simplified');
  const { execFileSync } = await import('node:child_process'); const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs'); const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'waha-guide-matrix-'));
  try {
    writeFileSync(join(dir, 'p.docx'), await buildProjectDocx(model));
    const xml = execFileSync('unzip', ['-p', join(dir, 'p.docx'), 'word/document.xml'], { encoding: 'utf8' });
    expect(xml).toContain('w:cs="Simplified Arabic"'); expect(xml).toContain('w:firstLine="567"');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('only an approved page number rule reaches the export profile, and it keeps its source line', () => {
  const sentence = 'Page numbers must be placed at the top right of each page.';
  const text = `Arabic body font size: 14 pt\n${sentence}\nThe thesis must not exceed 80,000 words.`;
  const approved = saveGuideEnvelope(text, [
    { key: 'page_numbering', value: 'top-right', evidence: sentence, status: 'approved' },
    { key: 'max_words', value: '80000', evidence: 'The thesis must not exceed 80,000 words.', status: 'review' },
  ]);
  expect(approved).not.toBeNull();
  const profile = approvedStyleProfile(readSavedGuide(approved));
  expect(profile.document_rules.page_numbering).toEqual({ value: 'top-right', evidence: sentence });
  // Still under review, so it must not act on the draft or the export.
  expect(profile.document_rules.max_words).toBeNull();
  // A value outside the allowed positions cannot be approved.
  expect(saveGuideEnvelope(text, [{ key: 'page_numbering', value: 'somewhere', evidence: sentence, status: 'approved' }])).toBeNull();
});
