import { buildDashboardProjects } from '@/lib/dashboard-resume';

const projects = [
  { id: 'old', title: 'مشروع قديم', status: 'draft', created_at: '2026-08-01T08:00:00.000Z' },
  { id: 'active', title: 'مشروع نشط', status: 'title_completed', created_at: '2026-08-02T08:00:00.000Z' },
];

const verified = {
  decision: 'proceed',
  topic: 'أثر الذكاء الاصطناعي في التعليم الجامعي',
  searchCoverage: { uniqueStudies: 8 },
  researchPaths: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  selectedResearchPath: { id: 'a', title: 'الذكاء الاصطناعي وتعلم طلبة الجامعة' },
};

describe('dashboard project resume', () => {
  test('selects the project with the newest saved stage and opens the correct next stage', () => {
    const result = buildDashboardProjects(projects, [
      { project_id: 'active', type: 'journey:verify', content: JSON.stringify(verified), version: 1, created_at: '2026-08-29T08:00:00.000Z' },
      { project_id: 'active', type: 'journey:title', content: JSON.stringify({ title: 'أثر الذكاء الاصطناعي التوليدي في تعلم طلبة الجامعات الفلسطينية' }), version: 2, created_at: '2026-08-29T09:00:00.000Z' },
    ]);

    expect(result[0].id).toBe('active');
    expect(result[0].resume.lastStage).toBe('title');
    expect(result[0].resume.lastVersion).toBe(2);
    expect(result[0].resume.nextStage).toBe('problem');
    expect(result[0].resume.completedStages).toBe(2);
    expect(result[0].resume.lastOutputPreview).toContain('الذكاء الاصطناعي');
  });

  test('does not expose malformed saved content as a preview', () => {
    const [project] = buildDashboardProjects([projects[0]], [
      { project_id: 'old', type: 'journey:verify', content: '{not-json', version: 1, created_at: '2026-08-10T08:00:00.000Z' },
    ]);

    expect(project.resume.lastStage).toBe('verify');
    expect(project.resume.lastOutputPreview).toBeNull();
    expect(project.resume.nextStage).toBe('verify');
  });
});
