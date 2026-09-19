import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Documentation only. Never accesses credentials, databases or production APIs.
const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const areas = JSON.parse(read('docs/architecture/product-audit/areas.json'));
const verified = JSON.parse(read('docs/architecture/product-audit/verification.json'));
const counters = new Map();
const records = read('docs/architecture/product-audit/requirements.tsv').trim().split('\n').filter(line => !line.startsWith('#')).map(line => {
  const cells = line.split('\t');
  assert.equal(cells.length, 8, `Expected 8 cells: ${line}`);
  const [page, area, status, severity, scope, requirement, gap, acceptance] = cells;
  assert.ok(areas[area], `Unknown area ${area}`);
  assert.ok(['COMPLETE', 'PARTIAL', 'MISSING', 'BROKEN', 'NOT APPLICABLE'].includes(status));
  assert.ok(['Blocker', 'Critical', 'Major', 'Minor'].includes(severity));
  assert.ok(Number(page) >= 1 && Number(page) <= 61);
  const n = (counters.get(page) || 0) + 1;
  counters.set(page, n);
  const id = `DOC-${page.padStart(2, '0')}-${String(n).padStart(2, '0')}`;
  const a = areas[area];
  for (const path of a.files) assert.ok(existsSync(resolve(root, path)), `Missing evidence path: ${path}`);
  // No implementation is marked complete just because its file exists.
  assert.notEqual(status, 'COMPLETE', 'COMPLETE needs a recorded per-requirement acceptance result; add explicit verification support first.');
  const row = [page, id, requirement, a.route, a.files.join('; '), a.api, a.tables, status,
    `${a.evidence} [STATIC; ليس إثبات تشغيل إنتاجي]`,
    status === 'NOT APPLICABLE' ? 'مادة مرجعية وليست عملية تطبيق' : status === 'MISSING' ? 'لا يوجد تنفيذ موصول مثبت لهذا المطلب؛ الملفات المذكورة أقرب موضع متعلق به فقط' : a.works,
    gap, severity, gap, acceptance,
    status === 'NOT APPLICABLE' ? 'NOT RUN — مادة وثائقية' : status === 'BROKEN' ? 'FAIL — مخالفة ظاهرة في الكود؛ إعادة الإنتاج واختبار الإصلاح مطلوبان' : 'NOT RUN — القبول الخاص بهذا المطلب غير منفذ في هذا التدقيق', scope];
  const verification = verified[id];
  if (verification) {
    assert.equal(verification.status, 'PARTIAL', 'Partial regression evidence must not certify the whole requirement');
    for (const [column, value] of Object.entries(verification.columns)) {
      assert.ok([8, 9, 10, 12, 14].includes(Number(column)) && typeof value === 'string' && value.length > 0);
      row[Number(column)] = value;
    }
    row[7] = verification.status;
  }
  return row;
});
for (const id of Object.keys(verified)) assert.ok(records.some(row => row[1] === id), `Orphan verification ${id}`);
for (let page = 1; page <= 61; page++) assert.ok(counters.has(String(page)), `Unmapped source page ${page}`);
const headers = ['Page / Screen', 'Requirement ID', 'المطلب الأصلي (صياغة أمينة)', 'Route', 'Component / File', 'Backend / API', 'Database tables (code references)', 'Status', 'Evidence', 'ما الموجود فعلياً في الكود؟', 'ما الناقص؟', 'Severity', 'التعديل / التحقق المطلوب', 'Acceptance Test', 'Test Result', 'نطاق الوثيقة'];
const escaped = v => String(v).replaceAll('|', '\\|').replaceAll('\n', '<br>');
const intro = `# PRODUCT COMPLETION MATRIX\n\nتاريخ الفحص: 2026-09-11. مرجع التنفيذ الابتدائي: c99c9c5. المرجع: وثيقة المنتج الرسمية، الإصدار الثاني، 61 صفحة.\n\n## حدود هذا الإصدار\n\nهذه مطابقة تفصيلية أولى تغطي صفحات المصدر الـ61 في جدول واحد (${records.length} صفاً)، وليست شهادة إطلاق أو ادعاء اجتياز اختبارات القبول. نصوص المطالب معاد صياغتها لتفكيكها وليست اقتباسات حرفية. الصفحات الافتتاحية والفهارس والخاتمة مذكورة صراحة. تكرار المبدأ في الوثيقة لا يعني ميزة جديدة. يلزم تدقيق ثانٍ مقابل الأصل للتأكد من عدم سقوط مطلب مركب؛ تغطية أرقام الصفحات وحدها لا تثبت اكتمال تفكيك المطالب.\n\n- لا يوجد COMPLETE بدون اختبار. STATIC يعني قراءة كود/جرد مسارات فقط، وليس تنفيذ الطلب أو مراجعة مخطط الإنتاج.\n- PARTIAL يشمل تطبيقاً ظاهراً لم يثبت قبوله كاملاً؛ MISSING يعني غياب التنفيذ الموصول المثبت، وليس غياب أي ملف يحمل اسماً مشابهاً.\n- BROKEN هنا مخالفة محددة ظاهرة في التنفيذ، وليست تخميناً عن حسابات المزودين أو حصة API.\n- أسماء الجداول هي مراجع الكود؛ لا تثبت أن migrations مطبقة أو أن RLS صحيحة في الإنتاج.\n- المؤجل بالوثيقة يبقى في الجدول ولا يُحوّل تلقائياً إلى مانع إطلاق اليوم الأول. أهداف السوق ليست اختبارات برمجية.\n- تعليمات المالك الأحدث: الدفع معطل، الأزرار تشرح أنه قيد الإعداد؛ فحص الأجهزة مقبول من المالك ولا يُعاد ما لم نغير الواجهات.\n- الدليل التاريخي (254 unit و10 public smoke) لا يمنح PASS للرحلة المسجلة أو البريد أو جودة البحث.\n\n## تعارضات يجب حلها دون توسيع النطاق\n\n1. ص24: مؤشر القبول لا يجوز عرضه كاحتمال قبول علمي موثوق دون معايرة؛ ص12 تمنع ضمان القبول.\n2. ص37: عدم إمكانية تعطيل البريد مقابل تفضيلات المستخدم؛ لا نضيف تسويقاً إلزامياً أو نساوي النسخ بالبريد التسويقي.\n3. ص41 مقابل ص50: عبارة المجاني كامل الوظائف لا تتفق مع قصر المجاني على الاستكشاف. لا تُفعّل قيود أو تحصيل قبل توضيح الوعد.\n4. ص41: لا يمكن ضمان استحالة إزالة علامة من ملف قابل للتحرير؛ يلزم وصف تقني صادق.\n5. ص39: مولد لغوي وحده ليس فحص تشابه قواعد بيانات أو كاشف تأليف موثوقاً.\n6. ص59: إرسال محتوى إلى مزودي AI يحتاج سياسة وموافقة متسقتين مع وعد عدم المشاركة.\n\n## الجدول الموحد\n\n`;
const markdown = intro + '| ' + headers.join(' | ') + ' |\n|' + headers.map(() => '---').join('|') + '|\n' + records.map(row => '| ' + row.map(escaped).join(' | ') + ' |').join('\n') + '\n';
const csv = '\uFEFF' + [headers, ...records].map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
writeFileSync(resolve(root, 'docs/architecture/PRODUCT_COMPLETION_MATRIX.md'), markdown);
writeFileSync(resolve(root, 'docs/architecture/PRODUCT_COMPLETION_MATRIX.csv'), csv);
console.log(JSON.stringify({ pages: counters.size, requirements: records.length, statuses: Object.fromEntries([...new Set(records.map(r => r[7]))].map(status => [status, records.filter(r => r[7] === status).length])), validation: 'PASS: page coverage, unique page IDs, schema, evidence file paths; NOT product acceptance' }, null, 2));
