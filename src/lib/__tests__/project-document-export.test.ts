import { mkdir, writeFile } from 'node:fs/promises';
import { buildProjectDocx, buildProjectPdf } from '@/lib/project-document-export';
import type { ProjectExportModel } from '@/lib/project-export';

const repeatedArabic = Array.from({ length: 10 }, (_, index) =>
  `فقرة اختبار ${index + 1}: تُحلّل الدِّراسة أثرَ التعلُّم الرَّقمي على طلبة الجامعات خلال 2024–2026، مع الحفاظ على الأرقام 12.5% والمعادلة س = ص + 2 والنص العربي المشكول.`
);

const model: ProjectExportModel = {
  title: 'أثر التعلُّم الرَّقمي على جودة البحث العلمي',
  notice: 'نسخة اختبارية للتحقق من سلامة التصدير العربي وتنسيق الصفحات.',
  sections: [
    { title: 'تعليمات الجامعة', level: 1, paragraphs: ['الالتزام بدليل الجامعة وتوثيق المراجع وفق النمط المعتمد.'] },
    { title: 'المشكلة والفجوة - النسخة 2', level: 1, paragraphs: repeatedArabic },
    { title: 'الأهداف - النسخة 1', level: 1, paragraphs: ['قياس الأثر.', 'مقارنة النتائج بين التخصصات.', 'تفسير الفروق في ضوء الأدبيات.'] },
    { title: 'المصادر المحفوظة', level: 1, paragraphs: ['تُراجع جميع البيانات الببليوغرافية قبل الاعتماد النهائي.'] },
    { title: 'المصدر 1', level: 2, paragraphs: ['باحث، أ. (2025). التعلُّم الرقمي والجامعات العربية. مجلة البحث، 8(2)، 20–41.'] },
    { title: 'مكتبة مراجع المشروع', level: 1, paragraphs: ['المراجع أدناه محفوظة ضمن المشروع.'] },
    { title: 'المرجع 1', level: 2, paragraphs: ['العنوان: Digital Learning in Higher Education', 'DOI: 10.1000/waha.2025.1'] },
  ],
};

describe('academic document export', () => {
  it('builds a real Word package and a readable, paginated PDF', async () => {
    const [docx, pdf] = await Promise.all([buildProjectDocx(model), buildProjectPdf(model)]);

    expect(docx.subarray(0, 2).toString()).toBe('PK');
    expect(docx.byteLength).toBeGreaterThan(5_000);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(10_000);

    const pdfStructure = pdf.toString('latin1');
    expect(pdfStructure.match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(4);
    expect(pdfStructure).toContain('/Outlines');

    if (process.env.WRITE_EXPORT_QA === '1') {
      const directory = '/private/tmp/waha-export-qa';
      await mkdir(directory, { recursive: true });
      await Promise.all([
        writeFile(`${directory}/waha-academic-export.docx`, docx),
        writeFile(`${directory}/waha-academic-export.pdf`, pdf),
      ]);
    }
  }, 30_000);
});
