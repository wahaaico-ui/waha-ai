import { buildProjectSnapshotEmail } from '@/lib/email/project-snapshot';

describe('project snapshot email', () => {
  test('renders a readable owned project snapshot without executable HTML', () => {
    const email = buildProjectSnapshotEmail({
      researcherName: 'أحمد <script>alert(1)</script>',
      projectTitle: 'أثر التعلم <img src=x onerror=alert(1)>',
      stage: 'journey:problem',
      version: 3,
      savedAt: '2026-08-30T10:00:00.000Z',
      content: JSON.stringify({
        problemStatement: 'انخفاض المشاركة <script>alert(2)</script>',
        researchGap: 'نقص الأدلة المحلية',
      }),
      dashboardUrl: 'https://waha-ai.vercel.app/dashboard',
    });

    expect(email.subject).toContain('النسخة 3');
    expect(email.text).toContain('مشكلة البحث');
    expect(email.text).toContain('الفجوة البحثية');
    expect(email.html).not.toContain('<script>alert');
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('https://waha-ai.vercel.app/dashboard');
  });

  test('rejects non-HTTPS continuation links and bounds oversized content', () => {
    const email = buildProjectSnapshotEmail({
      researcherName: 'باحث',
      projectTitle: 'مشروع',
      stage: 'journey:analysis',
      version: 1,
      savedAt: 'invalid',
      content: { conclusion: 'ن'.repeat(30_000) },
      dashboardUrl: 'javascript:alert(1)',
    });

    expect(email.html).not.toContain('javascript:');
    expect(email.text).toContain('https://waha.systems/dashboard');
    expect(email.text.length).toBeLessThan(22_000);
    expect(email.text).toContain('يعرض البريد مقتطفًا');
  });

  test('labels autosaved drafts without presenting them as approved versions', () => {
    const email = buildProjectSnapshotEmail({
      researcherName: 'محمد',
      projectTitle: 'مشروع تجريبي',
      stage: 'journey:objectives',
      version: 3,
      savedAt: '2026-09-20T10:00:00.000Z',
      content: { objectives: ['هدف محفوظ تلقائياً'] },
      dashboardUrl: 'https://waha.systems/dashboard',
      isDraft: true,
    });

    expect(email.subject).toContain('مسودة محفوظة تلقائياً');
    expect(email.text).toContain('هذه أحدث مسودة محفوظة تلقائياً');
    expect(email.text).not.toContain('رقم النسخة: 3');
  });
});

test('renders a writing snapshot without leaking internal editor fields and rejects an unreadable one', () => {
  const input = { researcherName: 'Researcher', projectTitle: 'Project', stage: 'evidence-writing:v1', version: 1,
    savedAt: '2026-10-20T00:00:00Z', dashboardUrl: 'https://waha.systems/dashboard' };
  const message = buildProjectSnapshotEmail({ ...input, content: { text: '<script>saved text</script>', citations: [] } });
  expect(message.text).toContain('الكتابة المرتبطة بالدليل');
  expect(message.html).toContain('&lt;script&gt;saved text&lt;/script&gt;');
  expect(message.html).not.toContain('<script>');
  expect(message.text).not.toMatch(/citations:|sourceHash|richText/);
  expect(() => buildProjectSnapshotEmail({ ...input, content: { text: 123, citations: [] } })).toThrow('EMAIL_SNAPSHOT_UNREADABLE');
});
