import { buildDashboardProjects, latestDashboardDocuments, type DashboardJourneyDocument } from '@/lib/dashboard-resume';

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

  test('uses the highest stage version so dashboard and journey gate cannot disagree', () => {
    const validObjectives = {
      objectives: [
        'قياس أثر الذكاء الاصطناعي في تحصيل طلبة الجامعات الفلسطينية.',
        'تحليل اتجاهات طلبة الجامعات الفلسطينية نحو أدوات الذكاء الاصطناعي.',
      ],
    };
    const problem = {
      problemStatement: 'تتمثل المشكلة في غياب أدلة كافية حول أثر الذكاء الاصطناعي في تحصيل طلبة الجامعات الفلسطينية ضمن سياق أكاديمي محدد.',
      researchGap: 'لا توضح الدراسات المتاحة طبيعة هذا الأثر لدى طلبة الجامعات الفلسطينية ضمن السياق المحلي بصورة قابلة للفحص.',
      researcherNote: 'أهتم بهذا الموضوع لارتباطه المباشر بتطوير التعليم الجامعي الفلسطيني ورفع جودة تعلم الطلبة.',
    };
    const [project] = buildDashboardProjects([projects[1]], [
      { project_id: 'active', type: 'journey:verify', content: JSON.stringify(verified), version: 1, created_at: '2026-08-29T08:00:00.000Z' },
      { project_id: 'active', type: 'journey:title', content: JSON.stringify({ title: 'أثر الذكاء الاصطناعي التوليدي في تعلم طلبة الجامعات الفلسطينية' }), version: 1, created_at: '2026-08-29T09:00:00.000Z' },
      { project_id: 'active', type: 'journey:problem', content: JSON.stringify(problem), version: 1, created_at: '2026-08-29T10:00:00.000Z' },
      { project_id: 'active', type: 'journey:objectives', content: JSON.stringify(validObjectives), version: 2, created_at: '2026-08-29T11:00:00.000Z' },
      { project_id: 'active', type: 'journey:objectives', content: JSON.stringify({ objectives: ['هدف قديم'] }), version: 3, created_at: '2026-08-29T10:30:00.000Z' },
    ]);

    expect(project.resume.nextStage).toBe('objectives');
    expect(project.resume.lastStage).toBe('objectives');
    expect(project.resume.lastVersion).toBe(3);
    expect(project.resume.lastOutputPreview).toBe('هدف قديم');
  });
});

const save = (type: string, content: unknown, created_at = '2026-10-20T10:00:00Z', id = 'revision-a'): DashboardJourneyDocument => ({
  id, project_id: 'active', type, content: JSON.stringify(content), version: 1, created_at,
});
const review = { originalText: 'Original research text to be revised with the supervisor.', revisedText: 'Revised research text incorporating the supervisor comments.', notes: [] };

describe('resume the unified research workspace', () => {
  test('resumes the newest evidence writing without pretending workflow stages are complete', () => {
    const [project] = buildDashboardProjects(projects, [save('evidence-writing:v1', { text: 'My latest evidence-linked draft.', citations: [] })]);
    expect(project.id).toBe('active');
    expect(project.resume).toMatchObject({ activity: 'writing', lastStage: null, completedStages: 0, totalStages: 17,
      href: '/research/tasks?projectId=active&task=writing', lastOutputPreview: 'My latest evidence-linked draft.' });
  });

  test.each([
    ['journey:supervisor_review', review, 'supervisor', review.revisedText],
    ['journey:language_task', { operation: 'translate', text: 'Original input', output: 'Final translation', targetLanguage: 'en', status: 'completed' }, 'language', 'Final translation'],
    ['journey:language_task', { operation: 'proofread', text: 'Pending original input', output: '', targetLanguage: 'en', status: 'pending' }, 'language', 'Pending original input'],
  ])('opens saved %s in its workspace', (type, content, activity, preview) => {
    const [project] = buildDashboardProjects([projects[1]], [save(type, content)]);
    expect(project.resume.activity).toBe(activity);
    expect(project.resume.href).toBe(`/research/tasks?projectId=active&task=${activity}`);
    expect(project.resume.lastOutputPreview).toBe(preview);
  });

  test('selects task creation time instead of a misleading version number, with a stable ID tie-break', () => {
    const rows = [save('evidence-writing:v1', { text: 'newest', citations: [] }, undefined, 'z'),
      { ...save('evidence-writing:v1', { text: 'older', citations: [] }, '2026-10-19T10:00:00Z'), version: 500 },
      save('evidence-writing:v1', { text: 'tie', citations: [] }, undefined, 'a')];
    expect(buildDashboardProjects([projects[1]], rows)[0].resume.lastOutputPreview).toBe('newest');
    expect(buildDashboardProjects([projects[1]], [...rows].reverse())[0].resume.lastOutputPreview).toBe('newest');
  });

  test('does not preview an older valid manuscript when the newest save is unreadable', () => {
    const rows = [save('evidence-writing:v1', { text: 'old text', citations: [] }, '2026-10-19T10:00:00Z'),
      save('evidence-writing:v1', { arbitrary: 'not a valid draft' })];
    expect(buildDashboardProjects([projects[1]], rows)[0].resume).toMatchObject({ activity: 'writing', lastOutputPreview: null });
  });

  test('returns to an autosaved stage without counting it as an approved result', () => {
    const [project] = buildDashboardProjects([projects[1]], [], [{ project_id: 'active', stage: 'problem',
      content: { problemStatement: 'Saved problem draft in progress.' }, updated_at: '2026-10-20T11:00:00Z' }]);
    expect(project.resume).toMatchObject({ activity: 'draft', lastStage: 'problem', lastVersion: null,
      href: '/research/problem?projectId=active', completedStages: 0, nextStage: 'verify', lastOutputPreview: 'Saved problem draft in progress.' });
  });

  test('ignores leftover stale, malformed, unknown and foreign drafts', () => {
    const documents = [save('journey:title', { title: 'A sufficiently descriptive research title for this project' })];
    const [project] = buildDashboardProjects([projects[1]], documents, [
      { project_id: 'active', stage: 'title', content: { title: 'stale text' }, updated_at: '2026-10-19T11:00:00Z' },
      { project_id: 'active', stage: 'problem', content: [], updated_at: '2026-10-20T11:00:00Z' },
      { project_id: 'active', stage: 'javascript:alert(1)', content: {}, updated_at: '2026-10-20T12:00:00Z' },
      { project_id: 'foreign', stage: 'problem', content: {}, updated_at: '2026-10-20T13:00:00Z' },
      { project_id: 'active', stage: 'problem', content: {}, updated_at: 'invalid date' },
    ]);
    expect(project.resume.activity).toBe('journey');
    expect(project.resume.lastOutputPreview).not.toBe('stale text');
  });

  test('orders projects by their latest saved work and excludes other projects and internal documents', () => {
    const oldWriting = { ...save('evidence-writing:v1', { text: 'Recent work in the old project.', citations: [] }), project_id: 'old' };
    const documents = [oldWriting, save('journey:decision', { private: 'internal gate' }, '2099-01-01T00:00:00Z'),
      { ...save('evidence-writing:v1', { text: 'Foreign project text.', citations: [] }, '2099-01-01T00:00:00Z'), project_id: 'foreign' }];
    const result = buildDashboardProjects(projects, documents);
    expect(result[0].id).toBe('old');
    expect(JSON.stringify(result)).not.toMatch(/Foreign project text|internal gate/);
  });

  test('encodes project identifiers into an internal path and limits previews', () => {
    const id = 'project/&task=javascript:alert(1)';
    const [project] = buildDashboardProjects([{ ...projects[1], id }], [
      { ...save('evidence-writing:v1', { text: '<script>alert(1)</script> ' + 'text '.repeat(100), citations: [] }), project_id: id },
    ]);
    expect(project.resume.href).toBe(`/research/tasks?projectId=${encodeURIComponent(id)}&task=writing`);
    expect(project.resume.lastOutputPreview!.length).toBeLessThanOrEqual(160);
    expect(project.resume.lastOutputPreview).toContain('<script>'); // React renders plain text, never HTML.
  });

  test('opens an empty project directly in the writing workspace', () => {
    expect(buildDashboardProjects([projects[1]], [])[0].resume).toMatchObject({ activity: 'writing', href: '/research/tasks?projectId=active&task=writing', totalStages: 17 });
  });

  test('uses the identical canonical stage version for metadata and full documents', () => {
    const rows = [save('journey:title', { title: 'new' }, '2026-10-20T10:00:00Z'),
      { ...save('journey:title', { title: 'highest version' }, '2026-10-19T10:00:00Z', 'b'), version: 3 }];
    expect(latestDashboardDocuments(rows).map(row => row.id)).toEqual(['b']);
    expect(buildDashboardProjects([projects[1]], rows)[0].resume.lastOutputPreview).toBe('highest version');
  });
});
