import { buildGoogleFormsRequests, createGoogleForm, parseStoredQuestionnaire } from '@/lib/integrations/google-forms/client';
import type { Questionnaire } from '@/lib/google-forms-export';

const questionnaire: Questionnaire = {
  title: 'استبانة جودة التعلم الرقمي',
  description: 'تقيس الاستبانة خبرة الطلبة في التعلم الرقمي.',
  consentStatement: 'المشاركة طوعية ويمكن الانسحاب في أي وقت وتستخدم الإجابات لأغراض البحث فقط.',
  instructions: 'اقرأ كل عبارة ثم اختر الإجابة التي تمثل تجربتك بدقة ووضوح.',
  respondentFields: [{ label: 'المرحلة الدراسية', kind: 'single_choice', required: true, options: ['ماجستير', 'دكتوراه'] }],
  sections: [{
    title: 'جودة التعلم',
    variableName: 'جودة التعلم',
    description: 'بنود قياس جودة التعلم',
    items: [
      { text: 'أفهم المفاهيم الأكاديمية بوضوح.', kind: 'likert5', required: true, options: [] },
      { text: 'ما التحسين الذي تقترحه للتجربة؟', kind: 'long_text', required: false, options: [] },
    ],
  }],
};

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('Google Forms API client', () => {
  test('normalizes a stored questionnaire and rejects malformed choices', () => {
    expect(parseStoredQuestionnaire(JSON.stringify(questionnaire))?.title).toBe(questionnaire.title);
    const malformed = structuredClone(questionnaire);
    malformed.sections[0].items[0] = { text: 'اختر الإجابة المناسبة لهذا البند.', kind: 'single_choice', required: true, options: ['وحيد'] };
    expect(parseStoredQuestionnaire(malformed)?.sections[0].items).toHaveLength(1);
  });

  test('builds consent, section and supported question requests', () => {
    const requests = buildGoogleFormsRequests(questionnaire);
    expect(requests[0]).toHaveProperty('updateFormInfo');
    expect(JSON.stringify(requests)).toContain('الموافقة على المشاركة');
    expect(JSON.stringify(requests)).toContain('scaleQuestion');
    expect(JSON.stringify(requests)).toContain('pageBreakItem');
  });

  test('creates and populates a form without exposing the token in request bodies', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: 'form_1234567890' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ replies: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: 'form_1234567890', responderUri: 'https://docs.google.com/forms/d/e/public/viewform' }), { status: 200 }));
    global.fetch = fetchMock;

    const result = await createGoogleForm(questionnaire, 'private-access-token');

    expect(result.formId).toBe('form_1234567890');
    expect(result.responderUri).toContain('docs.google.com');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      const headers = new Headers(init.headers);
      expect(headers.get('authorization')).toBe('Bearer private-access-token');
      expect(String(init.body || '')).not.toContain('private-access-token');
    }
  });

  test('stops when Google rejects form creation', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'denied' } }), { status: 403 }));
    await expect(createGoogleForm(questionnaire, 'token')).rejects.toThrow('Google Forms API request failed (403)');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
