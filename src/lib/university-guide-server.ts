import { canonicalPdfPages } from '@/lib/pdf-evidence';
import { arabicTextLayerUnreadable, normalizeUniversityPolicy, UNIVERSITY_GUIDE_MAX_BYTES, UNIVERSITY_GUIDE_MAX_PAGES, UNIVERSITY_POLICY_MAX_CHARS } from '@/lib/university-policy';
import { extractAcademicStyleProfile } from '@/lib/academic-style-profile';

/** Local text-layer extraction only. Never invokes an AI/OCR provider or stores PDF bytes. */
export async function extractUniversityGuide(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > UNIVERSITY_GUIDE_MAX_BYTES || Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-') throw new Error('invalid_guide');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  try {
    const info = await parser.getInfo();
    if (!Number.isInteger(info.total) || info.total < 1 || info.total > UNIVERSITY_GUIDE_MAX_PAGES) throw new Error('guide_pages');
    const result = await parser.getText({ pageJoiner: '' });
    const canonical = canonicalPdfPages(result.pages, info.total);
    const text = normalizeUniversityPolicy(canonical.text);
    if (canonical.text.length > UNIVERSITY_POLICY_MAX_CHARS) throw new Error('guide_text');
    // An image-only (scanned) guide has no text layer; nothing is guessed from it.
    if (!text || text.length < 20) throw new Error('guide_no_text');
    if (arabicTextLayerUnreadable(text)) throw new Error('guide_scrambled_text');
    return { text, totalPages: info.total, emptyPages: result.pages.filter(page => !page.text.trim()).map(page => page.num), styleProfile: extractAcademicStyleProfile(text) };
  } finally { await parser.destroy(); }
}
