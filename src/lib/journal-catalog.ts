/**
 * Ten journals' published author instructions, read on 13 Nov 2026 and turned
 * into journal templates (DOC-45-02). Each keeps the page it came from and
 * what a template cannot hold, so the researcher sees which rules are checked
 * and which remain theirs to follow. Only stated numbers are used; a limit a
 * page does not state stays empty.
 */
import type { JournalTemplate } from '@/lib/journal-template';

export type CatalogJournal = {
  id: string;
  name: string;
  publisher: string;
  articleType: string;
  source: string;
  /** The journal's own page, or another page quoting it when the journal blocks reading. */
  sourceKind: 'journal' | 'secondary';
  checkedAt: string;
  template: JournalTemplate;
  /** Rules the journal states that a template does not check. */
  notChecked: string[];
};

const CHECKED_AT = '2026-11-13';
const custom = (template: Omit<JournalTemplate, 'preset'>): JournalTemplate => ({ preset: 'custom', ...template });

export const JOURNAL_CATALOG: CatalogJournal[] = [
  {
    id: 'plos-one', name: 'PLOS ONE', publisher: 'PLOS', articleType: 'Research Article',
    source: 'https://journals.plos.org/plosone/s/submission-guidelines', sourceKind: 'journal', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'methods', 'results', 'discussion', 'conclusion'], wordLimit: null, abstractMaxWords: 300, keywordsMin: null, keywordsMax: null, referenceLimit: null }),
    notChecked: ['المراجع بنمط Vancouver؛ اختره من نمط التوثيق في الكتابة.', 'لا تطلب المجلة كلمات مفتاحية.'],
  },
  {
    id: 'scientific-reports', name: 'Scientific Reports', publisher: 'Springer Nature', articleType: 'Article',
    source: 'https://www.nature.com/srep/author-instructions/submission-guidelines', sourceKind: 'journal', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'results', 'discussion', 'methods'], wordLimit: 4500, abstractMaxWords: 200, keywordsMin: 0, keywordsMax: 6, referenceLimit: 60 }),
    notChecked: ['حد 4500 كلمة لا يشمل المنهجية والمراجع وتعليقات الأشكال، والفحص هنا يعدّ المنهجية.', 'العنوان 20 كلمة على الأكثر.', 'حد 60 مرجعًا غير ملزم بصرامة بنص المجلة.'],
  },
  {
    id: 'frontiers-psychology', name: 'Frontiers in Psychology', publisher: 'Frontiers', articleType: 'Original Research',
    source: 'https://www.frontiersin.org/journals/psychology/for-authors/article-types', sourceKind: 'journal', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'methods', 'results', 'discussion'], wordLimit: 12000, abstractMaxWords: null, keywordsMin: 5, keywordsMax: 8, referenceLimit: null }),
    notChecked: ['حتى 15 شكلًا وجدولًا.', 'الملخص فقرة واحدة؛ لم تذكر صفحة أنواع المقالات حدًا لكلماته.'],
  },
  {
    id: 'elife', name: 'eLife', publisher: 'eLife Sciences', articleType: 'Research Article',
    source: 'https://reviewer.elifesciences.org/author-guide/full', sourceKind: 'journal', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'results', 'discussion', 'methods'], wordLimit: null, abstractMaxWords: null, keywordsMin: null, keywordsMax: null, referenceLimit: null }),
    notChecked: ['لا حد ملزم للطول؛ تقترح المجلة ألا يتجاوز النص 5000 كلمة دون المنهجية والمراجع.', 'الملخص عادة 150–200 كلمة، دون إلزام.'],
  },
  {
    id: 'jmir', name: 'Journal of Medical Internet Research', publisher: 'JMIR Publications', articleType: 'Original Paper',
    source: 'https://www.jmir.org/author-information/instructions-for-authors', sourceKind: 'journal', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'methods', 'results', 'discussion'], wordLimit: null, abstractMaxWords: null, keywordsMin: null, keywordsMax: null, referenceLimit: null }),
    notChecked: ['المراجع بأسلوب AMA (الطبعة 11)، وهو غير متاح في الواحة بعد.', 'حدود الكلمات والملخص في صفحة أنواع المقالات، ولم تُقرأ.', 'أقسام إلزامية: التمويل، وتعارض المصالح، وتوفر البيانات، وإسهامات المؤلفين.'],
  },
  {
    id: 'jjnr', name: 'Jordan Journal of Nursing Research', publisher: 'Jordan University of Science and Technology', articleType: 'Original Article',
    source: 'https://jjnr.just.edu.jo/jjnr/home/instructions_to_authors.aspx', sourceKind: 'journal', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'literature', 'methods', 'results', 'discussion', 'conclusion'], wordLimit: 4000, abstractMaxWords: 250, keywordsMin: 0, keywordsMax: 6, referenceLimit: 30 }),
    notChecked: ['ملخص مهيكل بعناوين: Background, Objectives, Methods, Results, Conclusions, Implications for Nursing.', 'حتى 4 جداول وشكلين.', 'قسم Implications to Nursing، وترقيم الأسطر، وقائمة EQUATOR.', 'حد 4000 كلمة لا يشمل المراجع والجداول والأشكال.'],
  },
  {
    id: 'ksu-jap', name: 'مجلة العمارة والتخطيط', publisher: 'جامعة الملك سعود', articleType: 'بحث',
    source: 'https://jap.ksu.edu.sa/sites/jap.ksu.edu.sa/files/attach/jap_regulation_ar.pdf', sourceKind: 'journal', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'literature', 'methods', 'results', 'discussion', 'conclusion'], wordLimit: null, abstractMaxWords: 200, keywordsMin: 0, keywordsMax: 10, referenceLimit: null }),
    notChecked: ['حد 25 صفحة A4 شاملة الملخصين والجداول والمراجع؛ القالب يعدّ الكلمات لا الصفحات.', 'التوثيق بالاسم والتاريخ، وترجمة المراجع العربية إلى الإنجليزية.', 'لم تحدد التعليمات أقسام البحث؛ الأقسام هنا ترتيب عام.'],
  },
  {
    id: 'jnilqs', name: 'Journal of Nursing & Interprofessional Leadership in Quality & Safety', publisher: 'UTHealth Houston', articleType: 'Article',
    source: 'https://digitalcommons.library.tmc.edu/uthoustonjqualsafe/styleguide.html', sourceKind: 'journal', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'methods', 'results', 'discussion'], wordLimit: 3500, abstractMaxWords: 250, keywordsMin: 4, keywordsMax: 6, referenceLimit: null }),
    notChecked: ['صيغة SQUIRE 2.0 مع قسم للتحليل الإحصائي وبيانات الموافقات الأخلاقية.', 'المراجع بنمط APA 7؛ اختره من نمط التوثيق في الكتابة.'],
  },
  {
    id: 'nbu-humanities', name: 'مجلة العلوم الإنسانية بجامعة الحدود الشمالية', publisher: 'جامعة الحدود الشمالية', articleType: 'بحث',
    source: 'https://www.nbu.edu.sa/sites/default/files/2022-08/6----%20%D8%B6%D9%88%D8%A7%D8%A8%D8%B7%20%D8%A7%D9%84%D9%86%D8%B4%D8%B1.pdf', sourceKind: 'journal', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'methods', 'results', 'conclusion'], wordLimit: null, abstractMaxWords: 200, keywordsMin: 0, keywordsMax: 6, referenceLimit: null }),
    notChecked: ['حد 45 صفحة A4؛ القالب يعدّ الكلمات لا الصفحات.', 'النتائج والمناقشة قسم واحد.', 'التوثيق بنمط APA الإصدار السادس، والخط Simplified Arabic بحجم 14 والهوامش 2.54 سم.'],
  },
  {
    id: 'nurse-education-today', name: 'Nurse Education Today', publisher: 'Elsevier', articleType: 'Research manuscript',
    source: 'https://bimhse.med.hku.hk/wp-content/uploads/2026/03/Medical-Education-Type-of-Articles.pdf', sourceKind: 'secondary', checkedAt: CHECKED_AT,
    template: custom({ sections: ['introduction', 'methods', 'results', 'discussion', 'conclusion'], wordLimit: 6000, abstractMaxWords: null, keywordsMin: null, keywordsMax: null, referenceLimit: null }),
    notChecked: ['صفحة المجلة منعت القراءة الآلية؛ الحد 3500–6000 كلمة منقول من صفحة تقتبسها، فتحقق منه في دليل المجلة.', 'حدود الملخص والكلمات المفتاحية لم تُقرأ.'],
  },
];
