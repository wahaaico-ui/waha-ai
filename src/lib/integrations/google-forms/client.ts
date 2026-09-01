import type { Questionnaire, QuestionnaireField, QuestionnaireItem } from '@/lib/google-forms-export';

const GOOGLE_FORMS_API = 'https://forms.googleapis.com/v1';
const MAX_SECTIONS = 20;
const MAX_ITEMS = 200;

type GoogleFormResult = {
  formId: string;
  editUrl: string;
  responderUri: string | null;
};

type GoogleCreateRequest = Record<string, unknown>;

const cleanText = (value: unknown, maxLength: number) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

function stringOptions(value: unknown) {
  return Array.isArray(value) ? value.map((option) => cleanText(option, 200)).filter(Boolean).slice(0, 50) : [];
}

function parseItem(value: unknown): QuestionnaireItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const kinds = new Set(['likert5', 'single_choice', 'multiple_choice', 'short_text', 'long_text']);
  const kind = typeof item.kind === 'string' && kinds.has(item.kind) ? item.kind as QuestionnaireItem['kind'] : null;
  const text = cleanText(item.text, 500);
  if (!kind || !text) return null;
  const options = kind === 'likert5' ? [] : stringOptions(item.options);
  if ((kind === 'single_choice' || kind === 'multiple_choice') && options.length < 2) return null;
  return { text, kind, required: item.required !== false, options };
}

function parseField(value: unknown): QuestionnaireField | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const field = value as Record<string, unknown>;
  const kind = field.kind === 'single_choice' ? 'single_choice' : field.kind === 'short_text' ? 'short_text' : null;
  const label = cleanText(field.label, 300);
  if (!kind || !label) return null;
  const options = kind === 'single_choice' ? stringOptions(field.options) : [];
  if (kind === 'single_choice' && options.length < 2) return null;
  return { label, kind, required: field.required !== false, options };
}

export function parseStoredQuestionnaire(content: unknown): Questionnaire | null {
  let parsed = content;
  if (typeof content === 'string') {
    try { parsed = JSON.parse(content); } catch { return null; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  const sections = Array.isArray(value.sections) ? value.sections.slice(0, MAX_SECTIONS).flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const section = entry as Record<string, unknown>;
    const title = cleanText(section.title, 300);
    const variableName = cleanText(section.variableName, 300);
    const items = Array.isArray(section.items) ? section.items.map(parseItem).filter((item): item is QuestionnaireItem => Boolean(item)) : [];
    if (!title || !variableName || items.length < 1) return [];
    return [{ title, variableName, description: cleanText(section.description, 1_000), items }];
  }) : [];
  const totalItems = sections.reduce((sum, section) => sum + section.items.length, 0);
  const questionnaire: Questionnaire = {
    title: cleanText(value.title, 300),
    description: cleanText(value.description, 5_000),
    consentStatement: cleanText(value.consentStatement, 5_000),
    instructions: cleanText(value.instructions, 5_000),
    respondentFields: Array.isArray(value.respondentFields)
      ? value.respondentFields.map(parseField).filter((field): field is QuestionnaireField => Boolean(field)).slice(0, 30)
      : [],
    sections,
  };
  if (!questionnaire.title || !questionnaire.consentStatement || !questionnaire.instructions || sections.length < 1 || totalItems > MAX_ITEMS) return null;
  return questionnaire;
}

function choiceQuestion(item: QuestionnaireItem | QuestionnaireField) {
  const options = item.kind === 'likert5'
    ? ['لا أوافق بشدة', 'لا أوافق', 'محايد', 'أوافق', 'أوافق بشدة']
    : item.options;
  return {
    choiceQuestion: {
      type: item.kind === 'multiple_choice' ? 'CHECKBOX' : 'RADIO',
      options: options.map((option) => ({ value: option })),
      shuffle: false,
    },
  };
}

function questionPayload(item: QuestionnaireItem) {
  if (item.kind === 'likert5') {
    return { scaleQuestion: { low: 1, high: 5, lowLabel: 'لا أوافق بشدة', highLabel: 'أوافق بشدة' } };
  }
  if (item.kind === 'single_choice' || item.kind === 'multiple_choice') return choiceQuestion(item);
  return { textQuestion: { paragraph: item.kind === 'long_text' } };
}

function createItem(item: Record<string, unknown>, index: number): GoogleCreateRequest {
  return { createItem: { item, location: { index } } };
}

export function buildGoogleFormsRequests(questionnaire: Questionnaire): GoogleCreateRequest[] {
  const requests: GoogleCreateRequest[] = [{
    updateFormInfo: {
      info: { description: [questionnaire.description, questionnaire.instructions].filter(Boolean).join('\n\n') },
      updateMask: 'description',
    },
  }];
  let index = 0;
  requests.push(createItem({
    title: 'الموافقة على المشاركة',
    description: questionnaire.consentStatement,
    textItem: {},
  }, index++));
  requests.push(createItem({
    title: 'هل توافق على المشاركة بعد قراءة المعلومات أعلاه؟',
    questionItem: { question: { required: true, ...choiceQuestion({ kind: 'single_choice', options: ['نعم، أوافق', 'لا، لا أوافق'], required: true, label: '' }) } },
  }, index++));
  for (const field of questionnaire.respondentFields) {
    const payload = field.kind === 'single_choice' ? choiceQuestion(field) : { textQuestion: { paragraph: false } };
    requests.push(createItem({ title: field.label, questionItem: { question: { required: field.required, ...payload } } }, index++));
  }
  questionnaire.sections.forEach((section, sectionIndex) => {
    requests.push(createItem({
      title: `${sectionIndex + 1}. ${section.title}`,
      description: section.description,
      pageBreakItem: {},
    }, index++));
    for (const item of section.items) {
      requests.push(createItem({
        title: item.text,
        questionItem: { question: { required: item.required, ...questionPayload(item) } },
      }, index++));
    }
  });
  return requests;
}

async function googleFormsRequest(url: string, accessToken: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Google Forms API request failed (${response.status})`);
  return payload;
}

export async function createGoogleForm(questionnaire: Questionnaire, accessToken: string): Promise<GoogleFormResult> {
  const created = await googleFormsRequest(`${GOOGLE_FORMS_API}/forms`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ info: { title: questionnaire.title, documentTitle: questionnaire.title } }),
  });
  if (!created || typeof created !== 'object' || Array.isArray(created) || typeof (created as Record<string, unknown>).formId !== 'string') {
    throw new Error('Google Forms API did not return a form ID');
  }
  const formId = (created as Record<string, unknown>).formId as string;
  await googleFormsRequest(`${GOOGLE_FORMS_API}/forms/${encodeURIComponent(formId)}:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ requests: buildGoogleFormsRequests(questionnaire) }),
  });
  const form = await googleFormsRequest(`${GOOGLE_FORMS_API}/forms/${encodeURIComponent(formId)}`, accessToken, { method: 'GET' });
  const responderUri = form && typeof form === 'object' && !Array.isArray(form) && typeof (form as Record<string, unknown>).responderUri === 'string'
    ? (form as Record<string, unknown>).responderUri as string
    : null;
  return { formId, editUrl: `https://docs.google.com/forms/d/${encodeURIComponent(formId)}/edit`, responderUri };
}
