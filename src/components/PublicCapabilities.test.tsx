import { renderToStaticMarkup } from 'react-dom/server';
import PublicCapabilities from './PublicCapabilities';
import TaskStart from './TaskStart';
import { researchEntryTasks } from '@/lib/research-entry-tasks';
import { translateUiText } from '@/lib/i18n/ui-text';

let mockLanguage: 'ar' | 'en' = 'ar';
let mockUser: { id: string } | null = null;
jest.mock('@/lib/use-ui-translation', () => ({
  useUiTranslation: () => ({ language: mockLanguage, direction: mockLanguage === 'ar' ? 'rtl' : 'ltr', text: (value: string) => translateUiText(value, mockLanguage) }),
}));
jest.mock('@/components/AuthSessionProvider', () => ({ useAuthSession: () => ({ user: mockUser, isAuthenticated: Boolean(mockUser), authResolved: true }) }));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  // Exercise the browser snapshot without starting a browser or contacting a service.
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
afterEach(() => {
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage);
  else Reflect.deleteProperty(globalThis, 'sessionStorage');
  mockLanguage = 'ar';
  mockUser = null;
});

test.each(['ar', 'en'] as const)('capability links describe and open the same task in %s', (language) => {
  mockLanguage = language;
  const html = renderToStaticMarkup(<PublicCapabilities />);
  for (const [key, task] of Object.entries(researchEntryTasks)) {
    expect(html).toContain(`href="/?task=${key}#start"`);
    expect(html).toContain(translateUiText(task.label, language));
    expect(html).toContain(translateUiText(task.action, language));
  }
  expect(html).toContain('href="/verify-idea"');
  expect(html).toContain('href="/tools/sample-size"');
  if (language === 'en') expect(html).not.toMatch(/[\u0600-\u06ff]/);
});

test.each(Object.entries(researchEntryTasks))('a direct %s link selects that task and its input', (key, task) => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: `?task=${key}` } } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null } });
  const html = renderToStaticMarkup(<TaskStart />);
  const selected = html.match(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?<\/button>/)?.[0];
  expect(selected).toContain(task.label);
  expect(html).toContain(task.input);
  expect(html).toContain(task.placeholder);
});

test('an unrelated saved text is not placed in a newly selected reference search', () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '?task=sources' } } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => JSON.stringify({ task: 'language', request: 'A saved paragraph for a different task.' }) } });
  const html = renderToStaticMarkup(<TaskStart />);
  expect(html).not.toContain('A saved paragraph for a different task.');
  expect(html).toContain('موضوع البحث');
});

test('an unknown task falls back to the entry flow and is never rendered as HTML', () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '?task=%3Cscript%3Eunsafe%3C%2Fscript%3E' } } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null } });
  const html = renderToStaticMarkup(<TaskStart />);
  expect(html).toContain('نص تبدأ منه (اختياري)');
  expect(html).not.toContain('unsafe');
});

test('a signed-in researcher restores the failed entry after returning to home', () => {
  mockUser = { id: 'owner' };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '' } } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => key === 'waha_task_entry_draft:owner' ? JSON.stringify({ task: 'writing', request: 'The original entry remains available after a lost response.', projectId: '56cca03a-078a-4d81-b19a-8547664136d8' }) : null } });
  const html = renderToStaticMarkup(<TaskStart />);
  expect(html).toContain('The original entry remains available after a lost response.');
});

test('another account and signed-out visitors cannot restore a researcher entry', () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '' } } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => key === 'waha_task_entry_draft:owner' ? JSON.stringify({ task: 'writing', request: 'Private entry belonging to the first account.' }) : null } });
  mockUser = { id: 'another-account' };
  expect(renderToStaticMarkup(<TaskStart />)).not.toContain('Private entry belonging to the first account.');
  mockUser = null;
  expect(renderToStaticMarkup(<TaskStart />)).not.toContain('Private entry belonging to the first account.');
});
