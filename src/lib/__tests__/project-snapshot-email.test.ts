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
  });
});
