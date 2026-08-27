import type { CitationItem, CitationStyle } from './types';

const noDate = 'n.d.';
const clean = (value: string | null | undefined) => value?.trim().replace(/\s+/g, ' ') || '';
const doiUrl = (doi: string | null) => doi ? `https://doi.org/${doi}` : '';
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part, index, values) => index === values.length - 1 ? part : `${part[0]?.toUpperCase()}.`).join(' ');
const surname = (name: string) => name.trim().split(/\s+/).pop() || name;

function apaAuthors(authors: string[]) {
  const values = authors.slice(0, 20).map((author) => initials(author));
  if (!values.length) return 'Unknown author';
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')}, & ${values.at(-1)}`;
}

function inTextAuthors(item: CitationItem) {
  if (!item.authors.length) return 'Unknown author';
  if (item.authors.length === 1) return surname(item.authors[0]);
  if (item.authors.length === 2) return `${surname(item.authors[0])} & ${surname(item.authors[1])}`;
  return `${surname(item.authors[0])} et al.`;
}

export class CitationFormatter {
  static bibliography(item: CitationItem, style: CitationStyle, number = 1) {
    const title = clean(item.title);
    const journal = clean(item.journal);
    const publisher = clean(item.publisher);
    const year = item.year || noDate;
    const details = [item.volume, item.issue ? `(${item.issue})` : '', item.pages].filter(Boolean).join(', ');
    const link = doiUrl(item.doi) || clean(item.url);
    if (style === 'apa-7') return `${apaAuthors(item.authors)}. (${year}). ${title}.${journal ? ` ${journal}${details ? `, ${details}` : ''}.` : publisher ? ` ${publisher}.` : ''}${link ? ` ${link}` : ''}`.replace(/\s+/g, ' ').trim();
    if (style === 'ieee') return `[${number}] ${item.authors.map(initials).join(', ') || 'Unknown author'}, “${title},”${journal ? ` ${journal},` : ''}${details ? ` ${details},` : ''} ${year}.${link ? ` ${link}` : ''}`.replace(/\s+/g, ' ').trim();
    if (style === 'vancouver') return `${number}. ${item.authors.map((author) => initials(author)).join(', ') || 'Unknown author'}. ${title}. ${journal || publisher}.${item.year ? ` ${item.year}` : ''}${details ? `;${details}` : ''}.${link ? ` ${link}` : ''}`.replace(/\s+/g, ' ').trim();
    if (style === 'harvard') return `${item.authors.map(surname).join(', ') || 'Unknown author'} (${year}) ‘${title}’, ${journal || publisher || 'n.p.'}${details ? `, ${details}` : ''}.${link ? ` Available at: ${link}` : ''}`.replace(/\s+/g, ' ').trim();
    if (style === 'chicago') return `${item.authors.map((author) => initials(author)).join(', ') || 'Unknown author'}. “${title}.” ${journal || publisher || ''}${details ? ` ${details}` : ''} (${year}).${link ? ` ${link}` : ''}`.replace(/\s+/g, ' ').trim();
    return `${item.authors.map((author) => initials(author)).join(', ') || 'Unknown author'}. “${title}.” ${journal || publisher || ''}, ${year}${details ? `, ${details}` : ''}.${link ? ` ${link}` : ''}`.replace(/\s+/g, ' ').trim();
  }

  static inText(item: CitationItem, style: CitationStyle, number = 1, locator?: string | null) {
    if (style === 'ieee' || style === 'vancouver') return `[${number}]`;
    const location = locator?.trim() ? `, ${locator.trim()}` : '';
    if (style === 'mla') return `(${inTextAuthors(item)}${location})`;
    return `(${inTextAuthors(item)}, ${item.year || noDate}${location})`;
  }
}
