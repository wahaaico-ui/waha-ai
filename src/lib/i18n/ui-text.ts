import english from './en.json';
import systemMessageTemplates from './system-message-templates.json';

export type UiLanguage = 'ar' | 'en';

const catalog: Readonly<Record<string, string>> = english;
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const messagePatterns = systemMessageTemplates.map((template) => {
  const indices: number[] = [];
  const parts = template.split(/(\{\d+\})/g).map((part) => {
    const slot = /^\{(\d+)\}$/.exec(part);
    if (!slot) return escapePattern(part);
    indices.push(Number(slot[1]));
    return '(.+?)';
  });
  return { template, indices, pattern: new RegExp(`^${parts.join('')}$`, 'u') };
});

function systemLabel(value: string) {
  if (Object.hasOwn(catalog, value)) return catalog[value];
  const indexed = /^(.*) (\d+)$/.exec(value);
  return indexed && Object.hasOwn(catalog, indexed[1]) ? `${catalog[indexed[1]]} ${indexed[2]}` : value;
}

function translatedSystemMessage(message: string) {
  // Only known validation templates match; never translate arbitrary research prose.
  if (message.length > 2048) return null;
  for (const { template, indices, pattern } of messagePatterns) {
    const match = pattern.exec(message);
    if (!match || !Object.hasOwn(catalog, template)) continue;
    const values = new Map(indices.map((index, position) => [index, systemLabel(match[position + 1])]));
    return catalog[template].replace(/\{(\d+)\}/g, (token, index: string) => values.get(Number(index)) ?? token);
  }
  return null;
}

/** Only interface messages are passed here; research content stays unchanged. */
export function translateUiText(message: string, language: UiLanguage, values: readonly unknown[] = []) {
  const key = message.replace(/\s+/g, ' ').trim();
  const text = language === 'en' ? (Object.hasOwn(catalog, key) ? catalog[key] : translatedSystemMessage(key) ?? message) : message;
  return text.replace(/\{(\d+)\}/g, (token, index: string) => Number(index) < values.length ? String(values[Number(index)]) : token);
}

