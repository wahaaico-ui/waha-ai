import { renderToStaticMarkup } from 'react-dom/server';
import SavedLiteraturePicker from './SavedLiteraturePicker';

test('early collection exposes a project-scoped next action, not formal approval', () => {
  const html = renderToStaticMarkup(<SavedLiteraturePicker projectId="project & other" canApprove={false} />);
  expect(html).toContain('جارٍ تحميل مكتبة المشروع');
  expect(html).not.toContain('الخطوة التالية: ابحث واحفظ مصدرًا');
  expect(html).toContain('ليس اعتمادًا رسميًا');
  expect(html).toContain('اختيار جميع المراجع المناسبة');
  expect(html).not.toContain('حتى 12 دراسة');
  expect(html).not.toContain('تثبيت اختيار 3 مراجع');
});

test('formal approval stays disabled without the required selection', () => {
  const html = renderToStaticMarkup(<SavedLiteraturePicker projectId="project-a" canApprove />);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>تثبيت اختيار 3 مراجع أو أكثر<\/button>/);
});
